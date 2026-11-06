# WeedGrow algorithm implementation plan - v8.3

28 planned tasks. Follow dependencies; none are completed by this handoff audit. No daily measurements or new biological coefficients are added.

Read the [master](../output/spec/WeedGrow_Implementation_Master_v8.3.md), [contract](../output/spec/WeedGrow_Implementation_Contract_v8.3.json) and [boundary rules](../output/spec/WeedGrow_Implementation_Boundary_Contract_v8.3.md) first.

Start WG-001, then WG-002. WG-008 and protocol work WG-023 can start after WG-001. Weather release WG-027 does not depend on real-plant calibration WG-026; watering release WG-028 does.

## Common completion rules

- Preserve unrelated repository changes and inspect applicable AGENTS.md before editing.
- Deliver focused increments with tests, behavior/files changed and any checks not run. Split large tasks along their deliverables without weakening dependencies.
- Use the fixed oracles and current boundary regressions; do not regenerate expected answers to agree with a broken port.
- Run targeted checks for each change and repository-required verification for integration/release. Unknown remains null across every consumer.
- An implementation gate is not a scientific approval. Profiles/criteria/targets requiring real evidence remain unassigned until the corresponding validation task is actually complete.

## Stages

| Stage | Task IDs | Outcome |
| --- | --- | --- |
| A | WG-001–002 | Contracts and fixed-answer tests |
| B | WG-003–008 | Weather, history, logs and setup |
| C | WG-009–013 | Water-state calculations and forecast |
| D | WG-014–017 | Independent warnings and factual context |
| E | WG-018–022 | App integration, delivery and shadow records |
| F | WG-023–026 | Real-plant calibration/validation |
| G | WG-027–028 | Separate gated weather/watering releases |

## Tasks

### WG-001 - Define versioned algorithm contracts and inactive feature gates

**Depends on:** None
**Status:** planned; **Type:** code

**Deliverables**

- Add typed input/output, provider provenance, warning states and water/not_due/uncertain ->true/false/null mapping.
- Separate empirical profile parameters from engineering policy; keep unapproved care/disease routes inactive.
- Define serialization/version boundaries without changing existing user-facing care behavior.
- Adopt the canonical weather sample names/enums and per-variable quality contract; reject nullable-to-false conversion at all boundaries.

**Acceptance checks**

- Unknown survives serialization as null; missing/unapproved profile cannot activate care.
- All 14 warning IDs and phases have a typed result; no disease probability default.
- Contract fixtures round-trip without renaming kinds/units or converting point air to hourly coverage.

**Likely repository/reference areas:** `firestoreModels.ts`, `lib/suggestions/types.ts`, `Proposed: lib/careAlgorithm/contracts.ts`

**Spec acceptance cases:** I04, I08, I11

### WG-002 - Port fixed-answer fixtures into the app test harness

**Depends on:** WG-001
**Status:** planned; **Type:** code

**Deliverables**

- Create reusable TypeScript fixture loaders for captured weather and the 13 fixed-answer water cases.
- Add cross-language parity checks for implemented pure functions using fixed expected answers; preserve Python reference runner.
- Track unmet integration cases explicitly; do not mark existing parser defects as successful behavior.
- Run the root handoff verifier and port the audited negative cases; use the reference-role table to distinguish current rules from legacy adapter behavior.

**Acceptance checks**

- Expected answers are not regenerated from the target engine.
- Tests run offline with no API keys; newly enabled regression assertions land with their corresponding fix.
- A bad RH/unit/array affects only its variable; explicit null rain and negative rain components cannot become zero/positive rainfall.

**Likely repository/reference areas:** `lib/weather/__tests__`, `lib/suggestions/__tests__`, `output/spec/WeedGrow_Independent_Test_Cases_v7.5.json`, `output/spec/weather_fixtures`

**Spec acceptance cases:** I01, I04, I07, I08

### WG-003 - Implement corrected OpenWeather normalization

**Depends on:** WG-001, WG-002
**Status:** planned; **Type:** code

**Deliverables**

