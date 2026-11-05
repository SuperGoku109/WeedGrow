# WeedGrow algorithm implementation tasks - v8.2

This backlog implements the frozen v8.2 specification incrementally. It does not add factors or daily user inputs. Tasks are planned, not completed; passing offline references do not establish app integration or plant-care accuracy. No separate chats, issues or agents were created.

Source of truth: [output/spec/WeedGrow_Implementation_Master_v8.2.md](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Implementation_Master_v8.2.md) and [output/spec/WeedGrow_Implementation_Contract_v8.2.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Implementation_Contract_v8.2.json).

## Recommended sequence

| Stage | Tasks | Reviewable outcome |
| --- | --- | --- |
| A. Contracts and tests | WG-001-002 | Typed semantics and fixed fixtures; no care activation. |
| B. Data foundation | WG-003-008 | Correct source data, history, logs and low-burden setup. |
| C. Water model | WG-009-013 | Testable gated reserve model, transitions and projection. |
| D. Warnings | WG-014-017 | Independent weather/context/review routes for all 14 IDs. |
| E. App and shadow mode | WG-018-022 | Nullable decisions, cache, cards and frozen shadow output integrated. |
| F. Calibration/validation | WG-023-026 | Genuine evidence for supported profile domains. WG-023 can start after WG-001. |
| G. Gated release | WG-027-028 | Weather release separately; watering only after independent approval. |

Task numbers are reading order, not a requirement to finish every lower number first. Follow explicit dependencies. In particular, protocol preparation can start early; physical data collection/validation cannot be completed from synthetic tests.

## First increment

Start WG-001, then WG-002. They establish result semantics and fixed expected answers before parser/model changes. Next, WG-003/004 establish the provider adapters; WG-008 can follow WG-001 without waiting for them. This plan does not authorize a subscription purchase or production activation.

## Common completion rules

- Keep basic setup and watering logs sufficient; amount and dated size/age/medium stay optional. No daily measurements or routine inspections.
- Treat each code task as a focused reviewable increment. If scope is too large, split along its listed deliverables while keeping dependencies and gates.
- Add regression assertions with the relevant behavior change. Do not redefine expected answers to match a broken implementation.
- Run targeted Jest/reference/fixture checks appropriate to changed code. Run repository-required checks, including `npm run verify`, for integration/release changes when the configured local toolchain is available. Record unavailable checks explicitly.
- Keep existing unrelated work intact. Suggested code areas are starting points, not exhaustive or guaranteed final filenames. Proposed paths do not yet exist.
- Return changed behavior/files, tests actually run and remaining limits. Do not equate “reference passes” with “production integrated.”
- Production profiles, predictive disease routes and pushes remain gated until their explicit evidence/integration/release tasks are done.

## Individual tasks

### WG-001 - Define versioned algorithm contracts and inactive feature gates

**Stage:** A - Contracts and tests  
**Dependencies:** None  
**Type/status:** code / planned

**Scope / deliverables**

- Add typed input/output, provider provenance, warning states and water/not_due/uncertain ->true/false/null mapping.
- Separate empirical profile parameters from engineering policy; keep unapproved care/disease routes inactive.
- Define serialization/version boundaries without changing existing user-facing care behavior.

**Acceptance checks**

- Unknown survives serialization as null; missing/unapproved profile cannot activate care.
- All 14 warning IDs and phases have a typed result; no disease probability default.

**Likely code/reference areas:** [firestoreModels.ts](C:/Users/Zane/dev/WeedGrow/firestoreModels.ts), [lib/suggestions/types.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/types.ts), `Proposed: lib/careAlgorithm/contracts.ts`

**Spec acceptance coverage:** I04, I08, I11

### WG-002 - Port fixed-answer fixtures into the app test harness

**Stage:** A - Contracts and tests  
**Dependencies:** WG-001  
**Type/status:** code / planned

**Scope / deliverables**

- Create reusable TypeScript fixture loaders for captured weather and the 13 fixed-answer water cases.
- Add cross-language parity checks for implemented pure functions using fixed expected answers; preserve Python reference runner.
- Track unmet integration cases explicitly; do not mark existing parser defects as successful behavior.

**Acceptance checks**

- Expected answers are not regenerated from the target engine.
- Tests run offline with no API keys; newly enabled regression assertions land with their corresponding fix.

