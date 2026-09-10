import assert from "node:assert/strict";
import fs from "node:fs";

function detectMonthlyRange(months, options = {}) {
  const {
    minimumRangeMonths = 6,
    maximumRangeMonths = 120,
    minimumUpperTouches = 2,
    minimumLowerTouches = 2,
    touchTolerancePercent = 3,
    minimumContainmentPercent = 80,
    maximumRangeWidthPercent = 40,
    maximumMonthsSinceUpperTouch = 3,
  } = options;

  let best = null;
  const firstDuration = Math.min(minimumRangeMonths, maximumRangeMonths);
  const lastDuration = Math.min(
    Math.max(minimumRangeMonths, maximumRangeMonths),
    months.length,
  );
  const tolerance = touchTolerancePercent / 100;

  for (let duration = firstDuration; duration <= lastDuration; duration += 1) {
    const window = months.slice(0, duration);
    const extremeUpper = Math.max(...window.map((bar) => bar.high));
    const extremeLower = Math.min(...window.map((bar) => bar.low));
    const upperTouchFloor = extremeUpper * (1 - tolerance);
    const lowerTouchCeiling = extremeLower * (1 + tolerance);
    const upperTouchOffsets = [];
    const lowerTouchOffsets = [];

    window.forEach((bar, index) => {
      const offset = index + 1;
      if (bar.high >= upperTouchFloor) upperTouchOffsets.push(offset);
      if (bar.low <= lowerTouchCeiling) lowerTouchOffsets.push(offset);
    });

    if (
      upperTouchOffsets.length < minimumUpperTouches ||
      lowerTouchOffsets.length < minimumLowerTouches
    ) {
      continue;
    }

    const candidateUpper =
      upperTouchOffsets.reduce((sum, offset) => sum + window[offset - 1].high, 0) /
      upperTouchOffsets.length;
    const candidateLower =
      lowerTouchOffsets.reduce((sum, offset) => sum + window[offset - 1].low, 0) /
      lowerTouchOffsets.length;
    const midpoint = (candidateUpper + candidateLower) / 2;
    const widthPercent = ((candidateUpper - candidateLower) / Math.abs(midpoint)) * 100;
    const allTouchOffsets = [...upperTouchOffsets, ...lowerTouchOffsets];
    const spanMonths = Math.max(...allTouchOffsets) - Math.min(...allTouchOffsets) + 1;
    const newestUpperTouch = Math.min(...upperTouchOffsets);
    const containedCloses = window.filter(
      (bar) => bar.close >= candidateLower && bar.close <= candidateUpper,
    ).length;
    const materiallyBroken = window.some(
      (bar) =>
        bar.close > candidateUpper * (1 + tolerance) ||
        bar.close < candidateLower * (1 - tolerance),
    );
    const requiredContained = Math.ceil((duration * minimumContainmentPercent) / 100);

    const eligible =
      candidateUpper > candidateLower &&
      widthPercent <= maximumRangeWidthPercent &&
      spanMonths >= minimumRangeMonths &&
      newestUpperTouch <= maximumMonthsSinceUpperTouch &&
      containedCloses >= requiredContained &&
      !materiallyBroken;
    if (!eligible) continue;

    const totalTouches = upperTouchOffsets.length + lowerTouchOffsets.length;
    const candidate = {
      upper: candidateUpper,
      lower: candidateLower,
      spanMonths,
      duration,
      totalTouches,
      widthPercent,
    };
    const better =
      best === null ||
      candidate.spanMonths > best.spanMonths ||
      (candidate.spanMonths === best.spanMonths && candidate.duration > best.duration) ||
      (candidate.spanMonths === best.spanMonths &&
        candidate.duration === best.duration &&
        candidate.totalTouches > best.totalTouches) ||
      (candidate.spanMonths === best.spanMonths &&
        candidate.duration === best.duration &&
        candidate.totalTouches === best.totalTouches &&
        candidate.widthPercent < best.widthPercent);
    if (better) best = candidate;
  }

  return best;
}

function breakoutMatches({
  range,
  previousWeeklyClose,
  weeklyOpen,
  weeklyClose,
  weeklyVolume,
  priorWeeklyVolumes,
  threshold = 1.2,
}) {
  if (!range || priorWeeklyVolumes.length !== 20) return false;
  const average = priorWeeklyVolumes.reduce((sum, value) => sum + value, 0) / 20;
  const multiple = weeklyVolume / average;
  return (
    previousWeeklyClose <= range.upper &&
    weeklyClose > weeklyOpen &&
    weeklyClose > range.upper &&
    multiple >= threshold
  );
}

const stableRange = Array.from({ length: 120 }, (_, index) => ({
  open: 90,
  high: index % 3 === 0 ? 100 : 98,
  low: index % 4 === 0 ? 80 : 82,
  close: 90,
}));
stableRange[0].high = 100;
stableRange[1].high = 99;

const detected = detectMonthlyRange(stableRange);
assert.ok(detected, "a repeated 120-month range should qualify");
assert.ok(detected.spanMonths >= 6, "touches must span at least six months");

const priorVolumes = Array(20).fill(100);
assert.equal(
  breakoutMatches({
    range: detected,
    previousWeeklyClose: detected.upper,
    weeklyOpen: detected.upper,
    weeklyClose: detected.upper + 1,
    weeklyVolume: 120,
    priorWeeklyVolumes: priorVolumes,
  }),
  true,
  "exactly 1.2x on a bullish candle should pass",
);

assert.equal(
  breakoutMatches({
    range: detected,
    previousWeeklyClose: detected.upper,
    weeklyOpen: detected.upper,
    weeklyClose: detected.upper + 1,
    weeklyVolume: 119.99,
    priorWeeklyVolumes: priorVolumes,
  }),
  false,
  "a value immediately below 1.2x should fail",
);

assert.equal(detectMonthlyRange(stableRange.slice(0, 5)), null, "five months cannot qualify");

const source = fs.readFileSync(
  new URL("./monthly-range-breakout.pine", import.meta.url),
  "utf8",
);
assert.equal((source.match(/\bplot\(/g) ?? []).length, 10, "screener contract has ten plots");
assert.equal((source.match(/\brequest\.security\(/g) ?? []).length, 1, "Monthly values share one request");
assert.equal((source.match(/\brequest\.footprint\(/g) ?? []).length, 0, "production fallback has no footprint dependency");
assert.ok(!/input\.(timeframe|symbol|time)\(/.test(source), "unsupported screener inputs are absent");
assert.match(source, /input\.float\(1\.2, "Minimum volume multiple"/);
assert.match(source, /ta\.sma\(volume, volumeAverageLengthInput\)\[1\]/);

console.log("Monthly range breakout model and static checks passed.");
