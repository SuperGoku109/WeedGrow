# WeedGrow v7.2 - realistic inputs, evidence and algorithm design

30 October 2026. Research and official weather documentation checked through
29 October 2026. This revision supersedes v7.1 algorithm-design detail while
retaining its basic-setup + watering-logs + automatic-weather scope.

The 24-page PDF and matching Markdown contain the complete reading version.
The JSON contract contains all 38 source records, 21 parameter records with
provenance/use restrictions, all 14 warning IDs, and 12 investigation gaps.
Five additional primary studies were examined: four full PDFs and one primary
publisher-indexed methods/results record with an explicit full-access limit.

## Files

- `../pdf/WeedGrow_Low_Input_Evidence_Algorithm_v7.2.pdf`
- `WeedGrow_Low_Input_Evidence_Algorithm_v7.2.md`
- `WeedGrow_Low_Input_Model_Contract_v7.2.json`
- `WeedGrow_Low_Input_Math_Reference_v7.2.py`
- `WeedGrow_Low_Input_Capability_Reference_v7.2.py`
- `WeedGrow_Low_Input_Verification_v7.2.json`
- `WeedGrow_Low_Input_v7.2_README.md`
- `WeedGrow_SPEC_STATUS.json`

The ZIP preserves the `pdf/` and `spec/` layout for these eight files.

## What the reference does

The math reference implements paired-air VPD, dimensional storage/rain
calculations, a simplified available-water bank, robust scenario decisions
and time-windowed ambient feature extraction. All trajectory parameters must
be supplied explicitly; no calibrated production profiles are included.
The capability reference preserves v7.1's 30 low-input dependency checks.

Run the math checks using Python 3.10 or newer:

```powershell
python WeedGrow_Low_Input_Math_Reference_v7.2.py
```

Run the retained capability checks:

```powershell
python -c "import runpy; m=runpy.run_path('WeedGrow_Low_Input_Capability_Reference_v7.2.py'); print(len(m['run_checks']()))"
```

The verification JSON records executed check names and final PDF review.
These are mathematical/dependency checks, not biological validation or an app
integration test. No application implementation was changed by this work.

## Boundaries that must survive implementation

- No daily moisture checks, leaf/root temperature or sensor requirements.
- Water amount is optional; a log without an amount is not a full refill.
- Forecast rain is not credited to current stored water.
- Depletion allowance is different from the remaining action reserve.
- Unknown profile/state/history can return `uncertain`, never silent `not_due`.
- Scenario agreement is not a probability or validated confidence interval.
- Published site coefficients and selected study thresholds are not universal
  outdoor cannabis defaults.
- Disease outputs describe ambient conditions and preparation; predictive
  pushes remain unreleased pending prospective validation.
- No weather-only root-rot/damping-off diagnosis or fixed internal-bud offset.
- Ordinary growers do not supply the instrumented research-cohort measurements.

Useful reading locations: PDF pages 6-12 for numbers/watering; 13-18 for
combinations and all warnings; 20-21 for the remaining investigation plan.
