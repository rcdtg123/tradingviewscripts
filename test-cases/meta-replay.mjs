import fs from "node:fs";
import assert from "node:assert/strict";

const pineSource = fs.readFileSync(
  new URL("../pine/monthly-close-support.pine", import.meta.url),
  "utf8",
);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("MR_APPROACH"'), false);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("R_APPROACH"'), false);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("M_APPROACH"'), true);
assert.equal(pineSource.includes('alertcondition(mrApproachEvent'), false);
assert.equal(pineSource.includes('alertcondition(resistanceApproachEvent'), false);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("MR_RETEST"'), false);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("RT_REACHED"'), true);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("R_REACHED"'), true);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("MR_REACHED"'), true);
assert.equal(pineSource.includes('f_shouldSendDailyAlert("M_REACHED"'), true);
assert.equal(pineSource.includes('alertcondition(approachEvent'), true);
assert.equal(pineSource.includes("close <= breakBoundary and\n                 (liveCrossedBreakDown or gappedThroughBreak or"), true);
assert.equal(pineSource.includes("request.footprint(100, 70, 300)"), true);
assert.equal(pineSource.includes('"M_BUY_" + str.tostring(buyVolumeTier) + "X"'), true);
assert.equal(pineSource.includes("buyReactionExtensionAtr * confirmedDailyAtr"), true);
assert.equal(pineSource.includes("recoveryFromDailyLowAtr >= buyReactionBounceAtr"), true);
assert.equal(pineSource.includes('" approaching " + structureName + " retest support"'), false);
assert.equal(pineSource.includes("array.set(mrLatched, stateIndex, true)"), true);
assert.equal(pineSource.includes("f_latchResistance(resistance)"), true);
assert.equal(pineSource.includes("if array.get(mrLatched, stateIndex) and\n"), false);

const monthlyPath = "/Users/dhavader/Downloads/BATS_META, 1M.csv";
const dailyPath = "/Users/dhavader/Downloads/BATS_META, 1D.csv";
const plabMonthlyPath = "/Users/dhavader/Downloads/BATS_PLAB, 1M.csv";
const plabDailyPath = "/Users/dhavader/Downloads/BATS_PLAB, 1D.csv";
const anetMonthlyPath = "/Users/dhavader/Downloads/BATS_ANET, 1M.csv";
const anetDailyPath = "/Users/dhavader/Downloads/BATS_ANET, 1D.csv";
const avgoMonthlyPath = "/Users/dhavader/Downloads/BATS_AVGO, 1M.csv";
const avgoDailyPath = "/Users/dhavader/Downloads/BATS_AVGO, 1D.csv";
const sapMonthlyPath = "/Users/dhavader/Downloads/BATS_SAP, 1M.csv";
const sapDailyPath = "/Users/dhavader/Downloads/BATS_SAP, 1D.csv";

function readCsv(path) {
  const [header, ...lines] = fs.readFileSync(path, "utf8").trim().split(/\r?\n/);
  const names = header.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(names.map((name, index) => [name, Number(values[index])]));
  });
}

function rma(values, length) {
  const result = Array(values.length).fill(NaN);
  if (values.length < length) return result;
  let seed = 0;
  for (let index = 0; index < length; index++) seed += values[index];
  result[length - 1] = seed / length;
  for (let index = length; index < values.length; index++) {
    result[index] = (result[index - 1] * (length - 1) + values[index]) / length;
  }
  return result;
}

