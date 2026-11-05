# v8.1 practical refinements

Start with section17 of WeedGrow_Implementation_Master_v8.1.md for the five
limited changes. The full master includes the v8 baseline. No new routine
client facts, measurements, disease scores or API subscriptions are added.

Run the new standalone air helper tests:

    python WeedGrow_API_Air_Fallback_Tests_v8.1.py

The15 tests check the FAO numerical example, saturation, provider RH priority,
pairing, aggregate/invalid/unsupported data and no invented leaf wetness.
The helper is offline and not integrated into the app or frozen emulator.

Run the existing model/evaluator commands in master section14. The original
reference remains v7.4. Four new integration acceptance cases are specified,
not claimed implemented. Calibrated profiles and field validation are still
required before activating production care recommendations.
