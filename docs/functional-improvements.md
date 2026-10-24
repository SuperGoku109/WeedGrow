# Functional improvements — 20 October 2026
Latest completion: see [functional reliability improvements](functional-reliability.md) for the approved 14-item follow-up. Older atomic restore limits below describe the earlier implementation.


## Delivered scope

| Requested item | Implementation |
| --- | --- |
| Accounts and legacy garden | Email/Password enabled in the live Firebase project. Owner rules published. Four legacy plants, Home group, and two profiles linked to the verified account with user approval. Group membership reconciled. |
| Garden refresh and weather independence | One shared live plant subscription per account; visible updates, pull refresh, retry, status filters. Optional weather no longer blocks garden loading. |
| Group watering and duplicates | Deterministic daily watering IDs, legacy-history checks, owned transactions, atomic group commits, already-recorded/inactive skips and result counts. |
| Journal corrections and undo | Manual entries can be edited, dated and deleted with confirmation. Quick watering offers mutation-checked undo in garden and group views. |
| Care-plan editor | Duplicate feeding field removed and choices reconciled. |
| Reminders and daily checklist | Water/feed tasks from routines and recent history, local snooze, completion logging, installed-device notification scheduling and tap navigation. |
| Care reliability | Weather unit boundary corrected in scenario fixtures; stale weather lowers displayed confidence; low-confidence rain evidence no longer reports high confidence. Mildew presentation avoids double-counting assessed risks. |
| Membership consistency | Creating, moving, removing and deleting spaces updates both sides atomically. Plant deletion detaches memberships and blocks new child writes during cleanup. |
| Photos | Caption editing, cover selection, confirmed deletion, unused image-byte reclamation, dated side-by-side comparison, paged loading and retry. Upload IDs remain stable across retries. |
| Measurements | Optional water ml, nutrient ml/L, pH, height cm and moisture percent with numerical validation and journal display. |
| Journal search | Plant and garden-wide date/category/text search with bounded paged reads and explicit loaded-result scope. |
| Offline drafts | Account/plant-scoped journal drafts survive form dismissal; stable request IDs, serialized local writes, explicit storage errors. New writes require a live connection instead of silently claiming sync success. |
| Harvest and archive | Date, optional gram weight and notes save with harvested status atomically. Archive/restore keeps history and removes inactive plants from care tasks. |
| Export and restore | JSON backup with compact photo bytes, CSV journal export with formula escaping, validated additive restore, safe reference/owner remapping and stable restore plans for retries. |
| Settings | Supported account, checklist, journal, profiles, default environment, device reminders and export/restore controls replace inactive text labels. |

## Deliberate limits

- No billing plan upgrade or paid backend has been enabled. Existing service quotas still apply.
- Atomic group watering supports up to 8 members. Larger spaces receive a clear error and can use individual records. Growing spaces themselves support up to 80 plants.
- Restore validates at most 400 documents / 8 plants / 30 MB in one atomic operation. Existing garden records are never overwritten. Selecting the same backup for a new restore creates another set of copies; retrying the same prepared restore does not.
- Gallery pages contain 20 images. Journal queries read 50 entries per plant search or 25 per plant per garden-wide page. Search explicitly reports its loaded scope.
- Native reminders schedule up to 50 upcoming checks over 30 days and refresh when the app is opened or care changes. They are local device reminders, not paid remote push. Browser users get the checklist. Device preferences and snoozes are local to the account on that device.
- Old Android cache-file photo paths have no image bytes in Firebase. The new gallery cannot recover originals that were never uploaded; select those images again. Such unavailable cover paths are omitted from portable backups.
- Installed mobile apps must be rebuilt for the new native dependencies. Physical-device notification delivery, permission recovery, camera/photo picking and restart behavior still require device QA; those have not been certified here.

## Verification

- TypeScript, full lint and all Jest tests.
- `node scripts/test-plant-ownership.mjs`: actual emulator ownership rules, actor spoofing, signed-out access, oversized images and atomic save rejection.
- `node scripts/test-functional-workflows.cjs`: actual repositories against Auth/Firestore emulators, competing watering transactions, date corrections, exact undo, 8-plant group watering/retry, membership moves/deletion, backup restore/retry, caption/cover/image cleanup and harvest retry.
- Chrome against isolated local emulators: sign-in, plant list, quick watering/undo, journal draft recovery, structured entry save and date correction, delete confirmation, care checklist/snooze, functional settings and backup download.
- Live project: account sign-in, private rule publication, required query indexes, image-byte indexing exemption, approved ownership migration and Home membership save.

Metro isolates emulator and cloud bundle caches to prevent backend configuration leaking between simultaneous local previews.

## Follow-up completeness audit — 20 October 2026

Reviewed every delivered-scope row above against its implementation. The table groups related requests; implementation is present for every row. Installed-device verification remains outstanding and is not counted as completed testing.

The audit found and fixed these additional gaps:

- Refreshing the checklist now reconnects failed care-history listeners, clears recovered errors, and ignores callbacks from retired subscriptions. A regression test simulates a listener failure and successful retry.
- A successful harvest starts a fresh request for a later harvest after restoring a plant. Retrying an unsuccessful request still retains its original ID.
- Plants awaiting deletion cannot be edited, restored or added to growing spaces while cleanup is unfinished.
- Garden-wide journal pagination now rejects a changed date range until a fresh search runs, matching plant-level search behavior.

Verification after the audit: 17 Jest suites / 174 tests, TypeScript and lint; both Firebase emulator integration scripts. The workflow script additionally checks restoring and harvesting a second time, preserving both harvest records, and rejecting edits and membership changes during pending deletion.

Remaining limits are still those listed above: mobile rebuild and physical-device QA, bounded group watering/restore/search, local-only reminders/preferences, and unavailable legacy photo bytes. These are not certified as unrestricted or device-tested features.


## Location, weather history and care follow-up

The additional requested work (excluding broader place search) is recorded in [functional-follow-up.md](functional-follow-up.md). It adds reusable growing-space locations, opt-in inheritance, movement-safe weather, unsaved-edit guards, measured checklist care, skip/undo, a garden overview and clearer photo progress/comparison. Previous-day weather is never rewritten by refresh; earlier same-day locations are retained. Final verification: 26 suites / 200 tests, type checks, lint, local Firebase integration and browser QA. Physical-device testing remains pending by user choice.
