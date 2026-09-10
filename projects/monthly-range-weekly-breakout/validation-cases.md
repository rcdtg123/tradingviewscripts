# Validation Cases

## Observed TradingView validation — 2026-09-10

- Final total-volume script compiled without Pine errors on a `1W` chart.
- The saved indicator was selectable in Pine Screener.
- All ten plot columns appeared.
- The S&P 500 scan completed for 503 symbols without a runtime or memory error.
- Ordinary Weekly volume produced populated prior-20-Week multiples and valid
  `Data available` values.
- With `Match > 0.5`, the scan returned one symbol at validation time: PFG.
- PFG reported upper range 113.70, lower range 78.67, range span 11 months,
  range width 36.42%, breakout 2.62%, Weekly volume 9.71M, volume multiple
  1.53x, Weekly candle +4.73%, and `Data available = 1`.
- The PFG Weekly/Monthly chart was opened for a visual sanity check; live price
  was above the reported upper boundary.

The rejected footprint feasibility version also completed the S&P 500 scan,
but current Weekly footprint values had no usable previous-20-Week footprint
average. Its volume multiple remained `na` and `Data available` remained zero,
which triggered the approved total-volume fallback.

## Automated/static checks

- Pine version is v6 and the declaration is an indicator.
- Exactly ten named `plot()` outputs exist.
- A named `alertcondition()` uses the final completed-bar match.
- The default buy-volume threshold is 1.2.
- The volume average excludes the candidate breakout week.
- Monthly range data and history readiness are requested from `1M`.
- The single request path remains below Pine Screener's five-call limit.
- No unsupported `input.timeframe()`, `input.symbol()`, or `input.time()` calls
  are present.

## TradingView compile checks

1. Compile on a `1W` AAPL chart with a Premium or Ultimate account.
2. Confirm all ten outputs appear in the Data Window.
3. Confirm `Data available = 1` for AAPL when at least 120 Monthly candles and
   21 completed Weekly volume bars exist.
4. Change the chart to `1D`; confirm `Data available = 0` and `Match = 0`.
5. Restore `1W`; confirm values use the completed prior week while the current
   week is developing.
6. Test outside an active market week; confirm the latest confirmed bar is used
   directly rather than skipping back two weeks.

## Pine Screener checks

1. Verify the indicator is selectable in Pine Screener.
2. Select a small watchlist and the `1W` timeframe before testing an index.
3. Confirm the first ten plot columns are available.
4. Filter `Match = 1`; inspect every returned chart manually.
5. Filter `Data available = 0`; verify failures correspond to insufficient
   Monthly history or insufficient Weekly volume history.
6. Select the S&P 500 index source and run the full scan.
7. Record scan completion or any runtime/memory error before tuning inputs.

## Positive signal fixture

Find or construct a chart interval where all of these are visually true:

- At least six months between the oldest and newest qualifying boundary touch.
- At least two highs near the detected upper boundary.
- At least two lows near the detected lower boundary.
- At least 80% of Monthly closes inside the clustered boundaries.
- No materially broken Monthly close before the breakout.
- The latest completed Weekly close crosses above the displayed upper range.
- Total Weekly-volume multiple is at least 1.2 and the Weekly candle is bullish.

Expected: `Data available = 1`, `Match = 1`.

## Negative and boundary cases

| Case | Expected result |
| --- | --- |
| Only five months of range behavior | `Match = 0` |
| Only one upper or lower touch | `Match = 0` |
| Boundary interactions span fewer than six months | `Match = 0` |
| Prior Weekly close was already above the same boundary | `Match = 0` |
| Intrawweek high breaks out but Weekly close does not | `Match = 0` |
| Volume multiple is 1.1999 | `Match = 0` |
| Volume multiple is exactly 1.2 on a bullish candle | Volume gates pass |
| Volume multiple passes but the Weekly candle is bearish | `Match = 0` |
| Current developing week qualifies but prior completed week does not | `Match = 0` |
| Fewer than 120 months of symbol history | `Data available = 0`, `Match = 0` |
| Weekly volume is `na` | `Data available = 0`, `Match = 0` |
| Daily screener timeframe | `Data available = 0`, `Match = 0` |
