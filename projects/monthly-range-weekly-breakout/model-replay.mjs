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

function detectWeeklyBase(weeks, options = {}) {
  const {
    minimumBaseWeeks = 6,
    maximumBaseWeeks = 12,
    minimumUpperTouches = 2,
    touchTolerancePercent = 3,
    maximumBaseWidthPercent = 40,
    maximumWeeksSinceUpperTouch = 3,
  } = options;

  let best = null;
  const tolerance = touchTolerancePercent / 100;
  const lastDuration = Math.min(maximumBaseWeeks, weeks.length);

  for (let duration = minimumBaseWeeks; duration <= lastDuration; duration += 1) {
    const window = weeks.slice(0, duration);
    const extremeUpper = Math.max(...window.map((bar) => bar.high));
    const extremeLower = Math.min(...window.map((bar) => bar.low));
    const upperTouchOffsets = [];

    window.forEach((bar, index) => {
      if (bar.high >= extremeUpper * (1 - tolerance)) {
        upperTouchOffsets.push(index + 1);
      }
    });
    if (upperTouchOffsets.length < minimumUpperTouches) continue;

    const upper =
      upperTouchOffsets.reduce((sum, offset) => sum + window[offset - 1].high, 0) /
      upperTouchOffsets.length;
    const lower = extremeLower;
    const midpoint = (upper + lower) / 2;
    const widthPercent = ((upper - lower) / Math.abs(midpoint)) * 100;
    const spanWeeks =
      Math.max(...upperTouchOffsets) - Math.min(...upperTouchOffsets) + 1;
    const newestUpperTouch = Math.min(...upperTouchOffsets);
    const allClosesContained = window.every(
      (bar) => bar.close >= lower && bar.close <= upper,
    );
    const materiallyBroken = window.some(
      (bar) =>
        bar.close > upper * (1 + tolerance) ||
        bar.close < lower * (1 - tolerance),
    );

    const eligible =
      upper > lower &&
      widthPercent <= maximumBaseWidthPercent &&
      spanWeeks >= minimumBaseWeeks &&
      newestUpperTouch <= maximumWeeksSinceUpperTouch &&
      allClosesContained &&
      !materiallyBroken;
    if (!eligible) continue;

    const candidate = {
      upper,
      lower,
      spanWeeks,
      duration,
      upperTouches: upperTouchOffsets.length,
      widthPercent,
    };
    const better =
      best === null ||
      candidate.spanWeeks > best.spanWeeks ||
      (candidate.spanWeeks === best.spanWeeks && candidate.duration > best.duration) ||
      (candidate.spanWeeks === best.spanWeeks &&
        candidate.duration === best.duration &&
        candidate.upperTouches > best.upperTouches) ||
      (candidate.spanWeeks === best.spanWeeks &&
        candidate.duration === best.duration &&
        candidate.upperTouches === best.upperTouches &&
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
  threshold = 1.1,
  marketCapBillions = 5,
  minimumMarketCapBillions = 5,
}) {
  if (
    !range ||
    priorWeeklyVolumes.length !== 20 ||
    !Number.isFinite(marketCapBillions) ||
    marketCapBillions < minimumMarketCapBillions
  ) return false;
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
    weeklyVolume: 110,
    priorWeeklyVolumes: priorVolumes,
  }),
  true,
  "exactly 1.1x on a bullish monthly breakout should pass",
);

assert.equal(
  breakoutMatches({
    range: detected,
    previousWeeklyClose: detected.upper,
    weeklyOpen: detected.upper,
    weeklyClose: detected.upper + 1,
    weeklyVolume: 109.99,
    priorWeeklyVolumes: priorVolumes,
  }),
  false,
  "a value immediately below 1.1x should fail",
);

assert.equal(detectMonthlyRange(stableRange.slice(0, 5)), null, "five months cannot qualify");

assert.equal(
  breakoutMatches({
    range: detected,
    previousWeeklyClose: detected.upper,
    weeklyOpen: detected.upper,
    weeklyClose: detected.upper + 1,
    weeklyVolume: 110,
    priorWeeklyVolumes: priorVolumes,
    marketCapBillions: 4.999,
  }),
  false,
  "market cap immediately below 5 billion should fail",
);
assert.equal(
  breakoutMatches({
    range: detected,
    previousWeeklyClose: detected.upper,
    weeklyOpen: detected.upper,
    weeklyClose: detected.upper + 1,
    weeklyVolume: 110,
    priorWeeklyVolumes: priorVolumes,
    marketCapBillions: Number.NaN,
  }),
  false,
  "missing market-cap data should fail closed",
);

