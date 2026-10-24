# Loading, data and module-boundary review — 24 October 2026

This is a focused follow-up to the design-consistency review. It changes the existing app; no new service, paid dependency, billing setting, production migration or security-rule deployment is involved.

## Completed

### Shared validation at the write boundary

`lib/plants/plantValidation.ts` holds the shared core policies for names, enums, age, height, pH and coordinates. Add-plant validation and both edit flows use those policies. `updatePlant` also enforces them before starting a database transaction, so another caller cannot bypass the UI checks. Validation errors retain their field mapping. Only supplied fields are checked, preserving the ability to repair legacy data through unrelated edits. Flow-specific validation, such as reminder schedules and start dates, remains in the appropriate flow.

### Explicit activity calendar days

New setup watering/feeding entries record the selected `calendarDay`. Harvest records now save their calendar day, known plant timezone and a timestamp resolved in that timezone; future-date validation uses the plant's current timezone inside the transaction. The harvest form uses the same local-day rule. Calendar-day validity is shared across journal validation, range queries and age calculations. Existing activities and weather history are not rewritten.

### Bounded and resumable cleanup

`lib/data/deleteCollectionInBatches.ts` queries at most 50 child documents per page and commits each page before requesting another. It re-queries the first remaining page, avoiding cursors over deleted documents. Plant deletion uses it for all four child collections after setting the existing deletion tombstone. An interrupted cleanup can resume; the parent is removed only after child cleanup succeeds. This bounds per-page memory, including stored image data, rather than loading every child record first.

### Shared, account-scoped journal readers

Journal/weather queries are in `services/plantJournalData.ts`; the hook adapts them to the UI. The shared live-store infrastructure provides reference-counted subscriptions, a short navigation grace period, account-change cleanup and rejection of obsolete callbacks. Account, plant, date range and timezone are part of the key. Switching keys cannot render a previous range's data. Failed readers can be retried independently, preserving loaded data; synchronous connection-start failures also produce retryable errors.

### More informative loading

The reusable `ui/LoadingState.tsx` provides stable placeholders, a loading label and a connection hint after eight seconds. Plant loading also offers an exit back to the garden. Plant and growing-space initial loading share this component; there is no artificial minimum loading delay or perpetual shimmer. Journal counts distinguish pending/unavailable data from actual zero entries. Existing journal entries remain visible during refresh/retry, and calendar Today markers follow the plant's day. Read failures have a working retry control.

## Verification

- 47 Jest suites passed: 243 tests. New coverage includes shared validation, timezone-aware harvests, idempotent harvest retries, interruption/resumption across cleanup pages, shared journal readers, account/range isolation and synchronous stream-start failures.
- TypeScript and lint passed.
- Local Firebase workflow checks passed, including invalid-edit rejection, explicit harvest dates, cleanup across 121 child records, cleanup resumption and all existing historical-weather/membership/care consistency checks.
- Ownership/security checks passed against the local Firebase emulator.
- Browser checks covered plant navigation, Today, Journal, changing calendar weeks and returning to Today; no console errors appeared in the inspected session.
- Existing production care records were not created, deleted or edited for testing. Ordinary current-weather reads/refresh behavior remains active in the app.

## Remaining scope

This does not claim complete validation centralization or large-garden scalability. Full garden subscriptions, backup/export memory bounds, older calendar implementations and repeated theme values still warrant separate work. Native GPS and notification delivery still need physical-device verification, as previously agreed. No measured latency percentage is claimed.
