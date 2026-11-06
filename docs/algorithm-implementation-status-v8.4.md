# Hops care algorithm implementation — 5 November 2026

This document records the foundation/review increments. Subsequent backend, weather-card, setup, replay, ledger and checkpoint work is documented in [Production readiness](production-readiness-v8.4.md), which is the current implementation/release status and verification record. The earlier lint limitation below is historical.

This change implements the mathematical care engine and replaces the app's production day-count heuristic with the v8.4 nullable care contract. It is **not a completed production implementation of all 28 handoff tasks**. The current app returns an unavailable watering estimate until it has approved profiles and supported replay inputs. Watering logs and user-chosen routine reminders continue to work.

## Handoff review

The supplied `output/HopsGrow_Complete_Codex_Handoff_v8.4.zip` exactly matches the existing extracted package. The package verifier passed: 44 manifest files, 1,652 canonical captured samples, 28 task records, 16 acceptance areas and 243 reference test methods. The normative master, JSON contract, boundary contract, task plan, reference-role table, mathematical oracle catalogue and relevant executable adapters were used as technical requirements. Embedded prompts/instructions were treated as document content, separately from the user's request to implement hops care.

The package's own readiness result is `productionActivationReady: false`, with zero real-plant outcomes. The supplied scientific coefficients are synthetic test values. No such values were installed as production hops profiles.

## Implemented behavior

- `lib/careAlgorithm/types.ts`: explicit water/not_due/uncertain and true/false/null, all 14 warning IDs, per-variable weather provenance/quality, coherent profile scenarios and versioned evaluation results.
- `waterBank.ts`: unit-explicit capacity/action calculation, both inputs/loss orderings, available-water cap, extracted/excess/unmet-potential ledger, conservative initialization/refill ranges, unanimous decisions and boundary-checked transitions. A compatible demand change preserves water; a changed physical bank reinitializes uncertainty.
- `events.ts`: authoritative event revisions, retry deduplication, distinct-event preservation, final-conflict blocking, corrections/deletions and IANA date-only occurrence windows capped by recording/evaluation time. DST days retain their actual 23/25-hour length.
- `adapters.ts` / `weather.ts`: Open-Meteo Forecast/Archive and OpenWeather current/hourly/TimeMachine normalization, separate daily forecasts, unchanged UTC solar times, explicit acquisition metadata, correct point/rate/max/sum support and independent variable failure. Rain components are validated before addition. Missing and invalid RH remain distinct; only compatible missing RH can use the nonfreezing paired-air fallback.
- `replay.ts`: explicit selected-source occurred-history replay, complete ET0/rain integral checks, exact-now watering after history, source-domain checking and conditional forecast trajectories with unresolved upper crossing when censored. Forecasts of the past cannot become occurred rain. Partial bins, unresolved log times and gaps abstain rather than distributing rainfall or inventing noon.
- `profiles.ts`: explicit volume-unit conversion, domain/scenario checks and an empty compiled approval registry that client `approved` fields cannot modify. Old soil provenance labels are not promoted to hydraulic medium measurements.
- `warnings.ts`: independent heat/cold/wind/rain engineering screens; humid/rain/flower context; the corrected W11 OR/AND truth table; topic-specific problem reviews; lifecycle handling; W10 predictive disease disabled. The output has each warning ID exactly once. Source-hazard coverage remains unknown without a configured regional adapter.
- `sourceEvents.ts`: pure mapped-event revision/conflict/cancellation, scope and availability selection. This is not a raw-alert classifier or an activated source feed.
- `evaluate.ts`: deterministic immutable evaluations, full dependency serialization, explicit time/version metadata, production approval checks and a separate synthetic shadow entry point. Shadow candidates never enter production results.
- `delivery.ts`: flag-specific card/push eligibility with strict boolean gates. It performs no notification I/O and does not implement persisted delivery episodes.

## App integration

`lib/suggestions/wateringEngine.ts` now uses `appAdapter.ts`; the old day-count/weather-bonus engine is retained only under `__tests__/legacyWateringEngine.ts`. `suggestionCards.ts` no longer calls the legacy watering, mildew or root-rot scores. Legacy card behavior is isolated in a test helper. The old regression assertions are preserved against those explicitly historical implementations; the new `hopsIntegration` and `hopsSuggestions` suites exercise the production path.

