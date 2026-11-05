# WeedGrow v7.4 - corrected math/logic and flag calculations

This is an audit addendum to v7.3. Where behavior differs, v7.4 takes precedence.
The prior complete blueprint and factor registry remain the design context.

Start with the 10-page audit PDF or matching Markdown. Pages 4-9 contain the
actual water, exposure, weather and health-context flag calculations. Page 3
lists reproduced errors and fixes. No new daily client measurements are added.

Python 3.10+; standard library only, from the extracted spec directory:

```powershell
python WeedGrow_Algorithm_Scenarios_v7.4.py
python WeedGrow_Algorithm_Emulator_v7.4.py --input WeedGrow_Synthetic_Input_v7.4.json --output result.json
```

The test runner writes its report/examples beside the scripts. The delivered
report also records PDF review. Running the tests replaces that report.

Four before/after reproductions are in WeedGrow_Audit_Reproductions_v7.4.json.
The full blueprint/42-factor registry from v7.3 is included for context; use
the v7.4 addendum and executable code for corrected rain context, log conflict,
projection censoring and exposure behavior.

Exposure metrics are interval approximations where representative values are
used, not measured leaf wetness or injury doses. Max gusts/interval maxima
cannot supply sustained duration. Weather screens remain engineering
candidates. Forecast TTL is a configurable backend policy, with no invented
universal default. Profiles/disease models remain unvalidated and unreleased.

No application source files, API subscriptions, plant records or notification
delivery were changed. All fixture values are synthetic, not current weather
or agronomic calibration. The bundle contains no production profiles.
