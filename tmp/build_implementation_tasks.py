from pathlib import Path
import json,hashlib,zipfile
R=Path('C:/Users/Zane/dev/WeedGrow');D=R/'docs';S=R/'output/spec'
C=json.loads((S/'WeedGrow_Implementation_Contract_v8.2.json').read_text(encoding='utf-8'))
tasks=[]
def task(n,title,phase,deps,files,deliver,checks,ids=(),kind='code'):
 tasks.append(dict(id=f'WG-{n:03}',title=title,phase=phase,dependsOn=[f'WG-{x:03}' for x in deps],status='planned' if kind=='code' else 'planned_requires_evidence_or_release_review',kind=kind,codeAreas=files,deliverables=deliver,acceptanceChecks=checks,specAcceptanceIds=list(ids),completionEvidenceRequired=['changed files and behavior','executed relevant checks/results','remaining limitations; no biological accuracy inferred from synthetic tests']))

task(1,'Define versioned algorithm contracts and inactive feature gates','A - Contracts and tests',[],['firestoreModels.ts','lib/suggestions/types.ts','Proposed: lib/careAlgorithm/contracts.ts'],
 ['Add typed input/output, provider provenance, warning states and water/not_due/uncertain ->true/false/null mapping.','Separate empirical profile parameters from engineering policy; keep unapproved care/disease routes inactive.','Define serialization/version boundaries without changing existing user-facing care behavior.'],
 ['Unknown survives serialization as null; missing/unapproved profile cannot activate care.','All 14 warning IDs and phases have a typed result; no disease probability default.'],['I04','I08','I11'])
task(2,'Port fixed-answer fixtures into the app test harness','A - Contracts and tests',[1],['lib/weather/__tests__','lib/suggestions/__tests__','output/spec/WeedGrow_Independent_Test_Cases_v7.5.json','output/spec/weather_fixtures'],
 ['Create reusable TypeScript fixture loaders for captured weather and the 13 fixed-answer water cases.','Add cross-language parity checks for implemented pure functions using fixed expected answers; preserve Python reference runner.','Track unmet integration cases explicitly; do not mark existing parser defects as successful behavior.'],
 ['Expected answers are not regenerated from the target engine.','Tests run offline with no API keys; newly enabled regression assertions land with their corresponding fix.'],['I01','I04','I07','I08'])
task(3,'Implement corrected OpenWeather normalization','B - Data foundation',[1,2],['lib/weather/weatherResponse.ts','lib/weather/weatherMeasurements.ts','lib/weather/__tests__/weatherResponse.test.ts','lib/weather/__tests__/parseWeatherData.test.ts'],
 ['Add versioned current/hourly/daily/TimeMachine adapters and preserve raw source events/codes.','Keep UTC solar epochs unchanged, today daily record as forecast, rain rates separate from amounts.','Keep provider-valid omission-as-zero distinct from missing/failed data; retain historical data[] points.'],
 ['Captured TimeMachine record is ingested and sunrise has zero UTC shift.','Forecast night humidity is never labelled observed;2mm/h current and25mm daily remain distinct.','Old display compatibility is tested before routing it through new records.'],['I01','I02','I03'])
task(4,'Implement Open-Meteo normalization and paired-air fallback','B - Data foundation',[1,2],['Proposed: lib/weather/providers/openMeteo.ts','lib/weather/weatherResponse.ts','output/spec/WeedGrow_Functional_Reference_v8.2.py','output/spec/WeedGrow_API_Air_Fallback_v8.1.py'],
 ['Port Forecast rain+showers and Archive rain mappings, ET0/radiation units and preceding-hour supports.','Keep air points separate; preserve past_days as forecast and past model-history as a distinct source kind.','Port conservative paired API dew-point fallback, with provider RH priority and no wetness inference.'],
 ['Captured forecast yields0.6mm liquid rain; Archive does not require a separate showers array.','Wrong units/misaligned arrays/null components are rejected or retained unknown as specified.','No future record enters history; aggregates/unpaired/dew-above-air data cannot derive RH.'],['I01','I02','I13'])