**Likely code/reference areas:** [lib/weather/__tests__](C:/Users/Zane/dev/WeedGrow/lib/weather/__tests__), [lib/suggestions/__tests__](C:/Users/Zane/dev/WeedGrow/lib/suggestions/__tests__), [output/spec/WeedGrow_Independent_Test_Cases_v7.5.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Independent_Test_Cases_v7.5.json), [output/spec/weather_fixtures](C:/Users/Zane/dev/WeedGrow/output/spec/weather_fixtures)

**Spec acceptance coverage:** I01, I04, I07, I08

### WG-003 - Implement corrected OpenWeather normalization

**Stage:** B - Data foundation  
**Dependencies:** WG-001, WG-002  
**Type/status:** code / planned

**Scope / deliverables**

- Add versioned current/hourly/daily/TimeMachine adapters and preserve raw source events/codes.
- Keep UTC solar epochs unchanged, today daily record as forecast, rain rates separate from amounts.
- Keep provider-valid omission-as-zero distinct from missing/failed data; retain historical data[] points.

**Acceptance checks**

- Captured TimeMachine record is ingested and sunrise has zero UTC shift.
- Forecast night humidity is never labelled observed;2mm/h current and25mm daily remain distinct.
- Old display compatibility is tested before routing it through new records.

**Likely code/reference areas:** [lib/weather/weatherResponse.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/weatherResponse.ts), [lib/weather/weatherMeasurements.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/weatherMeasurements.ts), [lib/weather/__tests__/weatherResponse.test.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/__tests__/weatherResponse.test.ts), [lib/weather/__tests__/parseWeatherData.test.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/__tests__/parseWeatherData.test.ts)

**Spec acceptance coverage:** I01, I02, I03

### WG-004 - Implement Open-Meteo normalization and paired-air fallback

**Stage:** B - Data foundation  
**Dependencies:** WG-001, WG-002  
**Type/status:** code / planned

**Scope / deliverables**

- Port Forecast rain+showers and Archive rain mappings, ET0/radiation units and preceding-hour supports.
- Keep air points separate; preserve past_days as forecast and past model-history as a distinct source kind.
- Port conservative paired API dew-point fallback, with provider RH priority and no wetness inference.

**Acceptance checks**

- Captured forecast yields0.6mm liquid rain; Archive does not require a separate showers array.
- Wrong units/misaligned arrays/null components are rejected or retained unknown as specified.
- No future record enters history; aggregates/unpaired/dew-above-air data cannot derive RH.

**Likely code/reference areas:** `Proposed: lib/weather/providers/openMeteo.ts`, [lib/weather/weatherResponse.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/weatherResponse.ts), [output/spec/WeedGrow_Functional_Reference_v8.2.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Functional_Reference_v8.2.py), [output/spec/WeedGrow_API_Air_Fallback_v8.1.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_API_Air_Fallback_v8.1.py)

**Spec acceptance coverage:** I01, I02, I13

### WG-005 - Add backend provider clients and explicit source/freshness policy

**Stage:** B - Data foundation  
**Dependencies:** WG-003, WG-004  
**Type/status:** code / planned

**Scope / deliverables**

- Add server-side configurable clients for the chosen weather/ET0 and historical products; keep production provider switch off initially.
- Record retrieval/availability and optional real issue time; select a recent-history product/backfill policy instead of silently splicing models.
- Share garden-level requests, enforce bounded requests/timeouts and document source freshness/expiry configuration.

**Acceptance checks**

- Mocked auth,401/429/timeout/partial responses produce scoped errors; no secrets in logs/fixtures.
- Forecast is not substituted for occurred history; newly retrieved old source data is not declared fresh by retrieval alone.
- No purchase/subscription change or production provider activation is implied by this code task.

**Likely code/reference areas:** [functions/src/operations.ts](C:/Users/Zane/dev/WeedGrow/functions/src/operations.ts), [functions/src/index.ts](C:/Users/Zane/dev/WeedGrow/functions/src/index.ts), [lib/weather/fetchWeather.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/fetchWeather.ts), [lib/weather/refreshGardenWeather.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/refreshGardenWeather.ts)

**Spec acceptance coverage:** I02, I12, I16

### WG-006 - Persist typed weather intervals and replayable revisions

**Stage:** B - Data foundation  
**Dependencies:** WG-001, WG-005  
**Type/status:** code / planned

**Scope / deliverables**

- Add scoped/versioned interval storage and queries at the appropriate garden/location/provider level; retain a legacy display adapter.
- Persist complete required history, revision identity, source kind, units and availability; support bounded backfill.
- Specify retention/indexes/query bounds and ownership rules; avoid growing raw arrays in a single daily/plant record.

