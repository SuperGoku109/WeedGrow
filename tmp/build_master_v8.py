from pathlib import Path
import json,hashlib,zipfile
ROOT=Path('C:/Users/Zane/dev/WeedGrow');S=ROOT/'output/spec'
prior=json.loads((S/'WeedGrow_Factor_Flag_Registry_v7.3.json').read_text())
model_report=json.loads((S/'WeedGrow_Independent_Test_Report_v7.5.json').read_text())
field_report=json.loads((S/'WeedGrow_Field_Evaluator_Verification_v8.0.json').read_text())
assert model_report['allPassed'] and field_report['passed']

rules=[
('W01','Heat preparation','Known air T>=32C in recent/current or forecast phase OR verified applicable heat event. Duration/exceedance are descriptive; no injury probability.'),
('W02','Cold/frost context','Air T<=5C; nested possible-frost context<=2C and air-freezing context<=0C, or verified source event. No tissue-temperature claim.'),
('W03','Wind preparation','Known gust>=15m/s OR mean wind>=10m/s OR verified source wind event. Gust maxima supply no sustained duration.'),
('W04','Rain preparation','Known point/interval rate>=10mm/h OR nonoverlapping known amount>=25mm within declared24h window OR verified rain/flood event. Point rate supplies no retained volume.'),
('W05','Source hazard','Latest trusted mapped event, matching location and valid window; noncancelled/nonconflicted. Preserve source type/severity. No coverage means unknown.'),
('W06','Watering','Approved supported profile/state/history: all R<=A ->water; all R>A ->not_due; otherwise uncertain. Unapproved model always uncertain.'),
('W07','Excess-root-water review','Only a user-initiated matching problem topic. No automatic weather-only root saturation/rot inference.'),
('W08','Container heat context','Known pot context plus W01; merge with heat. Ground ->not_applicable; unknown pot/ground ->unknown.'),
('W09','Humid-air context','Known modeled RH>=90% bin exposure>0, with phase, coverage and representative-value assumption. Not dew or leaf-wet hours.'),
('W10','Predictive PM','Disabled until validated native low-input model exists. No mandatory high-RH/rain gate; keep ambient evidence without infection probability.'),
('W11','Flower weather context','Reported flowering AND(reachable positive recent/current/forecast rain OR supported humid-air context). Unknown stage/reception remains unknown when relevant. No infection prediction.'),
('W12','Wet-canopy context','Reachable positive recent/current/forecast rain ->context_only. Missing relevant rain ->unknown; direct rain sheltered ->not_applicable. Complete declared dry windows can establish only screen not triggered.'),
('W13','Establishment review','Known establishment stage plus matching optional problem topic. Unknown stage ->unknown. No automatic damping-off prediction.'),
('W14','Root/wilt review','Matching optional root-wilt problem report. No automatic disease diagnosis or watering from wilt alone.')]

acceptance=[
('I01','Provider normalization','Real fixture current rate, hourly amount, daily total and point/max values','Correct units/time support; no overlapping sum or invented duration','specified_app_integration_pending'),
('I02','Source and historical selection','Observed-estimate, archived forecast and multiple-provider versions overlap','Declared selection per path; forecasts do not become occurred history; unresolved integral conflict is unknown','reference_cases_pass_adapter_pending'),
('I03','Calendar and logs','Date-only entry on23/25h IANA calendar day; backdate/edit/delete/retry','Correct UTC bounds; occurrence-time replay; exact-now water applied; retries idempotent','UTC_reference_pass_calendar_adapter_pending'),
('I04','Nullable output consumers','Watering unavailable but valid heat/hail event exists','needsWater remains null everywhere; independent hazard survives; no false all-clear','reference_pass_app_consumers_pending'),
('I05','Lifecycle and transitions','Repot/move/stage/medium/root-volume change occurs after anchor','Supported dated state transition or explicit reinitialization; new capacity creates no water','reference_abstention_pass_transition_model_pending'),
('I06','Dependency invalidation','Change used setup/log/weather/profile/policy/anchor revision','Advice cache key changes and affected history replays; stale advice cannot be served as fresh','app_integration_pending'),
('I07','Forecast and censoring','Wet forecast follows current low reserve; some future paths never cross','No current rain credit; no finite upper wait when censored; missing forecast does not erase current result','reference_pass_app_copy_pending'),
('I08','Warning contracts','Run all14 IDs with missing, zero, partial and conflicting data','States/reasons/phase/coverage survive; disease remains disabled/context; roots are review-only','reference_pass_adapter_pending'),
('I09','Notification episodes','Source alert updates, cancels, escalates or is retried','No duplicate delivery; cancellation removes active event; escalation bypasses repeat cooldown; no biological reset','planning_reference_pass_delivery_integration_pending'),
('I10','Low-input validation','Normal prediction receives only setup/logs/API; staff references hidden','Independent labels and held-out groups; report coverage, unnecessary water, misses and uncertain positives','requires_real_outcomes'),
('I11','Release protection','Client supplies approved:true or an unregistered profile version','Cannot enable care model; only trusted approved registry can activate supported domains','reference_gate_pass_server_registry_pending'),
('I12','Source freshness and expiration','Forecast or source event exceeds its declared validity/policy','Stale values rejected; expiration triggers reevaluation; no universal invented freshness default','policy_and_integration_pending')]

