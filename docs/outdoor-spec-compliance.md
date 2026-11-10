# Outdoor care specification compliance review

Reviewed against the user's complete v1 specification on 10 November 2026.

## Result

The second pass found functional gaps despite the earlier passing tests. They have been corrected in the existing implementation, with regression tests that reproduce the failures. This document separates automated evidence from device checks; passing tests do not establish field calibration of weather or soil conditions.

## Defects found and corrected

| Finding | Correction and evidence |
| --- | --- |
| Learning reported EARLIER/LATER without meaningfully advancing most fresh observations | Soil state and next inspection time are independent. Three usable transitions can move the next check by one six-hour step while a fresh MOIST/WET report still suppresses watering. `outdoorSpecCompliance.test.ts` checks both earlier and later timing. |
| Forecasts did not affect inspection timing | Upcoming heat/wind/cold can advance a check and explain the forecast influence. Forecasts cannot postpone an already relevant check or establish moisture. |
| An elapsed cached forecast could become completed rainfall before a new acquisition | Provider rows are historical model estimates only if their intervals ended by acquisition time. A test compares the same cached forecast before/after a fresh acquisition. Neither becomes a journal watering. |
| Soil and health advice could expire while screens stayed open | Home and Plant Detail refresh at the evaluation/inspection deadline. Expired health, soil and weather cards are hidden. Dedicated mounted-component tests advance time and assert reevaluation. |
| Notification rate limits acknowledged findings that had never been sent | Only selected deliveries enter the dedup state. Excess findings remain eligible on subsequent evaluations. |
| A delivery failure could resend earlier successful notifications | Persist each successful delivery before sending the next. A native-service test injects a failure into the second delivery and verifies the first is not sent again. |
| Material weather escalation was hidden by stable IDs | Signatures include qualitative severity bands, phases and check status. Stronger forecast wind is considered even when a weaker observed signal exists. Sustained wind also works without gust data. |
| Missing weather could clear dedup memory and cause repeat alerts on recovery | The coordinator supplies explicitly resolved IDs. Unknown weather retains prior state; confirmed resolution allows later recurrence to notify. |
| A failed history read could retain a dry-soil title/action | Untrusted history is excluded. Return CHECK_SOIL with insufficient data; weather/health assessment continues independently. |
| Old humid runs could look current | A qualifying consecutive run must reach the configured recent-signal window. Incomplete coverage returns UNKNOWN. |
| Weather revision ordering could change outcomes | Normalize revisions deterministically; conflicting equal revisions become unknown. Corrected care-log revisions and feedback are also selected deterministically. |
| Legacy/date-only watering was treated as an exact placeholder timestamp | Reuse local-day occurrence windows, original recording caps and edit assertion caps. Legacy timestamps still contribute uncertain care windows. DST tests verify 23/25-hour days. |
| Rain could suppress the independent persistent-wet inspection signal | Drainage uses recent repeated WET reports independently of the watering state; new rain does not erase a justified inspection. |
| Existing qualitative observations could not survive backup validation/export | JSON backup validation and CSV export now preserve moisture state, configuration, feedback and user-confirmed rainfall. Real repository/emulator exports are checked. |
| No user-confirmed rainfall record existed | Health journal entries now support LIGHT/MODERATE/HEAVY reports, explicitly separate from API history, forecasts and watering. Existing edit/delete/retry flows are reused. |
| Ordinary afternoon warming could skew the local temperature comparison | Compare the same local hours on multiple prior days, not a full-day average. Absolute extreme bands remain safety checks; relative warmth is described as recent local history, not a climate normal. |
| Soil advice lacked a clear history overview and watering follow-through | Plant advice shows last watering, last user-reported check and current check status. Date-only watering does not invent an exact time. A dry confirmation provides a Log watering action alongside Record soil check. |

## Acceptance matrix