- Add versioned current/hourly/daily/TimeMachine adapters and preserve raw source events/codes.
- Keep UTC solar epochs unchanged, today daily record as forecast, rain rates separate from amounts.
- Keep provider-valid omission-as-zero distinct from missing/failed data; retain historical data[] points.
- Preserve current/history point kinds, raw source events and per-variable invalidity; quarantine future nonforecast rows.

**Acceptance checks**

- Captured TimeMachine record is ingested and sunrise has zero UTC shift.
- Forecast night humidity is never labelled observed;2mm/h current and25mm daily remain distinct.
- Old display compatibility is tested before routing it through new records.
- Malformed daily data cannot erase valid current wind; null rain is distinct from absent rain.

**Likely repository/reference areas:** `lib/weather/weatherResponse.ts`, `lib/weather/weatherMeasurements.ts`, `lib/weather/__tests__/weatherResponse.test.ts`, `lib/weather/__tests__/parseWeatherData.test.ts`

**Spec acceptance cases:** I01, I02, I03

### WG-004 - Implement Open-Meteo normalization and paired-air fallback

**Depends on:** WG-001, WG-002
**Status:** planned; **Type:** code

**Deliverables**

- Port Forecast rain+showers and Archive rain mappings, ET0/radiation units and preceding-hour supports.
- Keep air points separate; preserve past_days as forecast and past model-history as a distinct source kind.
- Port conservative paired API dew-point fallback, with provider RH priority and no wetness inference.
- Use v8.3 canonical normalization, product-specific gust support, source selection markers and first-availability semantics.

**Acceptance checks**

- Captured forecast yields0.6mm liquid rain; Archive does not require a separate showers array.
- Wrong units/misaligned arrays/null components are rejected or retained unknown as specified.
- No future record enters history; aggregates/unpaired/dew-above-air data cannot derive RH.
- Forecast gust is a preceding-hour maximum; reported wind speed is not a sustained mean. All captured samples satisfy the wire contract.

**Likely repository/reference areas:** `Proposed: lib/weather/providers/openMeteo.ts`, `lib/weather/weatherResponse.ts`, `output/spec/WeedGrow_Handoff_Reference_v8.3.py`, `output/spec/WeedGrow_API_Air_Fallback_v8.1.py`

**Spec acceptance cases:** I01, I02, I13

### WG-005 - Add backend provider clients and explicit source/freshness policy

**Depends on:** WG-003, WG-004
**Status:** planned; **Type:** code

**Deliverables**

- Add server-side configurable clients for the chosen weather/ET0 and historical products; keep production provider switch off initially.
- Record retrieval/availability and optional real issue time; select a recent-history product/backfill policy instead of silently splicing models.
- Share garden-level requests, enforce bounded requests/timeouts and document source freshness/expiry configuration.
- Specify the recent archive gap and inside-hour policy; unsupported current forcing remains uncertain with automatic backfill.

**Acceptance checks**

- Mocked auth,401/429/timeout/partial responses produce scoped errors; no secrets in logs/fixtures.
- Forecast is not substituted for occurred history; newly retrieved old source data is not declared fresh by retrieval alone.
- No purchase/subscription change or production provider activation is implied by this code task.
- No past-forecast relabeling, unfinished-hour credit, invented issue time or overwritten first acquisition for an immutable revision.

**Likely repository/reference areas:** `functions/src/operations.ts`, `functions/src/index.ts`, `lib/weather/fetchWeather.ts`, `lib/weather/refreshGardenWeather.ts`

**Spec acceptance cases:** I02, I12, I16

### WG-006 - Persist typed weather intervals and replayable revisions

**Depends on:** WG-001, WG-005
**Status:** planned; **Type:** code

**Deliverables**

- Add scoped/versioned interval storage and queries at the appropriate garden/location/provider level; retain a legacy display adapter.
- Persist complete required history, revision identity, source kind, units and availability; support bounded backfill.
- Specify retention/indexes/query bounds and ownership rules; avoid growing raw arrays in a single daily/plant record.
- Store canonical variable/source revisions and first acquisition; retain enough replay history for actual active anchors and corrections before retention purges.

