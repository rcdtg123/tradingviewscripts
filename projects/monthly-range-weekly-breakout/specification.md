# Combined Monthly and Weekly-Base Breakout Specification

## Signal definition

The indicator runs in Pine Screener on `1W` and emits `Match = 1` when either
of two independent branches qualifies on the latest completed Weekly candle:

1. `Signal type = 1`: breakout from a range built from completed Monthly bars.
2. `Signal type = 2`: breakout from a compact 6-12 week base.

Both branches require a bullish Weekly candle, a strict close across the
pre-breakout ceiling, and elevated total Weekly volume relative to the prior 20
completed weeks. Total volume is a participation proxy, not measured buy
volume.

If the current Weekly candle is developing, the indicator reports bar `[1]`.
If the last Weekly candle is already confirmed, it reports that candle. Every
structural boundary uses bars preceding the candle being tested.

## Monthly-consolidation branch

The Monthly detector remains the long-duration pattern used for PFG. It runs in
one `1M` `request.security()` context and searches between the configured
minimum and maximum duration, with defaults of 6 and 120 months.

For each duration it:

1. Finds the highest high and lowest low.
2. Averages highs and lows within the 3% touch tolerance of those extremes.
3. Requires at least two upper and two lower touches.
4. Requires touch span of at least six months and a recent upper touch.
5. Requires 80% close containment, no materially broken close, and width no
   greater than 40% of the boundary midpoint.
6. Selects by longest touch span, longest window, most touches, then narrowest
   width.

Ten years is a maximum search horizon, not a listing-age requirement. Monthly
history is sufficient when the configured minimum number of completed Monthly
candles exists. This permits newer listings to use the Monthly branch when
their actual structure qualifies.

The default Monthly breakout volume threshold is `1.1x`. This catches PFG's
2026-04-20 breakout, whose total Weekly volume was approximately `1.176x` its
prior-20-Week average.

## Weekly-base branch

The Weekly-base detector evaluates only completed weeks before the candidate
breakout. Defaults:

| Input | Default |
| --- | ---: |
| Minimum base duration | 6 weeks |
| Maximum base duration | 12 weeks |
| Minimum resistance touches | 2 |
| Resistance touch tolerance | 3% |
| Maximum base width | 40% of midpoint |
| Maximum weeks since resistance touch | 3 |
| Breakout volume multiple | 1.5x |

For each 6-12 week candidate window:

1. The ceiling is the average of highs within 3% of the window's highest high.
2. The floor is the window's lowest low.
3. At least two resistance touches must span at least six weeks.
4. A resistance touch must have occurred in the latest three completed weeks.
5. Every close must remain inside the base and width must not exceed 40%.
6. The signal candle must cross from at or below the ceiling to strictly above
   it, close bullish, and reach at least `1.5x` prior-20-Week volume.

These controls distinguish a short base from a one-week spike. With data cut
off at 2026-05-26, SNOW selects a nine-week base with an upper boundary near
`177.02`, a lower boundary of `118.30`, and `2.748x` volume on the breakout.

## Volume calculation

Both branches use:

```text
prior average = SMA(Weekly total volume, 20)[1]
volume multiple = current Weekly total volume / prior average
```

The signal candle is excluded from its own baseline. CVD is not a required
gate because both PFG and SNOW demonstrate that a valid bullish breakout can
have non-positive Weekly CVD delta.

## Screener output contract

The ten output columns are:

1. `Match`
2. `Signal type` (`0` none, `1` Monthly, `2` Weekly base)
3. `Upper range`
4. `Lower range`
5. `Range length` (months for type 1; weeks for type 2)
6. `Range width %`
7. `Breakout %`
8. `Volume multiple`
9. `Weekly candle %`
10. `Data available`

Filter `Match = 1` in Pine Screener. Use `Signal type` to separate the two
setups when desired.

## Request budget

- One Monthly `request.security()` tuple.
- Weekly-base and volume calculations run directly in the `1W` context.
- Total request count: one, below Pine Screener's five-request limit.
