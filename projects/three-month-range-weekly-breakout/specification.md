# Three-Month Consolidation Specification

The script runs on `1W`. Pine Screener rejects direct `3M` requests, so the
script obtains structural data from one permitted, fixed `1M`
`request.security()` call and assembles completed calendar-quarter candles.
For example, during May it skips April and combines January-March as the latest
completed 3M candle. An active quarter and the Weekly breakout candle therefore
cannot modify the boundary.

The minimum consolidation input is expressed in calendar months and converted
to 3M bars with `ceil(months / 3)`. The default six months therefore requires
two completed 3M bars. The ten-year setting is a maximum 40-bar search horizon,
not a minimum history gate.

Candidate construction mirrors the 1M range detector:

1. Find extreme high and low for each candidate duration.
2. Average highs/lows within the configured tolerance to form boundaries.
3. Require two touches at each boundary and a touch span covering the minimum
   number of 3M bars.
4. Require a recent upper touch, 80% close containment, no materially broken
   close, and width no greater than 40%.
5. Choose longest touch span, longest window, most touches, then narrowest
   width.

The Weekly signal requires prior close at or below the ceiling, current close
strictly above it, a bullish candle, and total volume at least 1.1x the average
of the prior 20 completed Weekly bars.

Before the signal can match, estimated market capitalization must be at least
5.0 billion in the selected normalization currency (`USD` by default or
`EUR`). The estimate uses FQ total shares outstanding with an FY fallback,
multiplies by the tested Weekly close, and applies TradingView's daily FX rate.
When shares or FX data is missing, the market-cap gate is bypassed and the
other signal rules still apply; `Market cap (bn)` remains blank. Exactly 5.0
billion passes.

The ten Pine Screener outputs are Match, upper/lower range, range months, range
width, breakout percentage, Weekly volume, volume multiple, market
capitalization in billions, and data availability.

The monthly request needs at most 124 bars: 120 months for the maximum range,
up to two alignment months, and one complete oldest quarter. Ten years remains
a maximum search horizon, never a minimum-history requirement.

Together, the monthly structural request, two shares-outstanding requests, and
one currency-rate request use four of Pine Screener's five allowed requests.