**Acceptance checks**

- Duplicate collection adds no rainfall; corrected authoritative records replay deterministically.
- Location revisions do not mix gardens/moves; partial history is observable.
- Local Firestore integration tests cover ownership and bounded reads/writes.
- Retention cannot silently delete history required by active state; a missing segment becomes explicit uncertainty.

**Likely repository/reference areas:** `firestoreModels.ts`, `functions/src/operations.ts`, `lib/weather/refreshGardenWeather.ts`, `lib/logs/fetchLogsAndWeatherForRange.ts`

**Spec acceptance cases:** I01, I02, I06, I12

### WG-007 - Canonicalize watering events and date-only occurrence windows

**Depends on:** WG-001, WG-002
**Status:** planned; **Type:** code

**Deliverables**

- Expose stable event identity/revision, occurrence bounds, recorded time, deletion and optional litre amount.
- Handle exact timestamps and IANA23/25hour date-only bounds; include exact-now events.
- Resolve latest authoritative revision, preserve two genuine events and replay edits/deletions.

**Acceptance checks**

- Retry is idempotent; zero amount stays zero; conflicting latest revision blocks affected replay.
- Date-only upper bound cannot extend beyond known recording/evaluation time; anchor-straddling events require reconciliation.

**Likely repository/reference areas:** `lib/logs/plantJournal.ts`, `lib/logs/__tests__/plantJournal.test.ts`, `lib/dates/plantDay.ts`, `firestoreModels.ts`

**Spec acceptance cases:** I03

### WG-008 - Add the small setup fields and unknown-safe legacy migration

**Depends on:** WG-001
**Status:** planned; **Type:** code

**Deliverables**

- Add one clear rain-reception choice populating soil/canopy reach and an optional meaningful medium choice.
- Retain unknown stage/sun/medium/volume; parse explicitly labelled pot units without inventing precision.
- Migrate absent legacy facts to unknown; keep existing dated age/height optional.
- Migrate rain reception/stage/medium conservatively; existing plant records remain usable with unknowns.

**Acceptance checks**

- Normal watering logging requires no amount, photo, moisture check or repeated size measurement.
- Existing soil provenance is not promoted to hydraulic texture; no guessed50percent shelter.
- UI/migration tests cover old plants and skipping optional setup.
- No legacy default or shared garden setting asserts an unconfirmed plant rain exposure or measured soil property.

**Likely repository/reference areas:** `firestoreModels.ts`, `features/plants/form/plantSectionForm.ts`, `features/plants/components/PlantEditorFields.tsx`, `features/addPlant/gardenDefaults.ts`

**Spec acceptance cases:** I14, I16

### WG-009 - Implement trusted profile resolution and release protection

**Depends on:** WG-001, WG-008
**Status:** planned; **Type:** code

**Deliverables**

- Resolve versioned domains for setup/climate/source/operating range, state basis and care criterion.
- Use one identifiable total effective loss coefficient; only explicit validated aggregate fallbacks for missing/stale optional facts.
- Keep approved registry server-controlled and empty until real validation; synthetic fixture profiles stay test-only.

**Acceptance checks**

- Forged approved:true cannot activate care; out-of-domain setup remains unsupported.
- Unknown optional age/height/medium tries only registered supported fallback without prompting repeatedly.
- Approximate volume never becomes exact rooting/catchment or an invented error percentage.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/profiles.ts`, `Proposed: functions/src/careProfiles.ts`, `output/spec/WeedGrow_Release_Policy_v8.0.json`

**Spec acceptance cases:** I11, I14

### WG-010 - Port pure water-bank mathematics and exposure primitives

**Depends on:** WG-001, WG-002
**Status:** planned; **Type:** code

**Deliverables**

- Implement capacity cap, inputs/loss ordering, mass ledger and numeric validation in litres.
- Implement remaining action reserve A=C-pC and total ET0 loss with explicit dimensions.
- Keep potential loss/unmet demand/overflow as model terms, not actual transpiration/root disease.

**Acceptance checks**

- All fixed mathematical cases and exhaustive ordering/conservation checks pass.
- Negative/nonfinite inputs and invalid starting reserve/order are rejected; no duplicate weather drying modifiers.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/waterBalance.ts`, `output/spec/WeedGrow_Independent_Test_Cases_v7.5.json`

