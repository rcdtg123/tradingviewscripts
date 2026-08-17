# TradingView Monthly Market Structure

This project contains a unified Pine Script v6 indicator for detecting and
monitoring structural price zones derived from completed Monthly candles.

The indicator combines Monthly-low support, former support acting as
resistance, Monthly-high resistance, volume-confirmed resistance breakouts,
and post-breakout retest support. Weekly support is intentionally outside the
project scope because the Monthly levels currently provide the required signal
quality.

## Main script

The TradingView implementation is:

- [`pine/monthly-close-support.pine`](pine/monthly-close-support.pine)
- Indicator name: **Unified Monthly Structure**
- Short title: **MStruct**
- Pine version: **v6**

Despite the historical filename, support detection now uses completed Monthly
**lows**, not Monthly closes.

## Detected market structure

### Monthly support: M1-M5

- Uses completed Monthly candle lows only.
- Examines the latest 120 completed Monthly candles by default.
- Requires at least two qualifying Monthly lows.
- Uses the median qualifying low as the level center.
- Displays up to five surviving support zones below or containing live price.
- Numbers levels by proximity after decluttering: `M1` is the nearest surviving
  Monthly support, followed by `M2` through `M5`.
- Two-touch zones are Developing and orange; zones with three or more touches
  are Established and blue.

### Former support resistance: R1-R3

A Monthly-low cluster above current price can become resistance after price has
fallen below it. These zones:

- Require at least four qualifying completed Monthly lows by default.
- Are displayed above live price as `R1` through `R3`.
- Use red boxes and labels.
- Retain the historical strength of the original support cluster.

### Monthly-high resistance: MR1-MR5

- Uses completed Monthly candle highs only.
- Requires at least two qualifying Monthly highs by default.
- Displays up to five surviving resistance zones strictly above live price.
- Numbers levels by proximity as `MR1` through `MR5`.
- Uses red boxes and labels because both `R` and `MR` represent resistance.

### Retest support

After a valid volume-confirmed `MR` breakout, the broken resistance can become
green Retest support. The indicator monitors a later downward return to that
level and invalidates the retest state if price falls sufficiently below it.

## Volatility-adaptive zones

The indicator normalizes clustering and approach zones using confirmed Daily
ATR data:

- Daily ATR length: 14 bars.
- Daily ATR-percent smoothing: 50 bars.
- Maximum historical cluster width: `2.0 × smoothed Daily ATR%` by default.
- Approach width: `0.75 × smoothed Daily ATR%`.
- Minimum approach width: 1%.
- Maximum approach width: 7%.

Support approach zones extend only upward from their median support level; they
do not add padding below the actual Monthly low. Resistance zones mirror this
behavior and extend downward from their center so an approaching rise can be
detected before price reaches resistance.

The displayed boundaries and alert boundaries are identical.

## Strength and decluttering

Nearby structural levels can otherwise create overlapping boxes and redundant
alerts. The indicator therefore declutters candidates within a 10% neighborhood
by default before assigning visible level numbers.

Survival is conviction-first:

1. Greater Monthly touch count.
2. Greater temporal spread between qualifying Monthly candles.
3. Narrower historical cluster.
4. For equal-conviction cross-family resistance, `MR` takes preference over
   `R`.
5. A deterministic directional destination resolves any remaining tie.

This ensures that a high-conviction zone is not discarded merely because a
weaker zone is closer to current price. Suppressed zones are neither displayed
nor alerted, keeping chart output and alert behavior consistent.

## Alerts

Alerts evaluate live intraday price movement and can include pre-market and
post-market data when the TradingView alert is configured for Extended hours.

### Support alerts

- **Approaching support:** falling price crosses the upper approach boundary.
- **Reached support:** falling price reaches or crosses the median Monthly-low
  level.
- **Broke support:** price falls `0.25 × Daily ATR` below the support level.