**Acceptance checks**

- Duplicate collection adds no rainfall; corrected authoritative records replay deterministically.
- Location revisions do not mix gardens/moves; partial history is observable.
- Local Firestore integration tests cover ownership and bounded reads/writes.

**Likely code/reference areas:** [firestoreModels.ts](C:/Users/Zane/dev/WeedGrow/firestoreModels.ts), [functions/src/operations.ts](C:/Users/Zane/dev/WeedGrow/functions/src/operations.ts), [lib/weather/refreshGardenWeather.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/refreshGardenWeather.ts), [lib/logs/fetchLogsAndWeatherForRange.ts](C:/Users/Zane/dev/WeedGrow/lib/logs/fetchLogsAndWeatherForRange.ts)

**Spec acceptance coverage:** I01, I02, I06, I12

### WG-007 - Canonicalize watering events and date-only occurrence windows

**Stage:** B - Data foundation  
**Dependencies:** WG-001, WG-002  
**Type/status:** code / planned

**Scope / deliverables**

- Expose stable event identity/revision, occurrence bounds, recorded time, deletion and optional litre amount.
- Handle exact timestamps and IANA23/25hour date-only bounds; include exact-now events.
- Resolve latest authoritative revision, preserve two genuine events and replay edits/deletions.

**Acceptance checks**

- Retry is idempotent; zero amount stays zero; conflicting latest revision blocks affected replay.
- Date-only upper bound cannot extend beyond known recording/evaluation time; anchor-straddling events require reconciliation.

**Likely code/reference areas:** [lib/logs/plantJournal.ts](C:/Users/Zane/dev/WeedGrow/lib/logs/plantJournal.ts), [lib/logs/__tests__/plantJournal.test.ts](C:/Users/Zane/dev/WeedGrow/lib/logs/__tests__/plantJournal.test.ts), [lib/dates/plantDay.ts](C:/Users/Zane/dev/WeedGrow/lib/dates/plantDay.ts), [firestoreModels.ts](C:/Users/Zane/dev/WeedGrow/firestoreModels.ts)

**Spec acceptance coverage:** I03

### WG-008 - Add the small setup fields and unknown-safe legacy migration

**Stage:** B - Data foundation  
**Dependencies:** WG-001  
**Type/status:** code / planned

**Scope / deliverables**

- Add one clear rain-reception choice populating soil/canopy reach and an optional meaningful medium choice.
- Retain unknown stage/sun/medium/volume; parse explicitly labelled pot units without inventing precision.
- Migrate absent legacy facts to unknown; keep existing dated age/height optional.

**Acceptance checks**

- Normal watering logging requires no amount, photo, moisture check or repeated size measurement.
- Existing soil provenance is not promoted to hydraulic texture; no guessed50percent shelter.
- UI/migration tests cover old plants and skipping optional setup.

**Likely code/reference areas:** [firestoreModels.ts](C:/Users/Zane/dev/WeedGrow/firestoreModels.ts), [features/plants/form/plantSectionForm.ts](C:/Users/Zane/dev/WeedGrow/features/plants/form/plantSectionForm.ts), [features/plants/components/PlantEditorFields.tsx](C:/Users/Zane/dev/WeedGrow/features/plants/components/PlantEditorFields.tsx), [features/addPlant/gardenDefaults.ts](C:/Users/Zane/dev/WeedGrow/features/addPlant/gardenDefaults.ts)

**Spec acceptance coverage:** I14, I16

### WG-009 - Implement trusted profile resolution and release protection

**Stage:** C - Water model  
**Dependencies:** WG-001, WG-008  
**Type/status:** code / planned

**Scope / deliverables**

- Resolve versioned domains for setup/climate/source/operating range, state basis and care criterion.
- Use one identifiable total effective loss coefficient; only explicit validated aggregate fallbacks for missing/stale optional facts.
- Keep approved registry server-controlled and empty until real validation; synthetic fixture profiles stay test-only.

**Acceptance checks**

