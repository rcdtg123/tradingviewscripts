# Monthly Range Weekly Breakout

`monthly-range-breakout.pine` is a Pine Script v6 indicator built for
TradingView Pine Screener. It detects a repeated Monthly upper/lower trading
range and screens for a confirmed Weekly close above the upper boundary with
elevated total Weekly volume.

## Approved defaults

- 120 completed Monthly candles available.
- Range duration of at least six months and up to 120 months.
- At least two upper and two lower boundary touches.
- Latest completed Weekly candle only.
- Total Weekly volume at least 1.2x the previous 20 completed Weekly-volume
  average.
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
4. Select **Monthly Range Weekly Buy-Volume Breakout** as the indicator.
5. Set the Pine Screener timeframe to **1 week**.
6. Add the filter **Match = 1**. This is the step that hides all non-qualifying
   symbols; Pine indicators expose filter values but do not directly remove
   table rows.
7. Keep **Data available** as a visible diagnostic column during initial use.

The approved footprint feasibility attempt returned current Weekly footprint
values but no usable previous-20-Week footprint average in Pine Screener. The
production indicator therefore uses and clearly labels total Weekly volume. A
symbol without enough Monthly or Weekly volume history returns `Data available
= 0` and `Match = 0`.

## Status

The indicator compiles in TradingView and is selectable in Pine Screener. The
S&P 500 `1W` compatibility scan completed successfully on 2026-09-10.