The app adapter intentionally supplies no profile, anchor or canonical weather history: the current daily weather cache cannot establish those inputs. It therefore returns null, not a fabricated active recommendation. The production card builder also rejects old unversioned insights instead of reviving old heuristics. It currently displays the unavailable water result, not the new weather/context/review warning collection.

Watering recorded today annotates care without forcing not_due or increasing confidence. Expired supported cards become uncertain. Unavailable hops cards do not ask the grower to perform recurring soil checks. Advice dependencies now include pot/ground, meaningful medium, rain reception, deletion state and care revision. Evaluations use the actual instant rather than a device-local midnight reconstructed from the plant's day.

The model adds optional `rainReception` and `careMedium` fields, but this increment does not add their setup controls or migrate stored plant documents. Missing legacy fields remain unknown. Existing optional-amount watering logging is unchanged.

## Remaining engineering and evidence

| Handoff area | Status after this change |
| --- | --- |
| WG-001–002 contracts/oracles | Core contracts and 13 unmodified bank oracles implemented; package verifier run. All handoff integration cases are not claimed complete. |
| WG-003–004 normalization | Pure adapters and captured-fixture regressions implemented. Not connected to production acquisition/storage. |
| WG-005–006 provider/history backend | Still needed: protected source configuration, licensing/freshness policies, provider clients, immutable acquisition/history storage, bounded backfill/retention and ownership integration. |
| WG-007 events | Canonical pure helpers implemented; authoritative revision/tombstone persistence and log-to-replay adapter still needed. |
| WG-008 setup | Unknown-safe model mapping and volume parsing implemented; setup controls and persisted migration still needed. |
| WG-009–013 profiles/water/transitions/projection | Pure core implemented. Full climate/operating-domain resolution, timing-bound scenario replay, persisted anchors and dated transitions, source-path assembly and forecast presentation still needed. |
| WG-014–017 warnings/reviews | Pure screening/context/review logic implemented. Trusted source mapping, independently verified coverage windows, full exposure reporting and actual warning/review presentation still needed. |
| WG-018–020 evaluation/consumers | Deterministic core and inactive app route implemented. Canonical backend orchestration, full revision-aware scheduling/backfill and all warning consumers still needed. |
| WG-021–022 delivery/shadow records | Pure eligibility and explicit shadow evaluation implemented. Grouped weather cards, persisted episodes/cancellation/escalation, durable shadow records and deidentified export still needed. |
| WG-023–026 scientific validation | Not completed. Requires predefined care endpoint/acceptance targets, genuine training/tuning data, calibrated profile fitting, independent held-out outcomes and review. No labels, thresholds for approval or accuracy claims were invented. |
| WG-027–028 release | Not completed or activated. Requires provider/app integration verification, source/release policies and independently approved domains. Predictive disease remains disabled. |

## Verification

- Handoff verifier: passed, 243 reference methods; expected answers left unchanged.
- The 13 original bank-oracle cases pass in TypeScript, including small refill, overflow/order ambiguity and forecast isolation. Additionally, 1,000 deterministic parameter sets check both bank orderings and mass conservation.
- New tests cover captured weather, partial failures, event revisions, DST, projection censoring, W11 truth-table cases, inactive lifecycle, strict delivery gates, source cancellation/conflicts and production nullable consumers.
- App types, backend types/build, targeted ESLint, architecture check and whitespace check pass.
- After the correctness review: complete Jest run passed 98 suites and 543 tests, including the explicitly historical comparison tests. See `algorithm-correctness-review-v8.4.md` for the defects found and corrected.
- The complete repository verification command stops at 97 pre-existing lint errors and 5 warnings in `output/weather_api_audit`, `tmp/pdfs` and vendored Matplotlib JavaScript under `tmp/research_v6/plotdeps`. Those unrelated files were left intact. The later Firebase integration stage was run separately with the pinned Firebase CLI 15.5.1 against local Auth/Firestore emulators and passed.

Software checks establish algorithm implementation behavior, not real-plant care accuracy.