**Spec acceptance cases:** I08

### WG-011 - Implement initialization, amount-free refills and current decisions

**Depends on:** WG-006, WG-007, WG-009, WG-010
**Status:** planned; **Type:** code

**Deliverables**

- Build initial state from supported saved state/anchor, otherwise unanchored[0,C] if capacity is supported.
- Replay coherent state/refill/reception scenarios; omitted amount broadens bounds without forcing full refill.
- Evaluate all R against their A, then gate production result on approved domain/state/history.

**Acceptance checks**

- Mixed trajectories return uncertain/null, never midpoint/majority vote.
- Small watering today can leave due; unknown amount cannot create precise moisture.
- No profile/history/state ->uncertain; independent weather paths remain available.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/waterState.ts`, `Proposed: lib/careAlgorithm/evaluateWater.ts`, `output/spec/legacy_v82/WeedGrow_Functional_Reference_v8.2.py`

**Spec acceptance cases:** I03, I04, I11, I14

### WG-012 - Implement dated transitions and corrected-history replay

**Depends on:** WG-007, WG-009, WG-011
**Status:** planned; **Type:** code

**Deliverables**

- Record relevant setup/stage/profile change boundaries automatically; replay old state to boundary.
- Carry water unchanged across approved compatible demand/threshold changes; update parameters forward only.
- For physical/incompatible changes use supported transformation or unknown initialization; recheck profile approval.

**Acceptance checks**

- New pot capacity never scales water upward; stage edit never rewrites earlier demand.
- A gap before transition requires replay, not silent time advancement.
- Move invalidates source scope; carrying reserve does not carry new-profile approval.

**Likely repository/reference areas:** `features/groups/gardenMove.ts`, `lib/plants/locationState.ts`, `Proposed: lib/careAlgorithm/transitions.ts`

**Spec acceptance cases:** I05, I15

### WG-013 - Implement conditional next-watering projection

**Depends on:** WG-005, WG-009, WG-011, WG-012
**Status:** planned; **Type:** code

**Deliverables**

- Project from current states using declared forecast/rain scenarios and horizon.
- Return crossing intervals and explicit horizon censoring; preserve source/coverage/conditional status.
- Keep forecast projections entirely separate from current water replay.

**Acceptance checks**

- Wet forecast never cancels already-due current state.
- Any trajectory without crossing means upper waiting time unresolved, not finite.
- Missing forecast makes projection unavailable without erasing current supported result.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/projectWater.ts`, `output/spec/WeedGrow_Algorithm_Emulator_v7.4.py`

**Spec acceptance cases:** I07

### WG-014 - Implement heat, cold, wind and container-weather flags

**Depends on:** WG-003, WG-004, WG-006, WG-008, WG-010
**Status:** planned; **Type:** code

**Deliverables**

- Implement W01-W03 and merged W08 with recent/current versus forecast evidence.
- Calculate supported H/L/D metrics and historical exposure independently of current trigger.
- Keep engineering thresholds labelled; do not wire legacy mildew heuristics into these physical flags.
- Respect the point wind and product-specific maximum gust support; W08 is merged factual context.

**Acceptance checks**