task(5,'Add backend provider clients and explicit source/freshness policy','B - Data foundation',[3,4],['functions/src/operations.ts','functions/src/index.ts','lib/weather/fetchWeather.ts','lib/weather/refreshGardenWeather.ts'],
 ['Add server-side configurable clients for the chosen weather/ET0 and historical products; keep production provider switch off initially.','Record retrieval/availability and optional real issue time; select a recent-history product/backfill policy instead of silently splicing models.','Share garden-level requests, enforce bounded requests/timeouts and document source freshness/expiry configuration.'],
 ['Mocked auth,401/429/timeout/partial responses produce scoped errors; no secrets in logs/fixtures.','Forecast is not substituted for occurred history; newly retrieved old source data is not declared fresh by retrieval alone.','No purchase/subscription change or production provider activation is implied by this code task.'],['I02','I12','I16'])
task(6,'Persist typed weather intervals and replayable revisions','B - Data foundation',[1,5],['firestoreModels.ts','functions/src/operations.ts','lib/weather/refreshGardenWeather.ts','lib/logs/fetchLogsAndWeatherForRange.ts'],
 ['Add scoped/versioned interval storage and queries at the appropriate garden/location/provider level; retain a legacy display adapter.','Persist complete required history, revision identity, source kind, units and availability; support bounded backfill.','Specify retention/indexes/query bounds and ownership rules; avoid growing raw arrays in a single daily/plant record.'],
 ['Duplicate collection adds no rainfall; corrected authoritative records replay deterministically.','Location revisions do not mix gardens/moves; partial history is observable.','Local Firestore integration tests cover ownership and bounded reads/writes.'],['I01','I02','I06','I12'])
task(7,'Canonicalize watering events and date-only occurrence windows','B - Data foundation',[1,2],['lib/logs/plantJournal.ts','lib/logs/__tests__/plantJournal.test.ts','lib/dates/plantDay.ts','firestoreModels.ts'],
 ['Expose stable event identity/revision, occurrence bounds, recorded time, deletion and optional litre amount.','Handle exact timestamps and IANA23/25hour date-only bounds; include exact-now events.','Resolve latest authoritative revision, preserve two genuine events and replay edits/deletions.'],
 ['Retry is idempotent; zero amount stays zero; conflicting latest revision blocks affected replay.','Date-only upper bound cannot extend beyond known recording/evaluation time; anchor-straddling events require reconciliation.'],['I03'])
task(8,'Add the small setup fields and unknown-safe legacy migration','B - Data foundation',[1],['firestoreModels.ts','features/plants/form/plantSectionForm.ts','features/plants/components/PlantEditorFields.tsx','features/addPlant/gardenDefaults.ts'],
 ['Add one clear rain-reception choice populating soil/canopy reach and an optional meaningful medium choice.','Retain unknown stage/sun/medium/volume; parse explicitly labelled pot units without inventing precision.','Migrate absent legacy facts to unknown; keep existing dated age/height optional.'],
 ['Normal watering logging requires no amount, photo, moisture check or repeated size measurement.','Existing soil provenance is not promoted to hydraulic texture; no guessed50percent shelter.','UI/migration tests cover old plants and skipping optional setup.'],['I14','I16'])
task(9,'Implement trusted profile resolution and release protection','C - Water model',[1,8],['Proposed: lib/careAlgorithm/profiles.ts','Proposed: functions/src/careProfiles.ts','output/spec/WeedGrow_Release_Policy_v8.0.json'],
 ['Resolve versioned domains for setup/climate/source/operating range, state basis and care criterion.','Use one identifiable total effective loss coefficient; only explicit validated aggregate fallbacks for missing/stale optional facts.','Keep approved registry server-controlled and empty until real validation; synthetic fixture profiles stay test-only.'],
 ['Forged approved:true cannot activate care; out-of-domain setup remains unsupported.','Unknown optional age/height/medium tries only registered supported fallback without prompting repeatedly.','Approximate volume never becomes exact rooting/catchment or an invented error percentage.'],['I11','I14'])
