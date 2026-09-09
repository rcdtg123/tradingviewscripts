import assert from "node:assert/strict";
import fs from "node:fs";

const pineSource = fs.readFileSync(
  new URL("../pine/monthly-close-support.pine", import.meta.url),
  "utf8",
);

assert.equal(
  pineSource.includes('input.float(2.75, "Overlap-group span × Daily ATR%"'),
  true,
);
assert.equal(
  pineSource.includes('input.int(4, "Minimum Monthly touches per consolidated level"'),
  true,
);
assert.equal(
  pineSource.includes('input.float(10.0, "Maximum overlap-group span %", 0.25, 10.0'),
  true,
);
assert.equal(
  pineSource.includes("overlapGroupAtrMultiplier * confirmedDailyAtrPercent"),
  true,
);
assert.equal(
  pineSource.includes("f_compactEstablishedSupportDestinations("),
  true,
);
assert.equal(
  pineSource.includes("f_compactFinalResistanceDestinations("),
  true,
);

const maximumSpanPercent = 10;
const atrMultiplier = 2.75;
const minimumConsolidationTouches = 4;

function effectiveSpan(atrPercent) {
  return Math.min(maximumSpanPercent, atrMultiplier * atrPercent);
}

function width(zone) {
  return (zone.high - zone.low) / Math.abs(zone.center) * 100;
}

function higherConviction(candidate, incumbent) {
  if (candidate.touches !== incumbent.touches) {
    return candidate.touches > incumbent.touches;
  }
  if (candidate.spread !== incumbent.spread) {
    return candidate.spread > incumbent.spread;
  }
  return width(candidate) < width(incumbent);
}

function baselineSupportDeclutter(input, spanPercent) {
  const zones = structuredClone(input);
  const survivors = [];
  for (const zone of zones) zone.highConvictionSupport = false;
  let index = 0;
  while (index < zones.length) {
    const higher = zones[index];
    survivors.push(higher);
    if (index + 1 >= zones.length) break;
    const lower = zones[index + 1];
    const distance = (higher.center - lower.center) / Math.abs(higher.center) * 100;
    if (distance <= spanPercent) {
      if (higherConviction(lower, higher)) {
        lower.highConvictionSupport = true;
        survivors.push(lower);
      }
      index += 2;
    } else {
      index += 1;
    }
  }
  return survivors;
}

function compactEstablishedSupports(zones, spanPercent) {
  const survivors = [];
  let index = 0;
  while (index < zones.length) {
    const higher = zones[index];
    if (index + 1 >= zones.length) {
      survivors.push(higher);
      break;
    }
    const lower = zones[index + 1];
    const distance = (higher.center - lower.center) / Math.abs(higher.center) * 100;
    const bothMature = higher.touches >= minimumConsolidationTouches &&
      lower.touches >= minimumConsolidationTouches;
    if (bothMature && distance <= spanPercent) {
      const priorities = [higher, lower].filter((zone) => zone.highConvictionSupport);
      if (priorities.length) {
        survivors.push(...priorities);
      } else {
        const winner = higherConviction(lower, higher) ? lower : higher;
        if (winner === lower) winner.highConvictionSupport = true;
        survivors.push(winner);
      }
      index += 2;
    } else {
      survivors.push(higher);
      index += 1;
    }
  }
  return survivors;
}

function supportResult(rawZones, atrPercent) {
  const spanPercent = effectiveSpan(atrPercent);
  return compactEstablishedSupports(
    baselineSupportDeclutter(rawZones, spanPercent),
    spanPercent,
  );
}

const adskRawSupports = [
  { center: 199.6317, touches: 11, spread: 20.4364, low: 195.285, high: 209.0588 },
  { center: 186.29, touches: 15, spread: 15.4095, low: 179.61, high: 192.88 },
  { center: 170.745, touches: 6, spread: 17.5333, low: 163.2, high: 175.0476 },
  { center: 155.7875, touches: 4, spread: 1.6667, low: 153.55, high: 158.51 },
  { center: 147.2525, touches: 4, spread: 7.1667, low: 145.9, high: 149.5 },
  { center: 138.62, touches: 3, spread: 4.6667, low: 135.52, high: 139.87 },
  { center: 125.6325, touches: 6, spread: 10.2, low: 123.875, high: 129.7 },
  { center: 120.1, touches: 5, spread: 4, low: 117.72, high: 121.12 },
  { center: 110.68, touches: 3, spread: 4, low: 108.65, high: 111.05 },
];