- Point crossings contribute no duration; gust maxima cannot become sustained hours.
- Gaps break continuous episodes, overlaps do not double-count, yesterday heat is not automatically current heat.
- Unknown pot/ground stays unknown; no root-temperature input.
- Point wind can cross a screen without sustained hours; W08 cannot generate its own predictive/push route.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/warnings/weather.ts`, `lib/weather/powderyMildewRisk.ts`

**Spec acceptance cases:** I08

### WG-015 - Implement rainfall flags and trusted source-event ingestion

**Depends on:** WG-003, WG-004, WG-005, WG-006
**Status:** planned; **Type:** code

**Deliverables**

- Implement W04 rate/known24h amount screens using product-specific liquid-water semantics.
- Persist source events/cancellation/revision and map W05 only through tested regional issuer/product rules.
- Keep unmapped/absent source coverage unknown and preserve source severity; no hail from prose inference.

**Acceptance checks**

- Positive partial known sum may exceed screen; incomplete below-threshold window cannot give all-clear.
- Latest cancellation removes prior event; source alert survives missing ET0.
- No source notification activation until regional mapping/coverage and delivery checks pass.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/warnings/rain.ts`, `Proposed: lib/weather/sourceEvents.ts`, `functions/src/operations.ts`

**Spec acceptance cases:** I01, I08, I09, I12

### WG-016 - Implement factual humidity/flower context with predictive disease disabled

**Depends on:** WG-004, WG-006, WG-008, WG-014, WG-015
**Status:** planned; **Type:** code

**Deliverables**

- Implement W09-W12 using paired air history/forecast, stage and reachable recent/current/forecast rain.
- Keep W10 predictive model disabled and all disease probabilities absent.
- Replace any reused high-humidity-only PM gate; keep conditions copy factual and shared.
- Implement the explicit W11 truth table, including missing evidence and sheltered-canopy humid air.

**Acceptance checks**

- Unknown/missing rain never clears canopy context; sheltered direct rain does not remove humidity context.
- Reported flowering is the flower gate; age/strain does not establish flower day or resistance.
- No leaf wetness, internal-bud offsets or daily inspection requirement.
- Known flowering plus missing applicable weather returns unknown; both OR arms must be ruled out before not_triggered.

**Likely repository/reference areas:** `Proposed: lib/careAlgorithm/warnings/ambient.ts`, `lib/weather/powderyMildewRisk.ts`, `output/spec/WeedGrow_Implementation_Master_v8.3.md`

**Spec acceptance cases:** I08, I13, I16

### WG-017 - Route optional root/wilt/establishment problem reviews

**Depends on:** WG-001, WG-008
**Status:** planned; **Type:** code

**Deliverables**

- Implement W07/W13/W14 as topic-specific user-initiated review routes using existing journal/care entry patterns.
- Do not introduce automatic root/damping-off diagnoses or mandatory health checks.
- Keep optional symptom/no-symptom observations separate from moisture and infection claims.

**Acceptance checks**

- Root-wilt report does not automatically instruct watering.
- Unknown establishment stage is unknown; unrelated problem topics do not trigger all root reviews.

**Likely repository/reference areas:** `lib/logs/plantJournal.ts`, `features/plants`, `Proposed: lib/careAlgorithm/warnings/problemReview.ts`

**Spec acceptance cases:** I08, I16

### WG-018 - Assemble the deterministic evaluation service

**Depends on:** WG-009, WG-011, WG-012, WG-013, WG-014, WG-015, WG-016, WG-017
**Status:** planned; **Type:** code

**Deliverables**

- Compose profile/state/warnings in one explicit-time immutable-input evaluation.
- Return all 14 IDs once, phase/coverage/reasons, versions and nullable water result; disable care for inactive/deleting plants.
- Add a shadow entry point; route no unvalidated candidate into user-facing care.
- Validate boundary version/shape before orchestration; do not feed canonical samples straight into the legacy synthetic-row emulator.

**Acceptance checks**

- Evaluation deterministic and input-preserving.
- One failed path cannot suppress independent source weather; every warning retains its own status.
- No timer/day-since-log fallback is presented as measured or validated moisture.
- Failure is isolated per path, all 14 IDs survive and unsupported data cannot silently use legacy assumptions.

**Likely repository/reference areas:** `lib/suggestions/wateringEngine.ts`, `lib/suggestions/wateringSuggestions.ts`, `lib/suggestions/algorithms/wateringAlgorithm.ts`, `Proposed: lib/careAlgorithm/evaluate.ts`

**Spec acceptance cases:** I04, I08, I11

### WG-019 - Implement revision-aware cache invalidation and automatic reevaluation

