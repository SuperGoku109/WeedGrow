# Firebase read/write efficiency improvements

Implemented 6 November 2026 for the planned small pre-release. This changes database orchestration and caching, not hops coefficients, watering thresholds or weather freshness requirements. Changes are local; no billing account, policy approval or production deployment was made.

## Measured results

Regression instrumentation counts returned SDK document reads, treating empty queries as at least one read. It is not a Cloud Billing meter: index reads, rule-dependent reads, network bytes and infrastructure costs are additional considerations.

| Operation | Before | After |
| --- | --- | --- |
| Unchanged ten-entry watering ledger synchronization | Approximately 80 document reads from the previous code path | 2 document reads, no queries or writes, on the protected routine cache path |
| Full verification of that ten-entry history | Rechecked every log with a separate three-document repair transaction | 31 document reads, no writes when unchanged |
| Repeated/concurrent client reads of the same care revision | A getDoc request for every call | Ten concurrent calls share one getDoc; later calls reuse the revision |
| Timer with twenty future-due plants and one due plant, no configured source work | Existing timer visited plants regardless of due state | 13 SDK document reads in the isolated test; future-due plants were not individually loaded |
| Following idle timer in that test | Existing timer revisited the inventory | 7 SDK document reads and three bounded maintenance bookkeeping writes |
| Rebuilding an unchanged care summary | Wrote the parent again | Zero writes |

The 80-to-2 comparison is a 97.5% reduction for that specific ledger synchronization component. It is not a 97.5% reduction in the entire app bill. Full reconciliation is still required initially, after relevant changes and during the daily repair pass.

## Changes

### Revision-protected watering history cache

`functions/src/careEventLedger.ts` now reads a consistent source/head/revision view and repairs only records whose physical care facts changed. Caption-only changes do not create watering revisions. Invalid watering changed into a note still receives the required tombstone. Historical as-of reads and bounded overflow handling remain intact.

The verified view can be stored in the private `careWaterState/eventView` document. Routine scheduled processing reads the plant and that view, rather than repeatedly querying and repairing every watering record. The cached view is bound to the plant's setup/care/ledger revisions, engine version and record limit. It is not reused for an earlier availability time, and views that exclude future-acquired revisions are not cacheable.

A server-owned `careEventProtocol: 1` enrolls the plant. Crucially, enrollment happens **before** taking the initial source snapshot, closing the legacy-write race. For enrolled plants, Firestore rules require watering/fertilizing creates, edits, type changes and deletions to atomically increment the parent's `careRevision`. Clients cannot remove enrollment or roll that revision back. The existing app's journal, garden watering and restore paths already use revision-changing transactions.

Consequently, a client watering edit invalidates the view before its asynchronous backend trigger arrives. Backend capture changes also advance the protected ledger revision. A daily full reconciliation checks source records for missed events or administrative changes. Privileged import scripts must participate in revision/capture semantics or explicitly request full reconciliation; Admin SDK writes bypass security rules by design.

The cache is capped at 600,000 serialized bytes. Oversized or incomplete results fall back to full verification rather than truncating history. Its large result payload is excluded from indexing. This trades one bounded private cache document per plant for fewer repeated reads; existing immutable event history is retained.

### Reuse the verified read within one evaluation

`careOperations.ts` passes that invocation's verified events to `careWatering.ts`, removing a second full source/ledger read. Reuse requires matching input revisions and complete availability at the original read time. Concurrent dependency changes force an authoritative read or fail publication fences. Setup, policy and input-version checks are still performed before publication.

### Due-based maintenance

Care publication writes the server-owned `careNextEvaluationUtc` alongside the existing plant pointer. Maintenance queries active plants whose decisions are due, using a new composite index, instead of recalculating the whole inventory every timer tick.

A bounded repair scan discovers legacy plants without the new field and reconciles missed changes once per UTC day. Engine/configuration changes restart that scan. Normal due work and repair work share a maximum 100-plant batch, with space reserved for reconciliation while a scan is active. Failed legacy work gets a due retry instead of being lost when the cursor advances.

The next evaluation time still comes from the existing source/algorithm expiry policy. This implementation does not quietly change a 15-minute freshness requirement into a three-hour one to save reads. Queueing delays can still make advice expire; the app continues to reject expired snapshots.

Configuration is read once per maintenance invocation and shared across the batch. The final publication transaction still checks current protected configuration and plant dependencies. Old snapshots from a different engine version cannot take the fresh-result shortcut.

### Avoid duplicate writes and client reads

Fresh weather acquisitions are no longer written again merely because another care evaluation used them. Immutable acquisition reads/writes happen when an acquisition lease actually fetched data. Care summary rebuilding compares the existing value and skips identical updates.

`services/plantCareEvaluation.ts` coalesces requests and keeps a bounded in-memory cache keyed by account, plant and immutable server revision. Every consumer still validates the current setup and clock, so a cached evaluation expires normally. Missing, failed and mismatched reads remain retryable. Account changes clear private caches; a different account cannot use the former account's result.

## Validation

The full verification gate passed 110 Jest suites / 863 unit and scenario tests, application/backend types, lint, architecture checks and emulator integration tests. Subsequent backend/scheduler refinements were rebuilt/typechecked/linted and the complete emulator integration set passed again. The final production-care check additionally exercises the integrated warm-history path, rather than only the cache helper.

Tests cover unchanged/corrected/deleted watering, note/type corrections, invalid amounts, historical availability, concurrent captures, checkpoint invalidation, approval revocation, policy changes in flight, source gaps and private-data permissions. The actual application workflow tests now enroll their eight plants in the protected revision protocol, exercising real journal edits/undo, eight-plant atomic watering and backup/restore under the new rules.

Additional efficiency regressions verify due-only selection, idle work, legacy/daily discovery, configuration-triggered reconciliation, old due-field backfill, transient failure retries, duplicate summary writes, shared UI requests, expiry, missing/error retries and account isolation. All provider requests in these checks use fixtures; test projects are restricted to disposable Firebase emulators.

## Deployment and limits

`npm run deploy:care` now releases **Firestore rules and indexes before functions**. The mandatory revision rules must be live before workers can enroll plants and reuse history. The new due-query index must finish building for the maintenance query to run successfully; monitor readiness during deployment. Existing billing preflight still stops the helper on Spark. This task did not run deployment or enable billing.

The new scheduling/protocol fields are server-owned, omitted from user backups and excluded from ordinary editable plant fields. Current clients are compatible; old scripts/clients that write enrolled care logs without advancing the revision will be rejected and must be updated.

These improvements reduce database work substantially, but they do not establish a hard free-tier cap for all app usage. Provider calls, photos, outgoing data, history retention, function duration, retries and foreground activity still need workload measurement. Shared weather acquisition across users/plants and a complete provider budget remain separate work; no such savings are claimed here.
