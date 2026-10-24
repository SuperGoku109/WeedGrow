# Functional follow-up — 20 October 2026
Current status: the later [14-item reliability completion](functional-reliability.md) supersedes this report’s restore limits and device-local snooze behavior.


Scope: implement items 2–12 from the follow-up list. Item 1 (broader place search) is explicitly excluded. The user requires historical weather to stay unchanged when a plant physically moves, and selected browser checks only for mobile verification. No billing upgrades or new paid services are authorised.

## Implemented

2. Named reusable locations use the existing owned growing-space records. More → Garden locations creates named spaces with pins and edits existing ones. The plant picker can copy any saved location. No duplicate address-book collection or new public database access is required.
3. Plants have an explicit `locationMode`: follow their growing space or use a custom pin. New plants selected into a space default to following it. Existing plants retain their own location unless the user opts in. Space edits atomically update followers, while custom overrides remain unchanged. Detaching a plant preserves its current pin as a custom location.
4. Effective location changes increment a revision. Weather responses carry their requested coordinates/revision; a transaction rejects old responses after a move. The writer filters out all dates before the app's current local date. When today's location changes, earlier same-day conditions are retained in `previousLocations` on that day's record. Current/future display and advice reject mismatched-location entries. Historical dates continue to display their saved conditions. No location edit deletes historical weather.
5. Plant weather displays update time, freshness and errors, with a refresh action. Historical dates have no refresh action. Network requests have a bounded deadline and concurrent requests for identical coordinates share one provider call.
6. The picker has a larger-map modal, recenter action, exact coordinates, and explicit Done action. The parent form still must be saved to persist a change.
7. Unsaved plant section/full/modal edits, photo drafts/captions, growing-space edits and saved-location creation receive discard protection. Browser refresh/tab-close and navigation removal are protected while dirty. Successful saves exit without asking to discard saved data.
8. Completing checklist care accepts water ml or nutrient ml/L, measured pH and notes, using the existing journal validation and stable retry IDs.
9. Skip today is a separate owned transaction and note; it does not log watering/feeding or reset the routine. Undo skip removes that decision. Snooze remains a device-local deferral. Reminder dates respect skipped days and custom weekdays. Snooze writes are serialized to avoid losing concurrent updates.
10. Garden overview shows due care checks, recorded care, important setup gaps and bounded recent activity with links to plant details/checklist/journal. Incomplete history does not show a misleading zero due count.
11. Photo uploads report real preparation/save stages, preserve retry IDs for unchanged attempts, and expose retry after failure. Dated comparisons stack on small screens, show clear labels and can be ended explicitly. Photo form/caption edits are protected on dismissal.
12. Physical-device QA is intentionally pending per the user's choice. Browser verification includes the map at phone width, the larger-map controls, saved-location screens, discard protection, checklist measurements and skip/undo.

Saved weather history is now included in new JSON backups, including earlier same-day locations. Old backups without weather remain valid. Existing atomic restore limits (400 records / 8 plants) remain; exports exceeding the record limit keep all data and clearly warn that the current restore UI cannot import that complete archive.

## Validation status

- Local Firebase workflow script passes movement and inheritance checks: yesterday's stored document remains exactly unchanged, earlier same-day weather is retained, stale in-flight responses are rejected, custom overrides do not move with a space, and skipping produces no watering entry.
- Final checks: 26 Jest suites / 200 tests, TypeScript and lint all pass. Both local Firebase integration scripts pass.
- Browser QA on a disposable local account: skip/undo, watering 250 ml with pH 6.2, rejected pH 15 with values retained, corrected feeding 1.5 ml/L with pH 6.4, next-due dates and exactly one record per care action. Database reads independently verified the saved measurements.
- Live browser QA: weather update status, saved Home location editing without saving test changes, larger map, discard confirmation and garden overview. At 390 × 844, the page remains 390 pixels wide; the large map and Done action stay in bounds. Normal viewport restored after testing.
- Live test locations and care records are not fabricated. Browser form changes used for QA are discarded.