**Depends on:** WG-006, WG-007, WG-008, WG-012, WG-018
**Status:** planned; **Type:** code

**Deliverables**

- Fingerprint every actual model dependency plus engine/profile/policy/anchor/log/weather revisions.
- Expire unsupported advice and schedule bounded retry/backfill/new-event evaluation.
- Keep metadata-only presentation changes from causing unnecessary history fetches.

**Acceptance checks**

- Changed plantedIn, used age/height/medium or rain reception invalidates affected advice.
- Outage yields one stable scoped uncertainty, not repeated prompts or retained stale not_due.
- Updated/deleted logs and late weather corrections trigger required replay without duplicates.

**Likely repository/reference areas:** `lib/suggestions/adviceInputs.ts`, `lib/weather/shouldUpdateWeather.ts`, `features/groups/hooks/useGroupWeather.ts`, `features/home/useGardenWeatherCollection.ts`

**Spec acceptance cases:** I06, I12, I16

### WG-020 - Migrate all care consumers to nullable decisions and truthful copy

**Depends on:** WG-001, WG-008, WG-018, WG-019
**Status:** planned; **Type:** code

**Deliverables**

- Remove same-day watering override that forces not_due/high confidence.
- Show watering recorded as an annotation, independent of decision; distinguish routine reminders from model estimates.
- Present unknown/context/disabled states without repeated soil-check instructions or disease diagnosis language.

**Acceptance checks**

- true/false/null survive persistence, sorting, badges and cards.
- A small watering cannot erase due; missing data cannot become not_due.
- No synthetic candidate or score reaches production care UI.

**Likely repository/reference areas:** `features/plants/plantCare.ts`, `lib/suggestions/types.ts`, `features/plants/components/PlantWeather.tsx`, `features/home`

**Spec acceptance cases:** I04, I16

### WG-021 - Implement grouped cards and delivery episodes behind inactive gates

**Depends on:** WG-014, WG-015, WG-016, WG-017, WG-018, WG-020
**Status:** planned; **Type:** code

**Deliverables**

- Merge heat/container and shared wet context; deduplicate one source event across warning IDs.
- Persist episode/revision/send state; handle cancellation, severity escalation and permitted repeats.
- Require consent, enabled policy and approved claim/source/profile; leave production push gates off until release tasks.
- Use flag-specific card eligibility and strict boolean gates before persisted delivery episode logic.

**Acceptance checks**

- Context/uncertainty never generates predictive-disease pushes.
- Retry cannot send duplicate episode; cancellation removes evidence; escalation is not hidden by repeat cooldown.
- Dismiss/snooze/watering changes delivery only, not modeled water or weather evidence.
- W06 context_only, W10 triggered and string permission values cannot emit a card/push.

**Likely repository/reference areas:** `features/care/NotificationNavigation.tsx`, `features/care/NotificationNavigation.native.tsx`, `Proposed: lib/careAlgorithm/delivery.ts`

**Spec acceptance cases:** I09, I11, I16

### WG-022 - Add shadow recording and independent evaluation export

**Depends on:** WG-018, WG-019, WG-020
**Status:** planned; **Type:** code

**Deliverables**

- Record immutable input/version/evaluation snapshots and debug predictions without activating advice.
- Export deidentified plant/grower groups, source availability and predictions frozen before labels.
- Keep reference measurements/labels out of ordinary-input inference; bound storage/retention.
- Export exact v8.3 evaluator field names with immutable snapshot/version records; keep selected/pending population visible.

**Acceptance checks**

- No API keys/credentials or unnecessary personal fields in export.
- Evaluator rejects temporal/group leakage, missing criterion and invented labels.
- Coverage/abstentions reported alongside errors; zero cases is never perfect accuracy.
- Malformed input returns invalid_evaluation; exclusions and adjudication coverage are reported alongside decided-case coverage.

**Likely repository/reference areas:** `Proposed: functions/src/careShadow.ts`, `output/spec/WeedGrow_Field_Evaluator_v8.3.py`, `output/spec/WeedGrow_Field_Dataset_v8.3.json`

