# Firebase sizing: 100 testers plus the owner

Implementation update: [read/write efficiency improvements](firebase-read-efficiency-2026-11-06.md) now replace the repeated repair scan on routine runs with a protected revision-bound cache and due-based scheduling. The figures below describe the pre-optimization baseline, not the new worker's measured usage.

Date: 6 November 2026. This is a code-derived capacity model, not a measured production bill. The working assumption is 101 accounts total, all active plants outdoors, three plants and one distinct weather location per account, with a 30-day month. User count alone cannot determine cost. No billing changes or deployment were performed.

## Assessment

A 100-person beta is a reasonable scope to evaluate on Firebase. The current background implementation still needs read-efficiency work before it is sensible to assume that the workload stays within free allowances. Shrinking from 500 people does not remove the cost of repeatedly scanning each plant's history.

Blaze can accrue charges as soon as billable resources are used or their free allowances are exceeded; a small member count is not a spending cap. Source: [Firebase pricing](https://firebase.google.com/pricing).

## Current scheduler: visits, not necessarily new evaluations

Maintenance runs every 15 minutes, with one page of at most 100 plants per invocation. It advances a cursor, including the final smaller page. Assuming successful timely runs, there are 96 scheduled invocations/day and 2,880 over 30 days. Other database triggers produce additional function invocations. A call to refreshPlantCare inside the scheduled process is not a separate Cloud Function invocation by itself.

| Plants/account | Total plants | Runs per sweep | Approx. visits per plant/day | Total scheduled plant visits/day |
| --- | ---: | ---: | ---: | ---: |
| 1 | 101 | 2 | 48 | 4,848 |
| 3 | 303 | 4 | 24 | 7,272 |
| 5 | 505 | 6 | 16 | 8,080 |

These counts exclude manual testing and journal/setup triggers, and assume no timeout, lease conflict or retry. They describe the current cursor sweep, not a desired freshness guarantee. At three plants/account a sweep takes about an hour. If a current snapshot is still fresh, refreshPlantCare can skip publishing a new result. Earlier simple per-evaluation cost examples must not be read as claiming every visit writes a result.

## Main finding: history reads happen before the freshness shortcut

In functions/src/careOperations.ts, when a valid watering policy is enabled, synchronizeWaterEvents runs before the existing care snapshot's nextEvaluationUtc is checked. That repair scan is in functions/src/careEventLedger.ts. For N unchanged watering records, each with one revision and a matching head, it approximately reads:

- N source watering records and N heads: 2N documents.
- For every distinct log, captureWaterEvent reads plant + log + head: 3N.
- readWaterEvents then reads revisions + heads + source watering records: 3N.

This is approximately **8N document reads just to synchronize an unchanged history**, plus configuration, plant, current-snapshot and maintenance reads. Historical edits add revisions, increasing the cost further. Transactions can retry; other checks/queries add reads. Empty queries also have a minimum read charge.

At 303 plants and the modeled 7,272 visits/day, using ten existing watering entries per plant:

    7,272 visits × 80 synchronization reads ≈ 581,760 history reads/day

That is already above the 50,000 free reads/day, before the rest of the app. This is a conditional code-derived scenario with the watering policy enabled, not current measured traffic. Missing/disabled watering configuration does not execute this same path and is not a meaningful proxy for a working watering release.

Therefore, the number of members is not the only issue: history depth and the repeated repair path are important. Replace unconditional repeated repair with trusted event-driven revision tracking, use checkpoints and incremental reads, and preserve reconciliation for missing/out-of-order events. The design must retain the same correctness guarantees for corrections, deletions and concurrent saves. Tests must show that skipping work cannot publish stale watering advice.

## Writes

Every newly published care evaluation currently writes care/current and the plant's careEvaluationRevision. A supported checkpoint adds a third write; weather acquisition, usage accounting, leases, journal changes and other operations add more.

For the three-plants/account scenario, if every visit publishes:

- Two publication writes: 14,544/day.
- With a checkpoint on every publication: 21,816/day, already above 20,000 free writes/day.

These are conditional scenarios. Fresh-snapshot skips reduce publication writes; missing history can reduce checkpoints while also preventing useful decisions. We must not obtain a deceptively small cost estimate by leaving the functioning algorithm disabled.

A possible optimized operating scenario is eight routine evaluations per plant/day plus input-triggered and foreground work:

    303 plants × 8 = 2,424 routine evaluations/day
    Two result writes each = 4,848/day
    Three writes each including a checkpoint = 7,272/day

Those figures exclude extra work. Eight evaluations/day is a sizing assumption, not a validated source-freshness policy. Current-condition warnings and near-term watering thresholds may require additional evaluations. Do not weaken freshness rules or stop responding to journal corrections to fit a quota.

## Photos using the existing Firestore implementation

The current limit is 180 KiB full-photo base64 text plus 20 KiB thumbnail text. A retained photo pair is therefore at most about 200 KiB of strings before document/index overhead.

| Retained photo pairs per account, across all plants | Pairs across 101 accounts | Maximum strings alone |
| --- | ---: | ---: |
| 10 | 1,010 | 197.3 MiB |
| 20 | 2,020 | 394.5 MiB |
| 50 | 5,050 | 986.3 MiB |
| 100 | 10,100 | 1,972.7 MiB |

Twenty compressed photos/account is a plausible initial beta limit. Fifty/account would leave almost no room in Firestore's 1 GiB included storage for weather, journals, care history, indexes and metadata. This table uses upper bounds, not sampled image sizes, and does not estimate download traffic. Photo views, cache behavior and exports also matter.

Moving photos to object storage remains desirable but is a separate decision. R2 is not a guaranteed-zero-overage service. Supabase Free storage can also hold limited images, but adds cross-service authorization/cleanup work. No external storage account was provisioned for this estimate.

## Weather calls

Sharing acquisitions across plants is essential. Assuming one provider request per location per refresh and 101 unique locations:

| Frequency | Scheduled provider calls/day |
| --- | ---: |
| Every three hours | 808 |
| Every hour | 2,424 |
| Every 15 minutes | 9,696 |

These are request counts, not a forecast of the current per-plant implementation. That implementation can duplicate acquisitions across a person's plants, and the client also calls OpenWeather independently.

OpenWeather One Call currently advertises 1,000 calls/day included. Eight daily acquisitions/site leave only 192 calls for client refreshes, retries and owner testing; hourly acquisition is already above the included allowance. Endpoint/legacy-plan entitlements must be checked against the actual account. Set a provider-side daily limit if continuing One Call, and centralize all acquisition so client requests cannot bypass the budget. [One Call pricing](https://openweathermap.org/price), [daily limit settings](https://openweathermap.org/faq)

For the confirmed non-commercial app, Open-Meteo's free API is another option. An illustrative hourly forecast fetch plus four archive checks/site/day is 2,828 location requests/day, before retries and weighted-call adjustments. That is below its stated 10,000/day allowance under ordinary single-location request assumptions. Adapter compatibility, source semantics and recent coverage still need verification; forecast rows cannot be substituted for occurred history. [Free API terms](https://open-meteo.com/en/terms)

## What this does and does not establish

Firestore's included allowances are 50,000 reads/day, 20,000 writes/day, 20,000 ordinary deletes/day, 1 GiB stored data and 10 GiB outgoing data/month. TTL deletes and managed backups are separately billable. Sources: [Firestore pricing and allowances](https://cloud.google.com/firestore/pricing).

This analysis establishes a specific reason not to assume the current enabled worker is free even at 100 testers. It does not establish a monthly dollar total. A trustworthy total also needs actual historical record counts, source response sizes, retention, function allocated CPU/memory and duration, region-specific rates, trigger fan-out, transactions/retries, UI reads and outgoing bytes. In particular, network waits contribute to hosted invocation duration; the local calculation-only benchmark cannot estimate that bill.

Suggested engineering goals for the beta: total project reads below 25,000/day and writes below 10,000/day in the representative test workload, leaving allowance for owner testing and bursts. These are targets, not existing protections or provider billing caps.

The next step is to fix the repeated synchronization work, create representative 101-account data in the local emulator, measure document operations for unchanged runs and watering/edit/delete/undo, and collect execution/size metrics. Only then decide whether accepting Blaze's residual billing risk is appropriate. The owner's no-charge requirement has not been withdrawn, so billing remains disabled.