task(10,'Port pure water-bank mathematics and exposure primitives','C - Water model',[1,2],['Proposed: lib/careAlgorithm/waterBalance.ts','output/spec/WeedGrow_Independent_Test_Cases_v7.5.json'],
 ['Implement capacity cap, inputs/loss ordering, mass ledger and numeric validation in litres.','Implement remaining action reserve A=C-pC and total ET0 loss with explicit dimensions.','Keep potential loss/unmet demand/overflow as model terms, not actual transpiration/root disease.'],
 ['All fixed mathematical cases and exhaustive ordering/conservation checks pass.','Negative/nonfinite inputs and invalid starting reserve/order are rejected; no duplicate weather drying modifiers.'],['I08'])
task(11,'Implement initialization, amount-free refills and current decisions','C - Water model',[6,7,9,10],['Proposed: lib/careAlgorithm/waterState.ts','Proposed: lib/careAlgorithm/evaluateWater.ts','output/spec/WeedGrow_Functional_Reference_v8.2.py'],
 ['Build initial state from supported saved state/anchor, otherwise unanchored[0,C] if capacity is supported.','Replay coherent state/refill/reception scenarios; omitted amount broadens bounds without forcing full refill.','Evaluate all R against their A, then gate production result on approved domain/state/history.'],
 ['Mixed trajectories return uncertain/null, never midpoint/majority vote.','Small watering today can leave due; unknown amount cannot create precise moisture.','No profile/history/state ->uncertain; independent weather paths remain available.'],['I03','I04','I11','I14'])
task(12,'Implement dated transitions and corrected-history replay','C - Water model',[7,9,11],['features/groups/gardenMove.ts','lib/plants/locationState.ts','Proposed: lib/careAlgorithm/transitions.ts'],
 ['Record relevant setup/stage/profile change boundaries automatically; replay old state to boundary.','Carry water unchanged across approved compatible demand/threshold changes; update parameters forward only.','For physical/incompatible changes use supported transformation or unknown initialization; recheck profile approval.'],
 ['New pot capacity never scales water upward; stage edit never rewrites earlier demand.','A gap before transition requires replay, not silent time advancement.','Move invalidates source scope; carrying reserve does not carry new-profile approval.'],['I05','I15'])
task(13,'Implement conditional next-watering projection','C - Water model',[5,9,11,12],['Proposed: lib/careAlgorithm/projectWater.ts','output/spec/WeedGrow_Algorithm_Emulator_v7.4.py'],
 ['Project from current states using declared forecast/rain scenarios and horizon.','Return crossing intervals and explicit horizon censoring; preserve source/coverage/conditional status.','Keep forecast projections entirely separate from current water replay.'],
 ['Wet forecast never cancels already-due current state.','Any trajectory without crossing means upper waiting time unresolved, not finite.','Missing forecast makes projection unavailable without erasing current supported result.'],['I07'])
task(14,'Implement heat, cold, wind and container-weather flags','D - Warnings',[3,4,6,8,10],['Proposed: lib/careAlgorithm/warnings/weather.ts','lib/weather/powderyMildewRisk.ts'],
 ['Implement W01-W03 and merged W08 with recent/current versus forecast evidence.','Calculate supported H/L/D metrics and historical exposure independently of current trigger.','Keep engineering thresholds labelled; do not wire legacy mildew heuristics into these physical flags.'],
 ['Point crossings contribute no duration; gust maxima cannot become sustained hours.','Gaps break continuous episodes, overlaps do not double-count, yesterday heat is not automatically current heat.','Unknown pot/ground stays unknown; no root-temperature input.'],['I08'])
task(15,'Implement rainfall flags and trusted source-event ingestion','D - Warnings',[3,4,5,6],['Proposed: lib/careAlgorithm/warnings/rain.ts','Proposed: lib/weather/sourceEvents.ts','functions/src/operations.ts'],
 ['Implement W04 rate/known24h amount screens using product-specific liquid-water semantics.','Persist source events/cancellation/revision and map W05 only through tested regional issuer/product rules.','Keep unmapped/absent source coverage unknown and preserve source severity; no hail from prose inference.'],
 ['Positive partial known sum may exceed screen; incomplete below-threshold window cannot give all-clear.','Latest cancellation removes prior event; source alert survives missing ET0.','No source notification activation until regional mapping/coverage and delivery checks pass.'],['I01','I08','I09','I12'])
