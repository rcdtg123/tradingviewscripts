# Monthly Range + Weekly Breakout Pine Screener

## Planning status

Review completed on 2026-09-10. The approved path is Plan B, with Plan A only as
a fallback if Weekly footprints fail the TradingView feasibility check. The
approved baseline is the previous 20 completed Weekly buy-volume values, signal
recency is the latest completed Weekly candle, and the starting volume multiple
is 1.2x rather than the originally proposed 1.5x.

The live feasibility result selected the fallback: Pine Screener returned the
current Weekly footprint values but not a usable previous-20-Week footprint
series. The production script therefore retains the touch-confirmed Monthly
range detector and uses Plan A's bullish-candle plus total Weekly relative-volume
confirmation, accurately labeled as total volume.

## Objective

Build one Pine Script v6 **indicator** that can be selected in TradingView Pine
Screener and used against an index source such as the **S&P 500**. The screener
must return only symbols where:

1. Monthly price action formed a bounded upper/lower range for at least six
   months within the most recent ten years.
2. The latest completed Weekly candle closed above that range's upper boundary.
3. The breakout week's chosen buying-volume measure was at least 1.5 times its
   historical baseline.

“SAP500” in the request is interpreted as “S&P 500”. The implementation will
not hard-code the index: Pine Screener supplies each constituent symbol to the
indicator.

## Confirmed Pine Screener constraints

The design must honor the current TradingView constraints below.

- Pine Screener accepts an indicator with at least one supported `plot*()` or
  `alertcondition()` output. Plots become filterable/result columns.
- One indicator can be used per screen. Indicator-on-indicator input is not
  supported.
- Index sources are supported and can contain up to 4,000 symbols.
- The scan timeframe must be one of TradingView's supported fixed timeframes.
  The required Weekly scan uses `1W`.
- A screened script can contain at most five separate `request.*()` calls, and
  requested timeframes are restricted to `1`, `5`, `15`, `30`, `60`, `120`,
  `240`, `1D`, `1W`, and `1M`.
- `input.timeframe()`, `input.symbol()`, and `input.time()` values are not
  supported reliably by the screener. Timeframes will therefore be constants;
  ordinary numeric, Boolean, and choice inputs can remain configurable.
- Pine Screener calculates only the last 500 bars of the scan timeframe. On a
  Weekly scan this is approximately 9.6 years, so the implementation must do
  the 120-Month range calculation inside a `1M` requested context rather than
  assume 520 Weekly bars are available.
- The first ten enabled plots are shown by default. The output contract should
  stay within ten useful columns.

Official references:

