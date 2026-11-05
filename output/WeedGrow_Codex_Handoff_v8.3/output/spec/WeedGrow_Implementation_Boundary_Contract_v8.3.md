# v8.3 implementation boundary contract

The v8.3 master and JSON contract are normative. `WeedGrow_Handoff_Reference_v8.3.py` supplies audited boundary helpers, not a complete production engine. This file closes implementation ambiguities; it introduces no biological coefficients or user measurements.

## One weather shape

Use the companion Weather_Sample_Contract JSON and `validate_sample` for canonical names and invariants. `kind` is exactly `occurred_estimate`, `forecast`, or `current_point`. Provider-specific origin stays in `provider/product/model_selection`; an archive record is still a grid/model estimate. `unit` is singular. All timestamps are UTC epoch seconds. `issued_at_utc` stays null unless an actual issue time is supplied by a separately verified provider adapter. Availability is recorded by the backend; preserve first acquisition for the SAME immutable source revision, not a different later correction. A refetch updates retrieval without retroactively changing availability. Source revision is a content hash in the helper; production stores immutable raw response/revision identity and its acquisition metadata.

`model_selection` records requested configuration, not a claim that an API exposed its internally resolved model. Preserve the best-match/unpinned marker and returned grid coordinates/elevation. A profile must support the actual chosen product/configuration; a successful sample decode cannot approve it.

Point and point-rate samples have equal bounds. Interval sums/means/maxima have start<end and preserve their actual period. A gust maximum cannot supply sustained hours. Daily totals live in a separate collection and cannot fill hourly gaps or be added to overlapping hourly sums. Do not sum duplicate revisions or combine sources before declared per-path selection.

## Partial failure

Reject an untrustworthy envelope/time axis for that path. Missing fields, wrong units, misaligned variable arrays and individual invalid values become null/quality/reason codes on the affected variable; other variables survive. Do not shift a short array, fill missing rain with zero, coerce strings/booleans or add negative rainfall to positive showers. Validate each rain component before summing. Explicit OpenWeather `rain:null` is unknown; absent rain may use the tested omission rule only for a complete valid point under that product contract. Failed fetches and missing rows cannot invoke it. Dewpoint fallback may fill missing RH, but must not replace invalid RH after normalization has turned its numeric value into null; `resolve_air_samples` preserves that distinction and source/time pairing.