task(16,'Implement factual humidity/flower context with predictive disease disabled','D - Warnings',[4,6,8,14,15],['Proposed: lib/careAlgorithm/warnings/ambient.ts','lib/weather/powderyMildewRisk.ts','output/spec/WeedGrow_Implementation_Master_v8.2.md'],
 ['Implement W09-W12 using paired air history/forecast, stage and reachable recent/current/forecast rain.','Keep W10 predictive model disabled and all disease probabilities absent.','Replace any reused high-humidity-only PM gate; keep conditions copy factual and shared.'],
 ['Unknown/missing rain never clears canopy context; sheltered direct rain does not remove humidity context.','Reported flowering is the flower gate; age/strain does not establish flower day or resistance.','No leaf wetness, internal-bud offsets or daily inspection requirement.'],['I08','I13','I16'])
task(17,'Route optional root/wilt/establishment problem reviews','D - Warnings',[1,8],['lib/logs/plantJournal.ts','features/plants','Proposed: lib/careAlgorithm/warnings/problemReview.ts'],
 ['Implement W07/W13/W14 as topic-specific user-initiated review routes using existing journal/care entry patterns.','Do not introduce automatic root/damping-off diagnoses or mandatory health checks.','Keep optional symptom/no-symptom observations separate from moisture and infection claims.'],
 ['Root-wilt report does not automatically instruct watering.','Unknown establishment stage is unknown; unrelated problem topics do not trigger all root reviews.'],['I08','I16'])
task(18,'Assemble the deterministic evaluation service','E - App and shadow mode',[9,11,12,13,14,15,16,17],['lib/suggestions/wateringEngine.ts','lib/suggestions/wateringSuggestions.ts','lib/suggestions/algorithms/wateringAlgorithm.ts','Proposed: lib/careAlgorithm/evaluate.ts'],
 ['Compose profile/state/warnings in one explicit-time immutable-input evaluation.','Return all 14 IDs once, phase/coverage/reasons, versions and nullable water result; disable care for inactive/deleting plants.','Add a shadow entry point; route no unvalidated candidate into user-facing care.'],
 ['Evaluation deterministic and input-preserving.','One failed path cannot suppress independent source weather; every warning retains its own status.','No timer/day-since-log fallback is presented as measured or validated moisture.'],['I04','I08','I11'])
task(19,'Implement revision-aware cache invalidation and automatic reevaluation','E - App and shadow mode',[6,7,8,12,18],['lib/suggestions/adviceInputs.ts','lib/weather/shouldUpdateWeather.ts','features/groups/hooks/useGroupWeather.ts','features/home/useGardenWeatherCollection.ts'],
 ['Fingerprint every actual model dependency plus engine/profile/policy/anchor/log/weather revisions.','Expire unsupported advice and schedule bounded retry/backfill/new-event evaluation.','Keep metadata-only presentation changes from causing unnecessary history fetches.'],
 ['Changed plantedIn, used age/height/medium or rain reception invalidates affected advice.','Outage yields one stable scoped uncertainty, not repeated prompts or retained stale not_due.','Updated/deleted logs and late weather corrections trigger required replay without duplicates.'],['I06','I12','I16'])
task(20,'Migrate all care consumers to nullable decisions and truthful copy','E - App and shadow mode',[1,8,18,19],['features/plants/plantCare.ts','lib/suggestions/types.ts','features/plants/components/PlantWeather.tsx','features/home'],
 ['Remove same-day watering override that forces not_due/high confidence.','Show watering recorded as an annotation, independent of decision; distinguish routine reminders from model estimates.','Present unknown/context/disabled states without repeated soil-check instructions or disease diagnosis language.'],
 ['true/false/null survive persistence, sorting, badges and cards.','A small watering cannot erase due; missing data cannot become not_due.','No synthetic candidate or score reaches production care UI.'],['I04','I16'])
task(21,'Implement grouped cards and delivery episodes behind inactive gates','E - App and shadow mode',[14,15,16,17,18,20],['features/care/NotificationNavigation.tsx','features/care/NotificationNavigation.native.tsx','Proposed: lib/careAlgorithm/delivery.ts'],
 ['Merge heat/container and shared wet context; deduplicate one source event across warning IDs.','Persist episode/revision/send state; handle cancellation, severity escalation and permitted repeats.','Require consent, enabled policy and approved claim/source/profile; leave production push gates off until release tasks.'],
 ['Context/uncertainty never generates predictive-disease pushes.','Retry cannot send duplicate episode; cancellation removes evidence; escalation is not hidden by repeat cooldown.','Dismiss/snooze/watering changes delivery only, not modeled water or weather evidence.'],['I09','I11','I16'])
