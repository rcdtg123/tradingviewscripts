# Pine Volume Semantics

## Choose the measurement that matches the rule

### Ordinary volume

`volume` is total bar volume. A bullish candle plus high relative volume is a
portable buying-pressure proxy, not measured buy volume.

### Volume Delta and CVD

TradingView's Volume Delta classifies lower-timeframe volume by intrabar price
direction and calculates buy-minus-sell volume for each chart bar. CVD
accumulates those per-bar deltas over an anchor period.

Use per-bar buy volume, sell volume, delta, or buy share for a rule about one
specific candle. Use CVD when the rule genuinely concerns accumulated pressure,
trend, or divergence. Do not use an anchor-dependent cumulative value as a
substitute for one bar's volume multiple.

Official descriptions:

- [Volume Delta](https://www.tradingview.com/support/solutions/43000725057-volume-delta/)
- [Cumulative Volume Delta](https://www.tradingview.com/blog/en/new-volume-delta-indicators-44132/)

### Footprint data

Pine v6 `request.footprint()` returns a footprint ID for the current dataset
bar. When available, its methods expose overall buy volume, sell volume, and
delta as well as row-level data. It is the closest built-in fit for a rule that
explicitly asks for buy volume.

Non-obvious constraints:

- Footprint requests require TradingView Premium or Ultimate.
- Only one unique footprint request can execute in a compiled script.
- Requesting footprint-derived results in another context can create another
  unique footprint request. Keep the footprint on the main dataset when that
  matches the intended timeframe.
- A footprint can be `na`; fail closed or expose availability.
- Pine Screener compatibility must be tested with the complete historical
  operation, not inferred from one current footprint value. In a 2026-09-10
  S&P 500 `1W` test, current footprint buy/sell values populated while a
  previous-20-Week footprint SMA remained `na` across the screen. A rule that
  needs historical footprint values therefore requires an explicit feasibility
  spike and a documented fallback.
- Categorization is based on lower-timeframe price direction. Do not describe it
  as direct exchange aggressor-side volume.
- Calculate a historical baseline with an explicit offset so the candidate bar
  is excluded, for example `ta.sma(barBuyVolume, length)[1]` when evaluating the
  current bar.

Official references:

- [`request.footprint()`](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#requesting-footprints)
- [Volume footprint categorization](https://www.tradingview.com/support/solutions/43000726164-volume-footprint-charts-a-complete-guide/)

## Validation checklist

- Confirm whether the volume source includes regular or extended sessions.
- Verify the baseline excludes the signal candle.
- Test exact threshold equality and the bar immediately below it.
- Test `na`, zero baseline, and insufficient-history cases.
- Verify lower-timeframe coverage for the full required history.
- Label every output as total volume, estimated buy volume, footprint buy
  volume, delta, or CVD—never simply “volume” when the distinction matters.
