/**
 * Regression test: stale resistance latch blocks support approach alert.
 *
 * Root cause: when a zone with ≥4 touches was approached from BELOW during a
 * prior decline, f_latchResistance fires.  The only existing unlatch path is
 * `close < approachBoundary − 0.25 × ATR` (price retreats far below the zone).
 * If price subsequently recovers well above the zone and never revisits that
 * rearm floor, the latch persists indefinitely.  The zone then sits in
 * resistanceZones (invisible, since it is below current price) instead of
 * supportZones, so support approach and reached alerts cannot fire.
 *
 * Concrete case — BAC March–October 2026:
 *   zone 48.875 (5 lows) latched 2026-03-31 (BAC crossed ~47.93 going up),
 *   BAC recovered to 63+, never dropped below ~47.6 rearm floor.
 *   On 2026-10-14 (BAC open 49.83, low 49.26) the zone was still in
 *   resistanceZones; approach alert could not fire.
 *
 * Fix: add a symmetric UPWARD rearm in the resistance alert loop.
 * When `close > resistance + rearmDistance`, unlatch and reset all resistance
 * cycle flags — mirroring the support rearm at `close > approachBound + rearmDist`.
 *
 * Pine implementation added immediately after the existing downward rearm:
 *
 *   if f_isLatchedResistance(resistance) and close > resistance + rearmDistance
 *       array.set(resistanceReachedSent, stateIndex, false)
 *       ...
 *       f_unlatchResistance(resistance)
 */

import assert from "node:assert/strict";
import fs from "node:fs";

// ── Verify the fix is present in the Pine source ────────────────────────────
const pineSource = fs.readFileSync(
  new URL("../pine/monthly-close-support.pine", import.meta.url),
  "utf8",
);

assert.equal(
  pineSource.includes(
    "if f_isLatchedResistance(resistance) and close > resistance + rearmDistance",
  ),
  true,
  "Pine source must contain the upward resistance rearm",
);

// ── Pure-JS model of the resistance latch lifecycle ──────────────────────────

/**
 * Simulate whether a resistance latch for `resistanceCenter` persists through
 * a sequence of daily closes.
 *
 * @param {object} opts
 * @param {number} opts.resistanceCenter
 * @param {number} opts.resistanceLow        - lower approach boundary (center*(1−appPct/100))
 * @param {number} opts.rearmBound           - downward rearm (resistanceLow − 0.25*atr)
 * @param {number} opts.rearmDist            - upward rearm distance (0.25*atr)
 * @param {Array<{close: number, prevClose: number}>} opts.bars
 * @param {boolean} opts.applyFix            - apply the upward rearm fix
 * @returns {{ latched: boolean, bars: Array<string> }}
 */
function simulateResistanceLatch({ resistanceCenter, resistanceLow, rearmBound, rearmDist, bars, applyFix }) {
  let latched = false;
  const events = [];

  for (const { close, prevClose } of bars) {
    // Downward crossing of resistanceLow from below → latch
    if (Number.isFinite(prevClose) && prevClose < resistanceLow && close >= resistanceLow) {
      latched = true;
      events.push(`LATCH (close=${close})`);
    }
    // Downward rearm: close retreats far below the lower boundary
    if (latched && close < rearmBound) {
      latched = false;
      events.push(`REARM_DOWN (close=${close})`);
    }
    // Upward rearm (the fix): price rises well above the zone center
    if (applyFix && latched && close > resistanceCenter + rearmDist) {
      latched = false;
      events.push(`REARM_UP (close=${close})`);
    }
  }

  return { latched, events };
}

// ── Scenario: BAC March-October 2026 ────────────────────────────────────────
// Zone 48.875 with 5 touches.
// Key dates from the daily data:
//   2026-03-09 close=47.90 (prevClose=49.81, below resistanceLow≈48.06 → no latch yet)
//   2026-03-10 close=48.56 (prevClose=47.90) → latch fires (47.90<48.06, 48.56>=48.06)
//   2026-03-12 close=47.10 → rearm_down (47.10<47.66) → unlatched
//   2026-03-24 close=48.14 (prevClose=47.52) → latch fires again
//   2026-03-27 close=46.97 → rearm_down → unlatched
//   2026-03-31 close=48.75 (prevClose=47.23) → latch fires (47.23<47.93, 48.75>=47.93)
//   April 2026+: BAC rises to 53+, never below ~47.6 → latch persists (BUG without fix)

const R = 48.875;
const rLow = 47.926;    // resistance approach boundary on 2026-03-31
const rDown = 47.608;   // downward rearm boundary
const rDist = 0.269;    // 0.25 * confirmedAtr

