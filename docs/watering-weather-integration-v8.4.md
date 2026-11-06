# Watering/weather integration — 5 November 2026

The app's watering path now has a complete engineering route from protected configuration and canonical weather history to the public care snapshot. The backend no longer always supplies `profile: null`, and the app no longer rejects all definite results. This is not a deployed or calibrated hops release. No real approved profiles were supplied, no operational policy was invented, and no live provider calls or deployment were performed.

## Data required by the supplied algorithm

The v8.4 master requires interval ET0 and occurred liquid-rain amounts, coherent capacity/loss/refill profiles, dated setup facts and authoritative watering logs. It expressly prohibits replacing these with a day-count timer, independent weather drying bonuses, a guessed full refill or historical forecasts relabeled as observations.

Our existing OpenWeather One Call 3.0 payload supplies temperature, humidity, wind and rain rates. It does not supply the required ET0 series. Its point rain rates do not establish occurred interval water volumes. See the [existing product documentation](https://openweathermap.org/api/one-call-3). The existing app's daily display caches consequently remain presentation data, not water-bank forcing.

`careWaterHistory.ts` requests hourly `et0_fao_evapotranspiration,rain` from the [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api), which the handoff already supports. It requests explicit UTC/Unix time and model configuration, retains returned grid metadata, hashes raw content and normalizes through the audited adapter. Best Match remains explicitly unpinned. Archive values are grid/model estimates, not measured plant water.

Archive latency remains a material limitation: the most recent required interval may be unavailable. The new collector retries/backfills within configured bounds; it does not substitute past forecasts or assume zero loss/rain. An unfinished hour also remains unavailable without supported completed forcing. This source alone does not establish useful current-decision coverage.

## Protected release configuration

`careConfiguration/watering` is denied to app clients. Missing/disabled/invalid configuration produces uncertainty and no new history requests. It is separate from `careConfiguration/weather` and its OpenWeather budget.

The water document requires these explicit operational fields:

- `enabled`, immutable release `version`, `historyModel`, `licensingEvidenceId`, `adapterReviewId`.
- `requestTimeoutMs`, `retryAfterSeconds`, `refreshSeconds`, `maxRequestsPerDay`, `backfillDays`, `historyRecheckDays`. The recheck window must be smaller than the request span so backfill can advance.
- `profiles`: full immutable profiles with approval record ID, approved outcome/evidence IDs matching the profile, statistical review ID, locked-before-holdout policy, passed source/consumer gates and preregistered non-null numeric targets. No target values or coefficients are supplied by this implementation.
- Optional `carryMappings`: explicit `fromProfile`, `toProfile` keys in `id@version` form and complete `scenarioMap` lineage for compatible demand changes. Same-profile scenarios can carry directly; physical/incompatible changes reinitialize uncertainty. Conflicting/overlapping supported profile domains do not use first-match precedence.

These records attest external release decisions; software cannot establish that an asserted study or review actually occurred. Only reviewed privileged administration should install them. The synthetic emulator records are created and cleaned up inside disposable demo projects; they are not a configuration template or calibration recommendation.

## Runtime behavior

1. Scheduled maintenance, setup changes and watering changes use the existing backend refresh. Raw watering facts synchronize into the authoritative revision ledger before dependency keys are captured.
2. The first supported activation creates a protected origin at its actual timestamp and initializes `[0,C]`, never a presumed full pot. It does not fabricate past setup dates. Existing retained origins are replayed, with dated compatible transitions. An unmodeled location move starts an unknown bank at its recorded boundary.
3. History acquisition uses fixed provider URLs, timeout/body/row bounds, distributed leases, a separate daily request budget and configured retry/recheck/backfill. Content-identical refetches reuse their original stored acquisition. Historical anchor data has no cache TTL.
4. A source view selects the latest acquired immutable revision for each exact interval. Equal-authority conflicts block the path; missing/invalid corrections cannot revive an older valid amount. Past forecast rows are excluded. Partial *completed* sums support conservative zero/full bounds at an anchor or transition; no uniform rainfall distribution is invented.
5. Checkpoints are checked against original setup/profile, source history and log revisions. Changed history replays the original origin. Missing, unsynchronized or bounded-read-overflow histories remain unavailable. Approved model inputs alone do not imply that replay coverage exists.
6. The existing production evaluator checks every applicable profile approval and emits `true`, `false` or `null` by unanimous scenario bounds. Only determinate approved results receive a `waterRelease` marker and explicit expiry. Private inputs/configuration are represented by a SHA-256 identity in the public snapshot.
7. Publication checks plant/log/setup dependencies and both configuration revisions transactionally. An in-flight policy change cannot publish the old result. Private checkpoints publish in the same final transaction. A weather-preparation request limit does not block an otherwise supported water evaluation.
8. The app accepts definite results only from the protected matching snapshot, with release/profile metadata and expiry. Its explanation follows the actual decision. Direct client writes to release records, origins, history and checkpoints are denied. Deleting a plant removes both new private collections.

The history reader is deliberately bounded to 32 immutable acquisition documents and 16,384 samples per evaluation. Overflow produces an explicit unavailable reason. Larger/long-lived deployments still need history pagination/compaction/retention design that preserves active-anchor correction provenance. No unlimited operational capacity is claimed.

Automatic water notifications, live provider entitlement/licensing, physical-device delivery, independent outcome validation, real hops profile approval and useful current-decision coverage remain outside what the local engineering tests prove.

## Verification

`npm run verify` passed backend/app types, backend build, lint, architecture checks, **105 Jest suites / 580 tests**, and the full local Firebase integration suite. The production care integration exercises real provider field semantics using synthetic weather/profile/approval fixtures only in disposable emulators. It verifies initial uncertainty, due after occurred loss, not-due after known exact-now watering, corrections/deletions, omitted amounts, original cache timestamps, trailing gaps, approval revocation, in-flight configuration rejection, denied client writes and response-size limits. No live source access or release configuration was installed.
