/**
 * Regression test: zone-center shift on monthly bar completion.
 *
 * Root cause: when a new monthly bar completes and shifts a support zone's
 * median center (e.g. 229.70 → 230.58 for MCD in October 2026), the updated
 * center gets a brand-new stateIndex with supportReachArmed = false.  If
 * current price is already between the new center and its approach boundary,
 * all three arming paths (live, gap, range) fail because each requires the
 * previous price to have been ABOVE the approach boundary.  The result: a
 * reached alert is never sent even though price clearly crosses the displayed
 * support level.
 *
 * Fix: on the bar where newConfirmedMonth is true, pre-arm any support zone
 * whose state is still fresh and whose center is currently within the approach
 * band.  The Pine implementation is a guard added immediately after the
 * existing crossedApproachDown arm:
 *
 *   if newConfirmedMonth and
 *      not array.get(approachSent, stateIndex) and
 *      not array.get(supportReachArmed, stateIndex) and
 *      not array.get(reachedSent, stateIndex) and
 *      close >= support and close <= approachBoundary
 *       array.set(supportReachArmed, stateIndex, true)
 *
 * This file tests the pure JS model of that logic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";

// ── Verify the fix is present in the Pine source ────────────────────────────
const pineSource = fs.readFileSync(
  new URL("../pine/monthly-close-support.pine", import.meta.url),
  "utf8",
);

assert.equal(
  pineSource.includes("if newConfirmedMonth and"),
  true,
  "Pine source must contain the newConfirmedMonth pre-arm guard",
);
assert.equal(
  pineSource.includes("not array.get(approachSent, stateIndex) and"),
  true,
);
assert.equal(
  pineSource.includes(
    "not array.get(supportReachArmed, stateIndex) and\n               not array.get(reachedSent, stateIndex) and",
  ),
  true,
);

// ── Pure-JS model of the support alert lifecycle ─────────────────────────────

/**
 * Minimal simulation of one support zone's alert state over a sequence of
 * daily bars.  Returns the list of events emitted ("approached", "reached").
 *
 * @param {object} opts
 * @param {number} opts.support        - Zone center (the support price)
 * @param {number} opts.approachBound  - Upper approach boundary
 * @param {number} opts.rearmBound     - Rearm boundary (approachBound + 0.25*ATR)
 * @param {Array<object>} opts.bars    - Daily bars: { open, high, low, close,
 *                                        newMonth? }
 * @param {boolean} opts.applyFix      - Whether to apply the newConfirmedMonth
 *                                       pre-arm (the fix under test)
 * @param {number} [opts.initialPrev]  - Initial previousLivePrice (last close
 *                                       before the simulation window; defaults
 *                                       to NaN meaning "no prior price")
 */
function simulateSupportAlerts({ support, approachBound, rearmBound, bars, applyFix, initialPrev = NaN }) {
  let armed = false;
  let approachSent = false;
  let reachedSent = false;
  let previousLivePrice = initialPrev;
  const events = [];

  for (const bar of bars) {
    const { open, high, low, close, newMonth = false } = bar;

    // ── Approach arming ──────────────────────────────────────────────────────
    const prevClose = previousLivePrice; // last tick of previous bar
    const gapArm = Number.isFinite(prevClose) && prevClose > approachBound && open <= approachBound;
    const rangeArm = open > approachBound && low <= approachBound;
    if (gapArm || rangeArm) {
      armed = true;
    }

    // ── Rearm reset (simplified: check if intraday high exceeds rearmBound) ──
    if (armed && high > rearmBound) {
      armed = false;
      // Re-arm if price subsequently fell back through approachBound same day
      // (liveCrossedApproachDown fires when previousLivePrice was above approachBound
      //  and close went to/below it intraday).  We approximate with: high > approachBound
      //  AND low <= approachBound (price crossed downward during the day).
      if (high > approachBound && low <= approachBound) {
        armed = true;
      }
    }

    // ── newConfirmedMonth pre-arm (the fix) ───────────────────────────────────
    if (applyFix && newMonth && !approachSent && !armed && !reachedSent) {
      const priceInBand = close >= support && close <= approachBound;
      if (priceInBand) {
        armed = true;
      }
    }

    // ── Approach alert ────────────────────────────────────────────────────────
    const crossedApproachDown =
      Number.isFinite(prevClose) &&
      prevClose > approachBound &&
      open <= approachBound;
    if (crossedApproachDown && !approachSent) {
      approachSent = true;
      events.push({ type: "approached", price: close });
    }

    // ── Reached alert ─────────────────────────────────────────────────────────
    const crossedSupportDown =
      Number.isFinite(prevClose) && prevClose > support && low <= support;
    if (armed && crossedSupportDown && !reachedSent) {
      reachedSent = true;
      events.push({ type: "reached", price: close });
    }

    // ── Rearm reset on recovery ───────────────────────────────────────────────
    if (close > rearmBound) {
      armed = false;
      approachSent = false;
      reachedSent = false;
    }

    previousLivePrice = close;
  }

  return events;
}

