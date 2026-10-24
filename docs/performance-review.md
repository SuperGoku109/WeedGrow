# Functional and performance review — 24 October 2026

The app remains available at http://localhost:8081. This review improves the existing Firebase/Expo design without adding a service, changing billing, migrating production records, or changing security rules.

## Completed improvements

- Shared account-scoped plant/group streams replace duplicate subscriptions across the garden, groups, saved locations and care screens. Group membership is derived from the owned garden instead of fetching every member separately.
- Authentication uses one shared observer. Account changes clear private live data and photo caches; generation guards discard late results from the previous account or request.
- Latest watering/feeding and recent activity streams are shared by identical consumers. Watering badges follow actual journal changes, including edits and undo. Group summaries count watering recorded today rather than the old stored water level.
- Navigation retains streams for a 1.5-second grace period, then releases unused streams and data. Successful writes rely on live updates instead of restarting the whole garden query. Failed listeners have explicit retry paths.
- Advice loads journal and weather ranges with two parallel queries. An eight-day window previously used nine SDK query/document calls; it now uses two. This measures API-call count, not billable document reads or end-to-end latency. Ranges are capped at 90 inclusive days.
- Advice evaluates at most two plants concurrently. Cancellation prevents obsolete results and stops queued work. Relevant plant settings, watering changes, local day changes and explicit refresh trigger evaluation; notes and minute ticks do not. No recurring database polling was added. Stale weather does not produce urgent watering cards.
- Hidden tabs stop unnecessary advice/activity work. Progress-photo metadata loads when Photos opens, deduplicates pages and retains the current page for 60 seconds between tab switches. Today loads its current journal window instead of the entire calendar window.
- Plant/group records preserve object identity when unchanged, filtered lists are memoized, and timezone formatters use a bounded 32-entry cache.
- Quick-water actions use synchronous per-plant locks to prevent duplicate taps. Care actions wait for history, with loading/error feedback. Read failures offer retry instead of incorrectly reporting a missing plant/group.
- Returning to Plants and reloading preserve the selected tab. Cached garden content remains visible during refresh.

## Verification

- TypeScript and lint passed.
- All 42 Jest suites passed: 228 tests, including shared-stream lifecycle, account isolation, lazy photo loading, bounded concurrency, two-query range reads, advice refresh triggers and timezone formatting.
- Local Firebase emulator workflow and ownership checks passed. The workflow check exercises the real range-query implementation and verifies it does not alter saved historical weather. Emulators were stopped after verification.
- Browser checks passed for the four-plant garden, plant filtering, group loading, detail navigation, Today weather, photo loading/tab retention, care checklist and returning to Plants. The final check caught an empty-string rendering warning in the plant list; its conditional rendering was corrected and no new errors appeared on the subsequent check.
- Production care records were not created or deleted for testing. Existing historical weather protection remains in place; moving a plant does not rewrite previous days.

## Limits

No percentage speed claim is made: this review verifies reduced repeated work and query counts rather than a controlled latency benchmark. Physical-device GPS, notification delivery and native interaction checks remain pending; the user requested browser checks for now. Large-garden pagination/aggregation is a separate future scalability change, not claimed complete by this review.
