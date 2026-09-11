# Three-Month Range Weekly Breakout

This independent Pine Script v6 indicator detects consolidation from completed
calendar-quarter (`3M`) candles and screens for a bullish Weekly close above
the resulting upper boundary with elevated total Weekly volume. It constructs
the 3M candles from monthly data because Pine Screener does not allow a direct
`3M` data request.

## Defaults

- Pine Screener interval: `1W`.
- Minimum consolidation: 6 calendar months, equivalent to two completed `3M`
  candles.
- Maximum search horizon: 120 months, equivalent to 40 completed `3M` candles.
- At least two upper and two lower touches within 3% of the window extremes.
- At least 80% of completed `3M` closes contained inside the range.
- Maximum range width: 40% of the boundary midpoint.
- Breakout volume: at least 1.1x the previous 20 completed Weekly candles.
- Bullish breakout candle and strict close across the ceiling.

## TradingView setup

1. Save `three-month-range-breakout.pine` as **Three-Month Range Weekly Breakout**.
2. Compile it on a `1W` chart.
3. Select it in Pine Screener and keep the screener interval at `1W`.
4. Select the desired index source and filter `Match = 1`.
5. Keep `Data available` visible during initial validation.

## Important 3M behavior

Only completed `3M` candles contribute to the range. During an April-June
candle, the latest usable 3M candle ends in March; during July-September, the
latest usable candle ends in June. This prevents repainting but makes the range
update only at 3M boundaries.

The script deliberately requests `1M`, which Pine Screener supports, then
groups January-March, April-June, July-September, and October-December into
completed 3M candles. A direct `request.security(..., "3M", ...)` compiles on a
chart but is rejected by Pine Screener.

Run `node model-replay.mjs` for deterministic range, threshold, and static
contract checks. TradingView compilation and a Pine Screener `1W` scan are the
final validation steps.

## Status

The monthly-backed calendar-quarter implementation compiled, was saved as
**Three-Month Range Weekly Breakout**, and completed a live Pine Screener `1W`
scan on 2026-09-11 without the unsupported-timeframe error.
