"""Write portable entrypoint, file-by-file review and integrity manifest."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT/'output/WeedGrow_Codex_Handoff_v8.3'


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(obj if isinstance(obj, str) else json.dumps(obj, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')


readme = '''# WeedGrow v8.3 - start here

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
'''
write(STAGE/'README_START_HERE.md', readme)
(STAGE/'tools').mkdir(parents=True, exist_ok=True)
(STAGE/'tools/verify_handoff_v8.3.py').write_bytes((ROOT/'tmp/verify_handoff_v83.py').read_bytes())

findings = [
 dict(id='A01', problem='One invalid RH/units/array could abort otherwise valid independent weather variables.', fix='Canonical per-variable null/quality/reasons; reject only untrustworthy path envelopes/axes.', tests='HandoffTests bad_rh, wrong_wind_units, misaligned_array, missing_showers'),
 dict(id='A02', problem='A negative rain component could be hidden by adding positive showers.', fix='Validate both components before sum; boolean/nonfinite values are invalid.', tests='HandoffTests negative_rain_component, boolean_component, nan'),
 dict(id='A03', problem='Explicit OpenWeather rain:null was inferred zero by the omission rule.', fix='Separate absent key from explicit null/malformed structure.', tests='HandoffTests explicit_null_openweather_rain, absent_openweather_rain'),
 dict(id='A04', problem='Adapter kind/unit/wind names did not match the main contract; first availability was overwritten on refetch.', fix='One canonical sample contract, matching enums/units and explicit immutable-revision availability.', tests='HandoffTests contract_valid_samples, first_availability, canonical_unit_validator; root verifier'),
 dict(id='A05', problem='Point wind was called a mean; Forecast gust period was lost and Archive gust needed product-specific handling.', fix='Official product mappings preserve point wind, Forecast preceding-hour gust maximum and explicit CERRA distinction.', tests='HandoffTests forecast_gust, archive_gust, wind_speed_is_point'),
 dict(id='A06', problem='Older W11 returned disabled for flowering with missing applicable evidence.', fix='Explicit AND/OR truth table; missing ->unknown, both arms false ->not_triggered, supported positive ->context_only.', tests='HandoffTests flowering_missing_weather, flower_context_truth_table'),
 dict(id='A07', problem='Invalid W06/W10 flag/state combinations could bypass intended card routes; string gates were truthy.', fix='Flag-specific display eligibility and strict boolean gates.', tests='HandoffTests water_context_state, predictive_pm, string_false, context_never_pushes'),
 dict(id='A08', problem='A malformed evaluator dataset could crash; requested split typos looked empty.', fix='Structured invalid_evaluation for malformed data/split/status/criterion/provenance.', tests='BoundaryTests; retained 14 known-count/leakage evaluator tests'),
 dict(id='A09', problem='Pending outcomes could be hidden from selected-population accounting; two false-water denominators were easy to confuse.', fix='Selected/pending counts, adjudication coverage, water recommendation precision and FP/recommendation alongside FP/negative.', tests='BoundaryTests pending_population, precision_and_false_recommendation_denominators'),
 dict(id='A10', problem='Old collection template field names did not directly match the evaluator dataset.', fix='Exact dataset contract with nonmechanical mapping and explicit missing fields; unconfigured dataset remains rejected.', tests='Root verifier emptyUnconfiguredDatasetRejected; field evaluator tests'),
 dict(id='A11', problem='Documented captured_payload_tests.py was missing; task links depended on a local C: workspace; test execution modified delivered reports.', fix='Ship the script with resolved fixture paths, portable root-relative package layout and temporary-copy verifier.', tests='Captured payload suite, manifest/link checks and relocated extraction verification'),
 dict(id='A12', problem='Older partial reference behavior and app/validation readiness could be mistaken for current production rules.', fix='One current master/contract, explicit reference-role table, legacy folder, dated report scope and task acceptance refinements.', tests='Task DAG, acceptance coverage, fixed oracle integrity and disabled release checks'),
 dict(id='A13', problem='Nulling invalid provider RH could accidentally make it eligible for dewpoint fallback.', fix='Quality-aware paired-air wrapper refuses invalid RH and mismatched source/time; missing RH alone can derive.', tests='HandoffTests invalid_normalized_rh, missing_normalized_rh, dewpoint_different_source'),
]
original = ROOT/'output/WeedGrow_Complete_Codex_Handoff_v8.2.zip'
ledger = []
with zipfile.ZipFile(original) as z:
    for name in z.namelist():
        data = z.read(name)
        if name.endswith('_payload.json'):
            note = 'Full JSON parsed; every requested row normalized and semantic contract checked; payload bytes retained as frozen evidence.'
            action = 'retained_frozen_fixture'
        elif name.endswith('.py'):
            note = 'Source reviewed; relevant executable suite run. Frozen math/air references retained; current adapter/scorer fixes have separate v8.3 tests.'
            action = 'reviewed_reference_or_superseded_helper'
        elif 'implementation/' in name:
            note = 'All 28 tasks/dependencies/acceptance coverage reviewed; portable v8.3 task plan adds audited boundary checks without adding tasks.'
            action = 'superseded_v83'
        elif 'Master_' in name or 'Contract_' in name:
            note = 'Requirements checked against helpers/provider docs/tasks; 42 factors, 14 warnings and all 38 source records preserved with clarified precedence.'
            action = 'superseded_v83'
        elif 'Field_Validation_Template' in name:
            note = 'Empty collection guidance retained; incompatible evaluator field names now explicitly mapped in v8.3 dataset contract.'
            action = 'retained_with_explicit_mapping'
        elif 'weather_evidence' in name:
            note = 'Historical source/probe/parser findings reviewed against fixtures. Missing documented script supplied and command path corrected; app findings remain historical.'
            action = 'retained_evidence_or_corrected_instructions'
        elif name.endswith('.json'):
            note = 'Full JSON parsed and role/version/claims checked. Empty/unapproved scientific parameters remain intentional; historical test reports are not app/crop validation.'
            action = 'reviewed_metadata'
        else:
            note = 'Full instructions/catalogue reviewed for precedence, working paths and claims. Current entrypoint replaces ambiguous handoff instructions; fixed expected conclusions retained.'
            action = 'reviewed_documentation'
        ledger.append(dict(path=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), action=action, review=note))
report = dict(version='8.3', originalZipSHA256=hashlib.sha256(original.read_bytes()).hexdigest(),
              originalFilesReviewed=len(ledger), findings=findings, originalFiles=ledger,
              biologicalConstantsAdded=0, routineUserInputsAdded=0, appImplementationChanged=False,
              realPlantOutcomes=0, productionActivationReady=False)
write(STAGE/'verification/WeedGrow_Handoff_Audit_v8.3.json', report)
write(STAGE/'verification/Original_Failure_Reproductions_v8.2.json', json.loads((ROOT/'tmp/handoff_v82_full_audit/original_reproductions.json').read_text(encoding='utf-8')))
lines = ['# Complete handoff audit - v8.3', '',
    'All 36 original ZIP members were reviewed by role: source/instructions, complete JSON records and captured payload arrays, reference suites, task dependencies and manifest. The original 178 tests passed; that did not cover the concrete issues below. The original fixed expected-answer catalogue and frozen bank emulator are unchanged.', '',
    'The new package adds only implementation corrections and evidence checks. It adds no biological constants, ordinary-user measurements, warnings or deployment activation.', '',
    '## Corrections', '', '| Finding | Problem | Correction / checks |', '| --- | --- | --- |']
for f in findings:lines += ['| '+f['id']+' | '+f['problem']+' | '+f['fix']+' '+f['tests']+' |']
lines += ['', '## File-by-file review of the original ZIP', '', '| Original file | Disposition and review |', '| --- | --- |']
for x in ledger:lines += ['| `'+x['path']+'` | '+x['action']+': '+x['review']+' |']
lines += ['', '## What remains outside this audit', '',
    'No production app tests or plant trials were claimed. Source model/licensing/freshness decisions, actual app consumers/storage/permissions and genuine calibration/outcome criteria remain tasks in the implementation plan. The reference-role table identifies intentionally incomplete legacy orchestration. Formal plant-care accuracy cannot be guaranteed by packaging or synthetic cases.', '',
    'The root verifier reports the actual suite counts/results and rejects the empty/unconfigured field dataset. The six suites include the historical 178 test methods (14 original scoring cases retained within the expanded current evaluator). New tests target the audited failures; none create real-plant labels.', '']
write(STAGE/'verification/WeedGrow_Handoff_Audit_v8.3.md', '\n'.join(lines))


def role(path):
    n = path.name
    if n == 'README_START_HERE.md':return 'entrypoint'
    if n.startswith('WeedGrow_Implementation_') and 'v8.3' in n or n.startswith('WeedGrow_Weather_Sample_Contract') or n.startswith('WeedGrow_Field_Dataset_Contract'):return 'current_requirement'
    if 'legacy_v82' in path.parts:return 'historical_partial_reference_not_current_raw_adapter'
    if 'weather_fixtures' in path.parts:return 'frozen_public_coordinate_payload'
    if 'weather_evidence' in path.parts:return 'historical_source_evidence_or_offline_fixture_test'
    if n.endswith('.py'):return 'offline_reference_or_verifier'
    if 'docs' in path.parts:return 'current_implementation_backlog'
    if 'verification' in path.parts:return 'audit_record'
    if 'Verification' in n or 'Report' in n:return 'scoped_prior_engineering_report'
    if 'Release_Policy' in n:return 'intentionally_unapproved_release_policy'
    return 'reference_contract_or_guidance'


entries = []
for p in sorted(STAGE.rglob('*')):
    if not p.is_file() or '__pycache__' in p.parts or p.suffix == '.pyc' or p.name == 'HANDOFF_MANIFEST.json' or p == STAGE/'verification/latest_run.json':
        continue
    b = p.read_bytes()
    entries.append(dict(path=p.relative_to(STAGE).as_posix(), bytes=len(b), sha256=hashlib.sha256(b).hexdigest(), role=role(p.relative_to(STAGE))))
manifest = dict(version='8.3', files=entries,
    immutableOracleSHA256=hashlib.sha256((STAGE/'output/spec/WeedGrow_Independent_Test_Cases_v7.5.json').read_bytes()).hexdigest())
last_run = STAGE/'verification/latest_run.json'
if last_run.exists():
    checked = json.loads(last_run.read_text(encoding='utf-8'))
    manifest['buildVerification'] = dict(testMethods=checked['testMethods'], allSuitesPassed=all(x['exitCode'] == 0 for x in checked['suites']),
        canonicalFixtureSamples=checked['canonicalFixtureSamples'], realPlantOutcomes=0,
        productionActivationReady=False, commands=[x['command'] for x in checked['suites']],
        verificationToolSHA256=hashlib.sha256((STAGE/'tools/verify_handoff_v8.3.py').read_bytes()).hexdigest())
write(STAGE/'HANDOFF_MANIFEST.json', manifest)
print('Manifest records:', len(entries))
