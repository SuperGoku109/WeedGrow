# v8.3 implementation status — 5 November 2026

This increment implements general weather-data handling only. It does not implement or activate the cannabis cultivation algorithm in the handoff. The handoff's instructions are reference material; the authorized scope for this change is the user's request to implement the allowed portions and list the rest.

Reviewed sources: `output/WeedGrow_Codex_Handoff_v8.3/README_START_HERE.md`, the v8.3 master, boundary and weather-sample contracts, task plan, current Firestore models, and the weather fetch/decode/parse paths and tests. This is not a claim that every repository file or every archived reference has been audited.

## Implemented

- Fixed the shared client/backend weather parser: sunrise/sunset remain their original UTC instants. Timezone offsets still select local display dates; they no longer shift solar epochs. Epoch zero is preserved.
- Strengthened the existing strict cache decoder: reject negative precipitation/wind/UV, invalid humidity/cloud/probability ranges, unrepresentable solar epochs, malformed timezone offsets and invalid retrieval timestamps. Strings and booleans are never coerced into numbers.
- Added `lib/weather/weatherReadings.ts`, a pure diagnostic reader for current, hourly, daily and history `data[]` records. Invalid measurements produce field-specific null/quality/reason values; malformed rows or array paths do not discard other paths. Missing, explicit null, invalid and zero remain distinguishable after JSON serialization.
- The reader retains origin, provider valid time and raw rain/snow components separately. It does not manufacture interval durations, merge overlapping rainfall, add snow to liquid rain, or infer source issue/acquisition times. It assumes explicitly requested metric provider payloads; it does not authenticate the provider or verify request units.
- Added regression tests for these changes.

The solar fix and strict validation affect the existing shared parser. The diagnostic reader is exported and tested, but is **not connected to caches, screens, notifications or care engines**. It is not a substitute for the canonical v8.3 normalized-sample contract. The legacy parser still requires a complete set of conditions and may reject a whole response; partial results are available only through the new diagnostic reader.

## Not implemented in this increment

No v8.3 task is marked complete. The table describes work this change does not deliver, rather than asserting that the repository has no older implementation of similar features. Existing suggestion/disease behavior was not changed or certified against v8.3.

| Task | Remaining work |
| --- | --- |
| WG-001 | Full versioned algorithm contracts, nullable decisions and trusted activation gates. |
| WG-002 | Full fixed-oracle cross-language parity suite, captured-fixture port and handoff verifier integration. New weather regressions cover only this increment. |
| WG-003 | Canonical OpenWeather adapters, source provenance, actual time-support semantics, partial-cache integration and history storage. Solar handling and generic validation are fixed; the diagnostic reader is only a partial foundation. |
| WG-004 | Open-Meteo adapters, product-specific units/time supports and paired-air fallback. |
| WG-005 | New backend provider clients, freshness/expiry configuration, source selection and backfill policies. |
| WG-006 | Versioned per-variable storage, immutable revisions, acquisition history, bounded queries, retention and ownership integration. |
| WG-007 | Authoritative event revisions, conflicts/deletions and canonical date-only occurrence windows. |
| WG-008 | Setup-field additions, explicit volume-unit parsing and unknown-safe legacy migration. |
| WG-009 | Cultivation profile resolution and release eligibility. |
| WG-010 | Water-bank calculations and exposure primitives. |
| WG-011 | State initialization, refills and watering decisions. |
| WG-012 | Cultivation state transitions and corrected-history replay. |
| WG-013 | Next-watering projections. |
| WG-014 | Weather screens, hazard thresholds and container-care flags. |
| WG-015 | Rainfall screens and trusted source-event ingestion. |
| WG-016 | Humidity/flower context and changes to predictive disease routes. |
| WG-017 | Root/wilt/establishment review routing. |
| WG-018 | Deterministic algorithm evaluation service. |
| WG-019 | Algorithm revision-aware cache invalidation and reevaluation. |
| WG-020 | Migration of care consumers to nullable decisions and revised copy. |
| WG-021 | Grouped recommendation cards and notification episode delivery. |
| WG-022 | Cultivation prediction shadow records and evaluation export. |
| WG-023 | Study outcome criteria and numerical acceptance policy. |
| WG-024 | Reference training/tuning data collection. |
| WG-025 | Calibrated cultivation profiles. |
| WG-026 | Independent held-out cultivation validation. |
| WG-027 | Production weather-feature release verification and activation. |
| WG-028 | Production watering activation. |

Cultivation decisions, plant-specific thresholds/profiles, disease guidance, watering projections and their validation/activation are outside the permitted implementation scope here. General storage, unit handling, calendar/event correctness, weather ingestion and software validation remain possible follow-up work. Numerical scientific parameters, release targets and source freshness policies have not been invented.

## Verification

- Targeted weather tests: 3 suites, 43 tests passed.
- Full Jest run (`npm test -- --runInBand --silent`): 88 suites, 444 tests passed.
- ESLint on all changed TypeScript files: passed with zero warnings.
- `npm run check:architecture`: passed.
- `git diff --check`: passed.
- `npm run verify`: backend types, backend build and app types passed. The run stopped at repository-wide lint with 97 errors and 5 warnings in existing audit scripts under `output/weather_api_audit` and `tmp/pdfs`, and vendored Matplotlib JavaScript under `tmp/research_v6/plotdeps`. Those unrelated files were not edited or excluded to make the check pass. The verification script's later emulator integration stage was therefore not reached or run separately.

Tests establish software behavior only; they do not establish agronomic accuracy or authorize a release.