function sma(values, length) {
  return values.map((_, index) => {
    if (index < length - 1) return NaN;
    const window = values.slice(index - length + 1, index + 1);
    return window.every(Number.isFinite)
      ? window.reduce((sum, value) => sum + value, 0) / length
      : NaN;
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function refresh(zone) {
  zone.low = Math.min(...zone.prices);
  zone.high = Math.max(...zone.prices);
  zone.center = median(zone.prices);
  zone.touches = zone.prices.length;
  zone.firstTouch = Math.min(...zone.timestamps);
  let total = 0;
  let pairs = 0;
  for (let left = 0; left < zone.timestamps.length - 1; left++) {
    const first = new Date(zone.timestamps[left] * 1000);
    for (let right = left + 1; right < zone.timestamps.length; right++) {
      const second = new Date(zone.timestamps[right] * 1000);
      total += Math.abs(
        (second.getUTCFullYear() - first.getUTCFullYear()) * 12 +
        second.getUTCMonth() - first.getUTCMonth(),
      );
      pairs++;
    }
  }
  zone.spread = pairs ? total / pairs : 0;
  return zone;
}

function detect(observations, maximumWidthPercent, minimumTouches) {
  const working = observations.map((item) => refresh({
    prices: [item.price], timestamps: [item.timestamp],
  }));
  let canMerge = true;
  while (canMerge && working.length > 1) {
    canMerge = false;
    let bestLeft = -1;
    let bestRight = -1;
    let bestDistance = Infinity;
    for (let left = 0; left < working.length - 1; left++) {
      for (let right = left + 1; right < working.length; right++) {
        const low = Math.min(working[left].low, working[right].low);
        const high = Math.max(working[left].high, working[right].high);
        const midpoint = (low + high) / 2;
        const width = ((high - low) / Math.abs(midpoint)) * 100;
        if (width <= maximumWidthPercent) {
          const denominator = Math.max(Math.abs((working[left].center + working[right].center) / 2), 0.000001);
          const distance = Math.abs(working[left].center - working[right].center) / denominator * 100;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestLeft = left;
            bestRight = right;
            canMerge = true;
          }
        }
      }
    }
    if (canMerge) {
      working[bestLeft] = refresh({
        prices: [...working[bestLeft].prices, ...working[bestRight].prices],
        timestamps: [...working[bestLeft].timestamps, ...working[bestRight].timestamps],
      });
      working.splice(bestRight, 1);
    }
  }
  return working.filter((zone) => zone.touches >= minimumTouches);
}

function width(zone) { return (zone.high - zone.low) / Math.abs(zone.center) * 100; }
function stronger(candidate, incumbent) {
  if (candidate.touches !== incumbent.touches) return candidate.touches > incumbent.touches;
  if (candidate.spread !== incumbent.spread) return candidate.spread > incumbent.spread;
  return width(candidate) < width(incumbent);
}

function declutter(zones, support, limit = 10) {
  if (support) {
    const survivors = [];
    for (const zone of zones) zone.highConvictionSupport = false;
    let index = 0;
    while (index < zones.length) {
      const higher = zones[index];
      survivors.push(higher);
      if (index + 1 < zones.length) {
        const lower = zones[index + 1];
        const distance = (higher.center - lower.center) / Math.abs(higher.center) * 100;
        if (distance <= limit) {
          if (stronger(lower, higher)) {
            lower.highConvictionSupport = true;
            survivors.push(lower);
          }
          index += 2;
        } else {
          index += 1;
        }
      } else {
        index += 1;
      }
    }
    return survivors;
  }

  const survivors = [];
  for (const zone of zones) zone.highConvictionResistance = false;
  let index = 0;
  while (index < zones.length) {
    const lower = zones[index];
    survivors.push(lower);
    if (index + 1 < zones.length) {
      const higher = zones[index + 1];
      const distance = (higher.center - lower.center) / Math.abs(lower.center) * 100;
      if (distance <= limit) {
        if (stronger(higher, lower)) {
          higher.highConvictionResistance = true;
          survivors.push(higher);
        }
        index += 2;
      } else index += 1;
    } else index += 1;
  }
  return survivors;
}

const daily = readCsv(dailyPath);
const tr = daily.map((bar, index) => index === 0
  ? bar.high - bar.low
  : Math.max(bar.high - bar.low, Math.abs(bar.high - daily[index - 1].close), Math.abs(bar.low - daily[index - 1].close)));
const atr = rma(tr, 14);
const atrPercent = atr.map((value, index) => value / daily[index].close * 100);
const smoothedAtrPercent = sma(atrPercent, 50);
const confirmedIndex = daily.length - 2;
const confirmedAtr = atr[confirmedIndex];
const confirmedAtrPercent = smoothedAtrPercent[confirmedIndex];
const clusterWidth = confirmedAtrPercent * 2;
const approachPercent = Math.max(1, Math.min(7, confirmedAtrPercent * 0.75));

const monthly = readCsv(monthlyPath).slice(0, -1).slice(-120);
const lowZones = detect(monthly.map((bar) => ({ price: bar.low, timestamp: bar.time })), clusterWidth, 2);
const highZones = detect(monthly.map((bar) => ({ price: bar.high, timestamp: bar.time })), confirmedAtrPercent, 2);

function supportList(price, previous) {
  const reference = Math.max(price, previous ?? price);
  const candidates = lowZones.filter((zone) => zone.center <= reference).sort((a, b) => b.center - a.center);
  return declutter(candidates, true).slice(0, 5);
}

function oldResistanceList(price, previous) {
  const reference = Math.min(price, previous ?? price);
  const candidates = lowZones.filter((zone) => zone.touches >= 4 && zone.center > reference).sort((a, b) => a.center - b.center);
  return declutter(candidates, false);
}

function mrList(price, previous) {
  const reference = Math.min(price, previous ?? price);
  const candidates = highZones.filter((zone) => zone.center > reference).sort((a, b) => a.center - b.center);
  return declutter(candidates, false).slice(0, 5);
}

function arbitrateResistance(oldResistance, monthlyResistance, limit = 10) {
  const combined = [
    ...oldResistance.map((zone) => ({ zone, isMR: false })),
    ...monthlyResistance.map((zone) => ({ zone, isMR: true })),
  ].sort((a, b) => a.zone.center - b.zone.center);
  let can = true;
  while (can && combined.length > 1) {
    can = false;
    let pair = -1;
    let closest = Infinity;
    let higherPair = -1;
    for (let lowerIndex = 0; lowerIndex < combined.length - 1; lowerIndex++) {
      for (let higherIndex = lowerIndex + 1; higherIndex < combined.length; higherIndex++) {
        const lower = combined[lowerIndex];
        const higher = combined[higherIndex];
        const distance = (higher.zone.center - lower.zone.center) / Math.abs(lower.zone.center) * 100;
        if (lower.isMR !== higher.isMR && distance <= limit && distance < closest) {
          pair = lowerIndex;
          higherPair = higherIndex;
          closest = distance;
          can = true;
        }
      }
    }
    if (can) {
      const lower = combined[pair];
      const higher = combined[higherPair];
      const higherStronger = stronger(higher.zone, lower.zone);
      const lowerStronger = stronger(lower.zone, higher.zone);
      const equal = !higherStronger && !lowerStronger;
      const higherWins = higherStronger || (equal && higher.isMR && !lower.isMR);
      combined.splice(higherWins ? pair : higherPair, 1);
    }
  }
  return {
    oldResistance: combined.filter((item) => !item.isMR).map((item) => item.zone),
    monthlyResistance: combined.filter((item) => item.isMR).map((item) => item.zone),
  };
}

function describe(zones, prefix) {
  return zones.map((zone, index) => ({
    label: `${prefix}${index + 1}`,
    center: Number(zone.center.toFixed(4)),
    touches: zone.touches,
    role: prefix === "M" && zone.highConvictionSupport
      ? "high-conviction"
      : prefix === "M" ? "actionable"
      : zone.highConvictionResistance ? "high-conviction" : "actionable",
    approachLow: prefix === "M" ? Number(zone.center.toFixed(4)) : Number((zone.center * (1 - approachPercent / 100)).toFixed(4)),
    approachHigh: prefix === "M" ? Number((zone.center * (1 + approachPercent / 100)).toFixed(4)) : Number(zone.center.toFixed(4)),
  }));
}

const prices = [568, 540, 520];
let previous = null;
const replay = [];
for (const price of prices) {
  const supports = supportList(price, previous);
  const arbitration = arbitrateResistance(
    oldResistanceList(price, previous),
    mrList(price, previous),
  );
  const oldResistance = arbitration.oldResistance.slice(0, 3);
  const monthlyResistance = arbitration.monthlyResistance;
  const alerts = [];
  if (previous !== null) {
    for (let index = 0; index < supports.length; index++) {
      const zone = supports[index];
      const approach = zone.center * (1 + approachPercent / 100);
      const breakBoundary = zone.center - 0.25 * confirmedAtr;
      const reached = previous > zone.center && price <= zone.center;
      const approached = previous > approach && price <= approach && price > zone.center;
      const broken = previous > breakBoundary && price <= breakBoundary;
      if (reached) alerts.push(`Reached M${index + 1} ${zone.center.toFixed(2)} (${zone.touches}xM)`);
      else if (approached) alerts.push(`Approaching M${index + 1} ${zone.center.toFixed(2)} (${zone.touches}xM)`);
      if (broken) alerts.push(`Broke M${index + 1} ${zone.center.toFixed(2)} (${zone.touches}xM)`);
    }
  }
  replay.push({
    price,
    previous,
    supports: describe(supports, "M"),
    oldResistance: describe(oldResistance, "R"),
    monthlyResistance: describe(monthlyResistance, "MR"),
    alerts,
  });
  previous = price;
}

assert.equal(replay[2].supports[0].center, 522.375);
assert.equal(replay[2].supports[0].role, "actionable");
assert.equal(replay[2].supports[1].center, 477.9);
assert.equal(replay[2].supports[1].role, "high-conviction");
assert.deepEqual(replay[2].alerts, ["Reached M1 522.38 (2xM)"]);
assert.equal(replay[0].supports[0].center, 553.3);
assert.equal(replay[0].supports[1].center, 477.9);

const snpsRawMonthlyHighResistance = [
  { center: 464.46, touches: 11, spread: 17.7455, low: 447.71, high: 471.94 },
  { center: 505.69, touches: 8, spread: 12.2857, low: 484.6, high: 525.49 },
  { center: 548.12, touches: 6, spread: 12.4, low: 535.2, high: 556.31 },
  { center: 585.665, touches: 7, spread: 6.1905, low: 564.78, high: 605.45 },
  { center: 624.8015, touches: 7, spread: 9.9048, low: 615.7925, high: 651.73 },
];
const snpsResistanceSurvivors = declutter(snpsRawMonthlyHighResistance, false);
assert.deepEqual(
  snpsResistanceSurvivors.map((zone) => Number(zone.center.toFixed(4))),
  [464.46, 548.12, 585.665, 624.8015],
);
assert.equal(snpsResistanceSurvivors[2].highConvictionResistance, true);

const plabDaily = readCsv(plabDailyPath);
const plabTrueRange = plabDaily.map((bar, index) => index === 0
  ? bar.high - bar.low
  : Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - plabDaily[index - 1].close),
    Math.abs(bar.low - plabDaily[index - 1].close),
  ));