Forecast and Archive use different rain/gust mappings. Forecast gust is the preceding-hour maximum. Archive gust is the reported point under the generic documented product; an explicitly selected CERRA product uses preceding-hour maximum. Automatic/mixed model selection does not license an invented sustained duration. Wind speed is a reported point for these hourly APIs, not an hourly sustained mean. These definitions were checked in [Forecast docs](https://open-meteo.com/en/docs) and [Archive docs](https://open-meteo.com/en/docs/historical-weather-api) on 30 October 2026. OpenWeather rain rates follow [One Call docs](https://openweathermap.org/api/one-call-3).

## From canonical samples to warning/water paths

Keep the normalized sample store distinct from a per-path view. Select source/product/revision, variable, location and validity first. Join air values only from the same compatible sample/source/time. Point air can establish crossings; duration needs a separately named representative-bin policy, with its approximation and gaps recorded. There is no implicit point-to-hour conversion. The fixed v7.4 weather objects are synthetic representative intervals, not raw API output.

The current water path consumes only supported nonoverlapping ET0/rain integrals ending by the evaluation boundary. Do not feed normalized rows directly to the v7.4 `evaluate` function: it has different names, joint-row assumptions and simplified provenance. Supply a deliberate tested production adapter/path implementation. Past forecast bins remain forecasts. If the selected archive/history feed has a recent-data gap, mark the current water path uncertain and backfill automatically; do not bridge it with reclassified forecasts. Any future forecast-driven current-state model would need its own declared domain, validation and revised contract.

At an evaluation inside an hourly integral, do not credit the full unfinished hour. An anchor/log/transition inside a bin requires supported subinterval forcing or conservative ordering/amount bounds; do not uniformly distribute a shower. Evaluate at the actual requested time, retaining an explicit gap if necessary. The current reference is not proof that this production integration is done.

## Warning state and delivery rules

W01-W05 engineering/source screens use triggered/not_triggered/unknown according to applicability and coverage. W06 maps water/not_due/uncertain to triggered/not_triggered/unknown and true/false/null. W08 is context_only when a known container and W01 trigger justify context; W01/W08 merge. W09/W11/W12 factual context uses context_only, not an infection-positive state. W10 remains disabled for an applicable plant. W07/W13/W14 use review_requested only for the matching user-initiated topic. Lifecycle/scope can yield not_applicable; disabled is an explicit model/product gate, not a substitute for missing weather.

For W11: known nonflowering ->not_applicable; unknown stage ->unknown; flowering AND (supported humid-positive OR known reachable positive rain) ->context_only. Without a positive, not_triggered requires both OR arms to be ruled out. Shelter rules out direct rain but does not rule out humid air. Complete dry rain evidence rules out the rain arm even if reception is unknown. Positive rain with unknown/partial reception remains unresolved unless an independently supported exposure rule establishes it. Missing applicable evidence ->unknown. No infection probability follows from this truth table.

The display helper accepts only flag-specific card routes. A malformed W06 context_only or W10 triggered value cannot create a card/push. All delivery gates must be booleans from trusted policy/permissions, never strings or user approval fields. Production still needs the episode/cancellation/idempotency and claim gates in WG-021; the helper sends zero notifications.

## Reference and test precedence

| File family | Use | Limits |
| --- | --- | --- |
| v8.3 master/contract/boundary contract | Current requirements | Not plant validation |
| v8.3 Handoff_Reference / Handoff_Tests | Canonical raw-weather boundary, W11 truth table, card eligibility | No full orchestrator or source classification |
| v8.3 Field_Evaluator / tests / dataset contract | Current descriptive scoring and input validation | No automatic approval or independent proof of collection integrity |
| v7.4 emulator + v7.5 independent cases | Frozen bank arithmetic, ordering/exposure examples and negative tests | Synthetic parameters; simplified provenance, transitions and app integration |
| legacy_v82 helpers/tests | Historical bank initialization, refill, transition and calendar examples | Old raw-weather and display functions are superseded by v8.3; their tests do not define new adapter behavior |
| v8.1 air helper/tests | Narrow paired-air RH fallback | No leaf/soil wetness or infection estimate |
| weather fixtures/evidence | Frozen public-coordinate examples and recorded parser defects | Not uptime, actual local weather truth or app success |

Never use unapproved `water.candidate` as a production decision. Do not change fixed expected answers to match new code. A newly ported implementation must test the current contract, including negative cases; preserving an outdated adapter defect for parity is not required. The documented 178 baseline checks include legacy tests. New checks supplement them; test counts are engineering evidence only.

## Field data and denominators

Use Field_Dataset_Contract_v8.3.json and Field_Dataset_v8.3.json for evaluator input. The old v7.5 template is collection guidance, not a serializable evaluator case. Its explicit mapping is in the v8.3 contract. Do not blindly rename or infer a missing observed label, group, time or criterion. Unknown adjudication state is an error; pending is explicitly excluded. Report selected and pending counts plus adjudication coverage so selective labeling is visible. Decision coverage uses adjudicated eligible cases. Report both FP/negative cases and FP/all water recommendations; their denominators answer different questions. Neither gets an invented acceptance target.

All research/reference measurements stay outside normal-user inference. Outcome criterion, sample sizes, meaningful accuracy/coverage targets, actual production freshness/cadence and regional source mappings remain explicit release decisions. An agent can implement gates/configuration/tests now; it must not fill scientific unknowns with fabricated constants.