release=dict(version='8.0',scope='per_model_profile_domain',policyLockedBeforeHoldout=False,
             approvedOutcomeCriterionId=None,approvedProfileIds=[],diseasePredictivePushEnabled=False,
             numericTargets=dict(minimumIndependentPlants=None,minimumPositiveCases=None,minimumNegativeCases=None,
                                minimumDecisionCoverage=None,maximumFalseWaterRate=None,maximumUnaddressedDueRate=None),
             statisticalReviewApproved=False,sourceAdapterContractsPassed=False,consumerIntegrationPassed=False,
             note='Null/unapproved targets block model activation. These are product/agronomic decisions to preregister, not values to infer from synthetic tests.')
contract=dict(version='8.0',dailyMeasurementRequirements=[],routineUserActions=['log watering; amount optional'],
 acceptedUserFacts=['location','environment','plantedIn','unit-labelled approximate pot volume','stage or unknown','sun category or unknown','soil/canopy rain reception','optional medium','optional dated age/origin','optional dated height'],
 weather=dict(kinds=['occurred_estimate','forecast','current_point'],timeSupport=['point','representative_bin','interval_mean','interval_maximum','interval_sum','rate'],requiredProvenance=['provider','product','location_revision','issued_at_utc','available_at_utc','valid_start_utc','valid_end_utc','units','time_support'],missingValue=None,overlapPolicy='select declared source/revision per path; unresolved integral overlap -> unknown',freshnessPolicy='backend per-source policy; no production default invented'),
 profile=dict(lossModel='total_empirical',effectiveLossM2=None,capacityL=None,actionReserveL=None,initialReserveScenarios=None,unknownRefillScenarios=None,catchmentAndDeliveryScenarios=None,requiredMetadata=['profile_id','version','criterion_id','validation_evidence_id','supported_setup_domain','supported_climate_and_source_domain','operating_range','state_anchor_basis','transition_policy','approval_record']),
 output=dict(waterDecision=['water','not_due','uncertain'],needsWater={'water':True,'not_due':False,'uncertain':None},warningStates=['triggered','not_triggered','unknown','not_applicable','disabled','context_only','review_requested'],requiredMetadata=['engine_version','profile_version','policy_version','evaluation_utc','location_revision','data_revision_fingerprint','phase','coverage','reason_codes','next_evaluation_utc']),
 flags=[dict(id=i,name=n,rule=t) for i,n,t in rules],factors=prior['factors'],sources=prior['sources'],
 releasePolicy=release,acceptanceCases=[dict(id=i,area=a,given=g,expected=e,status=t) for i,a,g,e,t in acceptance],
 status='implementation_contract_complete_for_foundation; production_care_activation_blocked_by_validation_and_integration')
(S/'WeedGrow_Implementation_Contract_v8.0.json').write_text(json.dumps(contract,indent=2,ensure_ascii=False),encoding='utf-8')
(S/'WeedGrow_Release_Policy_v8.0.json').write_text(json.dumps(release,indent=2),encoding='utf-8')
(S/'WeedGrow_Field_Dataset_v8.0.json').write_text(json.dumps(dict(criterion_id=None,criterion_definition=None,criterion_defined_before_predictions=False,cases=[]),indent=2),encoding='utf-8')