const plabAtr = rma(plabTrueRange, 14);
const plabAtrPercent = sma(
  plabAtr.map((value, index) => value / plabDaily[index].close * 100),
  50,
);
const plabLatestConfirmedIndex = plabDaily.length - 2;
const plabJuly31Index = plabDaily.findIndex((bar) =>
  new Date(bar.time * 1000).toISOString().slice(0, 10) === "2026-07-31");
const plabMonthly = readCsv(plabMonthlyPath).slice(0, -1).slice(-120);

function plabSupportCenters(dailyAtrPercent) {
  return detect(
    plabMonthly.map((bar) => ({ price: bar.low, timestamp: bar.time })),
    dailyAtrPercent * 2,
    2,
  ).filter((zone) => zone.center < 31.35)
    .sort((first, second) => second.center - first.center)
    .map((zone) => Number(zone.center.toFixed(4)));
}

const plabNormalizedCenters = plabSupportCenters(plabAtrPercent[plabLatestConfirmedIndex]);
const plabHistoricallySampledMonthlyCenters = plabSupportCenters(plabAtrPercent[plabJuly31Index]);
assert.deepEqual(plabNormalizedCenters.slice(0, 2), [27.58, 24.73]);
assert.equal(plabHistoricallySampledMonthlyCenters[0], 25.32);

