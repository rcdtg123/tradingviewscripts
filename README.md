# TradingView Support Zones

This project contains Pine Script v6 indicators for structural Monthly support,
Monthly resistance, volume-confirmed breakouts, and resistance retests.

The implementation is intentionally staged:

1. Validate Monthly low-cluster detection.
2. Add Weekly detection using the same detector.
3. Add combined alert arbitration, where Monthly alerts take precedence over
   Weekly alerts on the same symbol and bar.

See [specifications/support-detection.md](specifications/support-detection.md)
for the frozen behavioral specification and
[test-cases/validation-cases.md](test-cases/validation-cases.md) for the manual
TradingView validation procedure.

The unified implementation is in
[pine/monthly-close-support.pine](pine/monthly-close-support.pine). It combines
Monthly-low support, former-support resistance, Monthly-high resistance,
volume-confirmed breakout, cross-family MR-priority arbitration, and retest support.
