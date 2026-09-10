---
name: pine-tradingview
description: Design, implement, review, and validate TradingView Pine Script v6 indicators and strategies, especially multi-timeframe, non-repainting, volume-analysis, alert, and Pine Screener work.
---

# Pine TradingView

Use Pine Script v6 unless the user explicitly requires an older version.

## Workflow

1. Read the repository's `AGENTS.md` and preserve project-specific structure,
   tests, and synchronization rules.
2. Convert trading language into an executable specification before coding.
   Define timeframe, completed versus developing candles, lookback boundaries,
   strict/inclusive comparisons, tie-breakers, missing-data behavior, and signal
   recency.
3. For multi-timeframe values, identify which context owns each calculation.
   Keep calculations inside their source timeframe when that preserves history
   or reduces request output.
4. Use confirmed data for signals intended not to repaint. For a higher
   timeframe, prefer an offset expression with `barmerge.lookahead_on`. Verify
   that a breakout bar cannot modify the structural boundary it is breaking.
5. Keep detection/calculation functions free of drawing and alert side effects.
   Expose final scalar series to plots, drawings, and alert conditions.
6. Compile in TradingView Pine Editor, then verify behavior on the intended
   chart timeframe. Pine has no complete local compiler substitute.
7. Validate positive, negative, equality-boundary, insufficient-history,
   missing-data, developing-bar, and timeframe-mismatch cases.

## Routing

- For Pine Screener indicators, read
  [references/pine-screener.md](references/pine-screener.md).
- For buy/sell volume, Volume Delta, CVD, or footprint work, read
  [references/volume.md](references/volume.md).

## Implementation invariants

- Treat native `open`, `high`, `low`, `close`, and `volume` as values from the
  script's execution context.
- Use `request.security()` for another equal/higher context and
  `request.security_lower_tf()` when all lower-timeframe intrabars are needed.
- Consolidate values from the same request context into tuples or a compact
  user-defined result to reduce request count and memory.
- Do not call ordinary bar volume “buy volume”. State the classification or
  proxy explicitly.
- Do not silently substitute a weaker data source when required data is `na`.
  Expose availability or fail closed unless the specification says otherwise.
- A script output should depend on every calculation that must survive compiler
  dead-code elimination.
- Alerts and plots must use the same final signal when users expect chart and
  screener consistency.

## Authoritative references

- [Pine Script v6 manual](https://www.tradingview.com/pine-script-docs/)
- [Pine Script v6 reference](https://www.tradingview.com/pine-script-reference/v6/)
- [Pine release notes](https://www.tradingview.com/pine-script-docs/release-notes/)

