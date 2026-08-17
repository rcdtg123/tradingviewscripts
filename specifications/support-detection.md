# Support Detection Specification

## Scope

The unified indicator detects Monthly-low support, former-support resistance,
Monthly-high resistance, volume-confirmed breakout, and retest support. Its
scope is exclusively Monthly market structure.

## Monthly-high resistance and cross-family priority

- Cluster completed Monthly highs using the same volatility-normalized detector.
- Require two Monthly highs by default and display the nearest five strictly
  above live price as `MR1` through `MR5`.
- When R and MR candidates share a connected 10% neighborhood, retain the
  highest-conviction member. MR preference applies only when conviction ties.
- A Monthly-high breakout requires price at `MR + 0.25 * Daily ATR` and at least
  2x current extended-session Daily volume versus the previous 20-Day average.
  Send one notification and report the actual multiple.
- Convert a qualified MR breakout into green retest support. Alert
  once on a later downward approach and invalidate below
  `MR - 0.25 * Daily ATR`.

## Data

- Use only completed higher-timeframe candle lows.
- Never qualify a zone using a developing Monthly candle.
- Analyze the latest 120 completed Monthly observations by default.
- Use TradingView's supplied, normally adjusted symbol data.

## Volatility normalization

- Calculate Daily ATR(14) as a percentage of Daily close.
- Smooth Daily ATR% over 50 completed Daily bars.
- Use only confirmed Daily values.
- Maximum total low-cluster width defaults to `2.0 * smoothed Daily ATR%`.
- The multiplier describes total width, not a plus/minus width.

## Clustering

- Clusters never use chaining that permits their total width to exceed the
  volatility limit.
- An observation belongs to at most one final cluster.
- The detector deterministically merges the closest eligible low-price clusters.
- A merge is eligible only when the merged cluster's complete low-to-high width
  remains within the volatility limit.
- Cluster-width percentage is normalized by the low/high range midpoint. This
  permits constant-time merge eligibility checks; the displayed center remains
  the median qualifying low.
- At least two Monthly lows are required.
- Two-low zones are Developing; zones with three or more are Established.
- Zone center is the median qualifying Monthly low.
- Monthly closes and rebound behavior do not participate in qualification.
- The displayed M-level is the median qualifying Monthly low.
- Alert/display zones are directional approach bands. Their lower boundary is
  exactly the median support.
- Approach width percentage is volatility-adaptive:
  `clamp(0.75 * smoothed Daily ATR%, 1%, 7%)` by default.
- The 1% floor preserves a useful band for low-volatility securities, while the
  7% ceiling prevents extreme volatility from producing unbounded approach
  zones.
- The upper boundary is `median support + approach width`.
- No padding extends below the median support.

## Strength

- Primary score: average pairwise absolute timestamp separation in calendar
  months.
- Secondary tie-breaker: touch count.
- Further deterministic tie-breakers: narrower zone, then lower center price.
- Strength describes a zone but does not override price relevance when choosing
  which support zones to display.

## Classification and display

- A zone below price is support.
- A zone containing price is current support.
- A zone above live price is classified as Monthly resistance and is eligible
  for the visible resistance shortlist only when its cluster contains at least
  four qualifying completed Monthly lows by default.
- Declutter nearby display candidates independently of historical clustering.
  Adjacent candidates within 10% form a connected crowding neighborhood.
- For each support neighborhood, always preserve the highest center as the
  nearest actionable support for approach/reached alerts. If a lower member has
  greater conviction than that nearest member, also preserve the strongest
  lower member as a separate high-conviction support. Suppress all other members.
- Monthly touch count is the primary conviction measure, followed by temporal
  spread and narrower cluster width. Thus a weaker nearby support is no longer
  allowed to hide the immediate actionable level, while a stronger lower level
  remains visible rather than being discarded.
- Apply grouping to the complete qualifying candidate list before taking the
  visible shortlist, so lower distinct regions are not accidentally omitted.
- Display the five nearest surviving support/current regions by default.
- For nearby resistance regions, continue to apply the directional mirror rule: retain
  the highest resistance and discard lower members. Thus an overlapping
  `MR1 262.27` / `MR2 277.61` pair is represented by the 277.61 region.