const anetDaily = readCsv(anetDailyPath);
const anetTrueRange = anetDaily.map((bar, index) => index === 0
  ? bar.high - bar.low
  : Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - anetDaily[index - 1].close),
    Math.abs(bar.low - anetDaily[index - 1].close),
  ));
const anetAtr = rma(anetTrueRange, 14);
const anetConfirmedAtr = anetAtr[anetDaily.length - 2];
const anetAtrPercent = sma(
  anetAtr.map((value, index) => value / anetDaily[index].close * 100),
  50,
)[anetDaily.length - 2];
const anetMonthly = readCsv(anetMonthlyPath).slice(0, -1).slice(-120);
const anetHighZones = detect(
  anetMonthly.map((bar) => ({ price: bar.high, timestamp: bar.time })),
  anetAtrPercent * 2,
  2,
);
const anetHistoricalRetest = anetHighZones.find((zone) =>
  zone.touches >= 3 && Math.abs(zone.center - 179.45) < 0.01);
assert.ok(anetHistoricalRetest);
assert.equal(anetHistoricalRetest.touches, 4);
assert.ok(195.03 >= anetHistoricalRetest.center + 0.25 * anetConfirmedAtr);

const dailyAlertDates = new Map();
function shouldSendDailyAlert(symbol, eventType, center, date) {
  const key = `${symbol}|${eventType}|${center.toFixed(2)}`;
  if (dailyAlertDates.get(key) === date) return false;
  dailyAlertDates.set(key, date);
  return true;
}
assert.equal(shouldSendDailyAlert("BATS:AAPL", "MR_BREAKOUT", 316.2, 20260818), true);
assert.equal(shouldSendDailyAlert("BATS:AVGO", "M_APPROACH", 358.445, 20260819), true);
assert.equal(shouldSendDailyAlert("BATS:AVGO", "M_REACHED", 358.445, 20260819), true);
assert.equal(shouldSendDailyAlert("BATS:AVGO", "M_APPROACH", 358.445, 20260819), false);
assert.equal(shouldSendDailyAlert("BATS:AVGO", "M_REACHED", 358.445, 20260819), false);