**Spec acceptance cases:** I10, I11

### WG-023 - Predefine reference-study care criterion and acceptance policy

**Depends on:** WG-001
**Status:** planned_requires_evidence_or_release_review; **Type:** validation_protocol

**Deliverables**

- Choose a narrow first supported setup and independently justified watering-needed endpoint; obtain agronomic review.
- Preregister training/tuning/held-out grower/plant groups and quantitative release targets before holdout labels are used.
- Specify staff/opt-in reference methods and corrections; ordinary growers still only use setup/logs/API.
- Define independent collection-to-evaluator mapping and criteria before recruitment/holdout review.

**Acceptance checks**

- No universal study p value, survival endpoint or reminder compliance substituted for a validated care criterion.
- Unapproved/undefined acceptance targets continue blocking care activation.
- No missing label, revelation time or split group is invented from the older collection template.

**Likely repository/reference areas:** `output/spec/WeedGrow_Release_Policy_v8.0.json`, `output/spec/WeedGrow_Field_Validation_Template_v7.5.json`, `output/spec/WeedGrow_Field_Evaluator_v8.3.py`

**Spec acceptance cases:** I10, I11

### WG-024 - Collect reference training/tuning data with the normal-input contract

**Depends on:** WG-005, WG-007, WG-008, WG-023
**Status:** planned_requires_evidence_or_release_review; **Type:** requires_real_plant_data

**Deliverables**

- Collect independent state/loss/refill/rain-delivery reference data for the chosen domain using a research/opt-in cohort.
- Record timestamp/provenance and log-only versus optional-volume scenarios; keep holdout groups isolated.
- Use real outcomes, not generated case labels; record exclusions and missing data explicitly.

**Acceptance checks**

- Reference measurements are research inputs, never required deployment predictors.
- No training/test grower or plant overlap; weather as-of history is retained.
- Task remains incomplete until genuine eligible reference data exists.

**Likely repository/reference areas:** `output/spec/WeedGrow_Field_Validation_Template_v7.5.json`, `output/spec/WeedGrow_Field_Dataset_v8.3.json`

**Spec acceptance cases:** I10

### WG-025 - Fit and version the first supported water profiles

**Depends on:** WG-009, WG-010, WG-011, WG-012, WG-023, WG-024
**Status:** planned_requires_evidence_or_release_review; **Type:** requires_real_plant_data

**Deliverables**

- Fit identifiable total loss, supported capacity/state/refill/rain ranges and the reviewed action criterion.
- Include source/climate/operating scope, initial-state coverage and approximate-volume variation.
- Compare simple baseline and candidate using training/tuning only; leave profile unapproved pending holdout.

**Acceptance checks**

- No separate identification claimed for two coefficients multiplying identical ET0.
- Normal log-only use, missing optional fields and fallback domains evaluated explicitly.
- No coefficient or accuracy value fabricated to satisfy synthetic tests.

**Likely repository/reference areas:** `Proposed: model tooling/profile registry`, `output/spec/WeedGrow_Implementation_Contract_v8.3.json`

**Spec acceptance cases:** I10, I11, I14, I15

### WG-026 - Run independent held-out validation and decide profile eligibility

**Depends on:** WG-022, WG-023, WG-024, WG-025
**Status:** planned_requires_evidence_or_release_review; **Type:** requires_real_plant_data

**Deliverables**

- Freeze model/profile/policy and predictions before independent holdout labels are revealed.
- Evaluate unnecessary watering, misses, unresolved positives, useful coverage and domain uncertainty against preregistered targets.
- Obtain independent statistical/agronomic review; record supported and rejected domains.
- Review both FP/negative-case and FP/water-recommendation denominators and population/adjudication coverage.

**Acceptance checks**

- Good accuracy on a tiny decided subset cannot hide low coverage.
- Failure does not trigger holdout retuning; revisions require new properly isolated evaluation.
- No automatic approval from a metric file; failed/incomplete gates remain inactive.
- High decided-case accuracy cannot hide selective labeling, low useful coverage or a high share of unnecessary recommendations.