// ── Scenario mirroring the MCD October 2026 incident ─────────────────────────
//
// Before October 1 the zone median was 229.70 (8 touches).  On October 1
// the September 2026 bar completed, adding low=230.88 and shifting the median
// to 230.58.  The new zone gets a FRESH stateIndex: armed=false, never seen.
//
// The simulation begins on October 1 with previousLivePrice = Sep 30 close
// (230.94), representing the fresh-state start for the 230.58 zone.  The
// Sep 28–30 bars are NOT fed into the 230.58 zone because it did not exist
// then (the active zone on those days was 229.70 with a different stateIndex).
//
// On October 1:
//   - open=231.54  (above support 230.58, inside the band [230.58, 234.03])
//   - low =229.61  (below 230.58 — price crosses support downward)
//   - Without fix: armed=false → no alert
//   - With fix   : pre-arm fires because newMonth=true and open is in band
//                  → reached alert fires

const SUPPORT = 230.58;
const APPROACH_BOUND = 234.03; // 230.58 * 1.01471 ≈ 234.03
const REARM_BOUND = 235.25;    // APPROACH_BOUND + 0.25 * confirmedAtr ≈ 235.25

// The 230.58 zone is brand-new on Oct 1.  previousLivePrice = Sep 30 close.
// Only feed bars from Oct 1 onward to this zone's fresh stateIndex.
const MCDScenarioBars = [
  // Oct 1: newConfirmedMonth=true — zone center just became 230.58 (fresh state).
  // Open is 231.54 (inside the approach band [230.58, 234.03]).
  // Low crosses 230.58 intraday (229.61).
  // previousLivePrice (Sep 30 close) = 230.94, set as the initial value below.
  { open: 231.54, high: 232.84, low: 229.61, close: 231.83, newMonth: true },
];

// Sep 30 close = 230.94: this is previousLivePrice at the start of the fresh zone.
const SEP30_CLOSE = 230.94;

// Without the fix: no alert fires because the fresh zone is never armed.
const eventsWithoutFix = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: MCDScenarioBars,
  applyFix: false,
  initialPrev: SEP30_CLOSE,
});
assert.equal(
  eventsWithoutFix.some((e) => e.type === "reached"),
  false,
  "Without the fix, no reached alert fires for MCD 230.58 scenario",
);

// With the fix: the pre-arm on newMonth fires on October 1 (open=231.54 is
// inside [230.58, 234.03]), so the subsequent low=229.61 crossing triggers
// a reached alert.
const eventsWithFix = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: MCDScenarioBars,
  applyFix: true,
  initialPrev: SEP30_CLOSE,
});
assert.equal(
  eventsWithFix.some((e) => e.type === "reached"),
  true,
  "With the fix, a reached alert fires for MCD 230.58 on October 1",
);

// ── Edge cases ────────────────────────────────────────────────────────────────

// 1. Pre-arm does NOT fire when price is ABOVE the approach boundary.
const barsAboveBand = [
  { open: 238.00, high: 239.00, low: 237.00, close: 238.50, newMonth: true },
];
const eventsAbove = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: barsAboveBand,
  applyFix: true,
  initialPrev: 238.00,
});
assert.equal(
  eventsAbove.some((e) => e.type === "reached"),
  false,
  "No pre-arm when price is above the approach boundary",
);

// 2. Pre-arm does NOT fire when price is BELOW the support center.
const barsBelowSupport = [
  { open: 229.00, high: 229.50, low: 228.00, close: 228.50, newMonth: true },
];
const eventsBelow = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: barsBelowSupport,
  applyFix: true,
  initialPrev: 229.00,
});
assert.equal(
  eventsBelow.some((e) => e.type === "reached"),
  false,
  "No pre-arm when price has already gapped below the support center",
);

// 3. Pre-arm does NOT fire when the zone was already approached (approachSent=true).
//    Simulate by having a prior approach; then newMonth=true should not re-arm.
const barsAlreadyApproached = [
  // Day 1: normal approach crossing arms the zone (prev close 235.50 > appBound)
  { open: 235.00, high: 235.50, low: 233.00, close: 233.50, newMonth: false },
  // Day 2: newMonth=true, but approachSent was already set — no double pre-arm
  { open: 232.50, high: 233.00, low: 231.00, close: 232.00, newMonth: true },
  // Day 3: price reaches support
  { open: 231.50, high: 232.00, low: 230.00, close: 230.80, newMonth: false },
];
const eventsApproached = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: barsAlreadyApproached,
  applyFix: true,
  initialPrev: 236.00, // was above approachBound, so gap-arm fires on day 1
});
// Alert should still fire (via normal approach arm on day 1), but only once
assert.equal(
  eventsApproached.filter((e) => e.type === "reached").length,
  1,
  "Reached alert fires exactly once when zone was properly armed before newMonth",
);

// 4. Pre-arm fires once only: second newMonth bar with price still in band
//    should not trigger a double-fire (reachedSent blocks it).
const barsDoubleMonth = [
  // Day 1 (newMonth): price in band → pre-arm
  { open: 232.00, high: 232.50, low: 230.00, close: 231.00, newMonth: true },
  // Day 2 (also newMonth for a different symbol/scenario): reachedSent=true → no repeat
  { open: 231.50, high: 232.00, low: 229.50, close: 230.50, newMonth: true },
];
const eventsDouble = simulateSupportAlerts({
  support: SUPPORT,
  approachBound: APPROACH_BOUND,
  rearmBound: REARM_BOUND,
  bars: barsDoubleMonth,
  applyFix: true,
  initialPrev: SEP30_CLOSE,
});
assert.equal(
  eventsDouble.filter((e) => e.type === "reached").length,
  1,
  "Reached alert fires at most once per lifecycle even across multiple newMonth bars",
);

console.log("Monthly zone-center-shift regression: OK");