const muRawSupports = [
  { center: 770.1, touches: 3, spread: 1.3333, low: 737.88, high: 854.35 },
  { center: 352.0505, touches: 2, spread: 2, low: 340.2, high: 363.901 },
  { center: 303.175, touches: 2, spread: 2, low: 294.86, high: 311.49 },
  { center: 207.14, touches: 2, spread: 1, low: 192.59, high: 221.69 },
  { center: 105.72, touches: 7, spread: 8.8571, low: 98.94, high: 114.25 },
  { center: 92.35, touches: 4, spread: 8, low: 87.35, high: 95.53 },
  { center: 79.84, touches: 19, spread: 22.9708, low: 72.51, high: 84.91 },
];

const adskSpan = effectiveSpan(3.955537313728005);
const muSpan = effectiveSpan(8.499947691026708);
assert.equal(effectiveSpan(2), 5.5);
assert.equal(adskSpan, 10);
assert.equal(muSpan, 10);

const adskSupports = supportResult(adskRawSupports, 3.955537313728005);
assert.deepEqual(
  adskSupports.slice(0, 4).map((zone) => Number(zone.center.toFixed(2))),
  [186.29, 170.75, 147.25, 125.63],
);
assert.equal(adskSupports[0].highConvictionSupport, true);
assert.equal(adskSupports.some((zone) => Number(zone.center.toFixed(2)) === 199.63), false);

const muSupports = supportResult(muRawSupports, 8.499947691026708);
assert.deepEqual(
  muSupports.slice(0, 5).map((zone) => Number(zone.center.toFixed(2))),
  [770.1, 352.05, 303.18, 207.14, 105.72],
);

// A low-touch nearest support remains actionable beside a stronger lower HC
// support. This protects the established META 522.xx / 477.xx behavior.
const metaTransitionalPair = [
  { center: 522.375, touches: 2, spread: 2, low: 520, high: 525 },
  { center: 477.9, touches: 10, spread: 12, low: 470, high: 485 },
];
const metaSupports = supportResult(metaTransitionalPair, 5);
assert.deepEqual(
  metaSupports.map((zone) => Number(zone.center.toFixed(3))),
  [522.375, 477.9],
);
assert.equal(metaSupports[1].highConvictionSupport, true);

// Final combined resistance compaction is also disjoint. Every existing HC
// member survives and suppresses only its paired non-HC neighbor.
function compactResistance(candidates, spanPercent) {
  const survivors = [];
  let index = 0;
  while (index < candidates.length) {
    const lower = candidates[index];
    if (index + 1 >= candidates.length) {
      survivors.push(lower);
      break;
    }
    const higher = candidates[index + 1];
    const distance = (higher.center - lower.center) / Math.abs(lower.center) * 100;
    const bothMature = lower.touches >= minimumConsolidationTouches &&
      higher.touches >= minimumConsolidationTouches;
    if (bothMature && distance <= spanPercent) {
      if (lower.highConvictionResistance && higher.highConvictionResistance) {
        survivors.push(lower, higher);
      } else if (lower.highConvictionResistance) {
        survivors.push(lower);
      } else if (higher.highConvictionResistance) {
        survivors.push(higher);
      } else {
        const winner = higherConviction(higher, lower) ? higher : lower;
        if (winner === higher) winner.highConvictionResistance = true;
        survivors.push(winner);
      }
      index += 2;
    } else {
      survivors.push(lower);
      index += 1;
    }
  }
  return survivors;
}

const adskResistanceDestinations = [
  { center: 215.829, touches: 5, spread: 32.8, low: 214.1, high: 217, highConvictionResistance: false },
  { center: 227.52, touches: 11, spread: 33.2727, low: 223.03, high: 239.01, highConvictionResistance: true },
  { center: 274.82, touches: 17, spread: 27.1471, low: 265.75, high: 286.32, highConvictionResistance: false },
  { center: 310.23, touches: 7, spread: 27.1429, low: 303.69, high: 312.62, highConvictionResistance: true },
  { center: 319.115, touches: 8, spread: 28.5, low: 315.46, high: 322.68, highConvictionResistance: false },
  { center: 339.935, touches: 2, spread: 3, low: 335.48, high: 344.39, highConvictionResistance: false },
];
assert.deepEqual(
  compactResistance(adskResistanceDestinations, adskSpan)
    .map((zone) => Number(zone.center.toFixed(2))),
  [227.52, 274.82, 310.23, 339.94],
);

console.log(JSON.stringify({
  formula: "min(10%, 2.75 × smoothed Daily ATR%)",
  adsk: {
    effectiveSpanPercent: adskSpan,
    supports: adskSupports.slice(0, 4).map((zone) => Number(zone.center.toFixed(2))),
  },
  mu: {
    effectiveSpanPercent: muSpan,
    supports: muSupports.slice(0, 5).map((zone) => Number(zone.center.toFixed(2))),
  },
  metaTransitionalSupports: metaSupports.map((zone) => Number(zone.center.toFixed(3))),
}, null, 2));
