import assert from "node:assert/strict";
import fs from "node:fs";

function detectThreeMonthRange(bars, options = {}) {
  const {
    minimumRangeMonths = 6,
    maximumRangeMonths = 120,
    minimumUpperTouches = 2,
    minimumLowerTouches = 2,
    touchTolerancePercent = 3,
    minimumContainmentPercent = 80,
    maximumRangeWidthPercent = 40,
    maximumPeriodsSinceUpperTouch = 2,
  } = options;
  const minimumBars = Math.ceil(minimumRangeMonths / 3);
  const maximumBars = Math.floor(maximumRangeMonths / 3);
  const tolerance = touchTolerancePercent / 100;
  let best = null;

  for (let duration = minimumBars; duration <= Math.min(maximumBars, bars.length); duration += 1) {
    const window = bars.slice(0, duration);
    const extremeUpper = Math.max(...window.map((bar) => bar.high));
    const extremeLower = Math.min(...window.map((bar) => bar.low));
    const upperOffsets = [];
    const lowerOffsets = [];
    window.forEach((bar, index) => {
      if (bar.high >= extremeUpper * (1 - tolerance)) upperOffsets.push(index + 1);
      if (bar.low <= extremeLower * (1 + tolerance)) lowerOffsets.push(index + 1);
    });
    if (upperOffsets.length < minimumUpperTouches || lowerOffsets.length < minimumLowerTouches) continue;

    const upper = upperOffsets.reduce((sum, offset) => sum + window[offset - 1].high, 0) / upperOffsets.length;
    const lower = lowerOffsets.reduce((sum, offset) => sum + window[offset - 1].low, 0) / lowerOffsets.length;
    const midpoint = (upper + lower) / 2;
    const widthPercent = ((upper - lower) / Math.abs(midpoint)) * 100;
    const allOffsets = [...upperOffsets, ...lowerOffsets];
    const spanBars = Math.max(...allOffsets) - Math.min(...allOffsets) + 1;
    const newestUpper = Math.min(...upperOffsets);
    const contained = window.filter((bar) => bar.close >= lower && bar.close <= upper).length;
    const materiallyBroken = window.some(
      (bar) => bar.close > upper * (1 + tolerance) || bar.close < lower * (1 - tolerance),
    );
    const eligible =
      upper > lower &&
      widthPercent <= maximumRangeWidthPercent &&
      spanBars >= minimumBars &&
      newestUpper <= maximumPeriodsSinceUpperTouch &&
      contained >= Math.ceil((duration * minimumContainmentPercent) / 100) &&
      !materiallyBroken;
    if (!eligible) continue;

    const candidate = {
      upper,
      lower,
      spanBars,
      rangeMonths: spanBars * 3,
      duration,
      touches: upperOffsets.length + lowerOffsets.length,
      widthPercent,
    };
    const better =
      best === null ||
      candidate.spanBars > best.spanBars ||
      (candidate.spanBars === best.spanBars && candidate.duration > best.duration) ||
      (candidate.spanBars === best.spanBars && candidate.duration === best.duration && candidate.touches > best.touches) ||
      (candidate.spanBars === best.spanBars && candidate.duration === best.duration && candidate.touches === best.touches && candidate.widthPercent < best.widthPercent);
    if (better) best = candidate;
  }
  return best;
}

function completedCalendarQuarters(monthlyBars, currentMonthNumber) {
  const completedMonthsInCurrentQuarter = (currentMonthNumber - 1) % 3;
  const usable = monthlyBars.slice(completedMonthsInCurrentQuarter);
  const quarters = [];
  for (let index = 0; index + 2 < usable.length; index += 3) {
    const newest = usable[index];
    const middle = usable[index + 1];
    const oldest = usable[index + 2];
    quarters.push({
      open: oldest.open,
      high: Math.max(newest.high, middle.high, oldest.high),
      low: Math.min(newest.low, middle.low, oldest.low),
      close: newest.close,
    });
  }
  return quarters;
}

