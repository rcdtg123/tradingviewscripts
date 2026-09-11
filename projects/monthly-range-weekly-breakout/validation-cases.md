# Validation Cases

## Cutoff backtests

The downloaded source CSVs are not committed. The executable replay retains
only the minimum event fixtures needed to make the expected calculations
deterministic.

### PFG — Monthly branch

Cutoff: week beginning 2026-04-20. Later bars are ignored.

| Value | Result |
| --- | ---: |
| Pre-breakout Monthly upper | 96.6875 |
| Previous Weekly close | 96.17 |
| Breakout Weekly close | 99.34 |
| Weekly volume multiple | 1.176x |
| Monthly threshold | 1.1x |
| Expected signal type | 1 |

The revised 1.1x threshold passes. The Weekly-base branch's 1.5x threshold
does not, keeping PFG assigned to the long-duration pattern.

### SNOW — Weekly-base branch

Cutoff: week beginning 2026-05-26. Monthly data after April 2026 and Weekly
data after the signal candle are ignored.

| Value | Result |
| --- | ---: |
| Selected base | 9 weeks |
| Weekly-base upper | 177.015 |
| Weekly-base lower | 118.30 |
| Base width | 39.79% |
| Previous Weekly close | 172.20 |
| Breakout Weekly close | 255.55 |
| Weekly volume multiple | 2.748x |
| Weekly-base threshold | 1.5x |
| Expected signal type | 2 |

The nine-week selection comes from resistance touches around 177 in the weeks
beginning 2026-03-23 and 2026-05-18. A ten-week window is rejected because its
width exceeds 40%.

## False-positive controls

Automated replay verifies:

- Monthly ranges shorter than six months fail.
- A Monthly breakout at exactly 1.1x passes; 1.0999x fails.
- A Weekly base needs two resistance touches spanning at least six weeks.
- Weekly-base width above 40% fails.
- Weekly-base volume at exactly 1.5x passes; 1.4999x fails.
- Prior close already above the same ceiling, a bearish signal candle, missing
  volume history, or a non-Weekly chart fails closed.
- The signal candle is excluded from the structural range and volume baseline.

An exploratory replay over the supplied history through each cutoff produced
12 combined events for PFG and two for SNOW. Those counts are not labeled
precision statistics because the files provide no ground-truth outcome labels;
they are used to inspect duplicate frequency and verify the target events are
present. Manual chart review remains required before threshold tuning.

## Static contract

- Pine version 6 indicator.
- Exactly ten Pine Screener plots.
- One Monthly request tuple; Weekly-base calculations use the main `1W`
  context.
- No footprint dependency or unsupported screener inputs.
- Ten years is a maximum Monthly search horizon; six completed Monthly candles
  satisfy the default minimum-history gate.
- `Signal type`: 0 none, 1 Monthly, 2 Weekly base.

## Live TradingView checks

1. Compile on a standard `1W` chart.
2. Confirm all ten outputs appear in the Data Window and Pine Screener.
3. Verify `1D` makes `Data available = 0` and `Match = 0`.
4. Test a newer listing with at least six Monthly candles; confirm it is no
   longer rejected solely for lacking ten years of history.
5. Run a small watchlist before the S&P 500 scan.
6. Filter `Match = 1` and review each `Signal type` separately.

## Prior production evidence

The Monthly-only version compiled and completed a 503-symbol S&P 500 `1W` scan
on 2026-09-10. Its footprint feasibility variant lacked historical footprint
averages, so production volume remains ordinary total Weekly volume. The
combined revision compiled and was saved in TradingView on 2026-09-11 as
**Monthly + Weekly Base Breakout**.
