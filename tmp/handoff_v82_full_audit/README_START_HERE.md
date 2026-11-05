# WeedGrow v8.2 - complete Codex implementation handoff

Read spec/WeedGrow_Implementation_Master_v8.2.md first. This is the complete normative algorithm specification, including the warning decision table, calculations, factor ledger, API mappings, state rules and acceptance cases. Section 18 refines earlier wording where explicitly stated.

Read spec/WeedGrow_Implementation_Contract_v8.2.json alongside it for machine-readable requirements and source records. Earlier version numbers in bundled tests and references identify their actual versions; they do not supersede the v8.2 specification.

Read implementation/algorithm-implementation-plan-v8.2.md for the 28 implementation tasks. The JSON backlog is its structured companion. Dependencies and task acceptance checks control implementation order; begin with WG-001 and then WG-002. This package does not itself authorize production activation or a subscription purchase.

## Suggested instruction to Codex when starting

Read the v8.2 implementation master, companion contract and implementation task plan in this package. Inspect the target repository and its applicable AGENTS.md before editing. Implement WG-001 first, with its acceptance checks, preserving unrelated changes. Use the offline references and fixed expected answers to check semantics, not as proof of plant-care accuracy. Report what changed, tests actually run and remaining limits. Keep later tasks and production activation pending until their dependencies and evidence gates are satisfied.

## What is included

- spec/: full master, JSON contract, release policy, offline reference implementations, fixed-answer tests, validation tooling, captured weather fixtures and weather API audit evidence.
- implementation/: task plan, machine-readable backlog and structural plan verification.
- HANDOFF_MANIFEST.json: SHA-256 digests for every other file in this archive.

No application implementation is included. The references are not integrated into the production app. Routine use remains simple setup plus watering logs, with amount optional; no daily soil checks, leaf temperatures or sensors are required. Real-plant calibration and independent validation are still required for watering activation. Predictive disease alerts remain disabled; supported environmental context is not a disease diagnosis.

## Offline checks

From the extracted spec directory, use Python 3.10+ with IANA timezone data available (Windows installations may need tzdata):

    python WeedGrow_Functional_Tests_v8.2.py
    python WeedGrow_Independent_Tests_v7.5.py --include-existing
    python WeedGrow_Field_Evaluator_Tests_v8.0.py
    python WeedGrow_API_Air_Fallback_Tests_v8.1.py

The bundled previous verification records 178 passing test methods. Packaging did not rerun these suites. Synthetic/reference passes do not establish agronomic accuracy or application integration. The field dataset intentionally contains no real outcomes; do not invent labels, coefficients or release targets to make it pass.

The target app repository is required for implementation. Code-location links in the task plan describe the original repository and may need resolving against the receiving workspace. This archive contains no API credentials.