- Forged approved:true cannot activate care; out-of-domain setup remains unsupported.
- Unknown optional age/height/medium tries only registered supported fallback without prompting repeatedly.
- Approximate volume never becomes exact rooting/catchment or an invented error percentage.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/profiles.ts`, `Proposed: functions/src/careProfiles.ts`, [output/spec/WeedGrow_Release_Policy_v8.0.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Release_Policy_v8.0.json)

**Spec acceptance coverage:** I11, I14

### WG-010 - Port pure water-bank mathematics and exposure primitives

**Stage:** C - Water model  
**Dependencies:** WG-001, WG-002  
**Type/status:** code / planned

**Scope / deliverables**

- Implement capacity cap, inputs/loss ordering, mass ledger and numeric validation in litres.
- Implement remaining action reserve A=C-pC and total ET0 loss with explicit dimensions.
- Keep potential loss/unmet demand/overflow as model terms, not actual transpiration/root disease.

**Acceptance checks**

- All fixed mathematical cases and exhaustive ordering/conservation checks pass.
- Negative/nonfinite inputs and invalid starting reserve/order are rejected; no duplicate weather drying modifiers.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/waterBalance.ts`, [output/spec/WeedGrow_Independent_Test_Cases_v7.5.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Independent_Test_Cases_v7.5.json)

**Spec acceptance coverage:** I08

### WG-011 - Implement initialization, amount-free refills and current decisions

**Stage:** C - Water model  
**Dependencies:** WG-006, WG-007, WG-009, WG-010  
**Type/status:** code / planned

**Scope / deliverables**

- Build initial state from supported saved state/anchor, otherwise unanchored[0,C] if capacity is supported.
- Replay coherent state/refill/reception scenarios; omitted amount broadens bounds without forcing full refill.
- Evaluate all R against their A, then gate production result on approved domain/state/history.

**Acceptance checks**

- Mixed trajectories return uncertain/null, never midpoint/majority vote.
- Small watering today can leave due; unknown amount cannot create precise moisture.
- No profile/history/state ->uncertain; independent weather paths remain available.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/waterState.ts`, `Proposed: lib/careAlgorithm/evaluateWater.ts`, [output/spec/WeedGrow_Functional_Reference_v8.2.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Functional_Reference_v8.2.py)

**Spec acceptance coverage:** I03, I04, I11, I14

### WG-012 - Implement dated transitions and corrected-history replay

**Stage:** C - Water model  
**Dependencies:** WG-007, WG-009, WG-011  
**Type/status:** code / planned

**Scope / deliverables**

- Record relevant setup/stage/profile change boundaries automatically; replay old state to boundary.
- Carry water unchanged across approved compatible demand/threshold changes; update parameters forward only.
- For physical/incompatible changes use supported transformation or unknown initialization; recheck profile approval.

**Acceptance checks**

- New pot capacity never scales water upward; stage edit never rewrites earlier demand.
- A gap before transition requires replay, not silent time advancement.
- Move invalidates source scope; carrying reserve does not carry new-profile approval.

**Likely code/reference areas:** [features/groups/gardenMove.ts](C:/Users/Zane/dev/WeedGrow/features/groups/gardenMove.ts), [lib/plants/locationState.ts](C:/Users/Zane/dev/WeedGrow/lib/plants/locationState.ts), `Proposed: lib/careAlgorithm/transitions.ts`

**Spec acceptance coverage:** I05, I15

### WG-013 - Implement conditional next-watering projection

**Stage:** C - Water model  
**Dependencies:** WG-005, WG-009, WG-011, WG-012  
**Type/status:** code / planned

**Scope / deliverables**

- Project from current states using declared forecast/rain scenarios and horizon.
- Return crossing intervals and explicit horizon censoring; preserve source/coverage/conditional status.
- Keep forecast projections entirely separate from current water replay.

**Acceptance checks**

- Wet forecast never cancels already-due current state.
- Any trajectory without crossing means upper waiting time unresolved, not finite.
- Missing forecast makes projection unavailable without erasing current supported result.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/projectWater.ts`, [output/spec/WeedGrow_Algorithm_Emulator_v7.4.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Algorithm_Emulator_v7.4.py)

**Spec acceptance coverage:** I07

### WG-014 - Implement heat, cold, wind and container-weather flags

**Stage:** D - Warnings  
**Dependencies:** WG-003, WG-004, WG-006, WG-008, WG-010  
**Type/status:** code / planned

**Scope / deliverables**

- Implement W01-W03 and merged W08 with recent/current versus forecast evidence.
- Calculate supported H/L/D metrics and historical exposure independently of current trigger.
- Keep engineering thresholds labelled; do not wire legacy mildew heuristics into these physical flags.

**Acceptance checks**

