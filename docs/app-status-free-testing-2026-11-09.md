# App status and a free algorithm testing path

**Implementation update:** the interactive on-device experiment described below is now implemented. See [on-device-algorithm-testing.md](on-device-algorithm-testing.md) for usage and precise limitations. The deployment metadata below records the earlier read-only audit; the app now has an explicit local experimental path alongside the protected backend route.

Audit date: 9 November 2026, Africa/Johannesburg. Scope: inspect current implementation and live deployment metadata, and identify what is needed for free interactive algorithm testing. This audit does not enable billing, deploy code or install a watering profile.

## Verified state

Read-only checks against the existing `weed-grow` project found:

- Billing enabled: **false**.
- Deployed Firebase functions: **zero**.
- `careConfiguration/weather`: **missing**.
- `careConfiguration/watering`: **missing**; no profiles in that missing configuration.
- Local Expo configuration selects the real Firebase project, with emulator mode **off**. An OpenWeather key is configured; its value was not printed or retrieved from Secret Manager.

The source tree was clean before this audit. Earlier read-efficiency changes are present in the current code. Those backend savings cannot be active in production while no backend functions are deployed.

The focused current-code test run passed **18 suites / 400 tests** covering the care algorithm and client snapshot reader. This is fresh verification, not a repeat claim that production weather and real hops outcomes have been validated. The previous complete verification was recorded separately in the efficiency work.

## What is implemented

The pure TypeScript engine includes water-bank replay, watering event revisions, corrections/deletions, dated setup changes, forecast projection, source/time-support checks, explanations and weather warning rules. Firebase orchestration includes acquisition, budgets, protected snapshots, checkpoints and due-based maintenance. The app accepts production weather-care decisions only from matching protected server snapshots.

Relevant code:

- `lib/careAlgorithm/evaluate.ts`, `waterModel.ts`, `waterTimeline.ts`, `waterExplanation.ts`, `warnings.ts` and adapters.
- `functions/src/careOperations.ts`, `careWatering.ts`, `careWaterHistory.ts` and `index.ts`.
- `lib/careAlgorithm/snapshot.ts` and `services/plantCareEvaluation.ts`.
- `functions/src/careEventLedger.ts` and `operations.ts` for the read-efficiency work.

## Independent blockers

1. **Hosting:** Spark does not host Cloud Functions. The implemented background worker is not running, so it cannot publish care snapshots. This is a Firebase product restriction, rather than a restriction on executing the calculation. [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

2. **Configuration:** both protected operational policy documents are missing. Merely deploying functions would not configure source selection, request budgets, profile selection or release behavior.

3. **Production approval:** `evaluateCare` requires an approved profile registry. The compiled default is empty; the backend obtains approvals from protected configuration. It intentionally returns uncertainty for an absent/unapproved profile. Synthetic emulator fixtures exercise the route, but are not actual approvals or calibrated coefficients for the owner's plants. A development experiment does not need to satisfy this production gate; its output should remain explicitly experimental.

4. **Weather coverage:** the watering replay needs supported interval ET0 and liquid-rain history, rather than just a daily temperature/humidity/rain card. Archive availability varies by model, and the unfinished current interval may remain unsupported. For example, the provider currently documents a five-day delay for ERA5 while IFS has a different update cycle. Source changes require adapter/profile compatibility checks. A paid backend would not supply missing history. [Historical weather documentation](https://open-meteo.com/en/docs/historical-weather-api)

## Recommended next implementation: an in-app care test mode

For the owner's immediate goal of playing with the calculation, the simplest route is to **run the existing pure engine in the app**, keep Firebase Spark for ordinary data, and avoid adding a hosted worker or migrating databases yet.

This test mode is not currently wired into an interactive screen. The existing `evaluateShadow` engineering entry point can run without a production approval; its result is deliberately not accepted as a production care snapshot. Reuse it and the existing explanation/warning functions behind a separate test-result type and UI. Do not forge approval metadata or weaken the protected production snapshot reader.

Suggested interaction:

1. Open a “Test care” screen, optionally from an existing plant, using a local copy of its setup and selected journal records.
2. Select a recorded scenario or a completed historical weather range, and choose a simulation time.
3. Inspect/edit a clearly labeled experimental parameter profile, including capacity, demand/catchment and retention assumptions. Explicit simulation initial reserve values are assumptions, not measurements of the real pot. Unknown inputs should stay unknown.
4. Add, edit or remove simulated watering and change rain reception/shelter/setup.
5. Recalculate immediately and display water/not-due/uncertain, the reasoning, data gaps, contributing intervals and reserve bounds. Include warning outcomes so ordinary wind does not become an unsupported storm warning.
6. Keep experimental results and overrides local to the signed-in account. Do not write them into server-approved care documents or use them to schedule real watering notifications.

This allows the owner to vary inputs and see their effect without a local backend server remaining on, Cloud Functions, a billing upgrade or a new backend provider. The limitation is that this mode calculates while the app is open; it is not a 24/7 cloud service.

## Weather and cost isolation for the test mode

Default to bundled/recorded fixtures: deterministic, zero provider requests, and easy to compare against the existing hand-derived scenarios. Add an optional Open-Meteo fetch path for the confirmed non-commercial use, with attribution and bounded requests. [Free API terms](https://open-meteo.com/en/terms)

The existing app still has direct OpenWeather calls. A strict no-paid-API test session must explicitly disable those existing paths or replace them with the selected free/test provider, not merely add a free provider on one new screen. Firebase's Spark plan does not control a separate weather subscription's charges.

Start real-weather testing with completed historical intervals, replayed at a past simulation time, to avoid conflating an archive gap with a logic bug. Live forecast inputs remain forecasts. Do not relabel forecast/past-days data as occurred evidence or make missing rainfall zero to force a determinate answer.

## Other free routes

**Fully local Firebase emulators:** appropriate when testing the backend, security rules, transactions and journal triggers together. The repository already runs Auth/Firestore emulator integration tests, but there is no convenient persistent interactive launcher or seeded demo account. The current emulator configuration does not include the Functions emulator, and local scheduler execution must be handled explicitly rather than assumed to run like hosted Cron. Wiring this route needs more setup than a calculation test screen. [Functions emulator](https://firebase.google.com/docs/emulator-suite/connect_functions)

**Firebase Spark plus an external free worker:** potentially useful later for an always-hosted beta, but requires protected server credentials, request authentication, source/counter invalidation and quota/availability handling. It is more infrastructure work than necessary for the immediate experiment and would not resolve profile or weather semantics automatically.

## Recommended order

1. Build the in-app experimental screen using recorded cases and editable assumptions, with zero paid provider calls.
2. Add complete historical Open-Meteo replay and explain coverage precisely.
3. Use the screen to compare expected dry/rain/watering/shelter outcomes, and address genuine engine gaps with regression cases.
4. Independently design and test the recent-weather path and assess real plant observations.
5. Decide hosted backend and production release requirements after the experiment is useful.

This does not claim that a validated real-world watering system already exists. It provides the shortest free route to exercising the implemented algorithm without confusing hosting prerequisites with development experiments.