text='''# WeedGrow v8.0 - implementation master specification

30 October 2026. This is the single normative reading document for new implementation. It consolidates the practical v7.2 scope, v7.3 architecture, v7.4 corrections and v7.5 independent tests. Those older files are evidence/reference history; this document and the companion contract control new work. No application integration or agronomic validation is claimed.

## 1. Deliverable and readiness boundary

The product estimates whether outdoor watering is due, prepares growers for supported weather, and describes relevant ambient disease conditions. Its routine workflow is simple setup plus watering logs, with amount optional. It must not require daily moisture checks, sensors, leaf/root temperatures, photos or repeated plant measurements.

The engineering foundation is specified below. Production watering activation additionally requires approved calibrated profiles, valid initial-state ranges, real low-input validation, source adapters and consumer integration. Predictive disease alerts remain disabled. A specification and passing logic tests cannot guarantee perfect care.

One-time inputs: location, outdoor environment, pot/ground, approximate pot volume with units if known, stage with unknown option, sun category, soil/canopy rain reception and optional meaningful medium. Existing dated age/origin and height may select supported profiles. Unknown facts use a separately supported aggregate profile or uncertainty; they do not force another measurement.

## 2. Non-negotiable output semantics

`water`, `not_due`, `uncertain` map to `needsWater=true`, `false`, `null`. Missing, disabled and unsupported must never become false. `not_due` applies at the evaluation time; it is not a full-day guarantee.

Every warning returns a stable ID, state, reason codes, evidence, phase, coverage and applicability. States are `triggered`, `not_triggered`, `unknown`, `not_applicable`, `disabled`, `context_only`, `review_requested`. Screen-not-triggered is not a no-disease/no-harm guarantee. Context is not infection detection. No probability is output without a separately calibrated model.

The response also carries engine/profile/policy versions, evaluation UTC, location revision, data revision fingerprint and next evaluation time. Internal synthetic candidate values must not leak into the user-facing production decision. No exact watering dose is part of this scope.

## 3. Trust boundaries and units

Client facts and logs are assertions from the grower, with unknown/stale/precision metadata. Weather comes through trusted backend adapters. Client-supplied `approved` or `adapter_verified` values must not activate a production model or authenticate a source event. Approval records and profile versions belong in protected server configuration.

Normalize water to litres, rain depth to millimetres, area to square metres, air temperature to Celsius, RH to percent, wind to m/s and timestamps to UTC seconds or an explicitly declared application equivalent. A raw unitless pot string is not litres. Gallons require a declared gallon standard. UI waterLevel and sensorProfileId are not actual moisture evidence.

## 4. Weather contract and coverage

Each variable has provider/product, units, time support, issue/availability times, location revision and validity interval. Distinguish points, interval means, representative bins, maxima, sums and rates. A point uses identical start/end and cannot fill an hour. An hourly maximum gust is not an hour of sustained gust-speed wind.

Separate occurred estimates, current points and forecasts. Archived forecasts remain forecasts of the past. Select declared provider/product/revision per path before integration; never sum overlapping sources. Equal-authority conflicts or unresolved overlapping integrals make that path unknown. Reject invalid variables independently so bad RH does not erase valid wind evidence.

Rain missing is not zero unless the tested provider contract establishes zero. Current rate can establish a weather crossing but supplies no retained-water volume without an integration interval. Snow and frozen precipitation are not automatically available liquid water. Boundary bins need a tested adapter; do not silently prorate a shower uniformly across time.

Coverage is per variable and path. Complete ET0 plus required rain supports water replay even when RH is missing; soil sheltered from direct rain need not require rain for its direct-water component. Missing forecast data blocks projection, not an otherwise supported current decision. A supported positive threshold crossing can survive gaps; an absent crossing cannot be declared complete when data is missing.

Backend freshness/expiration policies are source-specific, versioned engineering configuration. They remain to be agreed and tested for actual products. Historical issued/fetched age is not treated identically to forecast freshness.

## 5. Canonical log and transition contract

Use stable event identity and authoritative revision. Duplicate retries count once; distinct equal-looking events both count. Edits/deletions replay affected history. A later authoritative revision clears an earlier conflict; an unresolved final conflict blocks water replay.

Use occurrence time, not editing time. A date-only event becomes a UTC interval from its calendar day and IANA timezone, capped by recorded/evaluation time. Days may last23 or25hours. Keep earliest/latest timing alternatives; do not invent noon. Exact-now watering is applied after history through that evaluation boundary. Events straddling an anchor require reconciliation.

Repot, medium, stage, root access and location changes require dated transitions. New volume does not create water. Carry existing water only through a supported transformation; otherwise reinitialize with defensible ranges. Do not apply today's flowering profile to an entirely vegetative past. The current reference abstains on unhandled transitions; it does not implement a complete growth model.

## 6. Profile model: make parameters identifiable

The base model uses one total effective loss coefficient `a_eff` in m2, equivalently litres per millimetre of ET0. Loss for an interval is `ET0_mm * a_eff`. This is an empirical effective coefficient, not actual leaf area or pot-opening area.

IMPORTANT CORRECTION FOR CALIBRATION: the reference expresses loss as `ET0*(plant_loss_m2 + surface_loss_m2)`. When both multiply the same ET0, total-loss data identify only their sum. Do not fit/publish them as independently identified physiological components. A compatibility adapter can set legacy plant_loss_m2=a_eff and surface_loss_m2=0. This does not mean real soil evaporation is zero. Separate components require independent evaporation references or distinct supported forcing; ordinary growers are not asked for them.

Profile parameters are available capacity C, action reserve A, initial reserve scenarios, total effective loss, rain catchment/delivery and retained-refill scenarios. Each has units, evidence, scope and uncertainty. Pot/ground, medium, stage, sun and optional dated age/height select supported profile domains, not universal additive weights. Unknown amount is not a full refill. Generic strain categories cannot supply resistance, roots or stomatal parameters.

Required profile metadata: immutable ID/version, care-outcome criterion, validation evidence, supported setup/climate/source/operating domains, state-anchor basis, transition policy and approval record. The existing reference checks only part of this contract; production domain/approval enforcement is a required implementation task. No approved profiles are bundled.

## 7. Current water calculation

```
C = accessibleVolumeL * (thetaUpper - thetaLower)  // only if supported
RAW = p*C                                        // allowable depletion
A = C-RAW                                        // remaining action reserve
rainL = liquidRainMm * effectiveCatchmentM2 * deliveryFraction
irrigationL = appliedLOrSupportedScenario * retainedFraction
potentialLossL = ET0mm * totalEffectiveLossM2

// inputs-first available-water bank
excessL = max(0, R + rainL + irrigationL - C)
storedL = min(C, R + rainL + irrigationL)
extractedL = min(storedL, potentialLossL)
nextR = storedL - extractedL
R + rainL + irrigationL = nextR + excessL + extractedL
```

One mm over one m2 is one litre. Nominal pot litres do not identify catchment, filled/root-accessible volume or retention. Study-selected p values are not universal care thresholds. This bank is available water above a lower reference, not total water or measured soil-moisture percent. Excess is accounting, not actual waterlogging; unmet potential loss is not actual transpiration.

Replay coherent scenarios, including supported timing/input-loss ordering alternatives, rather than independent arbitrary parameter extremes. Water if every supported R<=A; not_due if every supported R>A; otherwise uncertain. A numeric tolerance handles floating arithmetic only. Release requires an approved profile plus supported state/history/domain. No majority vote, mean-reserve shortcut or watered-today override is allowed.

ET0 already combines weather demand; do not add unvalidated heat/RH/wind/UV/daylength drying bonuses. A total loss coefficient already including evaporation must not add evaporation again. Fixed loss is a limited model, especially after stress; validate its operating region before activation.

## 8. Projection and exposure

Current replay credits only occurred water. Forecast trajectories start from current supported states and keep rain uncertainty separate. No-rain/provided-rain branches are conditional examples, not a complete meteorological error envelope. Missing forecast coverage returns unavailable projection. If any trajectory never crosses inside the horizon, the upper waiting time is unresolved/null, not the latest finite crossing. A wet forecast cannot cancel a current supported due decision.

For representative interval x_i and duration dt_i: H=sum(dt_i when threshold met); D=sum(max(x_i-threshold,0)*dt_i); L=longest contiguous known crossing episode. Reverse subtraction for cold. Gaps, unknown bins and noncrossing bins break L. Overlaps make integrals unavailable. Points can trigger without supplying duration; maxima supply no sustained exposure integral. Record the representative-bin approximation explicitly.

Keep recent/current screen, historical24h exposure and forecast24h screen distinct. Yesterday's high exposure is not automatically a current heat event. Example only: at32C screen,34C for1h and36C for2h gives3h crossing and10C-hours exceedance. These are weather metrics, not injury probabilities.

## 9. Single warning decision table

Numerical weather screens and RH90% context are engineering candidates, not calibrated cannabis damage/infection thresholds. Current and forecast evidence retain their phase. All14 routes execute independently so a water gap cannot hide a valid source hazard.

| ID | Output | Determination |
| --- | --- | --- |
'''
for i,n,t in rules:text+='| '+i+' | '+n+' | '+t+' |\n'
text+='''
Use paired same-interval air values for VPD and humidity context. Air VPD=`0.6108*exp(17.27*T/(T+237.3))*(1-RH/100)` kPa. It is not leaf VPD, soil moisture or a direct litre estimate. Humidity history is not measured leaf wetness; shelter from rain does not eliminate ambient humidity.

## 10. Cache, scheduling, cards and delivery

Deterministic evaluation uses an explicit time, immutable input snapshot, engine/profile/policy versions and canonical event/weather revisions. Cache keys include location, environment/lifecycle, pot/ground, used volume/medium/stage/sun/age/height, both rain-reception fields, anchor, logs, forcing revisions and model/policy changes. A future port must test those dependencies against actual app consumers; no application integration has happened yet.

Schedule reevaluation on new events/corrections, relevant fact/profile changes and source/data expiration, plus an agreed backend cadence. A daily bucket alone is insufficient. Stale cached advice must retain its old timestamp and become unavailable when its validity expires.

Merge heat/container and shared wet-weather context cards. Deduplicate one source episode across W01-W05 while retaining distinct hazards. Notification eligibility additionally requires product policy, app permission/subscription, episode/cooldown and validated claim. Cancellation removes current source evidence; escalation can bypass repeat cooldown. Dismissal/snooze/watering never resets biological or weather evidence. The reference sends zero notifications.

## 11. Calibration and real outcomes

Ordinary users continue basic setup plus watering logs. A separate research/opt-in cohort provides independent water/state/loss/retention references. Account for drainage, interception and non-water mass changes when choosing reference methods. Define the desired care endpoint before labeling cases; survival, wilting, yield response and a raw moisture percentage are not interchangeable targets.

Fit identifiable total-loss/state/refill profiles using training data. Choose model/policy on tuning data. Freeze predictions and holdout criteria before evaluating test outcomes. Separate growers/plants across partitions and evaluate future seasons/regions; hours from the same grower must not leak across splits. An analysis based only on watering timestamps cannot independently identify every storage/refill/loss parameter or prove that the grower watered at the right time.

The new evaluator checks watering outcomes only. Each adjudicated case requires case/group IDs, split, criterion, boolean independent label, decision, reference method/adjudicator and timing provenance. `latest_input_available_at_utc` means when information was available, not the forecast's future valid time: forecasts issued before evaluation are allowed; later observed/revised weather is not. Prediction freezing must precede label revelation. Empty/pending labels never become negatives.

It reports counts, decision coverage, accuracy/sensitivity on decided cases, all-positive capture, false watering per negative, explicit misses and due cases left without a water recommendation, including abstentions. For1TP/1TN/1FP/1FN plus1uncertain positive/1uncertain negative: coverage4/6, decided accuracy2/4, positive capture1/3. An accurate small decided subset cannot hide low coverage. Empty eligible data is not_evaluated; invalid/leaking evaluations suppress metrics. The tool never authorizes release, and it does not supply disease-performance or confidence-interval validation.

## 12. Release gates and remaining decisions

The companion release-policy file deliberately leaves numerical acceptance targets null. These must be preregistered by product/agronomic owners before holdout labels are used: minimum independent plants and positive/negative cases, minimum useful coverage, acceptable unnecessary watering and acceptable unaddressed due cases. Independent statistical review must consider uncertainty and domain coverage, not only point metrics. No arbitrary accuracy percentage is declared here.

Approval requires predefined outcome criterion, calibrated versioned profiles, independent domain validation, approved statistical review, source adapter tests, consumer integration and notification-policy checks. A later data/model/profile change reopens relevant gates. Validated synthetic tests are necessary for engineering consistency but cannot approve these agronomic gates.

Implement foundation and source-weather preparation first; run water model in shadow mode with debug estimates, no care activation. Validate supported container domains before broadening to ground/establishment. Keep predictive disease models disabled until prospective outcomes support their scope. Do not silently weaken the low-input promise to improve results.

## 13. Acceptance and implementation work

These are required integration tests and evidence gates, not claims that the app already passes them.

| ID | Area | Given / event | Required result | Current status |
| --- | --- | --- | --- | --- |
'''
for i,a,g,e,t in acceptance:text+='| '+i+' | '+a+' | '+g+' | '+e+' | '+t+' |\n'
text+='''
## 14. Reproducible test commands

Run from the extracted spec directory with Python3.10+ and the standard library:

```powershell
python WeedGrow_Independent_Tests_v7.5.py --include-existing
python WeedGrow_Field_Evaluator_Tests_v8.0.py
python WeedGrow_Field_Evaluator_v8.0.py WeedGrow_Field_Dataset_v8.0.json
```

The first command runs115 reference checks, the1,000 seeded bank trials,96 exhaustive parameter sets and7 deliberate fault checks. The second runs14 independently checked evaluator cases. The third intentionally refuses the empty/unconfigured field dataset: a real predefined criterion and independent outcomes are still needed. The scripts are offline and write only their local reports. No application, live plant or notifications are changed.

Do not regenerate expected answers from a changed engine merely to make tests pass. Any legitimate model/contract change needs independent rationale, revised scope and reviewed expected conclusions. Keep measured holdout labels outside tuning. Preserve failed cases as regressions.

## 15. Complete factor ownership ledger

Every factor has an explicit role, including legitimate no-direct-effect or unsupported paths. The rules in sections3-9 override outdated wording in earlier references.

| Factor | Algorithmic role | Outputs |
| --- | --- | --- |
'''
for f in prior['factors']:text+='| '+f['id']+' '+f['factor']+' | '+f['rule']+' | '+f['affectedOutputs']+' |\n'
text+='''
## 16. Evidence and artifact precedence

The JSON contract retains38 source records. Published measured values, author-selected protocols, derived arithmetic, engineering policy and calibration-required values must remain distinct. No new biological coefficients are assigned by this consolidation. The v7.4 executable remains an offline reference; v8 specifies production contracts it does not yet fully implement. In particular, total-loss identifiability, full domain validation, real provider/calendar adapters and app consumer integration are explicit handoff requirements.

The v7.5 independent known-answer catalogue and field-template guidance remain included. v8's field dataset/evaluator defines the executable scoring format. Its fields must be populated by trusted evaluation code and independent reference records, not filled by guessing outcomes. App source files remain unchanged.
'''
(S/'WeedGrow_Implementation_Master_v8.0.md').write_text(text,encoding='utf-8')
(S/'WeedGrow_Implementation_v8.0_README.md').write_text('''# WeedGrow v8 implementation handoff

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
''',encoding='utf-8')
statusp=S/'WeedGrow_SPEC_STATUS.json';status=json.loads(statusp.read_text());status.update(currentProductSpec='8.0',document='WeedGrow_Implementation_Master_v8.0.md',referenceAlgorithmVersion='7.4',testHarnessVersion='7.5',fieldEvaluatorVersion='8.0',productionActivationReady=False,appImplementationChanged=False,predictiveAccuracyValidated=False);statusp.write_text(json.dumps(status,indent=2),encoding='utf-8')
files=['WeedGrow_Implementation_Master_v8.0.md','WeedGrow_Implementation_Contract_v8.0.json','WeedGrow_Release_Policy_v8.0.json','WeedGrow_Implementation_v8.0_README.md','WeedGrow_Field_Evaluator_v8.0.py','WeedGrow_Field_Evaluator_Tests_v8.0.py','WeedGrow_Field_Evaluator_Verification_v8.0.json','WeedGrow_Field_Dataset_v8.0.json','WeedGrow_Algorithm_Emulator_v7.4.py','WeedGrow_Algorithm_Scenarios_v7.4.py','WeedGrow_Independent_Tests_v7.5.py','WeedGrow_Independent_Test_Cases_v7.5.json','WeedGrow_Independent_Test_Report_v7.5.json','WeedGrow_Known_Answers_v7.5.md','WeedGrow_Independent_Tests_v7.5_README.md','WeedGrow_Field_Validation_Template_v7.5.json','WeedGrow_SPEC_STATUS.json']
manifest=dict(version='8.0',appSourceChanged=False,realPlantCases=0,productionActivationReady=False,files=[dict(path=f,sha256=hashlib.sha256((S/f).read_bytes()).hexdigest()) for f in files])
(S/'WeedGrow_Implementation_Manifest_v8.0.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');files.append('WeedGrow_Implementation_Manifest_v8.0.json')
with zipfile.ZipFile(ROOT/'output/WeedGrow_Implementation_v8.0_Bundle.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for f in files:archive.write(S/f,'spec/'+f)
print(json.dumps(dict(words=len(text.split()),factors=len(prior['factors']),warnings=len(rules),acceptanceCases=len(acceptance),files=len(files),modelChecks=model_report['testsRun'],evaluatorChecks=field_report['testsRun'])))