task(22,'Add shadow recording and independent evaluation export','E - App and shadow mode',[18,19,20],['Proposed: functions/src/careShadow.ts','output/spec/WeedGrow_Field_Evaluator_v8.0.py','output/spec/WeedGrow_Field_Dataset_v8.0.json'],
 ['Record immutable input/version/evaluation snapshots and debug predictions without activating advice.','Export deidentified plant/grower groups, source availability and predictions frozen before labels.','Keep reference measurements/labels out of ordinary-input inference; bound storage/retention.'],
 ['No API keys/credentials or unnecessary personal fields in export.','Evaluator rejects temporal/group leakage, missing criterion and invented labels.','Coverage/abstentions reported alongside errors; zero cases is never perfect accuracy.'],['I10','I11'])
task(23,'Predefine reference-study care criterion and acceptance policy','F - Calibration and validation',[1],['output/spec/WeedGrow_Release_Policy_v8.0.json','output/spec/WeedGrow_Field_Validation_Template_v7.5.json','output/spec/WeedGrow_Field_Evaluator_v8.0.py'],
 ['Choose a narrow first supported setup and independently justified watering-needed endpoint; obtain agronomic review.','Preregister training/tuning/held-out grower/plant groups and quantitative release targets before holdout labels are used.','Specify staff/opt-in reference methods and corrections; ordinary growers still only use setup/logs/API.'],
 ['No universal study p value, survival endpoint or reminder compliance substituted for a validated care criterion.','Unapproved/undefined acceptance targets continue blocking care activation.'],['I10','I11'],kind='validation_protocol')
task(24,'Collect reference training/tuning data with the normal-input contract','F - Calibration and validation',[5,7,8,23],['output/spec/WeedGrow_Field_Validation_Template_v7.5.json','output/spec/WeedGrow_Field_Dataset_v8.0.json'],
 ['Collect independent state/loss/refill/rain-delivery reference data for the chosen domain using a research/opt-in cohort.','Record timestamp/provenance and log-only versus optional-volume scenarios; keep holdout groups isolated.','Use real outcomes, not generated case labels; record exclusions and missing data explicitly.'],
 ['Reference measurements are research inputs, never required deployment predictors.','No training/test grower or plant overlap; weather as-of history is retained.','Task remains incomplete until genuine eligible reference data exists.'],['I10'],kind='requires_real_plant_data')
task(25,'Fit and version the first supported water profiles','F - Calibration and validation',[9,10,11,12,23,24],['Proposed: model tooling/profile registry','output/spec/WeedGrow_Implementation_Contract_v8.2.json'],
 ['Fit identifiable total loss, supported capacity/state/refill/rain ranges and the reviewed action criterion.','Include source/climate/operating scope, initial-state coverage and approximate-volume variation.','Compare simple baseline and candidate using training/tuning only; leave profile unapproved pending holdout.'],
 ['No separate identification claimed for two coefficients multiplying identical ET0.','Normal log-only use, missing optional fields and fallback domains evaluated explicitly.','No coefficient or accuracy value fabricated to satisfy synthetic tests.'],['I10','I11','I14','I15'],kind='requires_real_plant_data')
task(26,'Run independent held-out validation and decide profile eligibility','F - Calibration and validation',[22,23,24,25],['output/spec/WeedGrow_Field_Evaluator_v8.0.py','output/spec/WeedGrow_Release_Policy_v8.0.json'],
 ['Freeze model/profile/policy and predictions before independent holdout labels are revealed.','Evaluate unnecessary watering, misses, unresolved positives, useful coverage and domain uncertainty against preregistered targets.','Obtain independent statistical/agronomic review; record supported and rejected domains.'],
 ['Good accuracy on a tiny decided subset cannot hide low coverage.','Failure does not trigger holdout retuning; revisions require new properly isolated evaluation.','No automatic approval from a metric file; failed/incomplete gates remain inactive.'],['I10','I11'],kind='requires_real_plant_data')
