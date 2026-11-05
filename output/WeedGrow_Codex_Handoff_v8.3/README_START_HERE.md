# WeedGrow v8.3 - start here

This is the complete audited Codex handoff. Use this package instead of the v8.2 ZIP. It contains the whole specification, the task backlog, offline references/tests and weather payload evidence. It does not contain the application repository or any credentials.

## Read in this order

1. [Full algorithm specification](output/spec/WeedGrow_Implementation_Master_v8.3.md).
2. [Machine-readable contract](output/spec/WeedGrow_Implementation_Contract_v8.3.json).
3. [Implementation boundary and reference precedence](output/spec/WeedGrow_Implementation_Boundary_Contract_v8.3.md).
4. [28 implementation tasks](docs/algorithm-implementation-plan-v8.3.md).
5. [File-by-file audit and changes](verification/WeedGrow_Handoff_Audit_v8.3.md).

The v8.3 master and contract govern implementation. New boundary rules override inconsistent older adapter behavior. Earlier version numbers on reference/tests identify their actual historical interfaces; they are not competing product specs. All code examples are offline references, not proof of production integration. See the reference-role table before porting.

## Verify the package

From the extracted package root:

    python tools/verify_handoff_v8.3.py

Or pass its absolute path from any directory. Use Python 3.10+ with IANA timezone data; Windows Python may need the tzdata package. That is a developer test dependency, not an ordinary grower requirement. The verifier uses no API keys or network. It checks digests, relative links, syntax, contract/task consistency, all captured samples and the six bundled test suites. Suites run in a temporary copy, leaving delivered files unchanged. It writes verification/latest_run.json. If it fails, inspect the actual failure instead of regenerating expected answers or skipping a release gate.

## Instruction to give Codex when ready

Read README_START_HERE.md and the linked current spec, contract, boundary rules and task plan. Inspect the target app repository and its applicable AGENTS.md. Start with WG-001, then WG-002; implement one reviewable increment at a time, following dependencies. Preserve unrelated changes. Run targeted tests and required repository checks. Report changed behavior/files, actual test results and anything still unimplemented. Use fixed oracles and audited negative cases, and keep synthetic candidate outputs separate from production decisions. Do not invent missing scientific parameters, labels, acceptance targets or source freshness policy, and do not activate production profiles/predictive disease or purchase subscriptions as part of foundation work.

## Scope and readiness

Normal use remains one-time setup plus watering logs, with amount optional. No daily soil checks, leaf temperatures, sensors or repeated measurements were added. There are 42 factors, 14 warning IDs and 16 acceptance areas across 28 tasks.

This package is ready to guide incremental engineering and tests. Actual app integration, source configuration and real-plant calibration/independent validation are separate required tasks. No calibrated production profiles or measured plant outcomes are supplied. Disease prediction stays disabled; factual environmental context is not disease detection. Weather features have a separate gated release path from watering recommendations. No ZIP review can guarantee perfect plant-care accuracy.

## Package layout

- output/spec: current normative files, canonical boundary helpers and field evaluation tools; frozen mathematical references; weather fixtures/evidence.
- output/spec/legacy_v82: historical partial helpers/tests. Raw-weather and display behavior there is superseded; bank/calendar examples remain useful.
- docs: portable Markdown task plan, structured JSON backlog and dependency verification.
- tools: the single offline verifier.
- verification: audit findings, original failure reproductions and original-file review ledger. Reports describe their actual scope.
- HANDOFF_MANIFEST.json: immutable file roles, sizes and SHA-256 digests.

Repository paths in tasks refer to the receiving app repository. Original research PDF workspace paths in source records are explicitly marked not bundled; their public URLs and recorded scope are preserved. They are not hidden runtime dependencies. The old field collection template has an explicit mapping to the current evaluator dataset contract; do not submit it directly as evaluator input.
