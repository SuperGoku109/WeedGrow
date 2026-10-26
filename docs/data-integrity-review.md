# Code and data integrity review — 24 October 2026

All seven accepted work areas and the related defects recorded in [the worklist](data-integrity-worklist.md) are addressed locally. Existing production records were not migrated, no security rules were deployed, and no billing plan or paid service was enabled.

| Area | Implementation |
| --- | --- |
| Runtime data validation | Shared decoders check plant, group, journal, weather, photo and profile reads. Malformed records produce a recoverable error while live stores retain previously valid data. Legacy nullable fields are represented explicitly. Weather responses are checked before caching/parsing. |
| Explicit contracts | Backup/configuration parsing starts with unknown values and validates structure. Form setters preserve the type of each field. Reviewed production services, libraries, features, hooks and UI reject explicit any through ESLint. Tests may use mocks with broader types. |
| Bounded reads and restore writes | Garden inventories use live document-ID pages of 100, with an explicit 5,000-record limit per collection. Changed page boundaries reopen following pages; normal field edits retain those listeners. Export queries are paged, CSV reads omit photos/weather, and restore decodes/writes bounded resumable chunks. |
| Relationship integrity | Deletion markers block new links before reference checks. Transactions validate owned, available profiles and plants. Concurrent linking/deletion is tested. Growing-space writes share environment/location validation. Completed plant deletion can be retried safely. |
| Async lifecycle | Shared resource/task hooks handle loading, refresh, errors, account/input changes, cancellation and obsolete results. Settings tasks, preferences, profile lookups and journal search use these foundations. Account changes discard the old screen's private task state. |
| Shared presentation | Reviewed flows share garden palette/layout tokens and feedback components. Buttons retain handlers and minimum touch size; reduced-motion observation is shared. Unknown garden totals display a dash until loaded. |
| Automatic verification | npm run verify runs types, lint, architecture policy, unit/scenario tests and local Firebase functional/ownership integration checks. The local pre-push hook is installed. An optional self-hosted workflow is supplied; hosted runners are never requested, fork PRs cannot run this job, and remote branch protection has not been configured. |

## Evidence

- The complete verification command passed all stages, including local Auth/Firestore emulator tests. Emulators used demo-weedgrow and shut down afterward.
- After the final weather boundary additions, TypeScript and lint passed again; **56 suites / 264 unit and scenario tests passed**.
- Integration checks cover profile deletion barriers, concurrent linking/deletion, paged JSON/CSV export, interrupted restore/resume, ownership, atomic care operations, edit conflicts and historical weather preservation, including same-day moves and westward repeated dates.
- Browser checks verified four plants and one space, journal loading and filtering (14 loaded entries; four matches for Gia), profile lists/linked lookup, preferences and backup controls. No production data was created or deleted during this walkthrough.
- The app remains available at http://localhost:8081.

## Practical limits

- Backups are capped at **30 MB UTF-8 / 50,000 records** consistently across chooser, validator and export. Encoded JSON is still assembled in memory within that budget; this is bounded processing, not an unlimited streaming export.
- Live garden pages preserve the complete supported inventory rather than implementing a screen that shows only one page. This bounds each query but does not promise a fixed total listener count or lower Firestore charges. Ordinary server/cache behavior still applies.
- Cancellation prevents obsolete publication and stops chunked tasks between operations; a database transaction already committed cannot be undone by cancelling the UI.
- Physical-device GPS, native maps, notifications and real-device performance remain unverified under the user's browser-only testing choice.
- No benchmarked speedup is claimed. Runtime validation covers the supported models and known optional fields; future schema changes must extend those decoders and tests.
- The CI workflow is opt-in and needs an available self-hosted runner. Local checks are enabled now; this does not activate remote CI or enforce a GitHub merge policy.
