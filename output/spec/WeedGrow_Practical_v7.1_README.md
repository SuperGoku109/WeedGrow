# WeedGrow practical app scope v7.1

This is the current product-input and warning-scope spec. It supersedes v7.0 wherever that version implies advanced measurements or physiology models in the ordinary app workflow.

Base inputs: one-time simple setup, routine watering logs (amount optional), and automatic weather. No leaf/root temperatures, PAR meter, internal CO2, cultivar assays or daily moisture checks. Optional age/height/medium facts do not block weather warnings.

The16-page PDF and matching Markdown define the realistic scope. Input-contract JSON includes all14 warning dispositions, current source-audit hashes and the retained33-source research ledger. The Python reference checks capability/dependencies only; it does not predict moisture, disease or warning severity. Run:

```powershell
python WeedGrow_Practical_Capability_Reference_v7.1.py
```

Expected:30 passing capability checks. No production app code was changed; water-state/profile implementation and outcome validation remain required. Earlier advanced research models are not included in this package.
