# WeedGrow v8 implementation handoff

Start with WeedGrow_Implementation_Master_v8.0.md. It is the single normative
document, with corrected calculations, all42 factors/all14 flags, adapter and
consumer contracts, explicit calibration/release gates and12 acceptance cases.

The machine-readable implementation contract and release policy mirror it.
Unassigned scientific/product targets remain null and block care activation.
They are decisions/evidence to obtain, not a reason to invent weights.

The existing v7.4 emulator and v7.5 independent harness are bundled unchanged.
The new v8 field evaluator and its14 tests support independent outcome scoring,
including abstentions and leak checks. No real-plant dataset is supplied.

Run commands are in master section14. The empty field dataset intentionally
fails eligibility until a real criterion/outcomes exist. All scripts use the
Python standard library and do not call APIs or send notifications. Tests
write local reports; they do not modify the engine.

Ready: implement/test the foundation from explicit contracts. Still required:
actual provider/calendar adapters, app consumers, calibration, outcome criteria,
domain evidence and release review. This bundle is not an activated algorithm
or a guarantee of perfect plant care.
