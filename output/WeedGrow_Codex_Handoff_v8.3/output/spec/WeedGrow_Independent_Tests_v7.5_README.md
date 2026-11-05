# Independent expected-answer tests - v7.5

These tests help detect wrong changes before tuning the algorithm. They add
independent expected answers to the existing v7.4 regression suite. They do
not assign invented real-plant watering or disease labels.

Run from the extracted `spec` directory with Python 3.10+:

```powershell
python WeedGrow_Independent_Tests_v7.5.py --include-existing
```

To check a future compatible reference against the SAME expected answers:

```powershell
python WeedGrow_Independent_Tests_v7.5.py --include-existing --engine C:\path\to\new_reference.py
```

The runner exits nonzero on a test failure or a surviving deliberate fault.
It writes `WeedGrow_Independent_Test_Report_v7.5.json`. It does not overwrite
the older v7.4 PDF verification report or modify the engine.

## What the conclusions establish

- **13 fixed-answer cases:** supplied storage/loss/refill values imply exact
  modeled reserves and candidate decisions. Each case has its hand arithmetic
  in the JSON catalogue and the readable cases file. Expected values are
  never copied from a fresh engine run.
- **20 new tests in total:** the above plus high-precision decimal VPD,
  independent exposure arithmetic, missing-interval handling, duplicate/event
  ordering invariants and no invented infection probabilities.
- **96 exhaustive parameter combinations:** an independent event-level model
  enumerates every order of small discrete water additions/removals. It checks
  that the engine's two ordering bounds actually enclose those possibilities.
- **Seven in-memory fault injections:** omitted loss, ignored water, incorrect
  water units, remaining-versus-depleted threshold confusion, assumed full
  refill, forecast water credited now and broken air VPD. Each must be caught.
- `--include-existing` adds the prior95 tests and their1,000 seeded bank trials.

All seven deliberate faults are reverted automatically after their checks.
Detecting them demonstrates sensitivity to these specific errors; it is not
proof that every possible bug or biological modeling error will be detected.

## How to use failures

1. Read the case's supplied values, expected result and derivation.
2. Inspect units, event timing, clipping, delivery, missingness and threshold
   semantics before changing any crop coefficient.
3. If a model assumption intentionally changes, document why and obtain an
   independent expected conclusion before revising a test. Do not regenerate
   expected values from the modified engine just to make it pass.
4. Keep mathematical fixtures separate from calibration and held-out field
   outcomes. Passing fixed synthetic cases cannot select an accurate crop
   threshold or measure disease-prediction accuracy.

## Real-plant conclusions

The field-validation template is deliberately empty. It specifies what must
be recorded to obtain independently adjudicated outcomes, with predictions
frozen before labels are revealed. Reference measurements belong to a research
or opt-in cohort. Ordinary users still need only simple setup and watering
logs; no daily checks or sensors are introduced by these tests.

For example, synthetic reserve0.7L below a supplied action reserve0.8L has a
definite *model* conclusion. Whether a particular outdoor cannabis plant
actually needs watering at that point is a separate biological question.
No expected test answer should blur those two claims.

This package changes the test harness only. The v7.4 emulator remains
unchanged and contains no released profiles. `water.candidate` can be checked;
production `needs_water` must remain null for these synthetic profiles.
