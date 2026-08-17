import fs from "node:fs";
import assert from "node:assert/strict";

const monthlyPath = "/Users/dhavader/Downloads/BATS_META, 1M.csv";
const dailyPath = "/Users/dhavader/Downloads/BATS_META, 1D.csv";

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

  const distinct = [...zones];
  let can = true;
  while (can && distinct.length > 1) {
    can = false;
    let pair = -1;
    let closest = Infinity;
    for (let index = 0; index < distinct.length - 1; index++) {
      const first = distinct[index];
      const second = distinct[index + 1];
      const distance = support
        ? (first.center - second.center) / Math.abs(first.center) * 100
        : (second.center - first.center) / Math.abs(first.center) * 100;
      if (distance <= limit && distance < closest) {
        closest = distance;
        pair = index;
        can = true;
      }
    }
    if (can) {
      const firstWins = stronger(distinct[pair], distinct[pair + 1]);
      const secondWins = stronger(distinct[pair + 1], distinct[pair]);
      const remove = firstWins && !secondWins ? pair + 1 : pair;
      distinct.splice(remove, 1);
    }
  }
  return distinct;
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
const highZones = detect(monthly.map((bar) => ({ price: bar.high, timestamp: bar.time })), clusterWidth, 2);

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
  const survivors = [];
  let start = 0;
  while (start < combined.length) {
    let end = start;
    while (end + 1 < combined.length) {
      const distance = (combined[end + 1].zone.center - combined[end].zone.center) /
        Math.abs(combined[end].zone.center) * 100;
      if (distance <= limit) end++;
      else break;
    }
    let winner = combined[start];
    for (let index = start + 1; index <= end; index++) {
      const candidate = combined[index];
      const candidateStronger = stronger(candidate.zone, winner.zone);
      const winnerStronger = stronger(winner.zone, candidate.zone);
      const equal = !candidateStronger && !winnerStronger;
      if (candidateStronger ||
          (equal && candidate.isMR && !winner.isMR) ||
          (equal && candidate.isMR === winner.isMR && candidate.zone.center > winner.zone.center)) {
        winner = candidate;
      }
    }
    survivors.push(winner);
    start = end + 1;
  }
  return {
    oldResistance: survivors.filter((item) => !item.isMR).map((item) => item.zone),
    monthlyResistance: survivors.filter((item) => item.isMR).map((item) => item.zone),
  };
}

function describe(zones, prefix) {
  return zones.map((zone, index) => ({
    label: `${prefix}${index + 1}`,
    center: Number(zone.center.toFixed(4)),
    touches: zone.touches,
    role: prefix === "M" && zone.highConvictionSupport
      ? "high-conviction"
      : prefix === "M" ? "actionable" : undefined,
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
