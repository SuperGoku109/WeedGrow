# WeedGrow weighted warning model v6.0

Start with the PDF (28 pages) or editable Markdown specification.

- Weights and mandatory combinations: PDF pages 5-7.
- Response curves and individual warning contracts: pages 9-20.
- Worked examples: page 22.
- Executed checks and validation plan: pages 23-25.
- Primary source ledger: pages 26-28.

The Python core uses only the standard library. From the spec folder run:

```powershell
python WeedGrow_Weighted_Warnings_v6.0.py
```

It executes 146 reference checks and prints their summary and all 14 demo outputs. Import `evaluate`, `CONFIG`, `run_checks`, and `delivery_preview` for further experiments. The Example JSON contains complete input, output and delivery simulation. The Config JSON includes parameters, source classes, warning profiles and all 89 prior factor mappings.

Published coefficients, a small source-derived cannabis fit and proposed engineering weights are labelled separately. Scores are exposure/attention indices, not infection probabilities. No field-accuracy improvement has been demonstrated. The core consumes supported normalized weather and water/root states: it does not implement provider ingestion, a validated reserve model, UI integration or production notifications. See the spec's integration contract. No app files were changed.
