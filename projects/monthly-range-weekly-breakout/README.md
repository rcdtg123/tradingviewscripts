# Monthly and Weekly-Base Breakout

`monthly-range-breakout.pine` is a Pine Script v6 indicator built for
TradingView Pine Screener. It combines a long Monthly-consolidation breakout
with a separate 6-12 week base-breakout pattern. Both require a confirmed
Weekly close above a pre-breakout ceiling and elevated total Weekly volume.

## Approved defaults

- Up to 120 completed Monthly candles searched; only the configured minimum is
  required for newer listings.
- Estimated market cap of at least 5.0 billion, normalized to USD by default;
  EUR can be selected in the indicator settings.
- Range duration of at least six months and up to 120 months.
- At least two upper and two lower boundary touches.
- Latest completed Weekly candle only.
- Monthly breakout volume at least 1.1x the previous 20 completed weeks.
- Weekly-base breakout volume at least 1.5x the previous 20 completed weeks.
- Weekly base of 6-12 completed weeks, no wider than 40%, with two recent
  resistance touches spanning at least six weeks.
- Bullish breakout candle (`close > open`).

See [`specification.md`](specification.md) for the exact algorithm and
[`implementation-plans.md`](implementation-plans.md) for the alternatives that
were considered.

Run `node model-replay.mjs` from this directory for the deterministic detector,
threshold-boundary, and static Pine contract checks. This supplements but does
not replace compilation in TradingView.

## TradingView setup

1. Open Pine Editor, paste `monthly-range-breakout.pine`, and save it as a
   personal indicator.
2. Compile it on a standard `1W` chart.
3. Open Pine Screener and choose the desired index source, such as S&P 500.
4. Select **Monthly + Weekly Base Breakout** as the indicator.
5. Set the Pine Screener timeframe to **1 week**.
6. Add the filter **Match = 1**. This is the step that hides all non-qualifying
   symbols; Pine indicators expose filter values but do not directly remove
   table rows.
7. Keep **Market cap (bn)** and **Data available** visible during initial use.

`Signal type = 1` identifies a Monthly-range breakout and `Signal type = 2`
identifies a Weekly-base breakout. The approved footprint feasibility attempt returned current Weekly footprint
values but no usable previous-20-Week footprint average in Pine Screener. The
production indicator therefore uses and clearly labels total Weekly volume. A
symbol without enough Monthly, Weekly volume, shares-outstanding, or FX history
returns `Data available = 0` and `Match = 0`. A stock below the configured
market-cap floor always returns `Match = 0`.

## Status

The original Monthly-only indicator compiled and completed an S&P 500 `1W`
scan on 2026-09-10. The combined revision compiled successfully in TradingView
on 2026-09-11 and was saved as **Monthly + Weekly Base Breakout**. Its
market-cap-gated revision also completed a 503-symbol S&P 500 `1W` scan on
2026-09-11.
