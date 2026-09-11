# Validation Cases

## Automated replay

- Two completed, similarly bounded 3M candles can represent the minimum six
  months and qualify when all other conditions pass.
- One completed 3M candle cannot qualify.
- Exact 1.1x Weekly volume passes; 1.0999x fails.
- Market cap at exactly 5.0 billion passes and 4.999 billion fails. Missing
  shares/FX data bypasses the market-cap gate while all other rules still apply.
- A bearish candle, prior close already above the ceiling, missing volume, or a
  non-Weekly chart fails.
- Calendar-quarter assembly skips incomplete months. In May, April is excluded
  and January-March is the latest completed 3M candle.
- The script has exactly ten plots and four requests: one permitted `1M`
  request, two financial requests, and one currency-rate request.
- Minimum history uses the configured minimum range bars, not 40 bars.

## Live checks

1. Compile on a `1W` chart.
2. Verify all ten outputs in the Data Window and Pine Screener.
3. Confirm `1D` produces `Data available = 0` and `Match = 0`.
4. Compare the range against completed 3M candles, especially during the
   middle of a developing 3M period.
5. Test a small watchlist, then the target index with `Match = 1`.
6. Verify a known sub-5-billion stock reports `Match = 0` in both USD and EUR
   normalization modes.

## TradingView validation evidence

- The first chart version using a direct `3M` request compiled, but Pine
  Screener rejected it and listed `1M` as the largest permitted structural
  timeframe.
- The production version therefore synthesizes completed calendar-quarter
  candles from a single `1M` request.
- On 2026-09-11 that corrected version compiled, exposed all ten columns, and
  completed a Pine Screener `1W` scan without the unsupported-timeframe error.
- The market-cap-gated revision then completed a 503-symbol S&P 500 `1W` scan;
  `Market cap (bn)` was populated and no request-limit error occurred.
- Repeating that scan with EUR normalization also completed successfully and
  produced converted values; the saved screener setting was then restored to
  the USD default.
- The subsequent missing-data-bypass revision compiled and completed another
  503-symbol S&P 500 `1W` scan successfully.

## Boundary caveat

Six months means only two 3M observations. The default two-touch requirement
makes this strict: both completed candles generally need to interact with both
range zones. Users seeking more statistical evidence can raise the minimum to
9 or 12 months.
