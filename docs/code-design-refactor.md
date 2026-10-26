# Code-design refactor — 24 October 2026

The nine areas discussed with the user have been addressed in the current plant, journal, care and profile flows. This is an incremental refactor, preserving existing database records and interfaces where needed. There is no billing change, new external service, production data migration or security-rule deployment.

| Area | Concrete result |
| --- | --- |
| Separate calculations from fetching | `wateringEngine.ts` calculates from explicit plant, date, settings and history inputs. `wateringSuggestions.ts` retains fetching, weather enrichment, bounded concurrency and cancellation. The heuristic's existing scenario tests still pass. |
| Strengthen stored models | Models use the client Firestore `Timestamp` type, declare the nulls actually stored, and include deletion/harvest fields. Photo metadata has a shared domain type. Removed broad `any` casts in the active full editor, plant card and watering engine. |
| Share rules and normalization | `plantRules.ts` centralizes setup cleanup, start-date limits and reminder validity. Create and edit paths share setup rules; the update transaction validates dates against the plant's day and checks the normalized fields for edit conflicts. |
| Split screen responsibilities | Full-editor conversion/validation lives in `editPlantForm.ts`; section schema/conversion lives in `plantSectionForm.ts`. Screens retain interaction, draft recovery, saving feedback and presentation. Missing legacy strain types become explicitly unknown in the section editor. |
| Standardize async states | Live snapshots use a discriminated `status`: idle, loading, refreshing, ready or error, with matching loading/error types. The common `useLiveResource` adapter powers garden, plant, journal and movement readers. A missing plant is distinct from a read failure. Compatibility loading/error properties remain for existing presentation code. |
| Centralize queries | No screen/component or reviewed subscription hook imports the database connection or Firestore directly. Journal search, photo pagination, plant documents, movement/weather history, care activity and sensor profiles expose typed repository/service APIs. Snooze subscriptions moved out of the mutation service. |
| Audit related writes/retries | Photo caption changes now update the matching photo journal entry atomically and change its mutation identifier, blocking stale journal edits. Repeating caption, cover or completed deletion operations is safe. Upload retries update the parent change marker. New sensor profiles use a stable ID and a create transaction; a lost-response retry cannot duplicate or overwrite a committed profile. Existing atomic care/membership/weather safeguards remain. |
| Consolidate old implementations | Removed the unused alternate edit modal, calendar components, calendar forms and old photo/activity/watering/calendar hooks. The old `/plant/LogHistoryCalendar` URL redirects to the maintained plant journal, preserving the plant ID. |
| Enforce boundaries | ESLint rejects direct database imports in UI/hooks, presentation imports in data modules and I/O imports in the extracted domain/form modules. `npm run check:architecture` checks both forbidden imports and an allowed repository import in memory. |

## Validation

- **50 Jest suites / 250 tests passed.** New tests cover calculation determinism/non-mutation, form conversion, setup/reminder rules, async-state transitions and photo pagination/deduplication. Existing advice scenarios remain unchanged.
- **TypeScript, lint and architecture checks passed.**
- **Local Firebase workflow and ownership checks passed.** Added assertions cover stable profile creation retries, profile measurement bounds, atomic caption/journal synchronization, mutation IDs and repeated photo deletion. Existing tests cover care/membership transactions, restore retries and historical-weather protection.
- **Browser checks passed:** clean garden reload, legacy calendar redirect into Journal, full editor and section editor hydration/cancel, Details/movement loading and profile listing. A location-picker empty-string rendering warning discovered during this pass was corrected. No production plants/profiles/care entries were edited for testing.
- The app remains running on port 8081. Local Firebase emulators were used only for disposable tests and stopped afterward.

## Practical limits

This does not claim that every older cast, duplicate style, asynchronous hook or possible concurrency edge case has been eliminated. The strict states and boundaries now provide a foundation for continued work. Large-garden pagination/aggregation, bounded backup/export processing, broader runtime decoding of legacy data and physical-device checks remain separate tasks. No latency percentage or guarantee about future service quotas is claimed. Historical weather was not rewritten.