- Point crossings contribute no duration; gust maxima cannot become sustained hours.
- Gaps break continuous episodes, overlaps do not double-count, yesterday heat is not automatically current heat.
- Unknown pot/ground stays unknown; no root-temperature input.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/warnings/weather.ts`, [lib/weather/powderyMildewRisk.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/powderyMildewRisk.ts)

**Spec acceptance coverage:** I08

### WG-015 - Implement rainfall flags and trusted source-event ingestion

**Stage:** D - Warnings  
**Dependencies:** WG-003, WG-004, WG-005, WG-006  
**Type/status:** code / planned

**Scope / deliverables**

- Implement W04 rate/known24h amount screens using product-specific liquid-water semantics.
- Persist source events/cancellation/revision and map W05 only through tested regional issuer/product rules.
- Keep unmapped/absent source coverage unknown and preserve source severity; no hail from prose inference.

**Acceptance checks**

- Positive partial known sum may exceed screen; incomplete below-threshold window cannot give all-clear.
- Latest cancellation removes prior event; source alert survives missing ET0.
- No source notification activation until regional mapping/coverage and delivery checks pass.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/warnings/rain.ts`, `Proposed: lib/weather/sourceEvents.ts`, [functions/src/operations.ts](C:/Users/Zane/dev/WeedGrow/functions/src/operations.ts)

**Spec acceptance coverage:** I01, I08, I09, I12

### WG-016 - Implement factual humidity/flower context with predictive disease disabled

**Stage:** D - Warnings  
**Dependencies:** WG-004, WG-006, WG-008, WG-014, WG-015  
**Type/status:** code / planned

**Scope / deliverables**

- Implement W09-W12 using paired air history/forecast, stage and reachable recent/current/forecast rain.
- Keep W10 predictive model disabled and all disease probabilities absent.
- Replace any reused high-humidity-only PM gate; keep conditions copy factual and shared.

**Acceptance checks**

- Unknown/missing rain never clears canopy context; sheltered direct rain does not remove humidity context.
- Reported flowering is the flower gate; age/strain does not establish flower day or resistance.
- No leaf wetness, internal-bud offsets or daily inspection requirement.

**Likely code/reference areas:** `Proposed: lib/careAlgorithm/warnings/ambient.ts`, [lib/weather/powderyMildewRisk.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/powderyMildewRisk.ts), [output/spec/WeedGrow_Implementation_Master_v8.2.md](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Implementation_Master_v8.2.md)

**Spec acceptance coverage:** I08, I13, I16

### WG-017 - Route optional root/wilt/establishment problem reviews

**Stage:** D - Warnings  
**Dependencies:** WG-001, WG-008  
**Type/status:** code / planned

**Scope / deliverables**

- Implement W07/W13/W14 as topic-specific user-initiated review routes using existing journal/care entry patterns.
- Do not introduce automatic root/damping-off diagnoses or mandatory health checks.
- Keep optional symptom/no-symptom observations separate from moisture and infection claims.

**Acceptance checks**

- Root-wilt report does not automatically instruct watering.
- Unknown establishment stage is unknown; unrelated problem topics do not trigger all root reviews.

**Likely code/reference areas:** [lib/logs/plantJournal.ts](C:/Users/Zane/dev/WeedGrow/lib/logs/plantJournal.ts), [features/plants](C:/Users/Zane/dev/WeedGrow/features/plants), `Proposed: lib/careAlgorithm/warnings/problemReview.ts`

**Spec acceptance coverage:** I08, I16

### WG-018 - Assemble the deterministic evaluation service

**Stage:** E - App and shadow mode  
**Dependencies:** WG-009, WG-011, WG-012, WG-013, WG-014, WG-015, WG-016, WG-017  
**Type/status:** code / planned

**Scope / deliverables**

- Compose profile/state/warnings in one explicit-time immutable-input evaluation.
- Return all 14 IDs once, phase/coverage/reasons, versions and nullable water result; disable care for inactive/deleting plants.
- Add a shadow entry point; route no unvalidated candidate into user-facing care.

**Acceptance checks**

- Evaluation deterministic and input-preserving.
- One failed path cannot suppress independent source weather; every warning retains its own status.
- No timer/day-since-log fallback is presented as measured or validated moisture.

**Likely code/reference areas:** [lib/suggestions/wateringEngine.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/wateringEngine.ts), [lib/suggestions/wateringSuggestions.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/wateringSuggestions.ts), [lib/suggestions/algorithms/wateringAlgorithm.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/algorithms/wateringAlgorithm.ts), `Proposed: lib/careAlgorithm/evaluate.ts`

**Spec acceptance coverage:** I04, I08, I11

### WG-019 - Implement revision-aware cache invalidation and automatic reevaluation