task(27,'Verify and release the supported weather-preparation slice','G - Gated release',[3,4,5,6,8,14,15,16,17,18,19,20,21],['scripts/verify.cjs','scripts/test-garden-weather.cjs','functions/src','features/care'],
 ['Run complete app/provider/local-Firebase integration for supported weather and factual context routes, including ownership/offline/revision cases.','Configure actual source licensing/freshness/regional hazard coverage and approved delivery policy before any activation.','Release supported weather-preparation behavior separately; watering and predictive-disease gates remain inactive if unapproved.'],
 ['Actual source, interval/timezone, cancellation and user-permission paths verified end to end.','No claim that regional weather measures pot moisture or detects disease.','Rollback/disable behavior and observable error state are reviewable before activation.'],['I01','I02','I03','I04','I06','I08','I09','I12','I13','I16'],kind='release_review')
task(28,'Activate only independently approved watering domains','G - Gated release',[11,12,13,18,19,20,21,22,26,27],['scripts/verify.cjs','Proposed: approved profile registry','functions/src','features/plants/plantCare.ts'],
 ['Run final app end-to-end water/transition/cache/delivery checks with approved profile versions and scoped production data.','Activate only domains that passed preregistered validation and integration gates; retain unknown elsewhere.','Monitor missed/needless watering, useful coverage, drift and alert burden; define reversible disable criteria.'],
 ['Every required model/profile/data/consumer gate is actually satisfied, not merely specified.','Client fields cannot enable unapproved profile/disease routes.','Predictive disease alerts remain disabled until a separate future validated workstream exists.'],['I04','I05','I06','I07','I10','I11','I14','I15'],kind='release_review')

# Structural verification of the plan, not application testing.
ids={x['id'] for x in tasks};assert len(ids)==28
for x in tasks:assert set(x['dependsOn'])<=ids and x['id'] not in x['dependsOn']
done=set();remaining=tasks[:];order=[]
while remaining:
 ready=[x for x in remaining if set(x['dependsOn'])<=done];assert ready,'dependency cycle'
 for x in ready:done.add(x['id']);order.append(x['id']);remaining.remove(x)
covered={a for x in tasks for a in x['specAcceptanceIds']};assert covered=={a['id'] for a in C['acceptanceCases']}
assert 'WG-026' not in next(x for x in tasks if x['id']=='WG-027')['dependsOn']
report=dict(taskCount=28,allDependenciesResolve=True,acyclic=True,acceptanceCasesCovered=sorted(covered),initiallyReady=[x['id'] for x in tasks if not x['dependsOn']],oneValidTopologicalOrder=order,appCodeChanged=False,tasksImplemented=0)
plan=dict(specVersion='8.2',sourceMaster='output/spec/WeedGrow_Implementation_Master_v8.2.md',sourceContract='output/spec/WeedGrow_Implementation_Contract_v8.2.json',purpose='Implementation backlog only; no chats/issues/agents created and no app implementation performed',routineInputPolicy=C['routineUserActions'],dailyMeasurementRequirements=[],tasks=tasks,verification=report)
jsonpath=D/'algorithm-implementation-tasks-v8.2.json';jsonpath.write_text(json.dumps(plan,indent=2,ensure_ascii=False),encoding='utf-8')

def link(path):
 p=R/path
 return '['+path+']('+str(p).replace('\\','/')+')' if p.exists() else '`'+path+'`'
