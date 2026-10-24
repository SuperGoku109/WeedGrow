# Add Plant flow

The five-step flow now supports a resumable local draft, explicit growth stage,
separate strain name/type, known or estimated start dates, owned growing spaces,
town lookup, recent care records, prepared photos and a compact editable review.

## Data and save guarantees

- `createdAt` is when the record was added. `startedOn` is a local calendar date;
  `ageEstimated` distinguishes an estimate from a known date. `ageDays` remains a
  compatible snapshot, while new plant details calculate age from `startedOn`.
- Initial watering and feeding are only logged for dates explicitly entered.
- Cover and first gallery photo share one photo reference; no duplicate image
  bytes are written. Plant, photo assets, history and group membership commit in
  one transaction. The retry ID is retained in the draft across restarts.
- Draft photos are portable, compressed JPEGs. Object URLs are never persisted.
  Device drafts follow a user who signs in during that flow; account drafts are
  isolated and are not copied into a different account. No password is stored in
  a draft. Draft failure is shown instead of falsely claiming a successful save.
- Cloud queries use the signed-in UID. No new writes use `demoUser`. Existing
  demo records are never automatically claimed by whoever registers first.
- Rules restrict plants, logs, photos, spaces and sensor profiles to their owner,
  and cap photo payloads. The photo-byte field is exempted from indexing.

## Production activation (no billing upgrade required by these changes)

1. In Firebase Authentication, initialize Authentication and enable Email/Password.
   Confirm the intended domains and password policy in the Firebase console.
2. Sign in to the app or create a real account. New plants belong to that UID.
3. If retaining legacy demo data, an administrator runs
   `node scripts/migrate-legacy-garden.mjs --owner VERIFIED_UID` with Application
   Default Credentials for the intended project. This is a dry run. Check the
   identity and counts, then append `--apply`. Add
   `--include-unowned-profiles` only after confirming those profiles belong to
   that same garden. Never put admin credentials in the app or repository.
4. Deploy the reviewed rules and index configuration:
   `firebase deploy --only firestore --project weed-grow`.
   The CLI must have a valid authorized sign-in. Coordinate this deployment with
   the updated app: old clients using shared placeholder IDs will be rejected.

Do not substitute permissive public rules if sign-in or a migration is missing.
These changes do not activate Blaze, billing, SMS authentication, push reminders
or a paid photo service. Existing Firestore and weather-provider quotas apply.

## Local verification

Run `firebase emulators:start --only auth,firestore --project demo-weedgrow`.
In a second terminal, set `USE_FIREBASE_EMULATORS=true`,
`FIREBASE_PROJECT_ID=demo-weedgrow`, and `FIREBASE_API_KEY=demo-api-key`, then run
the Expo web app on a separate port. Other required Firebase config values may
remain set; the explicit emulator flag redirects only Auth and Firestore.
Do not point a development client on a physical device at `127.0.0.1`; use your
development machine's LAN address for the emulator host settings instead.

`node scripts/test-plant-ownership.mjs` checks real emulator rules, including
cross-user denial, actor spoofing, oversized images, atomic writes and signed-out
access. It always connects to local services for `demo-weedgrow`.

Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` for source
verification. Browser checks cover draft resume, validation reveal/focus, photo
recovery, town lookup and review editing. Chrome now also verifies sign-in and
journal saves against local emulators. The in-app browser still blocks the local
Auth emulator endpoint. Local integration tests independently exercise account
creation, ownership rules and atomic creation with space membership. Native
camera, permissions and device restart behavior still require device QA before
a native release; new native dependencies require rebuilding the native app.

The 20 October functional improvements and live activation are documented in
[functional-improvements.md](functional-improvements.md).
