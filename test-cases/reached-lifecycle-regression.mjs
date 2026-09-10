import assert from "node:assert/strict";
import fs from "node:fs";

const pineSource = fs.readFileSync(
  new URL("../pine/monthly-close-support.pine", import.meta.url),
  "utf8",
);

assert.equal(pineSource.includes("varip array<bool> supportReachArmed"), true);
assert.equal(
  pineSource.includes("enableReachedAlerts and array.get(supportReachArmed, stateIndex)"),
  true,
);
assert.equal(pineSource.includes("f_isLatchedResistance(resistance) and"), true);
assert.equal(
  pineSource.includes("isVisibleMr and array.get(mrLatched, stateIndex) and"),
  true,
);

function supportReachPath(prices, approachBoundary, support) {
  let armed = false;
  return prices.slice(1).map((price, index) => {
    const previous = prices[index];
    if (previous > approachBoundary && price <= approachBoundary) armed = true;
    const reached = armed && previous > support && price <= support;
    if (reached) armed = false;
    return reached;
  });
}

function resistanceReachPath(prices, approachBoundary, resistance) {
  let armed = false;
  return prices.slice(1).map((price, index) => {
    const previous = prices[index];
    if (previous < approachBoundary && price >= approachBoundary) armed = true;
    const reached = armed && previous < resistance && price >= resistance;
    return reached;
  });
}

assert.deepEqual(
  resistanceReachPath([100, 110, 115, 125], 110, 125),
  [false, false, true],
);
assert.deepEqual(
  supportReachPath([140, 130, 125, 120], 130, 120),
  [false, false, true],
);

assert.deepEqual(resistanceReachPath([115, 125], 110, 125), [false]);
assert.deepEqual(supportReachPath([125, 120], 130, 120), [false]);
assert.deepEqual(resistanceReachPath([130, 125], 110, 125), [false]);
assert.deepEqual(supportReachPath([110, 120], 130, 120), [false]);

assert.deepEqual(resistanceReachPath([100, 126], 110, 125), [true]);
assert.deepEqual(supportReachPath([140, 119], 130, 120), [true]);

console.log("Directional reached-alert lifecycle: OK");