// Simplified bar sequence: just enough to reproduce the bug
const BACBars = [
  { prevClose: 49.81, close: 47.90 },  // Mar 09: falls below zone
  { prevClose: 47.90, close: 48.56 },  // Mar 10: LATCH
  { prevClose: 48.56, close: 48.52 },  // Mar 11: stays latched
  { prevClose: 48.52, close: 47.10 },  // Mar 12: REARM_DOWN
  { prevClose: 47.10, close: 46.72 },  // Mar 13-23 (represented as 3 bars)
  { prevClose: 46.72, close: 47.52 },
  { prevClose: 47.52, close: 48.14 },  // Mar 24: LATCH again
  { prevClose: 48.14, close: 48.75 },  // Mar 25
  { prevClose: 48.75, close: 48.24 },  // Mar 26
  { prevClose: 48.24, close: 46.97 },  // Mar 27: REARM_DOWN
  { prevClose: 46.97, close: 47.23 },  // Mar 30
  { prevClose: 47.23, close: 48.75 },  // Mar 31: LATCH (final)
  { prevClose: 48.75, close: 49.27 },  // Apr 01: above center, but < center+rearmDist
  { prevClose: 49.27, close: 53.46 },  // Apr (recovery): close > 48.875 + 0.269 = 49.144
  { prevClose: 53.46, close: 56.98 },  // Jun
  { prevClose: 56.98, close: 61.95 },  // Jul
  { prevClose: 61.95, close: 54.43 },  // Sep: BAC falls back but stays above rearmDist
  { prevClose: 54.43, close: 51.39 },  // Oct 14: today, close = 51.39
];

// WITHOUT fix: latch persists from Mar 31 — zone is stuck as resistance
const resultWithoutFix = simulateResistanceLatch({
  resistanceCenter: R, resistanceLow: rLow, rearmBound: rDown, rearmDist: rDist,
  bars: BACBars, applyFix: false,
});
assert.equal(
  resultWithoutFix.latched,
  true,
  "Without fix: resistance latch persists from March 2026 to October 2026",
);

// WITH fix: latch clears in April when BAC close (53.46) > R + rearmDist (49.144)
const resultWithFix = simulateResistanceLatch({
  resistanceCenter: R, resistanceLow: rLow, rearmBound: rDown, rearmDist: rDist,
  bars: BACBars, applyFix: true,
});
assert.equal(
  resultWithFix.latched,
  false,
  "With fix: latch clears when price rises above resistance + rearmDist",
);
// Verify the REARM_UP event appears in April (after the final LATCH in March)
assert.ok(
  resultWithFix.events.some((e) => e.startsWith("REARM_UP")),
  "REARM_UP event should have fired",
);

// ── Edge case: latch should NOT clear on a brief spike just above center ─────
// If close just barely exceeds center (but not center + rearmDist), latch persists.
const barsJustAboveCenter = [
  { prevClose: 47.23, close: 48.75 }, // LATCH
  { prevClose: 48.75, close: 48.90 }, // just above center (48.875) but < 49.144
  { prevClose: 48.90, close: 51.39 }, // now above center + rearmDist → REARM_UP
];
const justAbove = simulateResistanceLatch({
  resistanceCenter: R, resistanceLow: rLow, rearmBound: rDown, rearmDist: rDist,
  bars: barsJustAboveCenter, applyFix: true,
});
// The bar at 48.90 is NOT above 49.144, so latch persists; cleared at 51.39
assert.equal(justAbove.latched, false, "Latch clears once price exceeds R + rearmDist");
assert.equal(
  justAbove.events.filter((e) => e.startsWith("REARM_UP")).length,
  1,
  "REARM_UP fires exactly once",
);

// ── Edge case: downward rearm still works with the fix active ────────────────
const barsDownwardRearm = [
  { prevClose: 47.23, close: 48.75 }, // LATCH
  { prevClose: 48.75, close: 46.50 }, // REARM_DOWN (46.50 < 47.608)
];
const downRearm = simulateResistanceLatch({
  resistanceCenter: R, resistanceLow: rLow, rearmBound: rDown, rearmDist: rDist,
  bars: barsDownwardRearm, applyFix: true,
});
assert.equal(downRearm.latched, false, "Downward rearm still clears latch with fix applied");
assert.ok(
  downRearm.events.some((e) => e.startsWith("REARM_DOWN")),
  "REARM_DOWN fires as expected",
);

// ── Edge case: fix does not fire when no latch is active ─────────────────────
const barsNoLatch = [
  { prevClose: 51.00, close: 53.00 }, // no latch, well above zone
  { prevClose: 53.00, close: 51.39 }, // falls back, still no latch
];
const noLatch = simulateResistanceLatch({
  resistanceCenter: R, resistanceLow: rLow, rearmBound: rDown, rearmDist: rDist,
  bars: barsNoLatch, applyFix: true,
});
assert.equal(noLatch.latched, false);
assert.equal(noLatch.events.length, 0, "No events when no latch was set");

console.log("Stale resistance latch regression: OK");
