# Backend assessment — 6 November 2026

Follow-up: see [the deeper 500-person pre-release assessment](prerelease-free-backend-research-2026-11-06.md) for the recommended split photo/backend stack, weather budgets and updated Neon comparison. This initial report remains a code-audit reference.

Scope: analysis of the existing app and replacement options, not a migration or deployment. Assumptions supplied by the owner: a billing card is acceptable, and the target is up to 500 active users in the next year. Pricing below is in USD and was checked against official sources on this date. Capacity examples are assumptions, not measurements of the live dataset.

## Recommendation

**PostgreSQL is the best long-term data model for this app; Supabase is my preferred managed replacement.** The app has interconnected gardens, plants, journal events, photos, location history and reproducible care decisions. Foreign keys, transactions and explicit historical revisions fit these relationships well. Keep structured provider payloads in JSONB or immutable object storage where appropriate, rather than forcing every weather response into relational columns.

However, **a migration is not necessary just to unlock background care processing**. Firebase Blaze is a credible, much smaller immediate step now that a billing card is acceptable. It retains no-cost allowances, but functions and their supporting infrastructure can incur charges; this is not a guarantee of a zero bill. Compare measured Firebase costs with a Supabase prototype before committing to a rewrite. [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

A new backend will not supply missing weather intervals or validate the hops watering parameters. Those remain data and algorithm configuration concerns on every platform.

## How the current backend actually works

| Area | Current implementation | Consequence for a replacement |
| --- | --- | --- |
| Client | Expo / React Native and web call Firebase SDKs directly across dozens of source files | This is an adapter and subscription migration, not a connection-string change |
| Accounts | Firebase email/password auth, password reset, native session persistence | Preserve stable user identity and existing ownership; authentication can migrate separately |
| Data | Firestore plants, groups/gardens, sensor profiles and per-plant subcollections | Relationships currently rely on application transactions and duplicated fields |
| Live updates | Shared in-memory stores and paged Firestore listeners; inventories require server-confirmed completeness | Preserve bounded live views and explicit reconnect/error handling; full offline sync is not currently implemented |
| Writes | Transactions for logs, edits, undo, garden membership, watering and photo metadata | Replace with genuinely atomic operations and retry/idempotency semantics |
| Photos | Base64 JPEG and thumbnail strings in Firestore photoAssets documents | Move binary media into private object storage; retain metadata and access control in the database |
| Weather | Client OpenWeather requests, device-level caching, garden/plant snapshots, backend per-plant care acquisitions | Introduce a server proxy, cross-user quota controls and reusable weather scopes |
| Care | Pure TypeScript calculations plus Firebase orchestration, protected policies, event/setup revisions, histories and checkpoints | Reuse the calculation engine; port persistence, jobs and permissions while preserving evidence |
| Reminders | Expo local notifications scheduled on the device | These can remain local; there is no reason to introduce a push backend just to migrate |
| Backup | User JSON/CSV export and resumable restore for selected collections | Useful for user data, but insufficient as the complete migration backup |

Primary implementation evidence: `services/firebase.ts`, `services/authClient.native.ts`, `services/session.ts`, `firestoreModels.ts`, `lib/data/pagedLiveQuery.ts`, `lib/logs/groupWatering.ts`, `lib/plants/photoRepository.ts`, `lib/weather/fetchWeather.ts`, `functions/src/operations.ts`, `functions/src/careOperations.ts`, `functions/src/careEventLedger.ts`, `functions/src/careStateLedger.ts`, `lib/backup/gardenExport.ts`, and `services/reminders.native.ts`.

The previous deployment inventory found no deployed functions. Firestore rules/indexes were deployed, while functions deployment stopped at Spark/Blaze prerequisites. See `docs/backend-deployment-2026-11-06.md`. Local implementation must not be mistaken for a running production worker.

## Design issues to fix on either provider

1. **Photo bytes are using database capacity.** `photoRepository.ts` writes full images and thumbnails as data URIs. Base64 adds roughly one third to binary size, before document overhead. The current approach gains atomicity with journal writes, so replacing it also requires staged uploads, committed references and orphan cleanup.

2. **Weather is scoped too narrowly for efficient sharing.** Plant care acquisitions live under each plant, even when several plants request the same provider/location/product. A device's 30-minute cache does not coordinate requests across different users or devices. Share eligible source data once, then apply shelter, growth stage, pot and other plant-specific factors separately. Do not merge distinct locations through arbitrary coordinate rounding.

3. **The OpenWeather key is distributed to the client.** `fetchWeather.ts` reads it from Expo configuration and sends requests directly. Move provider calls behind a rate-limited authenticated backend and keep the key server-side. A backend move alone does not change this code path.

4. **The scheduled worker does not refresh every plant every 15 minutes.** The trigger runs at that interval, but maintenance reads at most 100 plants per invocation and advances a cursor. At 500 users with five plants each, 2,500 plants require 25 nonempty pages: over six hours per complete sweep, with possible extra cursor-reset work, failures and execution time. The plants are also processed sequentially. This is a code-level capacity estimate, not an observed production latency. Use a durable due-work queue with bounded parallelism and workload monitoring instead.

5. **Membership has two sources of truth.** A plant has groupId while its group maintains plantIds. Transactions keep them aligned today. A relational foreign key can remove this duplication. Preserve the current effective permissions; an owners array is not automatically equivalent to a single garden owner.

6. **Large operations have product limits.** Gardens currently allow 80 plants, but atomic garden watering supports eight. Changing database does not automatically remove these limits or define how retries, partial failure and undo should behave for larger groups.

7. **The user export excludes protected care evidence.** A migration must explicitly include policies, approved profiles, immutable watering/setup revisions, acquisition evidence, checkpoints and identity mappings. Otherwise historical care results may no longer be reproducible.

## Proposed data model

Use current-state rows for the UI, immutable revisions for care inputs and decisions, and private object storage for bytes. Do not event-source every ordinary setting or store the entire garden as one JSON document.

| Tables / storage | Purpose and important fields |
| --- | --- |
| app_users, auth_identities | Stable internal user IDs; map provider + subject to that ID. Existing Firebase UIDs are strings and must not be blindly cast to UUIDs |
| gardens, plants | Plant belongs to at most one current garden through garden_id. Preserve plant access rules; add membership tables where actual shared access requires them |
| plant_setup_revisions, plant_location_history | Effective time, recorded/available time, location revision, growing medium, pot size and other algorithm inputs; moving a plant does not rewrite its earlier exposure |
| journal_entries, journal_entry_revisions | Current view plus immutable edits/deletions. Keep event time separate from recording time, timezone/calendar day, units, uncertainty and mutation ID |
| watering_operations | Idempotent operation ID and affected plants; retries cannot duplicate completed watering. Preserve separate genuine watering events |
| photos + private objects | Owner, plant/log references, object and thumbnail keys, checksum, MIME type and upload status. No base64 image columns |
| weather_scopes, weather_acquisitions | Requested coordinates, provider/product/model, returned grid metadata, issued/retrieved/available times, source hash and immutable raw-response reference |
| weather_intervals | Canonical time intervals and typed measurements with units, quality, actual/forecast kind and source revision. Index by scope and time; retain independent missingness for each measurement |
| care_profiles, profile_approvals | Versioned, protected configuration and approval evidence. Clients cannot approve a profile or overwrite algorithm outputs |
| care_evaluations, care_current | Frozen decision and input fingerprint, engine/profile versions, reasons, diagnostic codes, evaluated/expires times; current pointer supports efficient UI subscriptions |
| care_checkpoints | Water-balance state with dependency lineage, invalidated when earlier relevant inputs change |
| jobs, outbox, provider_usage | Next-due work, leases, retries, mutation-triggered invalidation, provider budgets and durable processing |

Care should expose an explicit decision such as water_needed, water_not_needed or insufficient_data, alongside the reason and the evidence. Missing rainfall is not zero rainfall. A forecast is not an observation. Save time in UTC while retaining the original local calendar day/timezone where user records depend on it.

On Supabase, enforce owner access with row-level security and run sensitive multi-row writes through authorized SQL functions/transactions. Keep service credentials on the server. Subscribe the app to current plant/care views rather than the entire weather history. Constrain quantities and units, index actual screen queries and use retention policies for bulky source archives without discarding evidence still needed for replay.

## Managed alternatives with useful free tiers

### 1. Supabase — preferred replacement

PostgreSQL, auth, private storage, realtime and scheduled work suit the proposed model. The free allowance includes **500 MB database, 1 GB file storage, 50,000 monthly active users and 5 GB egress plus 5 GB cached egress**. Free projects pause after one week of inactivity; Pro starts at **$25/month**. These are evaluation/startup allowances, not a promise that the entire public app stays free. [Pricing](https://supabase.com/pricing)

Cron can schedule database work or HTTP calls to Edge Functions. Care jobs must be split and benchmarked: Edge Functions have a **2-second CPU limit per request**, distinct from the longer wall-clock duration. [Cron](https://supabase.com/docs/guides/cron), [function limits](https://supabase.com/docs/guides/functions/limits)

For public email signup/reset using Supabase Auth, configure custom SMTP; its default email sender is restricted to team addresses and currently two messages/hour. Alternatively, retain Firebase Auth during an incremental migration through the supported integration. Ownership policies must handle Firebase's string subjects correctly. [Email requirements](https://supabase.com/docs/guides/auth/auth-smtp), [Firebase Auth integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth)

Main tradeoff: SQL schema, policies, transaction endpoints and subscriptions must be implemented. Regional latency and job runtime need measurement before selection. PostgreSQL reduces database lock-in, though Supabase-specific services still have integration costs.

### 2. Convex — strongest TypeScript/realtime alternative

Good fit if productive TypeScript server functions and reactive screens matter more than SQL portability. Scheduling and Node.js actions are included. Free limits include **0.5 GB database, 1 GB file storage and 1 million function calls/month**; subscription updates, scheduled executions and file access count toward calls. Its separate Starter plan permits paid overages; Professional is **$25/developer/month**. [Limits](https://docs.convex.dev/production/state/limits), [plans](https://www.convex.dev/pricing)

Main tradeoff: schema, auth integration and Firebase operations must be rewritten into Convex's model. Efficient care scheduling and limited subscriptions remain essential. It is not the PostgreSQL model recommended above, but it is a viable managed backend choice.

### 3. Cloudflare Workers + D1 + R2 — good infrastructure value, more assembly

Useful for a custom API or a weather-worker/storage component. Workers Free allows **100,000 requests/day with 10 milliseconds CPU per invocation**. That CPU budget needs an actual care-engine benchmark; it is too restrictive to assume a large replay will fit. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

D1 Free has **500 MB per database**, with **5 GB total account storage**; those are different limits. R2 Standard includes **10 GB-month storage**, operation allowances and no direct internet egress charge. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Main tradeoff: D1 is SQLite-based, not PostgreSQL, and this combination is not a turnkey replacement for Firebase Auth, permissions and realtime subscriptions. We would own considerably more integration code. Retaining Firebase while moving selected workloads here is possible, but adds cross-provider authentication and operational complexity.

### 4. Appwrite Cloud — conditional option

Provides auth, database, storage, realtime and functions, but its current scheduling restriction matters directly to this app: since **19 October 2026**, cron schedules require a paid plan; Free runs use intervals of at least **60 minutes**. Hourly background updates might be acceptable for some tasks, but do not match the current 15-minute scheduler. I would not choose it as the first replacement for this workload. [Official scheduling change](https://appwrite.io/changelog/entry/2026-10-15-1)

Neon is worth considering as a PostgreSQL component if we deliberately want to assemble services, rather than choose a complete backend. PocketBase is free software, but does not supply free managed hosting, backups and operations. Neither is my first recommendation for this owner's managed public app.

## What 500 active users means for cost

User count alone is insufficient. We need plants/user, photos retained, image views, distinct weather scopes, source refresh frequency, history retention and care CPU/DB usage.

Illustrative media scenario: 500 users × 5 plants × 10 photos × 100 kB combined image/thumbnail = **2.5 GB binary storage** using decimal units. Base64 alone would make that approximately **3.33 GB**, before database overhead. This exceeds Supabase's and Convex's included file storage. R2 could fit the stored bytes in its allowance, but serving requests and backend work still have their own quotas.

Illustrative processing scenario: evaluating 2,500 plants every 15 minutes is **7.2 million plant evaluations per 30-day month**. Evaluations are not necessarily separate billable invocations when batched, but the CPU, reads and writes remain. Fetch reusable weather scopes once, invalidate dependent plants when inputs change, and schedule the next meaningful evaluation rather than blindly rewriting every plant on every tick. Time passing can itself change a decision, so event-driven work still needs next-due jobs.

Weather API usage is a separate provider cost under every option. Unknown scientific inputs remain unknown under every option too.

## A bounded way to decide before migrating

1. Measure existing data volume, media sizes, subscriptions and realistic weather/care workloads. Inventory every collection and protected backend artifact without exporting secrets into reports.
2. Build an isolated Supabase slice: existing identity mapping, one garden/plant, transactional watering with edit/undo, private photo upload and one care job. Keep the pure TypeScript engine and its existing tests.
3. Compare results from the same frozen inputs, including source revisions, delayed weather, plant moves, midnight/timezones, duplicate requests and corrections to earlier watering. Add authorization and cross-user isolation tests for the new adapter.
4. Load-test the 500-user scenario, measure worker CPU, queue age, DB growth, realtime fan-out, egress and local-user latency. Compare it with an improved Firebase worker, not the current under-sized sweep.
5. Only then select the host and design cutover: verified admin backup, identity/media mapping, reconciliation, support for old clients, a controlled write cutover or durable change capture, and a tested rollback. The user export alone is insufficient. Uncoordinated dual-writing is not a migration strategy.

No accounts, billing settings, production data, application runtime code or deployments were changed as part of this assessment.
