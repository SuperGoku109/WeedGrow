# Hops care production readiness — 5 November 2026

Deployment status: [6 November deployment attempt](backend-deployment-2026-11-06.md): Firestore rules/indexes are live. Functions are still absent because Firebase blocks deployment on the project's Spark billing plan; the user must enable Blaze. Deployment configuration, region and a continuation command are prepared. Earlier statements below describe prior local-only increments.

Live investigation: [6 November unavailable-estimate diagnostics](watering-unavailable-debug-2026-11-06.md) confirmed zero deployed functions in the preview's Firebase project and a missing care pointer, despite eight journal-weather dates. Diagnostic messaging is now specific. Latest full verification: **110 suites / 860 tests** plus Firebase integration. Local implementation must not be described as a live deployed service.

Latest relevance check: [6 November warning-noise audit](warning-noise-audit-2026-11-06.md): explicit wind/rain boundaries, grouped storm cards, expired-condition removal and reduced ordinary-rain clutter. All verification stages passed, including **108 suites / 844 tests** and Firebase integration.

Latest weather extension: [6 November storm/hail/disease scenarios](storm-disease-scenarios-2026-11-06.md): structured OpenWeather thunderstorm preparation, unknown mildew fallback, safer hazard revisions and **107 suites / 720 tests**. Live hail-source mapping and disease prediction remain unavailable.

Latest review: [6 November specification/factor audit](watering-spec-audit-2026-11-06.md), including per-variable rain isolation, checkpoint recovery, actual decision explanations and **106 suites / 632 tests** plus Firebase integration. The earlier counts below describe their respective increments.

The code now has a protected backend care path, owned app consumption, independently gated weather-preparation cards, expiry, bounded collection and release checks. **The full automatic watering product is not production-ready.** The user confirmed that no real hops calibration/validation data or approved profile exists. No model/profile was invented or enabled, and no cloud deployment or production provider call was performed in this work.

The subsequent [watering/weather integration](watering-weather-integration-v8.4.md) replaces the earlier hard-coded watering lock with protected profile approval, automatic archive acquisition/backfill, production replay/checkpoints and app consumption of supported determinate results. Weather/profile/coverage gates still apply. The new document supersedes earlier statements here that describe the feed connection or public watering route as entirely absent.

## Implemented release hardening

- `functions/src/careOperations.ts` reads the authoritative plant and server-only `careConfiguration/weather`. It publishes `plants/{id}/care/current` and an atomic server-owned pointer on the plant. The pointer does not retrigger evaluation of unchanged inputs. Input/configuration races and older evaluations cannot overwrite newer advice.
- `functions/src/careWeather.ts` supports the existing One Call metric product through the canonical adapter. Only the backend holds its secret. Requests have an explicit timeout, redirect rejection, streamed body limit and pre-normalization row bounds. Raw provider failures never expose URLs, keys or provider response text in published advice.
- Content revisions and original availability are preserved in separate immutable records. A scoped cache avoids unnecessary requests; distributed leases coalesce concurrent acquisition for the same plant/scope. Failed acquisition receives a configured retry delay. A protected daily reservation counter limits this care collector's calls. This counter does not cover the older, separate garden/display weather collectors.
- The scheduled maintenance already used by the app now refreshes a bounded page of care evaluations. Plant setup changes and care-log changes also trigger refresh. Deleting plants are excluded. An exhausted budget/outage leaves care unavailable rather than retaining an unsupported recommendation.
- App consumers accept only protected snapshots matching the actual setup/log/location dependency key and server pointer. Changed setup, wrong revisions, invalid shape and expired results are rejected. A weather-only release cannot carry a definite watering decision; the separate protected water release now supports it.
- The detail screen shows supported heat/cold/wind/rain preparation and shared ambient context. Heat/container and related rain/humidity/flower notes are grouped. These are engineering weather screens, not injury or infection predictions. Forecasts remain forecasts. Point RH is not promoted into hourly humid exposure.
- Cards expire while the screen is open using the app clock. Weather/context cards do not create health-check tasks or automatic pushes. Existing user-selected routine reminders remain separate from water-model decisions.
- The plant editor now offers optional direct-rain reception and meaningful medium fields. A partly sheltered plant never becomes an invented 50% delivery fraction. Old missing/unmatched facts remain unknown. Unknown growth stage is now an explicit supported choice through forms, models, rules, backups and display.
- Rules reject client changes to policy, care snapshots, acquisition records and the server pointer. Owned users can read their care snapshot and clean up the protected subcollections while deleting their plant. Backups omit the pointer and private acquisitions while retaining the optional setup facts.
- Index exemptions are included for large raw/sample/evaluation fields. Acquisition/usage records contain configured expiry timestamps, including abandoned leases. The cloud TTL policies still need to be installed and verified before source activation.
- The bundled profile approval registry remains empty. The backend can now decode full immutable approved profiles from protected watering configuration. No real record has been installed. Client flags cannot supply this approval.
- Repository lint covers production/source/tooling code and excludes generated research/artifact directories (`output`, `tmp`). Architecture checks explicitly verify that algorithm source remains checked.

## Configuration and staging procedure

The default is disabled: an absent, disabled or incomplete policy produces no new care-provider requests and cannot enable weather cards. There are no invented production freshness/retry/retention values. This disabled template illustrates the protected document's shape; the nulls must be resolved through actual source/operations review before enabling it:

```json
{
  "enabled": false,
  "version": "UNRELEASED-8.4",
  "product": "onecall_metric",
  "licensingEvidenceId": null,
  "adapterReviewId": null,
  "maxAcquisitionAgeSeconds": null,
  "maxCurrentAgeSeconds": null,
  "maxForecastLeadSeconds": null,
  "requestTimeoutMs": null,
  "retryAfterSeconds": null,
  "retentionSeconds": null,
  "maxRequestsPerDay": null
}
```

