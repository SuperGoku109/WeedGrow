# Outdoor intelligence refactor audit and plan

The active route is `services/localPlantCare.ts` → `lib/careAlgorithm/localCare.ts` → existing suggestion cards and Home hooks. Open-Meteo is the active cached provider; OpenWeather normalization remains supported. Existing uncommitted automatic-profile/practical-watering changes are preserved and superseded only in the automatic route.

| Files | Audit and planned change |
| --- | --- |
| `localCare.ts`, `automaticProfile.ts`, `practicalWatering.ts` | Automatic advice currently builds speculative reserve scenarios and can recommend water from hot weather. Route automatic execution through qualitative observation rules; retain detailed calculations solely for explicit manual experiments and backend research compatibility. |
| `adapters.ts`, `meteoCare.ts`, `weather/*` | Reuse provider normalization/cache and UTC interval provenance. Past model rows remain estimates, future rows forecasts. No new provider. |
| `firestoreModels.ts`, `lib/logs/*`, `recordDecoders.ts` | Reuse plant logs, timestamps, account transactions and edit/delete/draft flows. Add optional categorical observation and configuration signature; do not interpret legacy numeric moisture as calibrated categories. |
| `outdoorIntelligence.ts`, `outdoorContext.ts` | Pure normalization, qualitative context, observation precedence, independent weather/health rules, bounded learning and stable recommendation aggregation. No network dependencies. |
| `suggestionCards.ts`, Home hook, plant composer | Reuse cards and soil-check composer. Present user-reported moisture, check timing and independent inspections. |
| `services/reminders*`, `ReminderCoordinator.tsx` | Existing preference-aware scheduled routine reminders are independent of weather refresh. Preserve them; use stable condition signatures for any intelligence notification delivery. |
| `__tests__`, documentation | Add behavioral scenario tests, run typecheck/lint/architecture/full tests and emulator checks. |

Firestore: no collection migration. Existing rainReception soil/canopy already express full/partial/sheltered/unknown exposure. Existing careRevision provides invalidation; observation mutations must advance it. Groups share weather retrieval/cache but not logs or decisions. Server snapshots use the existing research/release protocol and are not silently promoted from client output.

Risks: historical API rows are model estimates, old numeric soilMoisture has no trustworthy category calibration, journal reads may fail, timestamps may be date-only, and legacy observations lack configuration provenance. These reduce evidence, never become zero rain or verified dryness. New learning requires configuration-stamped time-precise observations. Numeric rule thresholds are configurable inspection heuristics, not calibrated disease/crop probabilities.

Implementation sequence: normalize/soil decisions → rain/weather → independent health → learning → existing UI/journal integration → tests and documentation. Preserve manual-model tests and research rather than deleting dependent modules.


## Implemented behavior

Automatic client care uses `outdoor-observation-v1` / `observation-rules-v1`. It no longer calls the reserve model, ET0 decision model, automatic profile builder or practical weather-only watering shortcut. These remain reference/manual-experiment code because backend research and existing tests depend on them. There is one automatic decision path.

`outdoorContext.ts` centralizes configurable inspection thresholds, timestamp validation, weather provenance and categorical observation normalization. At least three recent values for temperature, humidity and wind are required to classify drying. A sufficiently sampled local temperature baseline also permits anomaly-based warm classification. Missing fields remain unknown. These cutoffs are product inspection heuristics, not horticultural calibration.

A recent time-precise soil observation wins. Freshness is 24 hours, shortened to 12 in fast drying. A subsequent watering or any known received rainfall invalidates the old category. Date-only records are historical evidence. Conflicting simultaneous reports cannot revive an older report as current. DRY permits conditional watering after reconfirmation; MOIST/WET suppress immediate watering. Without a valid observation the result is a soil-check prompt and `needsWater: null`. Watering/rain can defer a check without asserting soil moisture.

Rain exposure reuses `rainReception.soil`: yes/full, partial/sheltered in part, no/sheltered, unknown/unknown. Light/moderate/heavy are inspection categories using configurable 5/20 mm bands. Provider past rows are explicitly API model estimates, forecasts remain forecasts, and neither creates a journal watering event. Past Open-Meteo rows are relabelled as occurred estimates only after their intervals finish. No new API integration or collection is introduced.

