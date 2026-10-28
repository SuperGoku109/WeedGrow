# Free-plan reliability improvements

The project remains on Firebase Spark. No paid Cloud Functions, scheduler or reporting service is deployed. A trial Functions deployment was rejected by Firebase's billing prerequisite; the user explicitly chose to remain free. Normal `firebase.json` has no Functions entry, so ordinary deployment cannot enable the optional backend accidentally.

## Weather

`GardenWeatherProvider` mounts once at the app root. Collection therefore works from any route while the app is active and resumes on foregrounding. Existing six-hour freshness, fifteen-minute checks, retry feedback, exact-pin validation and same-day location history are preserved. Background/inactive timer checks skip work. A closed app cannot collect observations under this client-only arrangement; forecasts are not presented as collected historical observations.

Optional `functions/` source implements bounded scheduled collection, leases, resumable inventory traversal and summary rebuilds. It shares the weather parser with the client and has emulator coverage, but requires a separately approved Blaze upgrade and server-side weather secret before it could be used. It is deliberately disconnected from the normal deployment configuration.

## Save and retry feedback

Transport error codes now produce a clear connection message; validation and conflict messages retain their detail. Failed dialogs offer Try again using the same handler and stable mutation identifiers. After ten seconds, dialogs/edit sheets explain that the operation is still pending and ask the user to keep the screen open. No timeout falsely reports failure while a write may still commit. No automatic offline care queue is introduced. Existing drafts and lost-response reconciliation remain authoritative, and success is still shown only after the repository confirms the save.

## Care summaries on Spark

The parent plant can contain the latest watering and fertilizing entries, plus a care revision. All app care writers invalidate that summary and increment the revision atomically: journal creation/edit/date/type changes, undo/deletion, garden watering and restored care-log batches. Summary rebuilding reads the parent revision, queries both care kinds, then commits only if the revision is unchanged; racing edits trigger a bounded retry. Partial cache-only query results never become authoritative summaries.

Matching summaries use the already-shared plant stream and remove per-plant care listeners. Missing/invalidated summaries fall back to the original journal streams while a bounded four-worker rebuild runs. Failed rebuilding never prevents care history from loading and retries on app foregrounding. This adds a small initial read/write cost per invalidation, so it is a listener/memory optimization rather than a promise of lower cost for every workload. Derived summaries/revisions are excluded from backups and rebuilt from restored logs. Older external writers must also invalidate revisions if introduced later.

## Existing-plant picker

The picker uses one FlatList scroll container, rendering eight initial rows with a bounded window. The sheet supports a custom body so a virtualized list is not nested inside its ScrollView. Search, cross-garden source labels, selections, conflict baselines, capacity checks, saving locks, pinned confirmation and discard protection are retained. Selection changes reach rows through extraData.

## Production diagnostics

Release JS errors and unhandled rejections are captured; the original native JS error handler is still invoked. Render failures have a recoverable boundary. Known save failures and logger errors can reach the same channel. Development reporting is disabled.

Only enumerated operation/code/severity, platform, app version, UTC day/count and server timestamp may be stored. Raw messages, stacks, route/plant identifiers, notes, photos and coordinates are never sent. Each account has one diagnostic document; rules enforce ownership, the schema, counter increments and a maximum of twenty reports per UTC day. Client session deduplication also caps submissions at ten. This is intentionally minimal JS diagnostics, not native C++ crash reporting or a full stack-trace service. Reporting failures do not affect the user operation.

## Verification and deployment

`npm run verify` builds/typechecks the optional backend, typechecks/lints the app, checks architectural boundaries, runs unit/scenario tests and executes disposable Auth/Firestore emulator integrations. Integration coverage includes revision-matched client summaries and undo, ownership and diagnostic-content/quota restrictions, optional scheduled weather freshness, pin races and history preservation, plus existing watering/restore/photo/harvest flows.

Firestore rules were successfully deployed to `weed-grow` on 28 October 2026. No live plant/log records were deleted during verification.

## Phone testing

Maestro 2.12.0 is installed locally from its official release. `.maestro/plant-editor.yaml` and `android-back.yaml` pass Maestro syntax validation. They exercise keyboard editing, unsaved changes, cancellation, Android Back, deletion cancellation and Photos navigation without saving/deleting a plant. They expect an installed native app signed into an accessible account. The PowerShell runner disables Maestro analytics and writes local JUnit output:

```powershell
./scripts/test-phone.ps1 -PlantId <accessible-plant-id>
```

A device must appear as `device` in `adb devices`; accept the USB debugging prompt on the phone. Device test execution and screenshots must be recorded separately from syntax checks. Use a disposable account for write/retry/airplane-mode tests. Large system text and native photo-permission flows still require real-device checks; never count browser resizing as those tests.

## Completed verification on 28 October 2026

- App TypeScript and full ESLint passed; architecture checks passed.
- Final unit/scenario run: 87 suites, 405 tests passed.
- Local Auth/Firestore integrations passed, including summary rebuild/undo and diagnostics ownership, extra-content rejection, daily cap and protection against deleting the quota record.
- Optional backend build and typecheck passed, with scheduled collection tested only against disposable emulators.
- Android universal debug build succeeded (`app:assembleDebug`, all configured ABIs). Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`. The SDK was supplied through the process-local ANDROID_HOME setting; no persistent system settings were changed.
- Both Maestro flow files passed syntax validation. No physical-phone run is claimed: `adb devices -l` still listed no connected devices at the final check.
- Web review at 390 px verified picker search/selection layout, pinned confirmation, close/discard cancellation and checked-state accessibility. Selections were cleared without moving plants. The app was returned to Home and left running on port 8081.

Diagnostics are best-effort JS reporting. In particular, a fatal process shutdown can prevent an asynchronous report from arriving. Native process crashes, large system text and OS permission/picker interactions remain real-device verification items.
