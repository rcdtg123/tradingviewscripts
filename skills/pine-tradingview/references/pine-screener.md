# Pine Screener Constraints

Read the current official
[Pine Screener requirements](https://www.tradingview.com/support/solutions/43000742436-tradingview-pine-screener-key-features-and-requirements/)
before implementation because limits can change.

As verified on 2026-09-10:

- The script must be an indicator with at least one supported `plot*()` or
  `alertcondition()` output.
- Only one indicator is used per screen; indicator-on-indicator is unavailable.
- A screen can use an index source with up to 4,000 symbols.
- Supported scan/request timeframes are `1`, `5`, `15`, `30`, `60`, `120`,
  `240`, `1D`, `1W`, and `1M`.
- A screened script can contain no more than five separate `request.*()` calls.
- `input.timeframe()`, `input.symbol()`, and `input.time()` are not dependable
  screener controls because the screener uses their defaults.
- The screener calculates the last 500 bars of the scan timeframe.
- Plots are result columns and filter sources. The first ten enabled plots are
  shown by default; additional output should be intentional.

## Design checklist

- Fix required timeframes as constants and expose a `Data available` or
  `Timeframe valid` output when misuse should fail closed.
- Perform long history calculations inside the requested context when the 500
  scan bars do not cover the required calendar period.
- Budget request calls before coding and combine same-context expressions.
- Put `plot*()` and `alertcondition()` calls in global scope.
- Use a numeric `Match` plot (`1`/`0`) when users need a simple result filter.
- Explain that the user must configure `Match = 1`; a Pine indicator cannot
  itself delete non-matching screener rows.
- Test a small watchlist before a large index and inspect both matches and
  non-matches on charts.

