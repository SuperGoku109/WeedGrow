# Free backend design for the 500-person pre-release

Research date: 6 November 2026. This follows the initial backend assessment with a specific pre-release design and a wider comparison of database, media and weather services. The owner confirmed a non-commercial hobby/community app, up to 500 people, with a billing card acceptable but a preference for no charges.

This is a recommendation and capacity model, not a deployed system or a hosted load-test result. No production accounts, billing settings, data or runtime code were changed.

## Decision

**Use Supabase Free for PostgreSQL and background care jobs, Cloudflare R2 Standard for private photos, and initially retain the existing Firebase email/password authentication. Host the web preview as static files on Cloudflare Pages. Use centrally cached Open-Meteo data as the main free weather source, subject to adapter/coverage validation; consider OpenWeather's separate free Current Weather API for current conditions.**

This is my preferred balance of maintainability, useful free allowances and migration risk for this specific app. It is a realistic zero-monthly-cost target for a bounded pre-release, not unlimited free hosting for arbitrary activity. Retaining Firebase Auth avoids making a new email-delivery service/domain a prerequisite for the first migration. It does not require keeping Firestore or deploying Firebase Cloud Functions.

There are three necessary conditions:

1. Bound storage and requests on the server, not only in the interface.
2. Share weather and batch due care jobs instead of copying the current per-plant acquisition/sweep design.
3. Preserve the care engine's source, freshness and uncertainty rules. A cheaper source must pass the adapter contract; it must not silently remove checks or relabel forecasts as historical observations.

## Why relational data is the right choice

The reason is the app's relationships and transactions, rather than a threshold of 500 users. Firestore is capable of supporting the user count. PostgreSQL would make this particular domain easier to keep consistent and inspect:

- Plants belong to gardens, have owners, setup/location history and optional sensor profiles.
- Journal entries belong to plants; photos can reference a plant and journal entry.
- Garden watering affects several plants atomically and must tolerate retries and later corrections.
- A care result depends on dated setup, watering revisions, a profile and specific weather intervals.
- Several plants may use the same source weather, but have different shelter, pots and growth stages.

Use foreign keys and ordinary current-state rows for the UI. Keep immutable revisions only where care replay, audit and edits require them. Use typed quantities/times for searchable fields, JSONB for structured variable evidence, and object storage for binary media and bulky immutable archives. Do not turn every weather variable into a new globally indexed row or copy the Firestore nesting verbatim.

Suggested core tables: app_users, auth_identities, gardens, plants, plant_access, sensor_profiles, plant_setup_revisions, plant_location_history, journal_entries, journal_entry_revisions, watering_operations, photos, weather_scopes, weather_acquisitions, weather_intervals, care_profiles, care_evaluations, care_current, care_checkpoints, jobs and provider_usage.

Enforce access in row-level security and transactional server functions. A Firebase subject is a string; map provider/subject to a stable internal identity instead of casting Firebase IDs to UUIDs. A plant's current garden_id becomes the membership source of truth. Preserve the effective permissions of the existing owners array.

## What the code audit changes about the design

| Actual code path | Finding | Pre-release design |
| --- | --- | --- |
| lib/plants/preparePlantPhoto.ts; photoRepository.ts | Existing JPEG resize/compression is already useful, but full image and thumbnail are base64 Firestore documents | Retain compression and upload binary JPEGs to R2 |
| lib/weather/fetchWeather.ts | Client exposes the provider key; the cache is device-local | Authenticated backend, shared cache and global request accounting |
| functions/src/careOperations.ts | Weather acquisition storage is under each plant | Shared provider/location/product scopes; plant-specific interpretation remains separate |
| functions/src/operations.ts | A run reads only 100 plants and processes care sequentially | Durable next-due jobs with leases and bounded batches; monitor oldest due job |
| functions/src/careWaterHistory.ts | History reader stops at 32 acquisitions / 16,384 samples | Paginated, shared canonical history and tested compaction; a different database alone does not fix the bound |
| functions/src/careWatering.ts; careEventLedger.ts | Replay depends on corrections, setup transitions and original source evidence | Keep immutable revisions and invalidate dependent checkpoints correctly |
| lib/data/pagedLiveQuery.ts | Server-confirmed live inventories, not complete offline-first sync | Preserve explicit loading/reconnect states; use narrowly scoped realtime subscriptions |
| lib/backup/gardenExport.ts | User export omits protected care evidence and has a 30 MB / 50,000-record bound | Separate complete administrative backups from user export; photo export must include files, not just temporary links |
| services/reminders.native.ts | Reminders are local Expo notifications | Keep them local; no additional push service needed just to preserve this feature |

