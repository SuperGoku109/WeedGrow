# WeedGrow environmental response and warnings v7.0

The PDF and matching Markdown contain the next environmental/warning spec. This revision adds15 primary cannabis/hemp studies (12 reviewed from full text;3 with limited primary access). All source access/design limitations are in the evidence ledger.

## Reading guide

- Pages3-9: changes, evidence quality, interaction architecture and study-specific response windows.
- Pages10-18: physical features, native variation, age/rooting/medium, partial physiology emulator and counterfactual results.
- Pages19-24: all14 warning contracts, retained weights/formulas, water-balance and delivery integration.
- Pages25-28: cross-study synthesis, model-development plan, uncertainties and verification.
- Pages29-35:33 linked primary sources and access scope.

## Run the reference

Keep both Python files in the same folder and run:

```powershell
python WeedGrow_Environmental_Model_v7.0.py
```

Expected:55 environmental checks +146 retained warning-core checks =201 passing reference checks,288 factorial input scenarios, biologicalAccuracyValidated=false.

`WeedGrow_Environmental_Evidence_v7.0.json` holds all new study records, source access/design notes, native parameters, both configs and89 prior factor mappings. `WeedGrow_Environmental_Scenarios_v7.0.json` holds complete physical counterfactuals, partial biochemical calculations and288 input scenarios with explicitly supplied root states and conditional care decisions. These outputs are not measured biological training labels.

The reference uses the Python standard library. No provider adapter, validated root reserve producer, complete coupled physiology model, app UI or live notification system was implemented. No app source files were changed. The v5.2 general storage/permission/water-balance contracts continue where this focused spec does not supersede them. Existing v6 warning weights remain explicitly uncalibrated research priors.
