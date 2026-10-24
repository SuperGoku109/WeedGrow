# Functional reliability improvements — 24 October 2026

This completes the 14-item review approved with “do all of them.” Broader place-search coverage remains excluded. No billing plan, payment method, authentication provider or public database access was changed.

| Item | Result |
| --- | --- |
| 1. Larger backup restores | Files are validated before writes, then restored in small transactions bounded by document count, size and parent access. Restore destinations persist per account and file on this device. Selecting the same file resumes those copies; existing garden records are never overwritten. The preview shows plant/record counts and reports progress. |
| 2. Conflicting edits | Plant and growing-space editors compare their original values with current values inside the saving transaction. Conflicting fields are rejected with an explanation; unrelated updates can merge. Recovered drafts retain their original comparison baseline. |
| 3. Save during location detection | Both new saved locations and the growing-space editor block saving while GPS is pending. Cancelling location detection lets the existing pin be saved deliberately. |
| 4. Photo retries | A selected image keeps its request identity when its caption changes. A retry reconciles the existing photo and journal caption instead of creating duplicate image assets. |
| 5. Recover unfinished edits | Plant section/full/legacy editors and new photo drafts save locally, scoped by account, plant and form. Photo drafts contain compact image bytes so recovery survives expired browser blob URLs. Recovery is explicit; successful saves and confirmed discards clear queued draft writes. |
| 6. Movement history | Location changes record dated journal entries with old/new pins, labels and revision, in the same transaction as the move. Details shows recent movements; the journal retains older entries. No historical movements are invented for legacy records. |
| 7. Growing-space move preview | The editor lists followers that will move and plants that retain custom pins before saving the new location. |
| 8. Copy versus follow | Saved-location selection explicitly says “Copy a saved garden pin.” The explanation distinguishes an independent copied pin from following an assigned growing space. |
| 9. Complete forecast refresh | Cache checks examine the requested date instead of assuming a fresh current-day record means every forecast is present. Manual refresh bypasses the provider cache; missing forecast dates have explicit errors. |
| 10. Shared weather requests | Exact-coordinate requests share in-flight network calls and a 30-minute persistent provider cache, bounded to 32 locations. Reuse retains the original fetch time. Each plant still owns its historical snapshots; late older responses cannot replace newer matching snapshots. |
| 11. Recent garden activity | Four recent events per plant are merged and sorted to produce the actual latest four garden events. Multiple events on the same plant can appear. Selecting an event opens its journal date, and Back returns to the Plants overview. |
| 12. Actionable setup gaps | The overview opens a list of all affected active plants. Each missing detail explains its purpose and opens the relevant editor directly. Loading, signed-out and empty gardens have separate states. |
| 13. Synced snoozes | Snoozes are stored on owned plant records and update through live listeners across devices. Legacy local snoozes migrate without replacing an existing cloud decision. Care completion/skip clears the relevant snooze atomically. Notification permissions remain specific to each device. |
| 14. Plant timezone | Weather resolves the location's timezone. Current-day display, care completion, due dates, group watering and reminder occurrences use that timezone, including daylight saving. New journal records retain their calendar day and timezone. Plants without a resolved location zone use the device zone. |

## Historical weather guarantee

Moving a plant or growing space does not update prior-day weather documents. Location revision checks reject responses from before a move. Earlier conditions on a normal same-day move remain attached to that day's history.

A westward move may repeat a date that was already historical at the old location. In that case, current conditions are saved separately under a location/revision snapshot and exposed through the plant's current-weather value. The original date-keyed document stays byte-for-byte unchanged. The weather panel can display other saved locations for the selected day. First-time location assignment does not create an artificial history cutoff.

## Verification

- Final checks pass: TypeScript, lint, 32 Jest suites / 213 tests, both Auth/Firestore integration scripts, and the whitespace/diff check.
- Actual Auth/Firestore emulator workflows cover interrupted restores with more than 400 records and nine plants, repeat/resume without duplicated history, edit conflicts, unrelated edits, synced concurrent snoozes, dated moves, photo saves with lost responses and changed captions, and the repeated-date weather case.
- The ownership/security script verifies private reads/writes and blocks foreign access, actor spoofing, oversized photos, unsigned requests and partial writes.
- Browser checks cover current weather, the full setup-gap list, direct editor links, draft recovery in another tab, map movement previews and discarding temporary test values. At 390 × 844 the setup page has no horizontal overflow, and the editor's Save action remains inside the viewport after its opening animation. The normal viewport is restored afterward.
- Physical-device GPS and notification delivery remain untested, as requested by “Browser checks for now.”

## Practical limits

Restore accepts up to 100 MB / 50,000 records. It adds copies in resumable steps, so partial copies can be visible before completion. Keep the backup file and resume using the same account and browser/device; clearing local app data loses the saved destination mapping. Restore does not undo or overwrite the original garden. Backups include weather snapshots and movement history; device preferences and local form drafts are excluded.

Drafts remain on the device where they were written. Snoozes sync through Firebase, while scheduled notification permission and delivery still belong to each installed device. No new paid service or billing upgrade is required by these changes.