**Stage:** E - App and shadow mode  
**Dependencies:** WG-006, WG-007, WG-008, WG-012, WG-018  
**Type/status:** code / planned

**Scope / deliverables**

- Fingerprint every actual model dependency plus engine/profile/policy/anchor/log/weather revisions.
- Expire unsupported advice and schedule bounded retry/backfill/new-event evaluation.
- Keep metadata-only presentation changes from causing unnecessary history fetches.

**Acceptance checks**

- Changed plantedIn, used age/height/medium or rain reception invalidates affected advice.
- Outage yields one stable scoped uncertainty, not repeated prompts or retained stale not_due.
- Updated/deleted logs and late weather corrections trigger required replay without duplicates.

**Likely code/reference areas:** [lib/suggestions/adviceInputs.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/adviceInputs.ts), [lib/weather/shouldUpdateWeather.ts](C:/Users/Zane/dev/WeedGrow/lib/weather/shouldUpdateWeather.ts), [features/groups/hooks/useGroupWeather.ts](C:/Users/Zane/dev/WeedGrow/features/groups/hooks/useGroupWeather.ts), [features/home/useGardenWeatherCollection.ts](C:/Users/Zane/dev/WeedGrow/features/home/useGardenWeatherCollection.ts)

**Spec acceptance coverage:** I06, I12, I16

### WG-020 - Migrate all care consumers to nullable decisions and truthful copy

**Stage:** E - App and shadow mode  
**Dependencies:** WG-001, WG-008, WG-018, WG-019  
**Type/status:** code / planned

**Scope / deliverables**

- Remove same-day watering override that forces not_due/high confidence.
- Show watering recorded as an annotation, independent of decision; distinguish routine reminders from model estimates.
- Present unknown/context/disabled states without repeated soil-check instructions or disease diagnosis language.

**Acceptance checks**

- true/false/null survive persistence, sorting, badges and cards.
- A small watering cannot erase due; missing data cannot become not_due.
- No synthetic candidate or score reaches production care UI.

**Likely code/reference areas:** [features/plants/plantCare.ts](C:/Users/Zane/dev/WeedGrow/features/plants/plantCare.ts), [lib/suggestions/types.ts](C:/Users/Zane/dev/WeedGrow/lib/suggestions/types.ts), [features/plants/components/PlantWeather.tsx](C:/Users/Zane/dev/WeedGrow/features/plants/components/PlantWeather.tsx), [features/home](C:/Users/Zane/dev/WeedGrow/features/home)

**Spec acceptance coverage:** I04, I16

### WG-021 - Implement grouped cards and delivery episodes behind inactive gates

**Stage:** E - App and shadow mode  
**Dependencies:** WG-014, WG-015, WG-016, WG-017, WG-018, WG-020  
**Type/status:** code / planned

**Scope / deliverables**

- Merge heat/container and shared wet context; deduplicate one source event across warning IDs.
- Persist episode/revision/send state; handle cancellation, severity escalation and permitted repeats.
- Require consent, enabled policy and approved claim/source/profile; leave production push gates off until release tasks.

**Acceptance checks**

- Context/uncertainty never generates predictive-disease pushes.
- Retry cannot send duplicate episode; cancellation removes evidence; escalation is not hidden by repeat cooldown.
- Dismiss/snooze/watering changes delivery only, not modeled water or weather evidence.

**Likely code/reference areas:** [features/care/NotificationNavigation.tsx](C:/Users/Zane/dev/WeedGrow/features/care/NotificationNavigation.tsx), [features/care/NotificationNavigation.native.tsx](C:/Users/Zane/dev/WeedGrow/features/care/NotificationNavigation.native.tsx), `Proposed: lib/careAlgorithm/delivery.ts`

**Spec acceptance coverage:** I09, I11, I16

### WG-022 - Add shadow recording and independent evaluation export

**Stage:** E - App and shadow mode  
**Dependencies:** WG-018, WG-019, WG-020  
**Type/status:** code / planned

**Scope / deliverables**

- Record immutable input/version/evaluation snapshots and debug predictions without activating advice.
- Export deidentified plant/grower groups, source availability and predictions frozen before labels.
- Keep reference measurements/labels out of ordinary-input inference; bound storage/retention.

**Acceptance checks**

- No API keys/credentials or unnecessary personal fields in export.
- Evaluator rejects temporal/group leakage, missing criterion and invented labels.
- Coverage/abstentions reported alongside errors; zero cases is never perfect accuracy.