md=['# WeedGrow algorithm implementation tasks - v8.2','',
 'This backlog implements the frozen v8.2 specification incrementally. It does not add factors or daily user inputs. Tasks are planned, not completed; passing offline references do not establish app integration or plant-care accuracy. No separate chats, issues or agents were created.','',
 'Source of truth: '+link('output/spec/WeedGrow_Implementation_Master_v8.2.md')+' and '+link('output/spec/WeedGrow_Implementation_Contract_v8.2.json')+'.','',
 '## Recommended sequence','',
 '| Stage | Tasks | Reviewable outcome |','| --- | --- | --- |',
 '| A. Contracts and tests | WG-001-002 | Typed semantics and fixed fixtures; no care activation. |',
 '| B. Data foundation | WG-003-008 | Correct source data, history, logs and low-burden setup. |',
 '| C. Water model | WG-009-013 | Testable gated reserve model, transitions and projection. |',
 '| D. Warnings | WG-014-017 | Independent weather/context/review routes for all 14 IDs. |',
 '| E. App and shadow mode | WG-018-022 | Nullable decisions, cache, cards and frozen shadow output integrated. |',
 '| F. Calibration/validation | WG-023-026 | Genuine evidence for supported profile domains. WG-023 can start after WG-001. |',
 '| G. Gated release | WG-027-028 | Weather release separately; watering only after independent approval. |','',
 'Task numbers are reading order, not a requirement to finish every lower number first. Follow explicit dependencies. In particular, protocol preparation can start early; physical data collection/validation cannot be completed from synthetic tests.','',
 '## First increment','',
 'Start WG-001, then WG-002. They establish result semantics and fixed expected answers before parser/model changes. Next, WG-003/004 establish the provider adapters; WG-008 can follow WG-001 without waiting for them. This plan does not authorize a subscription purchase or production activation.','',
 '## Common completion rules','',
 '- Keep basic setup and watering logs sufficient; amount and dated size/age/medium stay optional. No daily measurements or routine inspections.',
 '- Treat each code task as a focused reviewable increment. If scope is too large, split along its listed deliverables while keeping dependencies and gates.',
 '- Add regression assertions with the relevant behavior change. Do not redefine expected answers to match a broken implementation.',
 '- Run targeted Jest/reference/fixture checks appropriate to changed code. Run repository-required checks, including `npm run verify`, for integration/release changes when the configured local toolchain is available. Record unavailable checks explicitly.',
 '- Keep existing unrelated work intact. Suggested code areas are starting points, not exhaustive or guaranteed final filenames. Proposed paths do not yet exist.',
 '- Return changed behavior/files, tests actually run and remaining limits. Do not equate “reference passes” with “production integrated.”',
 '- Production profiles, predictive disease routes and pushes remain gated until their explicit evidence/integration/release tasks are done.','',
 '## Individual tasks','']
for x in tasks:
 md += ['### '+x['id']+' - '+x['title'],'',
        '**Stage:** '+x['phase']+'  ','**Dependencies:** '+(', '.join(x['dependsOn']) or 'None')+'  ',
        '**Type/status:** '+x['kind']+' / '+x['status'],'',
        '**Scope / deliverables**','']+['- '+v for v in x['deliverables']]+['',
        '**Acceptance checks**','']+['- '+v for v in x['acceptanceChecks']]+['',
        '**Likely code/reference areas:** '+', '.join(link(p) if not p.startswith('Proposed:') else '`'+p+'`' for p in x['codeAreas']),
        '', '**Spec acceptance coverage:** '+', '.join(x['specAcceptanceIds']), '']
md+=['## Acceptance coverage','', '| Spec case | Implementation tasks |','| --- | --- |']
for a in C['acceptanceCases']:md.append('| '+a['id']+' - '+a['area']+' | '+', '.join(x['id'] for x in tasks if a['id'] in x['specAcceptanceIds'])+' |')
md+=['','## Plan verification','',
 '28 unique tasks; all dependencies resolve; no cycles; all 16 specification acceptance cases covered. The task plan itself was structurally checked. Zero implementation tasks are marked complete by this planning work. The existing application code was not changed.','']
(D/'algorithm-implementation-plan-v8.2.md').write_text('\n'.join(md),encoding='utf-8')
(D/'algorithm-implementation-plan-verification-v8.2.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
z=R/'output/WeedGrow_Implementation_Tasks_v8.2.zip'
files=[D/'algorithm-implementation-plan-v8.2.md',jsonpath,D/'algorithm-implementation-plan-verification-v8.2.json',S/'WeedGrow_Implementation_Master_v8.2.md',S/'WeedGrow_Implementation_Contract_v8.2.json']
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as archive:
 for p in files:archive.write(p,p.relative_to(R))
with zipfile.ZipFile(z) as archive:assert archive.testzip() is None
print(json.dumps(report,indent=2))