function breakoutMatches({
  range,
  previousClose,
  open,
  close,
  volume,
  priorVolumes,
  threshold = 1.1,
  marketCapBillions = 5,
  minimumMarketCapBillions = 5,
}) {
  if (
    !range ||
    priorVolumes.length !== 20 ||
    (Number.isFinite(marketCapBillions) &&
      marketCapBillions < minimumMarketCapBillions)
  ) return false;
  const average = priorVolumes.reduce((sum, value) => sum + value, 0) / 20;
  return previousClose <= range.upper && close > range.upper && close > open && volume / average >= threshold;
}

const sixMonthRange = [
  { high: 100, low: 80, close: 90 },
  { high: 99, low: 81, close: 91 },
];
const detected = detectThreeMonthRange(sixMonthRange);
assert.ok(detected, "two completed 3M candles can satisfy six months");
assert.equal(detected.rangeMonths, 6);
assert.equal(detectThreeMonthRange(sixMonthRange.slice(0, 1)), null);

const newestFirstMonthlyBars = [
  { month: "Apr", open: 103, high: 106, low: 102, close: 105 },
  { month: "Mar", open: 97, high: 104, low: 96, close: 103 },
  { month: "Feb", open: 94, high: 100, low: 93, close: 98 },
  { month: "Jan", open: 90, high: 96, low: 89, close: 95 },
  { month: "Dec", open: 87, high: 92, low: 86, close: 91 },
  { month: "Nov", open: 84, high: 89, low: 83, close: 88 },
  { month: "Oct", open: 80, high: 86, low: 79, close: 85 },
];
const mayView = completedCalendarQuarters(newestFirstMonthlyBars, 5);
assert.deepEqual(mayView[0], { open: 90, high: 104, low: 89, close: 103 });
assert.deepEqual(mayView[1], { open: 80, high: 92, low: 79, close: 91 });

const priorVolumes = Array(20).fill(100);
assert.equal(breakoutMatches({ range: detected, previousClose: detected.upper, open: detected.upper, close: detected.upper + 1, volume: 110, priorVolumes }), true);
assert.equal(breakoutMatches({ range: detected, previousClose: detected.upper, open: detected.upper, close: detected.upper + 1, volume: 109.99, priorVolumes }), false);
assert.equal(breakoutMatches({ range: detected, previousClose: detected.upper, open: detected.upper + 2, close: detected.upper + 1, volume: 150, priorVolumes }), false);
assert.equal(breakoutMatches({ range: detected, previousClose: detected.upper, open: detected.upper, close: detected.upper + 1, volume: 110, priorVolumes, marketCapBillions: 4.999 }), false);
assert.equal(breakoutMatches({ range: detected, previousClose: detected.upper, open: detected.upper, close: detected.upper + 1, volume: 110, priorVolumes, marketCapBillions: Number.NaN }), true);

const source = fs.readFileSync(new URL("./three-month-range-breakout.pine", import.meta.url), "utf8");
assert.equal((source.match(/\bplot\(/g) ?? []).length, 10);
assert.equal((source.match(/\brequest\.security\(/g) ?? []).length, 1);
assert.equal((source.match(/\brequest\.financial\(/g) ?? []).length, 2);
assert.equal((source.match(/\brequest\.currency_rate\(/g) ?? []).length, 1);
assert.ok((source.match(/\brequest\.[a-z_]+\(/g) ?? []).length <= 5);
assert.match(source, /"1M"/);
assert.doesNotMatch(source, /request\.security\([\s\S]*?"3M"/);
assert.match(source, /completedMonthsInCurrentQuarter = \(month\(time\) - 1\) % 3/);
assert.match(source, /oldestRequiredMonthOffset = latestCompletedQuarterOffset \+ minimumRangeBars \* 3 - 1/);
assert.doesNotMatch(source, /not na\(close\[40\]\)/);
assert.match(source, /ta\.sma\(volume, volumeAverageLengthInput\)\[1\]/);
assert.match(source, /input\.float\(5\.0, "Minimum market cap \(billions\)"/);
assert.match(source, /input\.string\("USD", "Market-cap currency", options = \["USD", "EUR"\]/);
assert.match(source, /not marketCapDataAvailable or marketCapBillions >= minimumMarketCapBillionsInput/);
assert.match(source, /"Market cap \(bn\)"/);
assert.ok(!/input\.(timeframe|symbol|time)\(/.test(source));

console.log("Three-month range breakout model and static checks passed.");
