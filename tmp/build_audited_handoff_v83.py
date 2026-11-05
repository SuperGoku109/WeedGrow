"""Build the audited handoff deterministically from explicit reviewed inputs."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT/'tmp/handoff_v82_full_audit'
STAGE = ROOT/'output/WeedGrow_Codex_Handoff_v8.3'
SPEC = ROOT/'output/spec'
DOCS = ROOT/'docs'


def read(path):
    return path.read_text(encoding='utf-8')


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')


protocol = '''# v8.3 implementation boundary contract

The v8.3 master and JSON contract are normative. `WeedGrow_Handoff_Reference_v8.3.py` supplies audited boundary helpers, not a complete production engine. This file closes implementation ambiguities; it introduces no biological coefficients or user measurements.

## One weather shape

Use the companion Weather_Sample_Contract JSON and `validate_sample` for canonical names and invariants. `kind` is exactly `occurred_estimate`, `forecast`, or `current_point`. Provider-specific origin stays in `provider/product/model_selection`; an archive record is still a grid/model estimate. `unit` is singular. All timestamps are UTC epoch seconds. `issued_at_utc` stays null unless an actual issue time is supplied by a separately verified provider adapter. Availability is recorded by the backend; preserve first acquisition for the SAME immutable source revision, not a different later correction. A refetch updates retrieval without retroactively changing availability. Source revision is a content hash in the helper; production stores immutable raw response/revision identity and its acquisition metadata.

`model_selection` records requested configuration, not a claim that an API exposed its internally resolved model. Preserve the best-match/unpinned marker and returned grid coordinates/elevation. A profile must support the actual chosen product/configuration; a successful sample decode cannot approve it.

Point and point-rate samples have equal bounds. Interval sums/means/maxima have start<end and preserve their actual period. A gust maximum cannot supply sustained hours. Daily totals live in a separate collection and cannot fill hourly gaps or be added to overlapping hourly sums. Do not sum duplicate revisions or combine sources before declared per-path selection.

## Partial failure

Reject an untrustworthy envelope/time axis for that path. Missing fields, wrong units, misaligned variable arrays and individual invalid values become null/quality/reason codes on the affected variable; other variables survive. Do not shift a short array, fill missing rain with zero, coerce strings/booleans or add negative rainfall to positive showers. Validate each rain component before summing. Explicit OpenWeather `rain:null` is unknown; absent rain may use the tested omission rule only for a complete valid point under that product contract. Failed fetches and missing rows cannot invoke it. Dewpoint fallback may fill missing RH, but must not replace invalid RH after normalization has turned its numeric value into null; `resolve_air_samples` preserves that distinction and source/time pairing.

Forecast and Archive use different rain/gust mappings. Forecast gust is the preceding-hour maximum. Archive gust is the reported point under the generic documented product; an explicitly selected CERRA product uses preceding-hour maximum. Automatic/mixed model selection does not license an invented sustained duration. Wind speed is a reported point for these hourly APIs, not an hourly sustained mean. These definitions were checked in [Forecast docs](https://open-meteo.com/en/docs) and [Archive docs](https://open-meteo.com/en/docs/historical-weather-api) on 30 October 2026. OpenWeather rain rates follow [One Call docs](https://openweathermap.org/api/one-call-3).

## From canonical samples to warning/water paths

Keep the normalized sample store distinct from a per-path view. Select source/product/revision, variable, location and validity first. Join air values only from the same compatible sample/source/time. Point air can establish crossings; duration needs a separately named representative-bin policy, with its approximation and gaps recorded. There is no implicit point-to-hour conversion. The fixed v7.4 weather objects are synthetic representative intervals, not raw API output.

The current water path consumes only supported nonoverlapping ET0/rain integrals ending by the evaluation boundary. Do not feed normalized rows directly to the v7.4 `evaluate` function: it has different names, joint-row assumptions and simplified provenance. Supply a deliberate tested production adapter/path implementation. Past forecast bins remain forecasts. If the selected archive/history feed has a recent-data gap, mark the current water path uncertain and backfill automatically; do not bridge it with reclassified forecasts. Any future forecast-driven current-state model would need its own declared domain, validation and revised contract.

At an evaluation inside an hourly integral, do not credit the full unfinished hour. An anchor/log/transition inside a bin requires supported subinterval forcing or conservative ordering/amount bounds; do not uniformly distribute a shower. Evaluate at the actual requested time, retaining an explicit gap if necessary. The current reference is not proof that this production integration is done.

## Warning state and delivery rules

W01-W05 engineering/source screens use triggered/not_triggered/unknown according to applicability and coverage. W06 maps water/not_due/uncertain to triggered/not_triggered/unknown and true/false/null. W08 is context_only when a known container and W01 trigger justify context; W01/W08 merge. W09/W11/W12 factual context uses context_only, not an infection-positive state. W10 remains disabled for an applicable plant. W07/W13/W14 use review_requested only for the matching user-initiated topic. Lifecycle/scope can yield not_applicable; disabled is an explicit model/product gate, not a substitute for missing weather.

For W11: known nonflowering ->not_applicable; unknown stage ->unknown; flowering AND (supported humid-positive OR known reachable positive rain) ->context_only. Without a positive, not_triggered requires both OR arms to be ruled out. Shelter rules out direct rain but does not rule out humid air. Complete dry rain evidence rules out the rain arm even if reception is unknown. Positive rain with unknown/partial reception remains unresolved unless an independently supported exposure rule establishes it. Missing applicable evidence ->unknown. No infection probability follows from this truth table.

The display helper accepts only flag-specific card routes. A malformed W06 context_only or W10 triggered value cannot create a card/push. All delivery gates must be booleans from trusted policy/permissions, never strings or user approval fields. Production still needs the episode/cancellation/idempotency and claim gates in WG-021; the helper sends zero notifications.

## Reference and test precedence

| File family | Use | Limits |
| --- | --- | --- |
| v8.3 master/contract/boundary contract | Current requirements | Not plant validation |
| v8.3 Handoff_Reference / Handoff_Tests | Canonical raw-weather boundary, W11 truth table, card eligibility | No full orchestrator or source classification |
| v8.3 Field_Evaluator / tests / dataset contract | Current descriptive scoring and input validation | No automatic approval or independent proof of collection integrity |
| v7.4 emulator + v7.5 independent cases | Frozen bank arithmetic, ordering/exposure examples and negative tests | Synthetic parameters; simplified provenance, transitions and app integration |
| legacy_v82 helpers/tests | Historical bank initialization, refill, transition and calendar examples | Old raw-weather and display functions are superseded by v8.3; their tests do not define new adapter behavior |
| v8.1 air helper/tests | Narrow paired-air RH fallback | No leaf/soil wetness or infection estimate |
| weather fixtures/evidence | Frozen public-coordinate examples and recorded parser defects | Not uptime, actual local weather truth or app success |

Never use unapproved `water.candidate` as a production decision. Do not change fixed expected answers to match new code. A newly ported implementation must test the current contract, including negative cases; preserving an outdated adapter defect for parity is not required. The documented 178 baseline checks include legacy tests. New checks supplement them; test counts are engineering evidence only.

## Field data and denominators

Use Field_Dataset_Contract_v8.3.json and Field_Dataset_v8.3.json for evaluator input. The old v7.5 template is collection guidance, not a serializable evaluator case. Its explicit mapping is in the v8.3 contract. Do not blindly rename or infer a missing observed label, group, time or criterion. Unknown adjudication state is an error; pending is explicitly excluded. Report selected and pending counts plus adjudication coverage so selective labeling is visible. Decision coverage uses adjudicated eligible cases. Report both FP/negative cases and FP/all water recommendations; their denominators answer different questions. Neither gets an invented acceptance target.

All research/reference measurements stay outside normal-user inference. Outcome criterion, sample sizes, meaningful accuracy/coverage targets, actual production freshness/cadence and regional source mappings remain explicit release decisions. An agent can implement gates/configuration/tests now; it must not fill scientific unknowns with fabricated constants.
'''


def build_spec():
    master = read(SPEC/'WeedGrow_Implementation_Master_v8.2.md')
    master = master.replace('# WeedGrow v8.2 - implementation master specification', '# WeedGrow v8.3 - audited implementation master specification', 1)
    master = master.replace('This is the single normative reading document', 'This v8.3 document is the single normative reading document', 1)
    master = master.replace('It supersedes v8.0/v8.1', 'It supersedes v8.0/v8.1/v8.2', 1)
    master = master.replace('mean wind>=10m/s', 'reported wind speed>=10m/s (respect point/interval support)')
    master = master.replace('| F23 Mean wind |', '| F23 Reported wind speed |')
    master = master.replace('matching optional problem topic.', 'matching optional problem topic.')
    master = master.replace('WeedGrow_Field_Evaluator_Tests_v8.0.py', 'WeedGrow_Field_Evaluator_Tests_v8.3.py')
    master = master.replace('WeedGrow_Field_Evaluator_v8.0.py WeedGrow_Field_Dataset_v8.0.json', 'WeedGrow_Field_Evaluator_v8.3.py WeedGrow_Field_Dataset_v8.3.json')
    master = master.replace('python WeedGrow_Functional_Tests_v8.2.py', 'python legacy_v82/WeedGrow_Functional_Tests_v8.2.py')
    master = master.replace('The second runs14 independently checked evaluator cases.', 'The current v8.3 evaluator runs 26 independently checked scoring/input cases (14 retained plus 12 boundary cases).')
    master = master.replace('The display_plan helper implements eligibility and stable card keys;', 'The historical v8.2 display_plan helper implements its earlier eligibility and stable card keys;')
    master = master.replace('The new functional suite checks real captured payload mappings', 'The historical v8.2 functional suite checks its original captured payload mappings')
    master = master.replace('New functional reference checks passed: 34.', 'Historical v8.2 functional reference checks passed: 34. These do not override the corrected v8.3 adapter/card rules.')
    master = master.replace('Those older files are evidence/reference history;', 'The separate Implementation_Boundary_Contract_v8.3.md and section 19 clarify the code boundary. Those older files are evidence/reference history;', 1)
    master += '''

## 19. Audited handoff corrections - v8.3

This section and the companion [implementation boundary contract](WeedGrow_Implementation_Boundary_Contract_v8.3.md) override inconsistent older reference behavior. Biological thresholds/profiles, the 42-factor scope and the 14 warning IDs are unchanged. No routine user measurements were added.

- Normalize raw data to the [canonical weather sample contract](WeedGrow_Weather_Sample_Contract_v8.3.json). Use occurred_estimate/forecast/current_point kinds, singular unit, per-variable quality and explicit time support. Provider-specific labels describe provenance, not new kind enums.
- Preserve valid independent variables when one field fails. Validate rain/showers independently; explicit null is not a documented omission. Invalid timestamps/axis are quarantined or rejected before use.
- Open-Meteo Forecast gust uses preceding-hour maximum; Archive mapping is model/product-specific. Reported wind speed is a point under these hourly APIs. No sustained-duration claim follows from either point wind or a gust maximum. See the cited official definitions in the boundary contract.
- W11 missing applicable evidence is unknown, not disabled. Implement the documented OR/AND truth table. W08/09/11/12 context cannot become predictive-disease flags; reject invalid display routes and nonboolean permission gates.
- Preserve first availability for the same immutable revision. Keep recent archive gaps and unfinished hourly integrals explicit; do not reclassify past forecasts or credit future interval water.
- Use the v8.3 evaluator and exact dataset contract; report adjudication coverage and recommendation precision/error denominators in addition to existing metrics. Malformed input returns structured invalid_evaluation instead of crashing.
- The package root verifier checks digests, portable links, syntax, contract/task consistency and the bundled suites from a temporary copy. Generated reports cannot silently invalidate the delivered files. Historical reports are scoped engineering evidence, not current app or crop validation.

Read the 28-task v8.3 plan for implementation order. Start WG-001 then WG-002. Reference helpers have not been integrated into the app. All 16 acceptance areas remain required; production watering and predictive disease are not approved by this audit.

For the complete current check, run `python tools/verify_handoff_v8.3.py` from the extracted package root. It includes the new 45 boundary tests, 26 current evaluator tests, 115 frozen model checks, 34 historical functional checks, 15 air-helper tests and 8 captured-payload checks. The ordinary command leaves delivered reference files unchanged by testing in a temporary copy.
'''
    write(SPEC/'WeedGrow_Implementation_Master_v8.3.md', master)
    write(SPEC/'WeedGrow_Implementation_Boundary_Contract_v8.3.md', protocol)
    c = json.loads(read(SPEC/'WeedGrow_Implementation_Contract_v8.2.json'))
    c['version'] = '8.3'
    c['weather']['requiredProvenance'] = [x if x != 'units' else 'unit' for x in c['weather']['requiredProvenance']]
    c['weather']['requiredProvenance'] += ['source_revision', 'model_selection', 'quality', 'reason_codes']
    c['weather']['canonicalSampleContract'] = 'WeedGrow_Weather_Sample_Contract_v8.3.json'
    c['weather']['normalizationFailurePolicy'] = 'Untrusted envelope/time axis rejects response; per-variable missing/invalid values or units become null+quality+reasons without erasing independent valid fields.'
    c['weather']['mappings']['openmeteo_forecast']['gust'] = 'preceding-hour interval_maximum; no sustained exposure duration'
    c['weather']['mappings']['openmeteo_forecast']['wind_speed'] = 'point at returned time, not sustained mean'
    c['weather']['mappings']['openmeteo_archive']['gust'] = 'generic documented point; explicitly selected CERRA uses preceding-hour interval_maximum; preserve configured model/product'
    c['weather']['mappings']['openweather_onecall']['rain_null'] = 'explicit null/malformed rain is unknown; only absent key under valid sample omission contract may be zero'
    c['weather']['partialHourlyBoundary'] = 'Do not credit full unfinished bins or silently prorate rain; supported subinterval/bounding method or explicit history gap.'
    for f in c['flags']:
        if f['id'] == 'W03':
            f['rule'] = f['rule'].replace('mean wind>=10m/s', 'reported wind speed>=10m/s with source time support')
        if f['id'] == 'W08':
            f['rule'] += ' Use context_only for supported container heat context; merge with W01.'
        if f['id'] == 'W11':
            f['rule'] += ' Without a positive, not_triggered requires both rain/humidity arms ruled out; missing applicable evidence ->unknown, not disabled. See audited truth table.'
    for f in c['factors']:
        # Retain all original factor records; only clarify the wind label.
        for k, v in list(f.items()):
            if isinstance(v, str):
                f[k] = v.replace('Mean wind', 'Reported wind speed')
    for s in c['sources'].values():
        if 'localResearchPDF' in s:
            s['originalWorkspaceResearchPathNotBundled'] = s.pop('localResearchPDF')
    c['handoff'] = dict(boundaryContract='WeedGrow_Implementation_Boundary_Contract_v8.3.md',
                        currentBoundaryReference='WeedGrow_Handoff_Reference_v8.3.py',
                        currentFieldEvaluator='WeedGrow_Field_Evaluator_v8.3.py',
                        productionAlgorithmIntegrated=False,
                        legacyAdapterParityRequired=False)
    c['implementationEvidence']['auditAddsRoutineUserInputs'] = 0
    c['status'] = 'audited_implementation_handoff; production_care_activation_still_requires_real_validation_and_integration'
    write(SPEC/'WeedGrow_Implementation_Contract_v8.3.json', c)
    status = json.loads(read(SPEC/'WeedGrow_SPEC_STATUS.json'))
    status.update(currentProductSpec='8.3', document='WeedGrow_Implementation_Master_v8.3.md',
                  fieldEvaluatorVersion='8.3', boundaryReference='WeedGrow_Handoff_Reference_v8.3.py',
                  functionalReference='legacy_v82/WeedGrow_Functional_Reference_v8.2.py')
    write(SPEC/'WeedGrow_SPEC_STATUS.json', status)
    write(STAGE/'output/spec/WeedGrow_SPEC_STATUS.json', status)
    write(SPEC/'WeedGrow_Field_Dataset_v8.3.json', json.loads(read(SPEC/'WeedGrow_Field_Dataset_v8.0.json')))
    field_contract = dict(version='8.3', evaluator='WeedGrow_Field_Evaluator_v8.3.py',
        datasetFields=dict(criterion_id='nonempty string; null only while unconfigured',
                           criterion_definition='nonempty independent care criterion; null while unconfigured',
                           criterion_defined_before_predictions='boolean, must be true for evaluation', cases='array'),
        adjudicatedCaseFields=dict(case_id='unique nonempty string', plant_group='nonempty deidentified string',
            grower_group='nonempty deidentified string', split=['train', 'tune', 'test'], criterion_id='matches dataset',
            adjudication_status=['pending', 'adjudicated'], observed_watering_needed='boolean for adjudicated cases only',
            decision=['water', 'not_due', 'uncertain'], evaluation_utc='UTC epoch seconds',
            latest_input_available_at_utc='UTC epoch seconds; <=evaluation', prediction_frozen_utc='UTC epoch seconds; >=evaluation and <label revelation',
            label_revealed_utc='UTC epoch seconds', reference_method='nonempty string', adjudicator_id='nonempty string'),
        collectionTemplateMapping=dict(deidentified_plant_id='plant_group (only if it is the declared independent plant group)',
            grower_group_id='grower_group', evaluation_time_utc='evaluation_utc', prediction_frozen_at_utc='prediction_frozen_utc',
            split_group='split plus separately preserved group IDs; not a mechanical rename',
            information_available_at_prediction_time='derive latest_input_available_at_utc from immutable input records, not guessed',
            model_and_profile_version='retain in the input snapshot/export; evaluator does not verify model freeze',
            additionalRequired='label_revealed_utc, exact decision and criterion/group/reference fields must be collected explicitly'),
        missingOutcome='pending; never infer false',
        metrics=dict(decision_coverage='decided / adjudicated eligible', adjudication_coverage='adjudicated eligible / selected split cases',
            false_water_recommendations_per_negative='FP / (FP+TN+uncertain_not_due)',
            false_water_per_recommendation='FP / (TP+FP)', precision_of_water_recommendations='TP / (TP+FP)'),
        limitations=['Timestamps/labels are assertions checked for consistency, not independently authenticated.',
                    'Research measurements, model freeze records and outcome criterion need independent review.',
                    'The scorer never authorizes release; no numeric targets are assigned by this handoff.'])
    write(SPEC/'WeedGrow_Field_Dataset_Contract_v8.3.json', field_contract)
    weather_contract = dict(version='8.3', shape='one variable sample',
        requiredFields=['schema_version', 'provider', 'product', 'source_revision', 'model_selection', 'model_selection_basis',
                        'location_revision', 'retrieved_at_utc', 'available_at_utc', 'issued_at_utc',
                        'variable', 'value', 'unit', 'time_support', 'kind', 'valid_start_utc', 'valid_end_utc', 'quality', 'reason_codes'],
        kinds=['occurred_estimate', 'forecast', 'current_point'],
        timeSupports=['point', 'interval_mean', 'interval_maximum', 'interval_sum', 'rate'],
        quality=['ok', 'missing', 'invalid'],
        variables=dict(air_temperature_c='°C', air_rh_pct='%', air_dewpoint_c='°C', wind_speed_ms='m/s',
                       wind_gust_ms='m/s', shortwave_w_m2='W/m²', et0_mm='mm', liquid_rain_mm='mm', rain_rate_mm_h='mm/h'),
        invariants=['finite JSON numbers; boolean/string never numeric', 'point/rate in these adapters: start=end; intervals:start<end',
                    'quality=ok iff value is nonnull; null never zero', 'available<=retrieved; issue=null or issue<=available',
                    'nonforecast valid_end<=retrieved; forecast may describe past valid times',
                    'same immutable revision preserves first acquisition; new correction has its own availability',
                    'UTC seconds, singular unit, request model selection is not resolved provider model identity'],
        optionalFields=['measurement_height_m', 'grid_latitude', 'grid_longitude', 'grid_elevation_m'],
        validator='WeedGrow_Handoff_Reference_v8.3.py:validate_sample',
        legacyNames=dict(historical_model_estimate='kind=occurred_estimate + product=archive',
                         historical_weather_estimate='kind=occurred_estimate + product=timemachine_metric',
                         units='unit', wind_10m_ms='wind_speed_ms + measurement_height_m=10',
                         gust_10m_ms='wind_gust_ms + measurement_height_m=10', reported_gust='product-specific point or interval_maximum'),
        legacyEmulator='No direct compatibility. Preserve real support/provenance in a tested path adapter; do not invent representative hours.')
    write(SPEC/'WeedGrow_Weather_Sample_Contract_v8.3.json', weather_contract)


def build_tasks():
    p = json.loads(read(DOCS/'algorithm-implementation-tasks-v8.2.json'))
    def revise(value):
        if isinstance(value, str):
            return value.replace('v8.2', 'v8.3').replace('WeedGrow_Field_Evaluator_v8.0.py', 'WeedGrow_Field_Evaluator_v8.3.py').replace('WeedGrow_Field_Dataset_v8.0.json', 'WeedGrow_Field_Dataset_v8.3.json').replace('WeedGrow_Functional_Reference_v8.3.py', 'WeedGrow_Handoff_Reference_v8.3.py')
        if isinstance(value, list):return [revise(x) for x in value]
        if isinstance(value, dict):return {k:revise(v) for k,v in value.items()}
        return value
    p = revise(p)
    p['specVersion'] = '8.3'
    additions = {
      'WG-001': ('Adopt the canonical weather sample names/enums and per-variable quality contract; reject nullable-to-false conversion at all boundaries.', 'Contract fixtures round-trip without renaming kinds/units or converting point air to hourly coverage.'),
      'WG-002': ('Run the root handoff verifier and port the audited negative cases; use the reference-role table to distinguish current rules from legacy adapter behavior.', 'A bad RH/unit/array affects only its variable; explicit null rain and negative rain components cannot become zero/positive rainfall.'),
      'WG-003': ('Preserve current/history point kinds, raw source events and per-variable invalidity; quarantine future nonforecast rows.', 'Malformed daily data cannot erase valid current wind; null rain is distinct from absent rain.'),
      'WG-004': ('Use v8.3 canonical normalization, product-specific gust support, source selection markers and first-availability semantics.', 'Forecast gust is a preceding-hour maximum; reported wind speed is not a sustained mean. All captured samples satisfy the wire contract.'),
      'WG-005': ('Specify the recent archive gap and inside-hour policy; unsupported current forcing remains uncertain with automatic backfill.', 'No past-forecast relabeling, unfinished-hour credit, invented issue time or overwritten first acquisition for an immutable revision.'),
      'WG-006': ('Store canonical variable/source revisions and first acquisition; retain enough replay history for actual active anchors and corrections before retention purges.', 'Retention cannot silently delete history required by active state; a missing segment becomes explicit uncertainty.'),
      'WG-008': ('Migrate rain reception/stage/medium conservatively; existing plant records remain usable with unknowns.', 'No legacy default or shared garden setting asserts an unconfirmed plant rain exposure or measured soil property.'),
      'WG-014': ('Respect the point wind and product-specific maximum gust support; W08 is merged factual context.', 'Point wind can cross a screen without sustained hours; W08 cannot generate its own predictive/push route.'),
      'WG-016': ('Implement the explicit W11 truth table, including missing evidence and sheltered-canopy humid air.', 'Known flowering plus missing applicable weather returns unknown; both OR arms must be ruled out before not_triggered.'),
      'WG-018': ('Validate boundary version/shape before orchestration; do not feed canonical samples straight into the legacy synthetic-row emulator.', 'Failure is isolated per path, all 14 IDs survive and unsupported data cannot silently use legacy assumptions.'),
      'WG-021': ('Use flag-specific card eligibility and strict boolean gates before persisted delivery episode logic.', 'W06 context_only, W10 triggered and string permission values cannot emit a card/push.'),
      'WG-022': ('Export exact v8.3 evaluator field names with immutable snapshot/version records; keep selected/pending population visible.', 'Malformed input returns invalid_evaluation; exclusions and adjudication coverage are reported alongside decided-case coverage.'),
      'WG-023': ('Define independent collection-to-evaluator mapping and criteria before recruitment/holdout review.', 'No missing label, revelation time or split group is invented from the older collection template.'),
      'WG-026': ('Review both FP/negative-case and FP/water-recommendation denominators and population/adjudication coverage.', 'High decided-case accuracy cannot hide selective labeling, low useful coverage or a high share of unnecessary recommendations.'),
      'WG-027': ('Run repository integration checks against the current contract; package reference tests alone do not complete app release.', 'The app actually handles partial-variable failures, source expiry and canonical data without legacy all-clear shortcuts.')}
    for task in p['tasks']:
        if task['id'] in additions:
            a,b = additions[task['id']]
            task['deliverables'].append(a);task['acceptanceChecks'].append(b)
        task['auditBoundaryContract'] = 'output/spec/WeedGrow_Implementation_Boundary_Contract_v8.3.md'
        if task['id'] == 'WG-011':
            task['codeAreas'] = [x.replace('output/spec/WeedGrow_Handoff_Reference_v8.3.py', 'output/spec/legacy_v82/WeedGrow_Functional_Reference_v8.2.py') for x in task['codeAreas']]
    # One historical example is deliberately still the frozen v7.4 model.
    p['verification'].update(specVersion='8.3', auditRefinementsApplied=True)
    write(DOCS/'algorithm-implementation-tasks-v8.3.json', p)
    write(DOCS/'algorithm-implementation-plan-verification-v8.3.json', p['verification'])
    lines = ['# WeedGrow algorithm implementation plan - v8.3', '',
      '28 planned tasks. Follow dependencies; none are completed by this handoff audit. No daily measurements or new biological coefficients are added.', '',
      'Read the [master](../output/spec/WeedGrow_Implementation_Master_v8.3.md), [contract](../output/spec/WeedGrow_Implementation_Contract_v8.3.json) and [boundary rules](../output/spec/WeedGrow_Implementation_Boundary_Contract_v8.3.md) first.', '',
      'Start WG-001, then WG-002. WG-008 and protocol work WG-023 can start after WG-001. Weather release WG-027 does not depend on real-plant calibration WG-026; watering release WG-028 does.', '',
      '## Common completion rules', '',
      '- Preserve unrelated repository changes and inspect applicable AGENTS.md before editing.',
      '- Deliver focused increments with tests, behavior/files changed and any checks not run. Split large tasks along their deliverables without weakening dependencies.',
      '- Use the fixed oracles and current boundary regressions; do not regenerate expected answers to agree with a broken port.',
      '- Run targeted checks for each change and repository-required verification for integration/release. Unknown remains null across every consumer.',
      '- An implementation gate is not a scientific approval. Profiles/criteria/targets requiring real evidence remain unassigned until the corresponding validation task is actually complete.', '',
      '## Stages', '', '| Stage | Task IDs | Outcome |', '| --- | --- | --- |',
      '| A | WG-001–002 | Contracts and fixed-answer tests |', '| B | WG-003–008 | Weather, history, logs and setup |',
      '| C | WG-009–013 | Water-state calculations and forecast |', '| D | WG-014–017 | Independent warnings and factual context |',
      '| E | WG-018–022 | App integration, delivery and shadow records |', '| F | WG-023–026 | Real-plant calibration/validation |',
      '| G | WG-027–028 | Separate gated weather/watering releases |', '', '## Tasks', '']
    for t in p['tasks']:
        lines += ['### '+t['id']+' - '+t['title'], '', '**Depends on:** '+(', '.join(t['dependsOn']) or 'None'),
                  '**Status:** '+t['status']+'; **Type:** '+t['kind'], '', '**Deliverables**', '']
        lines += ['- '+s for s in t['deliverables']]
        lines += ['', '**Acceptance checks**', '']+['- '+s for s in t['acceptanceChecks']]
        lines += ['', '**Likely repository/reference areas:** '+', '.join('`'+s+'`' for s in t['codeAreas']),
                  '', '**Spec acceptance cases:** '+', '.join(t['specAcceptanceIds']), '']
    lines += ['## Acceptance coverage', '', '| Spec case | Tasks |', '| --- | --- |']
    for n in range(1,17):
        aid=f'I{n:02}'
        lines += ['| '+aid+' | '+', '.join(t['id'] for t in p['tasks'] if aid in t['specAcceptanceIds'])+' |']
    lines += ['', 'Code paths are relative to the target repository; proposed paths are not claims that files already exist. The package contains references, not a copy of the app.', '']
    write(DOCS/'algorithm-implementation-plan-v8.3.md', '\n'.join(lines))


def stage_files():
    removed = {'HANDOFF_MANIFEST.json', 'README_START_HERE.md'}
    superseded = {'WeedGrow_Implementation_Master_v8.2.md', 'WeedGrow_Implementation_Contract_v8.2.json',
        'WeedGrow_Functional_v8.2_README.md', 'WeedGrow_Field_Evaluator_v8.0.py',
        'WeedGrow_Field_Evaluator_Tests_v8.0.py', 'WeedGrow_Field_Evaluator_Verification_v8.0.json',
        'WeedGrow_Field_Dataset_v8.0.json', 'WeedGrow_SPEC_STATUS.json'}
    with zipfile.ZipFile(ROOT/'output/WeedGrow_Complete_Codex_Handoff_v8.2.zip') as z:
        for name in z.namelist():
            if name in removed or name.startswith('implementation/') or Path(name).name in superseded:
                continue
            dest = STAGE/'output'/name
            if name.startswith('spec/WeedGrow_Functional_'):
                dest = STAGE/'output/spec/legacy_v82'/Path(name).name
            data = z.read(name)
            if Path(name).name == 'WeedGrow_Functional_Tests_v8.2.py':
                data = data.decode('utf-8').replace("PAYLOAD=HERE/'weather_fixtures'", "PAYLOAD=HERE.parent/'weather_fixtures'").replace('.read_text())', ".read_text(encoding='utf-8'))").encode('utf-8')
            dest.parent.mkdir(parents=True, exist_ok=True);dest.write_bytes(data)
    for path in SPEC.glob('*v8.3*'):
        if path.is_file() and 'Verification' not in path.name:
            (STAGE/'output/spec').mkdir(parents=True, exist_ok=True)
            (STAGE/'output/spec'/path.name).write_bytes(path.read_bytes())
    for stale_name in ('WeedGrow_Handoff_Verification_v8.3.json', 'WeedGrow_Field_Evaluator_Verification_v8.3.json'):
        stale = STAGE/'output/spec'/stale_name
        if stale.exists():
            stale.unlink()
    for path in DOCS.glob('algorithm-implementation-*v8.3*'):
        (STAGE/'docs').mkdir(parents=True, exist_ok=True)
        (STAGE/'docs'/path.name).write_bytes(path.read_bytes())
    captured = read(ROOT/'output/weather_api_audit/captured_payload_tests.py')
    captured = captured.replace("def read(n):return json.loads((P/n).read_text(encoding='utf-8'))", "def read(n):\n    folder=P.parent/'weather_fixtures' if n.endswith('_payload.json') else P\n    return json.loads((folder/n).read_text(encoding='utf-8'))")
    write(STAGE/'output/spec/weather_evidence/captured_payload_tests.py', captured)
    audit = STAGE/'output/spec/weather_evidence/Weather_API_Verification_2026-10-30.md'
    a = read(audit).replace('python captured_payload_tests.py', 'python weather_evidence/captured_payload_tests.py')
    a += '\nHandoff v8.3 note: run the above from output/spec. The shipped offline script verifies frozen payloads and recorded historical parser findings. It does not rerun the current app parser; the current repository still needs WG-003/027 integration checks.\n'
    write(audit, a)


if __name__ == '__main__':
    build_spec();build_tasks();stage_files()
    print('Staged normative spec, task plan and references:', STAGE)