Rising into a support zone from below does not trigger these alerts. Alert
stages do not repeat while price remains near the same zone and rearm only after
price moves sufficiently above the approach band.

### Resistance alerts

- **Approaching resistance:** rising price enters a displayed `R` or `MR` zone
  from below.
- Falling into a resistance zone from above does not trigger the approach
  alert.
- The indicator latches an approached level as resistance during its breakout
  cycle so it is not prematurely reclassified.

### Volume-confirmed breakouts

Breakout conviction requires price to exceed resistance by `0.25 × confirmed
Daily ATR` and volume confirmation against the previous 20 completed Daily
bars.

- Former-support `R` breakouts can alert independently at 2x, 4x, and 8x
  average Daily volume during one breakout cycle.
- Monthly-high `MR` breakout sends one notification once volume is at least 2x
  average and reports the actual multiple, such as 5x.
- Extended-session cumulative Daily volume is used so earnings-related moves
  outside regular market hours can qualify.
- A qualified `MR` breakout activates the Retest-support workflow.

### Alert strength notation

Dynamic messages include the number of qualifying Monthly candles as `2xM`,
`3xM`, `6xM`, and so on.

### TradingView alert lifecycle

TradingView alerts retain a snapshot of the script and inputs that existed when
the alert was created. After changing or replacing the Pine script, delete the
old alert and create it again so the latest logic is used.

## Chart display

- Blue: Established Monthly support with three or more touches.
- Orange: Developing Monthly support with two touches.
- Red: Resistance from either the `R` or `MR` family.
- Green: Post-breakout Retest support.
- Labels are placed at the left edge to keep the latest candles uncluttered.
- No diagnostics table or verbose zone statistics are drawn.

## Default configuration

| Setting | Default |
| --- | ---: |
| Completed Monthly candles | 120 |
| Daily ATR length | 14 |
| Daily ATR% smoothing | 50 |
| Cluster width multiplier | 2.0 |
| Approach ATR% multiplier | 0.75 |
| Minimum approach width | 1% |
| Maximum approach width | 7% |
| Minimum Monthly lows for support | 2 |
| Minimum Monthly lows for `R` | 4 |
| Visible support zones | 5 |
| Visible `R` zones | 3 |
| Minimum Monthly highs for `MR` | 2 |
| Visible `MR` zones | 5 |
| Decluttering neighborhood | 10% |
| Break/rearm distance | 0.25 Daily ATR |
| Breakout conviction distance | 0.25 Daily ATR |

All settings can be changed from the indicator's Inputs panel in TradingView.

## Installation in TradingView

1. Open a TradingView chart and select **Pine Editor**.
2. Copy the complete contents of
   [`pine/monthly-close-support.pine`](pine/monthly-close-support.pine).
3. Replace the editor contents, save the script, and select **Add to chart**.
4. Review the indicator Inputs and keep the chart on a Daily or intraday
   timeframe for live alert evaluation. Monthly levels are requested internally.
5. Create an alert using the indicator's desired condition. Use Extended hours
   when pre-market and post-market monitoring is required.
6. Recreate alerts whenever the script or relevant inputs change.

## Project documentation and validation

- [`specifications/support-detection.md`](specifications/support-detection.md)
  describes the detailed detection, ranking, display, and alert contract.
- [`test-cases/validation-cases.md`](test-cases/validation-cases.md) contains the
  manual TradingView validation scenarios.
- [`test-cases/meta-replay.mjs`](test-cases/meta-replay.mjs) reproduces key
  Monthly-zone and price-path behavior against exported META data.

## Architecture

Pine Script does not provide conventional class inheritance or interfaces. The
indicator applies maintainability principles through user-defined types, typed
functions, arrays, and separated modules for:

- Monthly observation collection.
- Volatility-bounded clustering.
- Strength ranking and decluttering.
- Support/resistance classification.
- Rendering.
- Stateful alert evaluation and rearming.

Detection functions remain separate from chart drawing and alert side effects,
making future changes easier to test and reason about.