**Likely code/reference areas:** `Proposed: functions/src/careShadow.ts`, [output/spec/WeedGrow_Field_Evaluator_v8.0.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Evaluator_v8.0.py), [output/spec/WeedGrow_Field_Dataset_v8.0.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Dataset_v8.0.json)

**Spec acceptance coverage:** I10, I11

### WG-023 - Predefine reference-study care criterion and acceptance policy

**Stage:** F - Calibration and validation  
**Dependencies:** WG-001  
**Type/status:** validation_protocol / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Choose a narrow first supported setup and independently justified watering-needed endpoint; obtain agronomic review.
- Preregister training/tuning/held-out grower/plant groups and quantitative release targets before holdout labels are used.
- Specify staff/opt-in reference methods and corrections; ordinary growers still only use setup/logs/API.

**Acceptance checks**

- No universal study p value, survival endpoint or reminder compliance substituted for a validated care criterion.
- Unapproved/undefined acceptance targets continue blocking care activation.

**Likely code/reference areas:** [output/spec/WeedGrow_Release_Policy_v8.0.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Release_Policy_v8.0.json), [output/spec/WeedGrow_Field_Validation_Template_v7.5.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Validation_Template_v7.5.json), [output/spec/WeedGrow_Field_Evaluator_v8.0.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Evaluator_v8.0.py)

**Spec acceptance coverage:** I10, I11

### WG-024 - Collect reference training/tuning data with the normal-input contract

**Stage:** F - Calibration and validation  
**Dependencies:** WG-005, WG-007, WG-008, WG-023  
**Type/status:** requires_real_plant_data / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Collect independent state/loss/refill/rain-delivery reference data for the chosen domain using a research/opt-in cohort.
- Record timestamp/provenance and log-only versus optional-volume scenarios; keep holdout groups isolated.
- Use real outcomes, not generated case labels; record exclusions and missing data explicitly.

**Acceptance checks**

- Reference measurements are research inputs, never required deployment predictors.
- No training/test grower or plant overlap; weather as-of history is retained.
- Task remains incomplete until genuine eligible reference data exists.

**Likely code/reference areas:** [output/spec/WeedGrow_Field_Validation_Template_v7.5.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Validation_Template_v7.5.json), [output/spec/WeedGrow_Field_Dataset_v8.0.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Dataset_v8.0.json)

**Spec acceptance coverage:** I10

### WG-025 - Fit and version the first supported water profiles

**Stage:** F - Calibration and validation  
**Dependencies:** WG-009, WG-010, WG-011, WG-012, WG-023, WG-024  
**Type/status:** requires_real_plant_data / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Fit identifiable total loss, supported capacity/state/refill/rain ranges and the reviewed action criterion.
- Include source/climate/operating scope, initial-state coverage and approximate-volume variation.
- Compare simple baseline and candidate using training/tuning only; leave profile unapproved pending holdout.

**Acceptance checks**

- No separate identification claimed for two coefficients multiplying identical ET0.
- Normal log-only use, missing optional fields and fallback domains evaluated explicitly.
- No coefficient or accuracy value fabricated to satisfy synthetic tests.

**Likely code/reference areas:** `Proposed: model tooling/profile registry`, [output/spec/WeedGrow_Implementation_Contract_v8.2.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Implementation_Contract_v8.2.json)

**Spec acceptance coverage:** I10, I11, I14, I15

### WG-026 - Run independent held-out validation and decide profile eligibility

**Stage:** F - Calibration and validation  
**Dependencies:** WG-022, WG-023, WG-024, WG-025  
**Type/status:** requires_real_plant_data / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Freeze model/profile/policy and predictions before independent holdout labels are revealed.
- Evaluate unnecessary watering, misses, unresolved positives, useful coverage and domain uncertainty against preregistered targets.
- Obtain independent statistical/agronomic review; record supported and rejected domains.

**Acceptance checks**

- Good accuracy on a tiny decided subset cannot hide low coverage.
- Failure does not trigger holdout retuning; revisions require new properly isolated evaluation.
- No automatic approval from a metric file; failed/incomplete gates remain inactive.

**Likely code/reference areas:** [output/spec/WeedGrow_Field_Evaluator_v8.0.py](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Field_Evaluator_v8.0.py), [output/spec/WeedGrow_Release_Policy_v8.0.json](C:/Users/Zane/dev/WeedGrow/output/spec/WeedGrow_Release_Policy_v8.0.json)

**Spec acceptance coverage:** I10, I11

### WG-027 - Verify and release the supported weather-preparation slice

