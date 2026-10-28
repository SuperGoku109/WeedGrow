# Code review and hardening — 28 October 2026

## Scope

Reviewed the recent Home cards and plant-editor changes alongside plant/garden lists, membership management, the gallery loader, shared discard/dialog controls, live data stores, session/account boundaries, plant mutations, lifecycle operations, and the existing architecture and integration checks. This is a focused source and regression review, not a claim that every screen or dependency has been exhaustively audited.

## Changes

- Cancelled discard prompts now clear their pending navigation callback. A later confirmed deletion cannot unexpectedly resume an earlier cancelled close. Repeated successful completions work even when removal is already allowed. Failed destructive operations restore unsaved-change protection.
- Plant editor mutation coordination moved into `usePlantEditorMutations`. The form owns fields and presentation, pure builders own validation/update construction, and existing services own persistence. The hook accepts only the draft and navigation operations it needs, preserves conflict baselines and cleanup, and serializes save/delete calls with one lock. This supports single responsibility and interface segregation without adding class hierarchies or an additional repository abstraction.
- Form field definitions and their key index are memoized, replacing repeated array construction and linear lookups while typing.
- Plant cards store only their actual 80/88 px photo-size breakpoint, rather than updating state for every measured width change. Square photos, layout and controls are preserved.
- Search text is normalized once per render in Home, Manage plants and the existing-plant picker, rather than once per plant.
- Gallery pagination requests are invalidated on unmount, including when Photos was reopened from its short-lived cache. Existing lazy loading, cache lifetime, ordering and deduplication remain unchanged.
- Synchronously thrown live-reader decode/limit errors retain their actionable message instead of losing it to the generic connection-error fallback.

No schema, rules, data migration, dependency, visible design or feature changes were introduced by this review. Improvements reduce avoidable work; no device speedup percentage is claimed because this pass did not include release-device profiling.

## Verification

- TypeScript: passed.
- Repository-wide ESLint: passed; new mutation tests also linted afterward.
- Architecture policy: passed (UI/query, hook/query, service/presentation and domain/I/O boundaries).
- Unit/scenario tests: 83 suites / 397 tests passed.
- Local Firebase Auth/Firestore integration and ownership tests: passed using the isolated `demo-weedgrow` emulators, with no production data writes. Coverage includes concurrent/retried watering, membership moves, plant deletion barriers, profile integrity, journal corrections/undo, backup/restore, photos, harvest, weather history and unauthorized access.
- Added regressions for stale cancelled callbacks, repeated completions, restored discard protection, save/delete contention, validation-before-write, conflict baselines, save retry/draft retention and synchronous decode errors.

## Production confidence

The checked paths retain their established behavior and pass the available automated gates. Final production sign-off still needs release builds on supported phones and performance measurements on those devices; automated source checks cannot establish frame rate, memory behavior, or device-specific interaction quality. Existing collection limits, garden capacities and weather refresh behavior were intentionally preserved.
