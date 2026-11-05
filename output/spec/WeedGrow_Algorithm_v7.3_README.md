# WeedGrow v7.3 - algorithm blueprint and offline emulator

30 October 2026. The v7.2 research/parameter restrictions remain the evidence
baseline. This version makes the algorithm callable and testable, with 42
factor rules and all 14 warning IDs.

Start with the PDF or matching Markdown. The standalone pseudocode is a short
reading version. The Python emulator is an executable design reference, not
application integration or a validated horticultural model.

## Run it

Python 3.10 or newer; standard library only. Run from the extracted `spec/`
directory:

```powershell
python WeedGrow_Algorithm_Scenarios_v7.3.py
python WeedGrow_Algorithm_Emulator_v7.3.py --input WeedGrow_Synthetic_Input_v7.3.json --output result.json
```

With no input argument, the emulator uses its built-in synthetic fixture. UTC
seconds, initial storage, thresholds, retention and effective coefficients in
that fixture are arbitrary test data. They are not current weather, a real
plant, or published cannabis parameter estimates.

## What is included

- `../pdf/WeedGrow_Algorithm_Blueprint_v7.3.pdf`: complete 25-page blueprint.
- `WeedGrow_Algorithm_Blueprint_v7.3.md`: editable matching text.
- `WeedGrow_Pseudocode_v7.3.txt`: pipeline, profile selection, water replay,
  decision, forecast projection and notification pseudocode.
- `WeedGrow_Algorithm_Emulator_v7.3.py`: pure offline calculations/flag calls.
- `WeedGrow_Algorithm_Scenarios_v7.3.py`: scenario and invariant tests.
- `WeedGrow_Factor_Flag_Registry_v7.3.json`: all factor rules, function mapping,
  carried-forward sources/parameters, and new engineering choices.
- `WeedGrow_Algorithm_Verification_v7.3.json`: executed cases and PDF review.
- `WeedGrow_Synthetic_Input_v7.3.json` and matching output: reproducible example.
- `WeedGrow_v7.3_figures/synthetic_water_balance.png`: standalone illustrative plot.
- `WeedGrow_SPEC_STATUS.json`: current design version and validation status.
- This README and a bundle manifest with hashes.

The scenario runner writes its report and synthetic examples beside the
scripts. PDF/plot authoring libraries are not needed to run the reference.

## What the outputs mean

`water.candidate` and `debug_threshold_projection` are design/synthetic outputs.
The release registry is empty, so `water.decision` remains `uncertain` and
`needs_water` remains `null`. An `approved` field in input JSON cannot enable
production decisions. Validated profiles and actual application integration
would be separate work.

Warning states distinguish `triggered`, `not_triggered`, `unknown`,
`not_applicable`, `disabled`, `context_only` and `review_requested`. They do not
report infection probabilities. Disease prediction routes remain disabled;
scoped ambient preparation context can still be produced.

The emulator has no network or external delivery behavior. It sends zero
notifications. Its notification helper returns a proposed plan only.

## Boundaries

- No daily soil checks, leaf temperatures or repeated height logging.
- Watering amount remains optional; omitted amount is not a full refill.
- Forecast rain is never credited to present water storage.
- Growing/repotting cannot manufacture water; unsupported transitions abstain.
- Raw API parsing, IANA/DST conversion and production data access are specified
  adapters, not implemented integrations in this reference.
- The bank is a short-window, constant-profile accounting model. It does not
  simulate soil layers, root oxygen, snowmelt or a complete physiology model.
- Synthetic tests establish logical behavior, not plant-care accuracy or
  disease-prevention effectiveness. Normal growers do not supply the research
  measurements needed for profile validation.

All application source files were preserved. Existing v7.2 artifacts remain
available as the evidence baseline.