**Likely repository/reference areas:** `output/spec/WeedGrow_Field_Evaluator_v8.3.py`, `output/spec/WeedGrow_Release_Policy_v8.0.json`

**Spec acceptance cases:** I10, I11

### WG-027 - Verify and release the supported weather-preparation slice

**Depends on:** WG-003, WG-004, WG-005, WG-006, WG-008, WG-014, WG-015, WG-016, WG-017, WG-018, WG-019, WG-020, WG-021
**Status:** planned_requires_evidence_or_release_review; **Type:** release_review

**Deliverables**

- Run complete app/provider/local-Firebase integration for supported weather and factual context routes, including ownership/offline/revision cases.
- Configure actual source licensing/freshness/regional hazard coverage and approved delivery policy before any activation.
- Release supported weather-preparation behavior separately; watering and predictive-disease gates remain inactive if unapproved.
- Run repository integration checks against the current contract; package reference tests alone do not complete app release.

**Acceptance checks**

- Actual source, interval/timezone, cancellation and user-permission paths verified end to end.
- No claim that regional weather measures pot moisture or detects disease.
- Rollback/disable behavior and observable error state are reviewable before activation.
- The app actually handles partial-variable failures, source expiry and canonical data without legacy all-clear shortcuts.

**Likely repository/reference areas:** `scripts/verify.cjs`, `scripts/test-garden-weather.cjs`, `functions/src`, `features/care`

**Spec acceptance cases:** I01, I02, I03, I04, I06, I08, I09, I12, I13, I16

### WG-028 - Activate only independently approved watering domains

**Depends on:** WG-011, WG-012, WG-013, WG-018, WG-019, WG-020, WG-021, WG-022, WG-026, WG-027
**Status:** planned_requires_evidence_or_release_review; **Type:** release_review

**Deliverables**

- Run final app end-to-end water/transition/cache/delivery checks with approved profile versions and scoped production data.
- Activate only domains that passed preregistered validation and integration gates; retain unknown elsewhere.
- Monitor missed/needless watering, useful coverage, drift and alert burden; define reversible disable criteria.

**Acceptance checks**

- Every required model/profile/data/consumer gate is actually satisfied, not merely specified.
- Client fields cannot enable unapproved profile/disease routes.
- Predictive disease alerts remain disabled until a separate future validated workstream exists.

**Likely repository/reference areas:** `scripts/verify.cjs`, `Proposed: approved profile registry`, `functions/src`, `features/plants/plantCare.ts`

**Spec acceptance cases:** I04, I05, I06, I07, I10, I11, I14, I15

## Acceptance coverage

| Spec case | Tasks |
| --- | --- |
| I01 | WG-002, WG-003, WG-004, WG-006, WG-015, WG-027 |
| I02 | WG-003, WG-004, WG-005, WG-006, WG-027 |
| I03 | WG-003, WG-007, WG-011, WG-027 |
| I04 | WG-001, WG-002, WG-011, WG-018, WG-020, WG-027, WG-028 |
| I05 | WG-012, WG-028 |
| I06 | WG-006, WG-019, WG-027, WG-028 |
| I07 | WG-002, WG-013, WG-028 |
| I08 | WG-001, WG-002, WG-010, WG-014, WG-015, WG-016, WG-017, WG-018, WG-027 |
| I09 | WG-015, WG-021, WG-027 |
| I10 | WG-022, WG-023, WG-024, WG-025, WG-026, WG-028 |
| I11 | WG-001, WG-009, WG-011, WG-018, WG-021, WG-022, WG-023, WG-025, WG-026, WG-028 |
| I12 | WG-005, WG-006, WG-015, WG-019, WG-027 |
| I13 | WG-004, WG-016, WG-027 |
| I14 | WG-008, WG-009, WG-011, WG-025, WG-028 |
| I15 | WG-012, WG-025, WG-028 |
| I16 | WG-005, WG-008, WG-016, WG-017, WG-019, WG-020, WG-021, WG-027 |

Code paths are relative to the target repository; proposed paths are not claims that files already exist. The package contains references, not a copy of the app.