**Stage:** G - Gated release  
**Dependencies:** WG-003, WG-004, WG-005, WG-006, WG-008, WG-014, WG-015, WG-016, WG-017, WG-018, WG-019, WG-020, WG-021  
**Type/status:** release_review / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Run complete app/provider/local-Firebase integration for supported weather and factual context routes, including ownership/offline/revision cases.
- Configure actual source licensing/freshness/regional hazard coverage and approved delivery policy before any activation.
- Release supported weather-preparation behavior separately; watering and predictive-disease gates remain inactive if unapproved.

**Acceptance checks**

- Actual source, interval/timezone, cancellation and user-permission paths verified end to end.
- No claim that regional weather measures pot moisture or detects disease.
- Rollback/disable behavior and observable error state are reviewable before activation.

**Likely code/reference areas:** [scripts/verify.cjs](C:/Users/Zane/dev/WeedGrow/scripts/verify.cjs), [scripts/test-garden-weather.cjs](C:/Users/Zane/dev/WeedGrow/scripts/test-garden-weather.cjs), [functions/src](C:/Users/Zane/dev/WeedGrow/functions/src), [features/care](C:/Users/Zane/dev/WeedGrow/features/care)

**Spec acceptance coverage:** I01, I02, I03, I04, I06, I08, I09, I12, I13, I16

### WG-028 - Activate only independently approved watering domains

**Stage:** G - Gated release  
**Dependencies:** WG-011, WG-012, WG-013, WG-018, WG-019, WG-020, WG-021, WG-022, WG-026, WG-027  
**Type/status:** release_review / planned_requires_evidence_or_release_review

**Scope / deliverables**

- Run final app end-to-end water/transition/cache/delivery checks with approved profile versions and scoped production data.
- Activate only domains that passed preregistered validation and integration gates; retain unknown elsewhere.
- Monitor missed/needless watering, useful coverage, drift and alert burden; define reversible disable criteria.

**Acceptance checks**

- Every required model/profile/data/consumer gate is actually satisfied, not merely specified.
- Client fields cannot enable unapproved profile/disease routes.
- Predictive disease alerts remain disabled until a separate future validated workstream exists.

**Likely code/reference areas:** [scripts/verify.cjs](C:/Users/Zane/dev/WeedGrow/scripts/verify.cjs), `Proposed: approved profile registry`, [functions/src](C:/Users/Zane/dev/WeedGrow/functions/src), [features/plants/plantCare.ts](C:/Users/Zane/dev/WeedGrow/features/plants/plantCare.ts)

**Spec acceptance coverage:** I04, I05, I06, I07, I10, I11, I14, I15

## Acceptance coverage

| Spec case | Implementation tasks |
| --- | --- |
| I01 - Provider normalization | WG-002, WG-003, WG-004, WG-006, WG-015, WG-027 |
| I02 - Source and historical selection | WG-003, WG-004, WG-005, WG-006, WG-027 |
| I03 - Calendar and logs | WG-003, WG-007, WG-011, WG-027 |
| I04 - Nullable output consumers | WG-001, WG-002, WG-011, WG-018, WG-020, WG-027, WG-028 |
| I05 - Lifecycle and transitions | WG-012, WG-028 |
| I06 - Dependency invalidation | WG-006, WG-019, WG-027, WG-028 |
| I07 - Forecast and censoring | WG-002, WG-013, WG-028 |
| I08 - Warning contracts | WG-001, WG-002, WG-010, WG-014, WG-015, WG-016, WG-017, WG-018, WG-027 |
| I09 - Notification episodes | WG-015, WG-021, WG-027 |
| I10 - Low-input validation | WG-022, WG-023, WG-024, WG-025, WG-026, WG-028 |
| I11 - Release protection | WG-001, WG-009, WG-011, WG-018, WG-021, WG-022, WG-023, WG-025, WG-026, WG-028 |
| I12 - Source freshness and expiration | WG-005, WG-006, WG-015, WG-019, WG-027 |
| I13 - Air fallback | WG-004, WG-016, WG-027 |
| I14 - Approximate volume | WG-008, WG-009, WG-011, WG-025, WG-028 |
| I15 - Compatible demand change | WG-012, WG-025, WG-028 |
| I16 - Outage without burden | WG-005, WG-008, WG-016, WG-017, WG-019, WG-020, WG-021, WG-027 |

## Plan verification

28 unique tasks; all dependencies resolve; no cycles; all 16 specification acceptance cases covered. The task plan itself was structurally checked. Zero implementation tasks are marked complete by this planning work. The existing application code was not changed.