// PFG, week beginning 2026-04-20. The current Monthly detector had a
// pre-breakout ceiling of 96.6875. Its 1.176x volume passes the revised 1.1x
// Monthly threshold but remains below the Weekly-base branch's 1.5x threshold.
const pfgPriorAverage = 7391729.9;
assert.equal(
  breakoutMatches({
    range: { upper: 96.6875 },
    previousWeeklyClose: 96.17,
    weeklyOpen: 95.56,
    weeklyClose: 99.34,
    weeklyVolume: 8695388,
    priorWeeklyVolumes: Array(20).fill(pfgPriorAverage),
    threshold: 1.1,
  }),
  true,
  "PFG should pass the Monthly branch on 2026-04-20",
);

// SNOW, the 12 completed weeks before the week beginning 2026-05-26, newest
// first. The two resistance touches nine weeks apart select a nine-week base.
const snowPriorWeeks = [
  { high: 176.98, low: 155.19, close: 172.2 },
  { high: 159.83, low: 146.05, close: 157.47 },
  { high: 157.0, low: 136.2, close: 152.45 },
  { high: 146.38, low: 133.0201, close: 141.0 },
  { high: 156.7, low: 134.3, close: 140.32 },
  { high: 151.48, low: 121.3, close: 143.98 },
  { high: 157.84, low: 118.3, close: 121.11 },
  { high: 159.28, low: 145.01, close: 151.85 },
  { high: 177.05, low: 150.6, close: 152.8 },
  { high: 180.79, low: 166.55, close: 168.02 },
  { high: 184.74, low: 174.43, close: 178.66 },
  { high: 183.25, low: 156.87, close: 180.48 },
];
const snowBase = detectWeeklyBase(snowPriorWeeks);
assert.ok(snowBase, "SNOW should have an eligible Weekly base");
assert.equal(snowBase.duration, 9, "SNOW should select the nine-week window");
assert.ok(Math.abs(snowBase.upper - 177.015) < 0.001);
assert.ok(Math.abs(snowBase.lower - 118.3) < 0.001);
assert.equal(
  breakoutMatches({
    range: snowBase,
    previousWeeklyClose: 172.2,
    weeklyOpen: 176.885,
    weeklyClose: 255.55,
    weeklyVolume: 89577806,
    priorWeeklyVolumes: Array(20).fill(32596828.1),
    threshold: 1.5,
  }),
  true,
  "SNOW should pass the Weekly-base branch on 2026-05-26",
);

assert.equal(
  breakoutMatches({
    range: snowBase,
    previousWeeklyClose: 172.2,
    weeklyOpen: 176.885,
    weeklyClose: 255.55,
    weeklyVolume: 32596828.1 * 1.4999,
    priorWeeklyVolumes: Array(20).fill(32596828.1),
    threshold: 1.5,
  }),
  false,
  "Weekly-base volume immediately below 1.5x should fail",
);

const overwideSnowBase = detectWeeklyBase(snowPriorWeeks, {
  maximumBaseWidthPercent: 35,
});
assert.equal(overwideSnowBase, null, "an overwide Weekly base should fail closed");

const source = fs.readFileSync(
  new URL("./monthly-range-breakout.pine", import.meta.url),
  "utf8",
);
assert.equal((source.match(/\bplot\(/g) ?? []).length, 10, "screener contract has ten plots");
assert.equal((source.match(/\brequest\.security\(/g) ?? []).length, 1, "Monthly values share one request");
assert.equal((source.match(/\brequest\.financial\(/g) ?? []).length, 2, "FQ shares fall back to FY shares");
assert.equal((source.match(/\brequest\.currency_rate\(/g) ?? []).length, 1, "market cap has one FX request");
assert.ok((source.match(/\brequest\.[a-z_]+\(/g) ?? []).length <= 5, "Pine Screener request budget is respected");
assert.equal((source.match(/\brequest\.footprint\(/g) ?? []).length, 0, "production fallback has no footprint dependency");
assert.ok(!/input\.(timeframe|symbol|time)\(/.test(source), "unsupported screener inputs are absent");
assert.match(source, /input\.float\(1\.1, "Monthly breakout volume multiple"/);
assert.match(source, /input\.float\(1\.5, "Weekly-base volume multiple"/);
assert.match(source, /not na\(close\[minimumRangeMonths\]\)/);
assert.doesNotMatch(source, /not na\(close\[120\]\)/);
assert.match(source, /ta\.sma\(volume, volumeAverageLengthInput\)\[1\]/);
assert.match(source, /input\.float\(5\.0, "Minimum market cap \(billions\)"/);
assert.match(source, /input\.string\("USD", "Market-cap currency", options = \["USD", "EUR"\]/);
assert.match(source, /marketCapBillions >= minimumMarketCapBillionsInput/);
assert.match(source, /"Market cap \(bn\)"/);

console.log("Combined Monthly and Weekly-base breakout checks passed.");