function crossedDown({ previousLive, live, priorClose, open, low }, level) {
  const liveCross = Number.isFinite(previousLive) && previousLive > level && live <= level;
  const gapCross = priorClose > level && open <= level;
  const rangeCross = open > level && low <= level;
  return liveCross || gapCross || rangeCross;
}

function crossedBreakDown({ previousLive, live, priorClose, open, low }, level) {
  const liveCross = Number.isFinite(previousLive) && previousLive > level && live <= level;
  const gapCross = priorClose > level && open <= level;
  const rangeCross = open > level && low <= level;
  return live <= level && (liveCross || gapCross || rangeCross);
}

assert.equal(crossedBreakDown({ previousLive: NaN, live: 275.64, priorClose: 276.27, open: 270.755, low: 269.28 }, 272.72), false);
assert.equal(crossedBreakDown({ previousLive: NaN, live: 271.5, priorClose: 276.27, open: 270.755, low: 269.28 }, 272.72), true);
assert.equal(crossedBreakDown({ previousLive: NaN, live: 586.4, priorClose: 570.05, open: 590.31, low: 561.88 }, 579.71), false);
assert.equal(crossedBreakDown({ previousLive: NaN, live: 573.71, priorClose: 570.05, open: 590.31, low: 561.88 }, 579.71), true);

function supportBuyVolumeSignal({
  live, support, approach, atr, dailyLow, buyVolume, sellVolume,
  averageBuyVolume, isOneDay = true,
}) {
  const lowerBoundary = support - 0.5 * atr;
  const buyShare = buyVolume / (buyVolume + sellVolume) * 100;
  const multiple = buyVolume / averageBuyVolume;
  const recoveryAtr = (live - dailyLow) / atr;
  const eligible = isOneDay && live >= lowerBoundary && live <= approach &&
    buyVolume > sellVolume && buyShare >= 60 && multiple >= 2 &&
    (live >= support || recoveryAtr >= 0.25);
  const tier = !eligible ? 0 : multiple >= 8 ? 8 : multiple >= 4 ? 4 : 2;
  return { eligible, tier };
}

assert.deepEqual(supportBuyVolumeSignal({ live: 101, support: 100, approach: 105, atr: 10, dailyLow: 98, buyVolume: 230, sellVolume: 120, averageBuyVolume: 100 }), { eligible: true, tier: 2 });
assert.deepEqual(supportBuyVolumeSignal({ live: 97, support: 100, approach: 105, atr: 10, dailyLow: 94.5, buyVolume: 520, sellVolume: 200, averageBuyVolume: 100 }), { eligible: true, tier: 4 });
assert.equal(supportBuyVolumeSignal({ live: 97, support: 100, approach: 105, atr: 10, dailyLow: 95, buyVolume: 520, sellVolume: 200, averageBuyVolume: 100 }).eligible, false);
assert.equal(supportBuyVolumeSignal({ live: 94.9, support: 100, approach: 105, atr: 10, dailyLow: 90, buyVolume: 520, sellVolume: 200, averageBuyVolume: 100 }).eligible, false);
assert.equal(supportBuyVolumeSignal({ live: 101, support: 100, approach: 105, atr: 10, dailyLow: 98, buyVolume: 230, sellVolume: 180, averageBuyVolume: 100 }).eligible, false);
assert.deepEqual(supportBuyVolumeSignal({ live: 101, support: 100, approach: 105, atr: 10, dailyLow: 98, buyVolume: 850, sellVolume: 100, averageBuyVolume: 100 }), { eligible: true, tier: 8 });