1. Review the chosen provider's actual terms, product access and field semantics against the [One Call documentation](https://openweathermap.org/api/one-call-3). The existing `OPENWEATHERMAP_API_KEY` backend secret is the credential binding; no key belongs in the policy or snapshot. No subscription change is made by the code.
2. Configure reviewed versioned operational values and evidence IDs using privileged administration in a staging project. Numeric implementation bounds prevent unlimited requests, but are not recommended freshness targets or an agronomic policy. The request budget applies to care acquisition; size the complete application's other provider usage separately.
3. Deploy the reviewed rules/indexes/functions to staging. Enable and verify Firestore TTL for `expiresAt` in the `careWeather` and `careUsage` collection groups. This weather cache supplies no active water anchor, so TTL is not allowed to masquerade as a water-history retention policy.
4. Test real credentials/provider responses, function event delivery, source expiry, quota failure, policy rollback, ownership and setup/move races. Local tests use mocked provider HTTP; they do not establish live service access, licensing, uptime or operational capacity.
5. Verify the installed Android/iOS app, background/resume behavior and actual routine-notification delivery. Render/unit tests and emulator data tests do not establish physical-device notification delivery.
6. Enable only the reviewed weather-preparation slice. Turning its policy off is picked up on the maintenance cycle and changes to snapshots; already displayed data is bounded by the configured expiry. Instant offline remote revocation is not claimed. No weather push route is activated.

## Automatic watering remains a separate release

Watering cannot be enabled through the weather policy, client fields or synthetic test fixtures. A complete water release still needs:

- A predefined hops care endpoint, preregistered acceptance criteria and an independently reviewed validation protocol.
- Genuine training/tuning data, identified total-loss/capacity/refill domains, and independent held-out outcomes supporting immutable approved profiles. There is no fixed accuracy or sample-size target invented by this implementation.
- Configure and verify the new selected ET0/occurred-liquid-water archive collector against actual recent coverage and source/operating-domain review. The separate current/forecast point-weather collector is not that history feed. Past forecasts cannot fill archive gaps.
- Measure useful current-decision coverage and extend the bounded history storage path for the intended production lifetime. The production replay and public snapshot route are now connected in code; no live availability or agronomic accuracy is established by that connection.
- Any future notification episodes, cancellation/escalation and claim-specific release review. Predictive disease remains disabled.

The existing handoff evaluator/dataset contract remain available for future independent data collection. Its empty dataset is not an outcome study. The older task status tables remain a history of the earlier increments; this document records the new backend/weather/setup work without marking the remaining science or water integration tasks complete.

## Water algorithm engineering follow-up

Missing calibration data does not prevent implementing the remaining mechanics. The following are now implemented and tested with explicitly synthetic profiles:

- History replay supports bounded date-only and within-bin watering times, revisioned edits and tombstones, source revision windows, and zero/full delivery bounds for unknown or partial rain reception. Unsupported forcing intervals still return uncertainty; rainfall is never uniformly prorated.
- Dated compatible demand changes carry each explicitly mapped scenario. Physical root-zone changes reinitialize uncertainty instead of scaling stored water. Ambiguous event/transition order and incompatible delivery changes remain explicit unsupported cases.
- Checkpoints bind the engine, original anchor, profile/setup sequence, selected past forcing and event revisions. Corrected or deleted history rejects checkpoint reuse and replays the original retained history. Missing retained history cannot be repaired by trusting a stale checkpoint.
- Conditional forecast projections report within-bin crossing windows and horizon censoring. Loss-first crossings before a later refill are retained. Forecast rain never cancels a current watering decision or changes historical state.
- Backend log capture rereads authoritative current documents, persists immutable event revisions, and detects unsynchronized or truncated histories. Setup facts preserve source-write boundaries independently of trigger arrival order. Server-owned ledger counters participate in care dependencies.
- A privileged, non-callable shadow-run helper reconciles recorded setup facts, freezes inputs/results and persists reusable checkpoints. Private output never updates the public care snapshot or watering pointer. Client writes are denied; plant deletion cleans up these records. Large shadow/checkpoint maps are exempt from indexing.

This closes specific engineering gaps from the earlier review. It does not establish full specification conformance, live history coverage, agronomic accuracy or a deployable automatic watering release. No history source, approval profile, notification episode system or production activation is fabricated by these changes.

## Verification

`npm run verify` now runs through app/backend types and build, repository lint, architecture checks, the full Jest suite, and local Auth/Firestore integration. The new `scripts/test-care-production.cjs` is included in that gate. It refuses non-demo/non-emulator environments and tests the actual backend operations with synthetic provider responses and no live API calls.

The care integration checks cover disabled defaults, protected snapshots, no watering activation, positive independent weather screens, cache reuse, immutable acquisition, distributed concurrency, configured request limits, stale/in-flight setup and config rejection, outage backoff, response-size rejection, foreign/forged access denial and deletion cleanup. Unit tests additionally cover app snapshot decoding, card gates/expiry, grouping, and unknown-safe setup.

Final `npm run verify` after the watering/weather integration: **passed all stages**, including **105 Jest suites / 580 tests** and all local Firebase integration checks. Added cases exercise the complete ET0/rain-to-public-decision route, due/not-due/unknown, log corrections and omitted amounts, checkpoint invalidation, source gaps, configuration races, approval revocation and protected storage. The earlier replay/ledger/checkpoint increment passed 104 suites / 575 tests. No production secrets or live provider calls were used. Passing software checks does not authorize the live release or prove plant-care accuracy.