| Specification | Implementation and verification |
| --- | --- |
| §§1–3, 13: architecture and pure execution | Existing on-device service/evaluation/card routes retained. Pure context, watering, weather, health and learning responsibilities share validated inputs. No new dependency, network/Firestore call or LLM in the core. Research/manual reserve calculations remain isolated from automatic execution. |
| §§4–5: observation hierarchy and check urgency | DRY/MOIST/WET, timestamps, configuration, configurable freshness, intervening care/rain and CHECK_NOW/SOON/LATER/INSUFFICIENT_DATA. Unknown/stale soil never becomes an inferred percentage or a weather-only watering instruction. |
| §6: rainfall | Existing rain exposure fields reused. Four provenance paths remain distinct: forecast, past API/model estimate, user-confirmed rainfall and logged watering. Neither model rain nor reported rain guarantees root-zone hydration. |
| §7: weather | Recent, current and forecast conditions produce separate preparation/inspection recommendations for heat, cold, wind, rain, temperature changes and sustained humidity. Same-hour local history supports relative warmth. |
| §8: plant health | Separate mildew, Botrytis, drainage, exposure and pest-follow-up signals. Each has its own evidence and missing-data handling. Repeated WET reports support drainage inspection; a recent no-symptoms inspection reduces repeated mildew inspection priority. No weather-only diagnosis or disease percentage. |
| §9: learning | Sufficient real, time-precise, configuration-matching observations required. Intervening care/rain, contradictions or incomplete weather exclude pairs. Bounded timing adjustments work in the returned schedule and cannot change a valid observed soil state. Feedback and WET-to-MOIST changes are retained as evidence. |
| §§10, 12: recommendations and UI | Stable per-plant IDs, type/category, priorities, actions, reasons, evidence, quality, timestamps, status and expiry. Structured status supports active/dismissed/resolved; current recommendations are derived, not a second persistent collection. Home prioritizes across plants. Plant Detail uses existing cards, soil-check composer and care history. |
| §11: Firestore compatibility and groups | Optional fields on existing logs, no new collection/migration. Care revision advances on relevant changes/deletions. Existing owner, conflict, idempotency and timestamp semantics preserved. Groups share weather acquisition/cache while decisions and history remain plant-specific. Unknown timezone falls back explicitly to UTC, not the execution host timezone. |
| §§12–13: notification and refresh behavior | Existing reminder preference and Expo Notifications are reused. Material-change dedup, rate limits, expiry, partial retries and confirmed resolution are tested. Refreshes alone do not cause repeated alerts. Scheduled user routines are preserved. |
| §§14–15: reliability and acceptance | See scenario coverage and end-to-end emulator evidence below. No live Firebase writes, deployment or weather API calls are needed by tests. |
| §§16–18: scope and incremental delivery | No precise moisture/volume prediction in automatic care, no FAO/VPD control, ML, camera diagnosis, sensors, indoor algorithm, redesign or Firestore restructuring added. Original research remains available for explicit manual tests. |

## Required forty scenarios

All forty required scenarios have behavioral assertions, including explanation codes and the absence of contradictory watering guidance. Primary coverage is in `lib/careAlgorithm/__tests__/outdoorIntelligence.test.ts` and `outdoorSpecCompliance.test.ts`, supplemented by service, journal, screen, backup and notification tests.

| IDs | Coverage |
| --- | --- |
| 1–10 | Fresh DRY/MOIST/WET; no/stale checks; watering without check; hot/windy versus moist; cool versus dry; missing weather; contradictory/reordered/corrected logs. |
| 11–18 | Light/heavy rain; exposed/partial/sheltered/unknown; forecast-only and unrealized rain; rain after a dry report; missing measurements. Cached forecast reconciliation additionally tests the actual provider adapter/evaluation path. |
| 19–25 | Consecutive humidity versus a spike; independent mildew/Botrytis; repeated wetness; extreme forecast wind; disappearing signals; duplicate alerts. |
| 26–32 | No/insufficient history; repeated real transitions; contradictory observations; changed pot/location; bounded timing changes; incomplete weather across training intervals. |
| 33–40 | Shared weather with independent plants; excluded indoor/greenhouse environments; expiry across all card types; malformed/revised data; delayed weather; midnight/DST/local time; deterministic reevaluation; one coherent soil action. |

## Actual data-path evidence

`scripts/test-functional-workflows.cjs` now runs an additional emulator scenario using the real TypeScript journal repository under the enrolled care revision protocol:

1. Save a precise DRY observation and evaluate the saved Firestore timestamp without weather: conditional watering is allowed.
2. Correct the same journal entry to MOIST: watering is suppressed and careRevision advances.
3. Save user-confirmed HEAVY rain: check planning changes, soil state becomes uncertain, and no watering event is created.
4. Export JSON and CSV and assert the new fields survive validation/export.
5. Delete rainfall and the moisture observation, checking revision invalidation and the resulting decisions.

The existing ownership, concurrency, group watering, history preservation, backup restore and backend protocol emulator scenarios remain in the verification pipeline.

## Verification boundaries

The exported web application was built and opened successfully at its signed-out garden screen. No user authentication or production journal changes were performed. Signed-in behavior is covered by mounted-component tests and the real Firestore emulator workflow; it was not manually exercised with a live account.

Physical-device notification delivery and horticultural field calibration are not established by automated tests. Fresh weather/health assessment runs while the app is active. Planned future soil inspections are registered with the existing native date-trigger system and can be delivered by the OS while the app is closed; they ask for a check and never claim current soil moisture. Existing scheduled routines are preserved. No background weather worker was added.


## Final verification results

- `npm run verify`: passed backend type checks/build, application TypeScript, zero-warning lint, architecture boundaries, 121 suites / 1,054 tests, and all Firebase Auth/Firestore emulator integration/ownership checks.
- The real repository observation/rain workflow passed against disposable local Firestore, including correction/deletion, revision invalidation, saved-timestamp replay and JSON/CSV export.
- `expo export --platform web`: passed and generated the web routes. The exported app opened successfully at its signed-out garden screen.
- No application source whitespace errors in `git diff --check`. Pre-existing scratch log changes were left alone.

Notification tests additionally verify native scheduling of future soil checks and suppression of an immediate duplicate after a planned check has already been delivered. These validate the scheduling calls and state transitions, not physical OS delivery.