const buyTierDates = new Map();
function newlyReachedBuyTier(multiple, date) {
  const tier = multiple >= 8 ? 8 : multiple >= 4 ? 4 : multiple >= 2 ? 2 : 0;
  if (tier >= 4) buyTierDates.set("2x", date);
  if (tier >= 8) buyTierDates.set("4x", date);
  if (!tier || buyTierDates.get(`${tier}x`) === date) return 0;
  buyTierDates.set(`${tier}x`, date);
  return tier;
}
assert.equal(newlyReachedBuyTier(5.2, 20260825), 4);
assert.equal(newlyReachedBuyTier(3.1, 20260825), 0);
assert.equal(newlyReachedBuyTier(8.3, 20260825), 8);
assert.equal(newlyReachedBuyTier(8.6, 20260825), 0);

function reachedRetest({ active = true, visible = true, previousLive, live, open, isNew = false }, center) {
  const liveReach = Number.isFinite(previousLive) && previousLive > center && live <= center &&
    (!isNew || open >= center);
  return active && visible && liveReach;
}

function reachedSupport({ previousLive, live, open, isNew = false }, center) {
  return reachedRetest({ previousLive, live, open, isNew }, center);
}

assert.equal(reachedSupport({ previousLive: 380, live: 371, open: 380 }, 358.445), false);
assert.equal(reachedSupport({ previousLive: 360, live: 358.445, open: 380 }, 358.445), true);
assert.equal(reachedSupport({ previousLive: 380, live: 350, open: 350, isNew: true }, 358.445), false);
assert.equal(reachedSupport({ previousLive: 380, live: 358.445, open: 358.445, isNew: true }, 358.445), true);
assert.equal(reachedSupport({ previousLive: 350, live: 359, open: 350 }, 358.445), false);

function reachedResistance({ visible = true, previousLive, live, open, isNew = false }, center) {
  const liveReach = Number.isFinite(previousLive) && previousLive < center && live >= center &&
    (!isNew || open <= center);
  return visible && liveReach;
}

assert.equal(reachedResistance(
  { previousLive: 239, live: 240.11, open: 239 }, 240.11), true);
assert.equal(reachedResistance(
  { previousLive: 239, live: 242, open: 242, isNew: true }, 240.11), false);
assert.equal(reachedResistance(
  { previousLive: 239, live: 240.11, open: 240.11, isNew: true }, 240.11), true);
assert.equal(reachedResistance(
  { visible: false, previousLive: 239, live: 240.11, open: 239 }, 240.11), false);
assert.equal(reachedResistance(
  { previousLive: 242, live: 240.11, open: 242 }, 240.11), false);

assert.equal(reachedRetest(
  { previousLive: 221, live: 220, open: 221 }, 214.94), false);
assert.equal(reachedRetest(
  { previousLive: 216, live: 214.94, open: 216 }, 214.94), true);
assert.equal(reachedRetest(
  { previousLive: 221, live: 210, open: 210, isNew: true }, 214.94), false);
assert.equal(reachedRetest(
  { previousLive: 221, live: 214.94, open: 214.94, isNew: true }, 214.94), true);
assert.equal(reachedRetest(
  { visible: false, previousLive: 216, live: 214.94, open: 216 }, 214.94), false);

assert.equal(crossedDown(
  { previousLive: 380, live: 370, priorClose: 380, open: 380, low: 370 }, 371), true);
assert.equal(crossedDown(
  { previousLive: NaN, live: 350, priorClose: 380, open: 350, low: 348 }, 358.445), true);
assert.equal(crossedDown(
  { previousLive: NaN, live: 361.5, priorClose: 380, open: 372.4, low: 357.6101 }, 358.445), true);
assert.equal(crossedDown(
  { previousLive: 350, live: 360, priorClose: 350, open: 350, low: 349 }, 358.445), false);

const avgoDaily = readCsv(avgoDailyPath);
const avgoTrueRange = avgoDaily.map((bar, index) => index === 0
  ? bar.high - bar.low
  : Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - avgoDaily[index - 1].close),
    Math.abs(bar.low - avgoDaily[index - 1].close),
  ));