Health rules require six consecutive paired hourly humidity/temperature observations, rather than isolated spikes. Powdery mildew and Botrytis have distinct thresholds and messages. Botrytis inspection additionally distinguishes flowering susceptibility. Repeated uninterrupted WET reports over 24 hours prompt drainage inspection. Weather hazards separately identify heat, cold, heavy rain and strong gusts, with observed-estimate versus forecast explanations. Recent user pest records can prompt follow-up; weather never diagnoses infestation.

The environmental principles are supported by [UC IPM powdery mildew guidance](https://ipm.ucanr.edu/home-and-landscape/powdery-mildew-on-ornamentals/) and [UC IPM Botrytis guidance](https://ipm.ucanr.edu/home-and-landscape/botrytis-blight-or-gray-mold/). They support separating the hazards and inspection language; the exact app thresholds remain configurable heuristics rather than validated disease models.

Learning requires three qualifying transitions in similar drying conditions, precise timestamps, matching plant configuration, and adequate intervening weather. Watering or received rain interrupts a training pair. A median transition time selects BASELINE/EARLIER/LATER, moving inspection timing at most six hours. A recent observation always wins. The configuration signature covers location, pot, planting type, medium, exposure and stage. Legacy records without that signature cannot train the model. Learning is derived on demand from existing logs rather than persisting a duplicate state. Optional useful/too early/too late inspection feedback is stored in the same journal and summarized as evidence; it does not independently override observation-based timing.

Optional log fields: `moistureState` (DRY/MOIST/WET), `moistureConfiguration` (configuration signature), `inspectionFeedback` (useful/too_early/too_late). Existing timestamp, precision, author and journal edit/delete/conflict/draft machinery remain authoritative. Categorical observations advance `careRevision`, including edits/deletions, to invalidate all client advice. Existing numeric `soilMoisture` is preserved and never translated using invented percentage bands.

Recommendation IDs are stable per plant/type/category. Output has priority, action, deterministic reasons, supporting evidence, quality, UTC generation/expiry and active status. Removing a signal removes its derived recommendation; expiry is also enforced by consumers. Client evaluations expire after five minutes. Existing cards display human explanations, not internal reason codes. Home displays a limited set of soil/weather/health prompts; plant advice works without a location when observations are present. Journal soil checks offer three categories plus optional timing feedback.

Native notifications reuse Expo Notifications, account-scoped routing and the existing reminder preference. A persistent per-account signature records meaningful changes; refresh timestamps are excluded. Expired, low-priority and unchanged results do not send. Resolution clears the signature so a later recurrence can notify. Existing scheduled routines remain independent and unchanged. Weather and health notifications require fresh evaluation while open. Planned future soil checks now use the existing native date-trigger system; no background weather fetch worker is introduced. Web continues to show in-app advice only.

## Rollout and limits

No Firebase deployment, collection migration, external writes or new dependencies were required. The existing local-versus-backend execution route is retained; authenticated backend research/release snapshots remain a separate explicit route. Manual advanced experiments still expose their labelled engineering assumptions. Existing research files and user work were retained.

Weather-only care never establishes measured root-zone water. Health outputs are inspection signals, not diagnoses or guarantees of health. Historical weather coverage limits learning, and no learned state survives a configuration mismatch. Notification delivery on an installed physical device still requires device QA; deterministic tests and local emulators do not prove OS delivery.


## Verification completed

`npm run verify` passed backend types/build, application types, zero-warning lint, architecture boundaries, all 120 unit/scenario suites (1,011 tests at that full run), and local Firebase Auth/Firestore integration and ownership checks. Final targeted checks also cover the subsequent humidity-coverage/independence refinements, journal observation invalidation, truthful diagnostics and notification deduplication. Tests do not call live Firebase or weather APIs. Physical-device notification delivery remains unverified.

## Second specification review

See [the full acceptance matrix and corrected gaps](outdoor-spec-compliance.md). The second review added effective inspection scheduling, forecast reconciliation at acquisition time, automatic refresh/expiry, user-confirmed rainfall, reliable notification retries/resolution, backup/CSV compatibility and real saved-timestamp replay against the Firebase emulators. It updates the earlier descriptions of timing and notification rules. Foreground execution and physical-device verification limits still apply.