- Perform support and resistance consolidation before visible-zone numbering and
  alert selection. Suppressed members neither draw nor alert.
- After same-family decluttering, combine `R` and `MR` candidates into connected
  10% price neighborhoods. Retain the greatest Monthly touch count; then prefer
  greater temporal spread, narrower cluster width, MR type, and finally the
  higher resistance destination. This applies before display and alerts.
- Display the three nearest resistance regions by default. Resistance approach
  bands mirror support bands: they extend downward from the median Monthly low
  using the same volatility-adaptive width.
- The resistance qualification threshold is independent of the support
  threshold: support requires two Monthly lows by default, while resistance
  requires four. A two- or three-low zone can remain support but cannot be
  displayed or alerted as resistance.
- Only surviving displayed M-levels are alertable.
- Distance from current price is the primary display ordering. Temporal spread,
  touch count, width, and center provide deterministic strength tie-breakers.
- Draw a translucent box for the alert zone and a median-center line.
- Place compact labels at the left edge of the visible chart, keeping the latest
  candles clear of text.
- Label visible zones by price proximity: `M1 <center>`, `M2 <center>`, and so
  on. M1 is the nearest Monthly support.
- Add `HC` to the compact label of a retained lower support whose conviction
  exceeds the nearest member of its crowding neighborhood, and include
  `Role: High-conviction support` in its dynamic alerts.
- Do not display a diagnostics table or verbose zone statistics on the chart.

## Alerts

- Alert eligibility and chart display use exactly the same nearest-zone
  shortlist, median-based support, and one-sided ATR approach band. Internally retained zones
  outside the displayed shortlist must not generate alerts.
- Evaluate live price updates intraday, including pre-market and post-market
  when the TradingView watchlist alert session is configured as Extended.
- Send an approach alert when live price first enters the one-sided approach
  band by crossing its upper boundary downward from above.
- Send a distinct reached alert when live price falls to or crosses below the
  median Monthly support from above. Exact equality is not required.
- Send a break alert only after price falls `0.25 * Daily ATR` below support.
- Rising into an approach band or upward through support from below never
  triggers an approach, reached, or break alert.
- Do not repeat a stage while price remains near the same zone.
- Rearm all stages only after price moves at least `0.25 * Daily ATR` above the
  approach boundary.
- If one update gaps through the approach band and support, suppress the
  redundant approach alert and send the reached alert.
- If one update crosses multiple displayed supports, emit an alert for every
  crossed support.
- If an alert starts while price is already inside an approach band or below a
  support, initialize direction state without alerting. A later alert requires
  a newly observed downward crossing from above.
- Every dynamic alert message includes Monthly confirmation strength using the
  notation `2xM`, `3xM`, `6xM`, and so on.

## Resistance and breakout alerts

- Send a resistance-approach alert only when live price rises into the lower
  edge of a displayed resistance band from below. Falling into the band from
  above cannot produce this alert.
- Once approached, latch the level as resistance so crossing above its center
  does not prematurely reclassify it as support.
- Breakout conviction is `resistance + 0.25 * confirmed Daily ATR` by default.
- Use cumulative volume from the current extended-session Daily bar. Compare it
  with the SMA of the previous 20 completed extended-session Daily volumes.
- A breakout qualifies when both conviction price and volume are satisfied,
  regardless of which condition occurs first.
- Send independent, one-time breakout alerts at 2x, 4x, and 8x the prior
  20-Day average volume during the same breakout cycle. Include the actual
  volume multiple in every message.
- Rearm the resistance cycle only after price retreats below the lower approach
  boundary by `0.25 * Daily ATR`.
- Visible and alertable resistance shortlists are identical, as they are for
  support.

## Architecture

Pine does not provide class inheritance or interfaces. The implementation uses
user-defined types, typed functions, arrays, and isolated modules to apply the
useful parts of SOLID:

- Observation and Zone types own domain data.
- Collection, clustering, ranking, classification, rendering, and alerting are
  separate responsibilities.
- Detection code has no drawing or alert side effects.
- Rendering and alert arbitration consume detector output.