const avgoAtr = rma(avgoTrueRange, 14);
const avgoConfirmedIndex = avgoDaily.length - 2;
const avgoConfirmedAtrPercent = sma(
  avgoAtr.map((value, index) => value / avgoDaily[index].close * 100),
  50,
)[avgoConfirmedIndex];
const avgoApproachPercent = Math.max(1, Math.min(7, avgoConfirmedAtrPercent * 0.75));
const avgoMonthly = readCsv(avgoMonthlyPath).slice(0, -1).slice(-120);
const avgoLowZones = detect(
  avgoMonthly.map((bar) => ({ price: bar.low, timestamp: bar.time })),
  avgoConfirmedAtrPercent * 2,
  2,
).sort((first, second) => second.center - first.center);
const avgoM1 = avgoLowZones.find((zone) => zone.center <= 380);
const avgoApproachBoundary = avgoM1.center * (1 + avgoApproachPercent / 100);
const avgoToday = avgoDaily.at(-1);
assert.equal(Number(avgoM1.center.toFixed(3)), 358.445);
assert.equal(avgoM1.touches, 2);
assert.equal(Number(avgoApproachBoundary.toFixed(3)), 371.049);
assert.equal(crossedDown({
  previousLive: NaN,
  live: avgoToday.close,
  priorClose: avgoDaily.at(-2).close,
  open: avgoToday.open,
  low: avgoToday.low,
}, avgoApproachBoundary), true);
assert.equal(crossedDown({
  previousLive: NaN,
  live: avgoToday.close,
  priorClose: avgoDaily.at(-2).close,
  open: avgoToday.open,
  low: avgoToday.low,
}, avgoM1.center), true);

const sapDaily = readCsv(sapDailyPath);
const sapTrueRange = sapDaily.map((bar, index) => index === 0
  ? bar.high - bar.low
  : Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - sapDaily[index - 1].close),
    Math.abs(bar.low - sapDaily[index - 1].close),
  ));
const sapAtr = rma(sapTrueRange, 14);
const sapConfirmedIndex = sapDaily.length - 2;
const sapConfirmedAtr = sapAtr[sapConfirmedIndex];
const sapConfirmedAtrPercent = sma(
  sapAtr.map((value, index) => value / sapDaily[index].close * 100),
  50,
)[sapConfirmedIndex];
const sapMonthly = readCsv(sapMonthlyPath).slice(0, -1).slice(-120);
const sapHighZones = detect(
  sapMonthly.map((bar) => ({ price: bar.high, timestamp: bar.time })),
  sapConfirmedAtrPercent,
  2,
);
const sapLowZones = detect(
  sapMonthly.map((bar) => ({ price: bar.low, timestamp: bar.time })),
  sapConfirmedAtrPercent * 2,
  2,
);
const sapPrice = sapDaily.at(-1).close;
const sapReconstructible = sapHighZones
  .filter((zone) => zone.touches >= 3 && sapPrice >= zone.center + 0.25 * sapConfirmedAtr)
  .sort((first, second) => second.center - first.center);
const sapNearestHistoricalRetest = sapReconstructible[0];
const sapApproachPercent = Math.max(1, Math.min(7, sapConfirmedAtrPercent * 0.75));
const sapOverlappingEstablishedSupport = sapLowZones.find((zone) => {
  if (zone.touches < 3 || zone.center > sapPrice) return false;
  const retestHigh = sapNearestHistoricalRetest.center * (1 + sapApproachPercent / 100);
  const supportHigh = zone.center * (1 + sapApproachPercent / 100);
  return Math.max(sapNearestHistoricalRetest.center, zone.center) <=
    Math.min(retestHigh, supportHigh);
});
assert.equal(Number(sapConfirmedAtrPercent.toFixed(3)), 3.738);
assert.equal(sapHighZones.some((zone) => Math.abs(zone.center - 214.94) < 0.01 && zone.touches >= 3), false);
assert.equal(Number(sapNearestHistoricalRetest.center.toFixed(4)), 197.0038);
assert.equal(sapNearestHistoricalRetest.touches, 4);
assert.equal(Number(sapOverlappingEstablishedSupport.center.toFixed(2)), 194.93);

console.log(JSON.stringify({
  dailyRows: daily.length,
  monthlyCompletedRows: monthly.length,
  confirmedAtr,
  confirmedAtrPercent,
  clusterWidth,
  approachPercent,
  lowZones: lowZones.map((zone) => ({ center: zone.center, touches: zone.touches, low: zone.low, high: zone.high, spread: zone.spread })),
  highZones: highZones.map((zone) => ({ center: zone.center, touches: zone.touches, low: zone.low, high: zone.high, spread: zone.spread })),
  replay,
}, null, 2));
