# Monthly Range + Weekly Breakout Specification

## Signal definition

The indicator emits `Match = 1` only when all conditions are true for the latest
completed Weekly candle:

1. The chart/screener timeframe is `1W`.
2. At least 120 months of symbol history are available to the Monthly request.
3. A qualifying Monthly range existed before the breakout week.
4. The Weekly close crossed from at or below the range ceiling to strictly
   above it, including the configured breakout buffer.
5. The breakout week's total volume is at least 1.2 times the average total
   volume of the previous 20 completed Weekly candles.
6. The breakout Weekly candle is bullish (`close > open`).

If the current Weekly candle is still developing, the indicator evaluates bar
`[1]`. If the last Weekly bar is already confirmed, such as outside an active
market week, it evaluates that bar directly. This prevents both repainting and
an unnecessary extra-week delay.

## Monthly range detector

The detector executes in a `1M` `request.security()` context. It sees only
completed Monthly candles (`[1]` and older relative to that context) and
evaluates rolling windows ending immediately before the candidate breakout
month.

Default inputs:

| Input | Default | Allowed range |
| --- | ---: | ---: |
| Historical Monthly candles | 120 | fixed |
| Minimum range duration | 6 months | 6-24 |
| Maximum range duration | 120 months | 6-120 |
| Minimum upper touches | 2 | 2-10 |
| Minimum lower touches | 2 | 2-10 |
| Boundary touch tolerance | 3% | 0.25-10% |
| Minimum close containment | 80% | 50-100% |
| Maximum range width | 40% of midpoint | 5-200% |
| Maximum months since an upper touch | 3 | 1-12 |

For every candidate duration from the configured minimum through maximum:

1. Find the highest Monthly high and lowest Monthly low.
2. Treat highs within the touch tolerance of the extreme high as upper touches;
   treat lows within the tolerance of the extreme low as lower touches.
3. Average qualifying highs and lows to form the upper and lower clustered
   boundaries.
4. Require the configured number of touches at each boundary.
5. Require the oldest and newest boundary interactions to span at least the
   minimum range duration.
6. Require an upper-boundary touch within the configured recent-touch window.
7. Require at least the configured percentage of Monthly closes to be between
   the clustered boundaries.
8. Reject a candidate if any close is materially outside the boundaries by more
   than the boundary tolerance.
9. Reject a candidate whose boundary-to-boundary width exceeds the configured
   percentage of their midpoint.

When multiple windows qualify, choose deterministically by:

1. Longest boundary-touch span.
2. Longest candidate window.
3. Highest combined upper/lower touch count.
4. Narrowest percentage width.

## Weekly breakout

For the Weekly candle being evaluated:

```text
breakout boundary = monthly upper boundary * (1 + breakout buffer / 100)
```

A breakout requires:

```text
weekly close > breakout boundary
previous weekly close <= breakout boundary
```

The default breakout buffer is 0%, preserving the requested strict close above
the range. It is configurable up to 5% for later tuning.

## Weekly volume confirmation

The initial Plan B feasibility scan proved that Weekly footprint values are
available for the current bar in Pine Screener, but a stable previous-20-Week
footprint series is not: the footprint buy-volume average and multiple were
`na` across the S&P 500 scan. The approved Plan A fallback therefore uses
ordinary total Weekly volume and labels it accordingly.

For each Weekly candle:

```text
prior average = SMA(weekly volume, 20)[1]
volume multiple = weekly volume / prior average
```

The default gates are:

```text
volume multiple >= 1.2
weekly close > weekly open
```

This is a buying-pressure proxy, not measured buy volume. The bullish candle
requires upward Weekly price progress, while the relative-volume gate requires
elevated participation. CVD remains unsuitable as the primary threshold because
it is anchor-dependent cumulative net delta.

Missing volume or history data sets `Data available = 0` and `Match = 0`.

## Screener output contract

The indicator exposes ten Pine Screener columns:

1. `Match`
2. `Upper range`
3. `Lower range`
4. `Range months`
5. `Range width %`
6. `Breakout %`
7. `Weekly volume`
8. `Volume multiple`
9. `Weekly candle %`
10. `Data available`

It also exposes one `Monthly range Weekly breakout` alert condition. In Pine
Screener, filter `Match` equal to `1` to return only qualifying symbols.

## Request and execution budget

- One `request.security()` call for Monthly range calculations, limited with
  `calc_bars_count` to the required history plus warm-up.
- Main indicator history limited to enough Weekly bars for the 20-Week baseline
  and confirmation offsets.
- Total: one request path, below Pine Screener's five-call limit.