At 500 people with five plants each, the current 100-plant/15-minute sweep needs 25 nonempty runs, over six hours per complete sweep, plus reset/failure/runtime effects. This is a code-level estimate; no production workload was run. Provider migration without redesigning this scheduling would retain the delay.

The previous deployment inventory had no deployed care functions because Spark blocked the required deployment services. Moving infrastructure does not itself install approved hops profiles or resolve recent historical weather gaps. Those remain release requirements, rather than benefits supplied by a database vendor.

## Exact service split

### Supabase Free: journals, relationships and processing

Relevant included allowances: **500 MB PostgreSQL database, 5 GB egress, 500,000 Edge Function invocations/month, 2 million realtime messages/month and 200 peak realtime connections**. There is also 1 GB file storage, but photos need not use it. Free projects can pause after a week of inactivity. [Billing allowances](https://supabase.com/docs/guides/platform/billing-on-supabase), [pausing/pricing](https://supabase.com/pricing)

Five hundred admitted accounts is compatible with this design; five hundred simultaneous live connections is not covered by the free realtime allowance. Subscribe only while a relevant screen is open, use one connection per client, stop subscriptions in the background and provide a normal HTTP refresh fallback. Restrict repeated full inventory downloads and large unbounded results.

Use Cron to dispatch due jobs. Functions must finish within their runtime limits: Free wall time is 150 seconds and CPU time is 2 seconds per request. Small batches are appropriate; one giant invocation evaluating all accounts is not. [Cron](https://supabase.com/docs/guides/cron), [runtime limits](https://supabase.com/docs/guides/functions/limits)

The free plan is not the same as a production service guarantee. Quota excess can lead to restrictions. Track the database, indexes, egress and job growth, not just user count. [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)

### Authentication: keep Firebase initially

Supabase officially accepts Firebase JWTs. The integration requires the authenticated role claim and correct project/owner policies. Existing users require an identity mapping and claim provisioning. New signups need a trusted provisioning endpoint or controlled admission flow; the documentation's Firebase Cloud Function example must not be assumed to run on Spark for free. A trusted non-Firebase backend can perform the necessary Admin operation after verifying identity. This integration is part of the prototype acceptance test, not a completed feature. [Firebase integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth)

Keep account creation/admission under a 500-member pre-release cap and rate-limit signups and password-reset requests. Firebase has separate authentication and email quotas; 500 total members does not mean unlimited email bursts. [Firebase Auth limits](https://firebase.google.com/docs/auth/limits)

If simplifying to Supabase Auth later, budget for public email delivery. Supabase's built-in sender is restricted to team addresses and currently two emails/hour. Resend has a free allowance but its test domain cannot send to arbitrary users; a verified sending domain is required. An email provider's free plan does not make a newly purchased domain free. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend sender requirements](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

### R2 Standard: photos and bounded archives

Included monthly allowances: **10 GB-month storage, 1 million Class A operations and 10 million Class B operations**, with no direct internet egress charge. This applies to Standard storage. R2 is metered beyond those allowances; do not assume adding a card creates a hard zero-spend cap. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Keep buckets private. PostgreSQL stores an object key, owner, byte length, checksum, MIME type, thumbnail key, associated plant/log and upload state. A key is the durable reference; a short-lived signed download URL is generated only after authorization and must not become the permanent database value. Signed URLs are supported for individual R2 objects. [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

Do not use the public r2.dev development endpoint as the production media service. Private S3 downloads can use signed URLs without buying a public custom media domain. A Worker gateway is optional, with its own execution quotas. [Development endpoint restrictions](https://developers.cloudflare.com/r2/buckets/public-buckets/)

Proposed photo path:

1. Resize/encode the image and thumbnail on the device using the existing helper, removing the base64 wrapper for upload.
2. A trusted endpoint checks membership, ownership and remaining bytes; reserve capacity atomically and issue an expiring upload authorization bound to the intended object.
3. Enforce a byte limit in the server upload path. Do not treat client-supplied MIME/length, or an ordinary unrestricted signed PUT, as proof of an acceptable image. Keep in-flight reservations bounded and avoid reusable grants accumulating unaccounted files.
4. Validate the stored object's type/size and commit its reference with the journal/photo metadata. Make retry/finalization idempotent.
5. Clean abandoned uploads, release expired reservations and implement retriable deletion. Never assume an R2 upload and SQL transaction are one atomic operation.
6. Deliver thumbnails for lists and full images only on demand. Cache safe versions locally, batch link requests and keep private access checks.

The proposed small-file limit makes a capped upload through a trusted function feasible if that is the simplest way to enforce size. Alternatively, direct uploads require a separately verified size/reuse enforcement design. No promise of free unlimited original-resolution archival is included.

### Web preview: Cloudflare Pages static hosting

Export and validate the Expo web application, including direct plant links, auth redirects and route fallback. The current config uses static output; deployment must verify dynamic routes instead of assuming every development-server URL works after export. Pages serves static asset requests free; any Functions routes have separate Workers accounting. A pages.dev preview avoids a mandatory domain purchase. [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)

## Photo capacity: the workaround is viable

The current limits are 180 KiB of base64 data-URI text for the full image and 20 KiB for the thumbnail. That corresponds to approximately **150 KiB combined binary bytes**, not a 200 KiB original JPEG. The app already resizes; it does not need to retain multi-megabyte camera originals for this pre-release.

Using 150 KiB per retained photo/thumbnail pair:

| Retained photos per member | Total photos at 500 members | Combined binary storage, decimal GB |
| --- | ---: | ---: |
| 20 | 10,000 | 1.536 |
| 50 | 25,000 | 3.840 |
| 100 | 50,000 | 7.680 |
| 200 | 100,000 | 15.360 |

**Recommended initial policy: up to 100 retained photos and 15 MiB total photo bytes per account**, with the smaller remaining limit enforced. Across 500 accounts, 15 MiB each is about 7.86 decimal GB. Count both image and thumbnail, and count all plant covers/gallery photos/progress photos toward the same allowance. Users can delete photos to regain capacity.

This leaves some of R2's allowance for upload cleanup, selected weather evidence and backups, but not unlimited copies of every source response. Set an application-wide admission threshold below the storage allowance; account for all buckets, in-flight uploads, archives and delayed deletion. Storage and operation budgets are independent. Monitor actual usage and reject new uploads before the reserve is exhausted. These controls reduce cost risk; they are not a provider guarantee against every abusive request or accounting delay.

Do not keep doubling the allowance by opening more free accounts or projects. The design should stay within the provider's actual terms and budget.

## Weather: the constraint that could otherwise invalidate the free plan

Current code requests OpenWeather One Call 3.0. Its One Call product has a small included daily allowance: **1,000 calls/day** in current published pricing. At 500 unique weather locations, hourly polling is 12,000 calls/day before retries, history or opening the app. Per-plant fetching makes it worse. [OpenWeather pricing](https://openweathermap.org/price)

The separate OpenWeather free Current Weather and 5-day/3-hour Forecast APIs allow **60 requests/minute and 1 million/month**. These are different endpoints/products, not a larger One Call entitlement. Current conditions can be useful here; the 3-hour forecast cannot silently replace a required hourly source or interval evidence. A new adapter and feature comparison are required. Keep its key on the server and set provider limits. [Free product details](https://openweathermap.org/price)

Since the owner confirmed non-commercial use, Open-Meteo is eligible in principle. Its Free API terms permit non-commercial apps and require attribution, with limits of **10,000 calls/day, 5,000/hour and 600/minute**. Open-Meteo also lists a 300,000 monthly allowance. Calls can be weighted by variables, time range and locations; batching locations does not mean one billable/quota unit for all of them. [Terms](https://open-meteo.com/en/terms), [pricing and call definition](https://open-meteo.com/en/pricing)

Illustrative centrally scheduled plan, assuming 500 distinct weather scopes and requests of at most ten variables and at most two weeks per location:

- Eight forecast acquisitions/location/day: 4,000 call units/day.
- Four archive checks/location/day: 2,000/day.
- Base: 6,000/day, about 180,000 over 30 days, before weighted extras, retries and foreground refreshes.
- Keep a separate reserve for first-time backfills, location changes and current conditions. Stagger work and use a global minute/hour/day/month budget rather than issuing all locations at once.

This is a capacity example, not an approved refresh/freshness policy. Live current conditions may require a more recent source than a three-hour forecast refresh. Use demand-based refreshes or the separate free current-weather endpoint where its fields/timestamps are adequate. If a source is too old, report that fact; never lengthen the algorithm's freshness limit just to satisfy a free quota. All 500 locations continuously refreshed every hour would exceed Open-Meteo's free daily allowance, so that workload needs another source or a paid plan.

The current algorithm consumes temperature, humidity, dew point, wind/gust, radiation, ET0 and liquid-rain data, and separate storm evidence. Open-Meteo exposes relevant meteorological variables, including FAO-56 ET0, but provider coverage, heights, units and time support must match each rule. Government alerts, hail evidence and forecast resolution must be checked individually. Missing fields must remain unknown. [Variable definitions](https://open-meteo.com/en/docs)

**Remaining functional issue:** archive latency and unfinished hours can still prevent a definite current watering decision. A cheap backend does not fill that gap. Preserve the distinction between occurred estimates and forecasts; any recent-data source change requires explicit spec/adapter review. Historical forecasts cannot simply be relabeled as occurred rain/ET0 to make the app appear operational.

## Database and job budgets

Photos moving out of PostgreSQL solves media growth, not every database limit. Keep current care results and indexed journal/setup data hot. Share weather by a fully specified source scope, preserve returned grid metadata and location revisions, and avoid arbitrary rounding that merges different sites. Store canonical hourly rows with several measurements and per-measurement quality, or compact interval blocks where appropriate. Archive bulky immutable evidence as compressed objects; retain references and hashes.

At 500 sites, a seven-day hot weather window is 84,000 site-hour records; thirty days is 360,000. Actual bytes depend on columns, indexes and revisions and must be measured in PostgreSQL. The seven-day window is a hot-query choice, not permission to delete evidence needed for a longer active watering anchor or historical correction. Pagination/compaction and archive retrieval must preserve replay correctness.

Do not save a new large database care-history row on every timer tick indefinitely. Keep a small current row, versioned dependencies and an explicit archival policy for evaluations/evidence. User journal history should not be silently deleted to preserve the free tier. If ordinary retained history approaches the allowance, admit fewer testers, reduce unnecessary duplication or choose a paid/larger service.

An illustrative care workload is 2,500 plants × 8 scheduled evaluations/day = 600,000 evaluations/month. With five plants per small job that is about 120,000 care function invocations, before event-driven edits and extra due times. Source acquisitions can also batch scopes per invocation without changing provider call accounting. This leaves a plausible function budget for uploads, link grants and request handling, but only a hosted measurement can establish sufficient margin. Time passing, new watering, setup edits, new weather and corrections can all make a plant due for evaluation.

### Local engine sizing performed

Ran `node tmp/backend-sizing-benchmark.cjs` with existing synthetic helpers and the actual water replay engine. No production provider/database calls. Node v24.19.0 on Windows; values are warm local wall times:

| Replay input | Repetitions | Mean | p95 |
| --- | ---: | ---: | ---: |
| 24 hourly intervals, one scenario | 50 | 0.38 ms | 0.76 ms |
| 168 hourly intervals, four scenarios | 20 | 2.47 ms | 3.11 ms |
| 720 hourly intervals, eight scenarios | 5 | 11.25 ms | 11.94 ms |

The 30-day JSON input was approximately 616 kB, while its replay output was approximately 3 kB. This supports small server jobs and avoiding repeated transfer/storage of full replay payloads. It does not benchmark production fingerprints, warnings, forecast branches, checkpoint verification, database access, provider parsing, cold starts, concurrent users or Supabase's hosted CPU. The small number of month-long samples is exploratory, not a statistically reliable tail-latency estimate. It also does not validate the synthetic coefficients as hops science.

Cloudflare Workers Free has a 10 ms CPU limit/invocation; this local result gives insufficient margin to choose it as the only care execution runtime without hosted benchmarking or redesign. Supabase's runtime is the more practical first prototype. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Alternatives checked and why they do not win this comparison

| Option | Relevant current free allowance / feature | Assessment for this pre-release |
| --- | --- | --- |
| Supabase alone | PostgreSQL, auth, jobs and realtime; 1 GB built-in files | Best core fit; add R2 to address photo capacity and delivery |
| Neon | Now includes 1 GB PostgreSQL, 5 GB objects, auth and functions; 100 CU-hours/project/month; realtime is beta | More capable than a database-only comparison suggests, but continuously active database compute can exhaust the free allowance |
| Turso + R2 | 5 GB database, 500 million rows read and 10 million written/month | Attractive SQL capacity; SQLite-based rather than PostgreSQL. Auth/API, permissions and live sync require more custom integration |
| Cloudflare D1 + R2 | 500 MB per free database, 5 GB account-wide; Workers, private objects | Useful infrastructure, but greater custom backend work and a tight free execution CPU budget |
| Convex + R2 | TypeScript/realtime/jobs; 0.5 GB DB and 1 million calls/month | Viable alternative; calls include live subscription updates and scheduling; less aligned with the relational model |
| Firebase Blaze + R2 | Keeps existing app integration and worker runtime | Lowest migration effort; sensible if occasional charges are acceptable, but not the strongest strict-free recommendation |
| Appwrite Cloud | Integrated backend; free scheduled execution intervals of at least 60 minutes | Poorer fit for timely background care than the preferred stack |

Sources: [Neon pricing](https://neon.com/pricing), [Turso pricing](https://turso.tech/pricing), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Convex limits](https://docs.convex.dev/production/state/limits), [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Appwrite scheduling](https://appwrite.io/changelog/entry/2026-10-15-1).

For Neon, 100 CU-hours covers about 400 active hours at 0.25 CU. A minimum compute continuously active for 30 days would use about 180 CU-hours. Frequent polling and users across timezones can prevent its five-minute idle suspension. That makes it a less predictable zero-cost fit here, although an intermittently used beta could fit. Supabase's smaller database is a tradeoff against Neon's active-compute allowance, rather than a universal superiority claim.

### Separate image services

| Image service | Current free model | Why I prefer R2 here |
| --- | --- | --- |
| Cloudflare R2 | Storage/operations allowance; no direct download egress charge | App already resizes images; private binary files and small metadata fit well |
| ImageKit | 3 GB DAM storage and 20 GB monthly bandwidth | Good optimization product, but smaller storage allowance and delivery cap |
| Cloudinary | 25 monthly credits shared across storage, transformations and bandwidth | Useful if advanced transformations are needed; 25 credits are not independent 25 GB allowances for every resource |

Sources: [ImageKit plans](https://imagekit.io/plans/), [Cloudinary plans](https://cloudinary.com/pricing), [credit accounting](https://cloudinary.com/documentation/billing_and_plans).

Do not use random public image-hosting links as the storage layer. They do not establish per-user access, controlled deletion, durable ownership or a migration/export strategy. A private object key plus authorized temporary access implements the owner's suggested link approach properly.

## Pre-release envelope and acceptance gates

Proposed initial envelope, to agree before implementation:

- 500 admitted accounts; approximately five active plants and one weather site per person for capacity testing. Multiple sites consume the global source budget; account count alone must not be used to promise unlimited sites.
- Up to 100 compressed retained photos / 15 MiB photo bytes per account, with a global budget and room for other objects. No video or original-camera archival in this envelope.
- Limited foreground realtime subscriptions; HTTP refresh works if a live connection cannot be admitted. This is not a promise of 500 concurrent realtime sessions.
- Shared source acquisition, durable due jobs, idempotent journal transactions and append-only correction evidence. Foreground refreshes cannot bypass quotas.
- Observe database size, outgoing bytes, object storage/operations, function usage, provider quota, queue age and percentage of plants receiving determinate care decisions. An apparent healthy server is not enough if care is always uncertain.
- Configure backups and actually test restore. Supabase recommends free-plan exports; daily managed backups are a paid-plan feature. Include protected configuration/history and media inventory. Budget backup egress and object retention too; database backup alone does not back up photo bytes. [Backup documentation](https://supabase.com/docs/guides/platform/backups)

Before migration, prove one isolated vertical slice: existing login, owner/outsider access, garden/plant queries, watering/edit/undo with retries, private photo upload/read/delete/export, weather acquisition and one complete care evaluation. Then run realistic load and growth tests, including empty quota, stale weather, old journal corrections, delayed uploads, missing fields and conflicting edits. Validate web deep links and South African network latency; the current database is Johannesburg, while the candidate region must be selected from actual provider availability. [Supabase regions](https://supabase.com/docs/guides/platform/regions)

The final cost statement is therefore: **a bounded, non-commercial 500-account pre-release can plausibly target $0/month on this split stack; arbitrary uploads, continuous high-frequency weather and unlimited retention cannot be guaranteed free.** The highest-value next implementation is an isolated Supabase/R2/auth/weather slice with usage instrumentation, followed by a measured go/no-go decision and a separate migration plan.
