# Manual Validation Cases

## NVDA Monthly-low conceptual case

The detector must be validated against completed Monthly lows from TradingView.
The earlier reference image contained illustrative Monthly closes and is no
longer an expected-output source after the switch to Monthly-low detection.

Example qualifying lows:

| Observation | Monthly low |
|---|---:|
| M1 | 173.00 |
| M2 | 170.00 |
| M3 | 171.00 |
| M4 | 170.00 |

- These observations form one zone if their total percentage width is within the
  current volatility-derived limit.
- Observed qualifying-low range is 170.00–173.00.
- Median center is 170.50.
- The alert/display zone starts at 170.50 and extends only upward by the
  configured volatility-adaptive approach distance.
- Approach width percentage equals `0.75 * smoothed Daily ATR%`, subject to a 1%
  minimum and 7% maximum.
- Touches equal 4.
- Status is Established.
- Temporal strength is higher than four comparable lows concentrated within
  a single year.

The image is illustrative rather than authoritative market data. Compare the
indicator against TradingView's actual split-adjusted Monthly history before
accepting these dates or prices as exact.

## Alert-state cases

1. Every alert-eligible zone is visible, and no hidden zone can trigger.
2. Outside -> M1 approach band: one approach alert.
3. Remain inside the approach band: no repeat.
4. Fall to/cross M1 support: one reached alert.
5. Fall `0.25 * Daily ATR` below M1: one break alert.
6. Recover meaningfully above the approach boundary, then re-enter: a new
   approach/reached sequence is allowed, including within the same day.
7. Gap through approach and support: reached alert only.
8. Gap through multiple displayed supports: one reached alert per crossed
   support.
9. Rising into a band from below: no alert.
10. Alert starts while already inside a band or below support: no startup alert;
    wait for a future observed downward crossing from above.

## Display-priority cases

1. When more than five supports qualify, display the five nearest zones at or
   below current price.
2. A very strong but distant historical zone must not displace a nearer valid
   support from the visible shortlist.
3. For equal-distance zones, prefer greater temporal spread, then more touches,
   then the narrower zone.
4. Resolve support candidates as non-transitive adjacent pairs from highest to
   lowest. Retain each pair's higher member as actionable and retain its lower
   member as `HC` only when the lower member has greater conviction.
5. A chain of individually close supports must not collapse distinct endpoints
   whose direct separation exceeds 10% merely because intermediate levels bridge
   them.
6. If the next non-overlapping support is near 89, the visible result begins
   `M1 96.xx`, `M2 89.xx`.
7. Group the complete candidate list before selecting five visible/alertable
   supports.
8. For support near 96.366 and 88.346 inside the same crowding region, retain
   96.366 as the nearest actionable level. If 88.346 has greater Monthly touch
   count (then temporal spread/width), also retain and mark it `HC`.
9. For ADBE, support bands centered near 218.74 and 205.99 overlap and span about
   5.83%; retain 218.74 as actionable and retain 205.99 as `HC` only if it has
   greater conviction.
10. For BANKNIFTY near 57,500, repeated Monthly lows around 49,800–50,600 form
    a high-conviction support. Preserve the nearer 55,xxx region as M1 for
    approach/reached alerts and also retain the approximately 50,xxx region as
    a lower `HC` support when its conviction is greater.
11. For META after price moves below the 553.xx support, preserve the nearer
    522.xx two-touch zone as M1. Also retain the stronger lower 477.xx zone as a
    separate `HC` support; both must draw and alert from the same boundaries.
12. For META near 568, the 522.xx intermediate candidate must not transitively
    group 553.xx with 477.xx. The visible supports begin near 553.xx and 477.xx,
    not 553.xx and 339.xx.

## Resistance and volume-breakout cases

1. A detected zone above price with four or more qualifying completed Monthly
   lows appears red as R1, with its approach band below the resistance center.
2. A two- or three-low zone above price does not display or alert as resistance,
   even though the same zone remains eligible as support when below price.
3. Rise from below the resistance band into it: emit one resistance-approach
   alert and latch the zone as resistance.
4. Remain inside or rise through the center: do not repeat the approach alert
   and do not reclassify the latched zone as support.
5. Enter the resistance band while falling from above: emit no resistance
   approach alert.
6. Gap from below the band to above resistance: latch it and evaluate breakout
   qualification on the same update.
7. Below `resistance + 0.25 * Daily ATR`, emit no breakout alert even when
   cumulative extended-session Daily volume is at least 2x its baseline.
8. At conviction price with volume below 2x, wait. If volume later reaches 2x
   while price retains conviction, emit the 2x alert.
9. If volume reaches 2x first, emit the 2x alert when price later reaches
   conviction.
10. Emit each 2x, 4x, and 8x alert at most once per breakout cycle and include
   the actual volume multiple in each message.
11. Use current extended-session Daily cumulative volume and the previous 20
    completed extended-session Daily bars for the average-volume baseline.
12. Retreat below the lower resistance-band boundary by `0.25 * Daily ATR`:
    unlatch and rearm the resistance alerts for that zone.

## Monthly-high resistance and cross-family-priority cases

1. Two completed Monthly highs within the cluster-width limit produce an MR
   center at their median; a developing Monthly high never participates.
2. Display the nearest five MR centers strictly above live price. Never display
   an MR center below price, including while it remains latched internally.
3. When an MR shares a connected 10% neighborhood with former-support R zones,
   display only the highest-conviction member. Prefer MR only on a strength tie.
4. Rising entry into the surviving MR emits one approach alert; suppressed R
   mechanisms emit no duplicates.
5. At `MR + 0.25 * Daily ATR` and actual extended-session volume of 5.00x,
   emit one breakout notification reporting 5.00x—not separate 2x and 4x alerts.
6. After breakout, replace MR with green retest support. A later
   downward entry through its upper band emits one retest alert.
7. Invalidate retest support below `MR - 0.25 * Daily ATR`; the old structural
   mechanisms can classify the region again on later updates.
8. A hidden MR outside the nearest-five shortlist cannot begin an approach or
   breakout lifecycle.
9. For ADBE, overlapping MR centers near 262.27 and 277.61 span about 5.85%;
   retain only the higher 277.61 destination. If old R1 is in the same 10%
   neighborhood, suppress R1 and display/alert only `MR1 277.61`.
10. For COIN, MR1 187.39, R2 202.59, MR2 216.77, and R3 231.17 form a connected
    10% cross-family neighborhood. Retain the member with greatest Monthly
    touch count. Only if conviction ties should MR beat R and the higher MR beat
    the lower MR.
11. Every support, resistance, breakout, and retest alert includes strength in
    `NxM` notation matching the survivor's qualifying Monthly candle count.

## TradingView validation sequence

1. Paste the Pine source into a new Pine Editor indicator.
2. Compile using Pine Script v6.
3. Add it to a standard candlestick chart, initially on the Daily interval.
4. Test NVDA and several low-, medium-, and high-volatility securities.
5. Compare detected clusters to completed Monthly lows.
6. Confirm the developing Monthly candle never changes existing membership.
7. Create a single-symbol test alert before creating a watchlist alert.
8. Use Bar Replay to exercise entry, persistence, exit, rearm, and break cases.