- [Pine Screener: key features and requirements](https://www.tradingview.com/support/solutions/43000742436-tradingview-pine-screener-key-features-and-requirements/)
- [Pine v6 release notes](https://www.tradingview.com/pine-script-docs/release-notes/)
- [Plots and Pine Screener outputs](https://www.tradingview.com/pine-script-docs/visuals/overview/)
- [`display.pine_screener` reference](https://www.tradingview.com/pine-script-reference/v6/)

## Required data and non-repainting rules

Pine's native `open`, `high`, `low`, `close`, and `volume` variables describe
the script's current execution timeframe. Other supported timeframes are
requested with `request.security()` or `request.security_lower_tf()`.

| Purpose | Timeframe | Required values | Confirmation policy |
| --- | --- | --- | --- |
| Range discovery | `1M` | OHLC, close time, optional ATR | Completed Monthly candles only |
| Breakout | `1W` | OHLC, volume, close time | Latest completed Weekly candle only |
| Volume fallback | `1D` or `60` | OHLC, volume | Completed lower-timeframe bars aggregated into the week |

For higher-timeframe requests, confirmed values will use an offset expression
with `barmerge.lookahead_on`, for example
`request.security(syminfo.tickerid, "1M", expression[1], lookahead =
barmerge.lookahead_on)`. This is TradingView's recommended non-repainting
pattern. The implementation must ensure the range boundary used by a breakout
week was known before that week closed; it must not let a breakout candle raise
its own boundary.

Relevant references:

- [Other timeframes and data](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/)
- [Timeframe strings](https://www.tradingview.com/pine-script-docs/concepts/timeframes/)
- [Repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/)
- [Pine limitations](https://www.tradingview.com/pine-script-docs/writing/limitations/)

## What “buy volume” can mean in Pine

Exchange bar volume is total traded volume; ordinary OHLCV bars do not expose
true buyer-initiated volume directly. Pine offers three practical levels of
approximation:

1. **Total Weekly volume proxy:** require a bullish Weekly breakout and compare
   its total volume with an average. This is portable and fast, but it must be
   labeled “relative volume”, not actual buy volume.
2. **Volume footprint buy volume:** Pine v6 `request.footprint()` categorizes
   lower-timeframe volume and exposes `buy_volume()`, `sell_volume()`, and
   `delta()`. This is the closest direct fit, but it requires TradingView
   Premium or Ultimate and can return `na` where footprint data is unavailable.
3. **Lower-timeframe directional estimate:** classify Daily or 60-minute volume
   as buying/selling from intrabar price direction and aggregate it into a
   Weekly value. This follows TradingView's published Volume Delta concept but
   is less precise than footprint data and consumes more computation/history.

Cumulative Volume Delta (CVD) is useful as an optional confirmation that buying
pressure is improving, but it is not the correct primary threshold. CVD sums
net volume delta over an anchor period; the requested rule compares the size of
one breakout week's buying activity with a baseline. Per-week buy volume, buy
share, or per-week delta is therefore the relevant measurement.

Relevant references:

- [Volume Delta calculation](https://www.tradingview.com/support/solutions/43000725057-volume-delta/)
- [Cumulative Volume Delta overview](https://www.tradingview.com/blog/en/new-volume-delta-indicators-44132/)
- [`request.footprint()` and footprint data](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#requesting-footprints)
- [Volume footprint categorization](https://www.tradingview.com/support/solutions/43000726164-volume-footprint-charts-a-complete-guide/)

## Shared signal contract

All three plans use these rules unless a plan explicitly differs:

- Pine version: v6 indicator, not a strategy.
- Pine Screener timeframe: `1W`.
- Historical Monthly search window: 120 completed months.
- Minimum range duration: six completed months.
- Breakout event: latest completed Weekly close is strictly above the
  pre-existing upper boundary, and the preceding completed Weekly close was at
  or below it. A small configurable breakout buffer can reduce one-tick breaks.
- Current developing week never qualifies.
- Missing price or volume data produces `Match = 0` and `Data available = 0`;
  no silent fallback changes the meaning of the selected plan.
- Primary screener filter: `Match == 1` or the equivalent alert condition.
- Suggested result columns: Match, upper range, lower range, range months,
  range width %, breakout %, volume multiple, buy share/delta where applicable,
  and data availability.

The phrase “average of last 20days weekly-average” needs one decision before
implementation. Two coherent definitions are:

- **20-Week baseline:** breakout week's volume divided by the average of the
  previous 20 completed Weekly volumes. This is the conventional Weekly
  relative-volume interpretation and is the default recommendation.
- **20-Day weekly-equivalent baseline:** breakout week's volume divided by five
  times the average of the previous 20 completed Daily volumes. A
  session-count-adjusted variant compares the breakout week's average per
  trading session with the prior 20-Day average; this treats holiday weeks more
  fairly.

## Plan A — Containment range + total Weekly volume

**Best for:** fastest, most portable Pine Screener implementation.

### Range algorithm

Within a `1M` request, evaluate candidate windows from six months up to a
configurable maximum (for example 24 or 36 months) across the last 120 completed
months. For each candidate:

- Upper boundary = highest Monthly high.
- Lower boundary = lowest Monthly low.
- Require range width as a percentage of midpoint to be below a configurable
  cap, optionally normalized by Monthly ATR.
- Require most Monthly closes (for example 80%) to remain inside an inner band
  so one extreme wick does not make any six-month period look like a valid
  base.
- Require at least two interactions near both the upper and lower boundaries.
- Select deterministically by longest duration, then most boundary touches,
  then narrowest ATR-normalized width, then most recent end date.

### Volume algorithm

Require a bullish Weekly breakout and:

`weekly volume / average(previous 20 completed Weekly volumes) >= 1.5`.

### Advantages

- No lower-timeframe or footprint dependency.
- Lowest risk of Pine Screener timeouts and missing volume classifications.
- Easy to explain and validate visually.

### Disadvantages

- Total volume is not buy volume.
- Range-width and containment thresholds materially affect results.
- Highest-high/lowest-low boundaries can be distorted by isolated wicks unless
  the close-containment and touch rules are tuned carefully.

### Estimated request budget

One `request.security(..., "1M", ...)` call; Weekly OHLCV comes from the main
scan context. This is comfortably below the five-call screener limit.

## Plan B — Touch-clustered range + Weekly footprint buy volume

**Best for:** the closest implementation of the stated “buy volume” rule when
the TradingView account is Premium or Ultimate.

### Range algorithm

Reuse the proven non-transitive price-clustering ideas from the existing
Monthly Structure project, but keep this screener implementation independent
and much smaller:

- Collect 120 completed Monthly highs and lows.
- Form bounded high clusters and low clusters without transitive chaining.
- Pair an upper cluster with a lower cluster only when at least six months
  separate the first and last qualifying observations.
- Require at least two touches near each boundary and a configurable percentage
  of Monthly closes inside the pair.
- Reject pairs whose width is excessive relative to Monthly ATR or midpoint.
- Prefer longer-lived pairs, then more total touches, then tighter boundaries,
  then recency.

This detects support/resistance behavior rather than merely finding a rolling
high and low.

### Volume algorithm

On each Weekly bar, obtain the footprint's `buy_volume()`, `sell_volume()`, and
`delta()`. Require:

- Weekly buy volume / average of the previous 20 completed Weekly buy-volume
  values >= 1.5.
- Weekly buy volume > Weekly sell volume.
- Optional minimum buy share, such as 55% or 60%.

CVD can be exposed as an optional diagnostic slope/confirmation column, but it
will not replace the per-week buy-volume ratio.

### Advantages

- Closest match to the requested buying-volume semantics.
- Touch-confirmed boundaries correspond well to visually recognizable trading
  ranges.
- Buy share and delta provide useful quality filters beyond total volume.

### Disadvantages

- Premium/Ultimate requirement.
- Footprint classification is still an intrabar-price-direction model, not a
  direct exchange aggressor-side feed.
- Footprints can be unavailable (`na`) for some symbols/bars.
- This combination must pass an early Pine Screener compatibility/performance
  spike before full implementation; official docs say screeners support
  `request.*()`, but footprint requests also have unique limits.

### Estimated request budget

One Monthly `request.security()` plus one unique `request.footprint()` path.
Keep the footprint on the main Weekly dataset to avoid accidentally creating a
second unique footprint request.

## Plan C — Statistical range + lower-timeframe directional buy volume

**Best for:** avoiding the footprint subscription dependency while retaining a
buy/sell-volume estimate.

### Range algorithm

Evaluate six-to-36-month windows within the 120-Month history and require all
of the following:

- Absolute linear-regression slope of Monthly closes is small relative to
  Monthly ATR.
- The high-low channel width is below a configurable ATR-normalized threshold.
- A high percentage of closes lies within the channel.
- At least one upper and one lower retest occur after the initial boundaries
  form.

Select the longest qualifying window, with narrowness and recency as
tie-breakers. The upper channel edge becomes the breakout boundary.

### Volume algorithm

Use one `request.security_lower_tf()` call for completed `1D` bars inside each
Weekly bar. Classify a Daily bar's volume as buying when its close is above its
open (with previous-close direction as the flat-bar tie-breaker), then sum the
Daily buying estimate for the breakout week.

Two baselines can be implemented after the wording decision:

- Average estimated Weekly buy volume across the prior 20 weeks; or
- Session-adjusted Weekly buy volume compared with the prior 20 Daily sessions.

Require the 1.5 ratio and positive Weekly estimated delta. A 60-minute variant
would improve directional granularity but increase history and computation.

### Advantages

- No footprint subscription dependency.
- More faithful to buying pressure than total Weekly volume.
- Statistical sideways detection is less dependent on exact pivot placement.

### Disadvantages

- Daily direction is a coarse proxy; large two-sided days are assigned wholly
  to one side.
- `request.security_lower_tf()` arrays, session counts, holidays, and shortened
  sessions add complexity.
- Statistical ranges can be less intuitive to users than visible horizontal
  support/resistance touches.
- Highest performance risk of the three plans when scanning hundreds of
  symbols.

### Estimated request budget

One Monthly `request.security()` and one Daily
`request.security_lower_tf()` call. This is below the formal call limit, but
runtime and memory require profiling.

## Comparison and recommendation

| Criterion | Plan A | Plan B | Plan C |
| --- | --- | --- | --- |
| Matches literal buy volume | Low | Highest available | Medium |
| Range interpretability | High | Highest | Medium |
| Account portability | Highest | Premium/Ultimate only | High |
| Screener performance risk | Lowest | Medium | Highest |
| Implementation complexity | Lowest | Highest | High |
| Recommended role | Portable baseline | Preferred semantic version | Fallback experiment |

**Recommendation:** run a short feasibility spike for Plan B first. If Weekly
footprints are available and performant in Pine Screener on the user's account,
implement Plan B. If the spike fails, implement Plan A as the production
version and label its volume metric accurately as total relative volume. Plan C
is worth choosing only if estimated buy/sell separation is more important than
simplicity and scan speed.

## Implementation phases after plan approval

1. Resolve the three open decisions below and write an executable signal
   specification with exact inequalities, tie-breakers, and defaults.
2. Build a minimal Pine Screener feasibility script for the selected volume
   source, verify that a `1M` request can evaluate the required 120-Month
   history despite the screen's 500-Weekly-bar execution window, and test it on
   a small watchlist before adding range detection.
3. Implement the Monthly detector as a pure calculation module with no drawing
   or alert side effects.
4. Add the confirmed Weekly breakout and volume gate.
5. Add no more than ten screener-focused plots plus one named alert condition.
6. Compile in TradingView Pine Editor and verify that the indicator is selectable
   in Pine Screener at `1W`.
7. Validate manually against representative positive, negative, boundary,
   insufficient-history, missing-volume, split-adjusted, and holiday-week cases.
8. Run the S&P 500 screen, inspect a sample of matches and non-matches on charts,
   then tune only specification-approved defaults.
9. Add a compact reusable `pine-tradingview` skill containing durable v6,
   non-repainting, screener, MTF, volume, validation, and repository conventions.
   Keep strategy-specific range thresholds in this project, not in the generic
   skill. Validate the skill with the standard skill validator.
10. Update project documentation, commit task-only files, push to `origin/main`,
    and verify local `main` matches `origin/main`.

## Proposed project layout

```text
projects/
  monthly-range-weekly-breakout/
    implementation-plans.md       # this review document
    README.md                      # usage after implementation
    monthly-range-breakout.pine    # Pine v6 indicator
    specification.md               # exact approved rules
    validation-cases.md            # manual and replay fixtures
```

The existing Monthly Structure files remain untouched during this planning
phase. A later repository-cleanup change can migrate that older project into
its own project directory, with all links and test paths updated atomically.

## Review decisions

1. **Plan B feasibility spike, then Plan A fallback**.
2. **Previous 20 completed Weekly buy-volume values**.
3. **Only the latest completed Weekly breakout**.
4. **1.2x starting buy-volume multiple**.
