# WeedGrow v8.0 - implementation master specification

30 October 2026. This is the single normative reading document for new implementation. It consolidates the practical v7.2 scope, v7.3 architecture, v7.4 corrections and v7.5 independent tests. Those older files are evidence/reference history; this document and the companion contract control new work. No application integration or agronomic validation is claimed.

## 1. Deliverable and readiness boundary

The product estimates whether outdoor watering is due, prepares growers for supported weather, and describes relevant ambient disease conditions. Its routine workflow is simple setup plus watering logs, with amount optional. It must not require daily moisture checks, sensors, leaf/root temperatures, photos or repeated plant measurements.

The engineering foundation is specified below. Production watering activation additionally requires approved calibrated profiles, valid initial-state ranges, real low-input validation, source adapters and consumer integration. Predictive disease alerts remain disabled. A specification and passing logic tests cannot guarantee perfect care.

One-time inputs: location, outdoor environment, pot/ground, approximate pot volume with units if known, stage with unknown option, sun category, soil/canopy rain reception and optional meaningful medium. Existing dated age/origin and height may select supported profiles. Unknown facts use a separately supported aggregate profile or uncertainty; they do not force another measurement.

## 2. Non-negotiable output semantics

`water`, `not_due`, `uncertain` map to `needsWater=true`, `false`, `null`. Missing, disabled and unsupported must never become false. `not_due` applies at the evaluation time; it is not a full-day guarantee.

Every warning returns a stable ID, state, reason codes, evidence, phase, coverage and applicability. States are `triggered`, `not_triggered`, `unknown`, `not_applicable`, `disabled`, `context_only`, `review_requested`. Screen-not-triggered is not a no-disease/no-harm guarantee. Context is not infection detection. No probability is output without a separately calibrated model.

The response also carries engine/profile/policy versions, evaluation UTC, location revision, data revision fingerprint and next evaluation time. Internal synthetic candidate values must not leak into the user-facing production decision. No exact watering dose is part of this scope.

## 3. Trust boundaries and units

Client facts and logs are assertions from the grower, with unknown/stale/precision metadata. Weather comes through trusted backend adapters. Client-supplied `approved` or `adapter_verified` values must not activate a production model or authenticate a source event. Approval records and profile versions belong in protected server configuration.

Normalize water to litres, rain depth to millimetres, area to square metres, air temperature to Celsius, RH to percent, wind to m/s and timestamps to UTC seconds or an explicitly declared application equivalent. A raw unitless pot string is not litres. Gallons require a declared gallon standard. UI waterLevel and sensorProfileId are not actual moisture evidence.

## 4. Weather contract and coverage

Each variable has provider/product, units, time support, issue/availability times, location revision and validity interval. Distinguish points, interval means, representative bins, maxima, sums and rates. A point uses identical start/end and cannot fill an hour. An hourly maximum gust is not an hour of sustained gust-speed wind.

Separate occurred estimates, current points and forecasts. Archived forecasts remain forecasts of the past. Select declared provider/product/revision per path before integration; never sum overlapping sources. Equal-authority conflicts or unresolved overlapping integrals make that path unknown. Reject invalid variables independently so bad RH does not erase valid wind evidence.

Rain missing is not zero unless the tested provider contract establishes zero. Current rate can establish a weather crossing but supplies no retained-water volume without an integration interval. Snow and frozen precipitation are not automatically available liquid water. Boundary bins need a tested adapter; do not silently prorate a shower uniformly across time.

Coverage is per variable and path. Complete ET0 plus required rain supports water replay even when RH is missing; soil sheltered from direct rain need not require rain for its direct-water component. Missing forecast data blocks projection, not an otherwise supported current decision. A supported positive threshold crossing can survive gaps; an absent crossing cannot be declared complete when data is missing.

Backend freshness/expiration policies are source-specific, versioned engineering configuration. They remain to be agreed and tested for actual products. Historical issued/fetched age is not treated identically to forecast freshness.

## 5. Canonical log and transition contract

Use stable event identity and authoritative revision. Duplicate retries count once; distinct equal-looking events both count. Edits/deletions replay affected history. A later authoritative revision clears an earlier conflict; an unresolved final conflict blocks water replay.

Use occurrence time, not editing time. A date-only event becomes a UTC interval from its calendar day and IANA timezone, capped by recorded/evaluation time. Days may last23 or25hours. Keep earliest/latest timing alternatives; do not invent noon. Exact-now watering is applied after history through that evaluation boundary. Events straddling an anchor require reconciliation.

Repot, medium, stage, root access and location changes require dated transitions. New volume does not create water. Carry existing water only through a supported transformation; otherwise reinitialize with defensible ranges. Do not apply today's flowering profile to an entirely vegetative past. The current reference abstains on unhandled transitions; it does not implement a complete growth model.

## 6. Profile model: make parameters identifiable

The base model uses one total effective loss coefficient `a_eff` in m2, equivalently litres per millimetre of ET0. Loss for an interval is `ET0_mm * a_eff`. This is an empirical effective coefficient, not actual leaf area or pot-opening area.

IMPORTANT CORRECTION FOR CALIBRATION: the reference expresses loss as `ET0*(plant_loss_m2 + surface_loss_m2)`. When both multiply the same ET0, total-loss data identify only their sum. Do not fit/publish them as independently identified physiological components. A compatibility adapter can set legacy plant_loss_m2=a_eff and surface_loss_m2=0. This does not mean real soil evaporation is zero. Separate components require independent evaporation references or distinct supported forcing; ordinary growers are not asked for them.

Profile parameters are available capacity C, action reserve A, initial reserve scenarios, total effective loss, rain catchment/delivery and retained-refill scenarios. Each has units, evidence, scope and uncertainty. Pot/ground, medium, stage, sun and optional dated age/height select supported profile domains, not universal additive weights. Unknown amount is not a full refill. Generic strain categories cannot supply resistance, roots or stomatal parameters.

Required profile metadata: immutable ID/version, care-outcome criterion, validation evidence, supported setup/climate/source/operating domains, state-anchor basis, transition policy and approval record. The existing reference checks only part of this contract; production domain/approval enforcement is a required implementation task. No approved profiles are bundled.

## 7. Current water calculation

```
C = accessibleVolumeL * (thetaUpper - thetaLower)  // only if supported
RAW = p*C                                        // allowable depletion
A = C-RAW                                        // remaining action reserve
rainL = liquidRainMm * effectiveCatchmentM2 * deliveryFraction
irrigationL = appliedLOrSupportedScenario * retainedFraction
potentialLossL = ET0mm * totalEffectiveLossM2

// inputs-first available-water bank
excessL = max(0, R + rainL + irrigationL - C)
storedL = min(C, R + rainL + irrigationL)
extractedL = min(storedL, potentialLossL)
nextR = storedL - extractedL
R + rainL + irrigationL = nextR + excessL + extractedL
```

One mm over one m2 is one litre. Nominal pot litres do not identify catchment, filled/root-accessible volume or retention. Study-selected p values are not universal care thresholds. This bank is available water above a lower reference, not total water or measured soil-moisture percent. Excess is accounting, not actual waterlogging; unmet potential loss is not actual transpiration.

Replay coherent scenarios, including supported timing/input-loss ordering alternatives, rather than independent arbitrary parameter extremes. Water if every supported R<=A; not_due if every supported R>A; otherwise uncertain. A numeric tolerance handles floating arithmetic only. Release requires an approved profile plus supported state/history/domain. No majority vote, mean-reserve shortcut or watered-today override is allowed.

ET0 already combines weather demand; do not add unvalidated heat/RH/wind/UV/daylength drying bonuses. A total loss coefficient already including evaporation must not add evaporation again. Fixed loss is a limited model, especially after stress; validate its operating region before activation.

## 8. Projection and exposure

Current replay credits only occurred water. Forecast trajectories start from current supported states and keep rain uncertainty separate. No-rain/provided-rain branches are conditional examples, not a complete meteorological error envelope. Missing forecast coverage returns unavailable projection. If any trajectory never crosses inside the horizon, the upper waiting time is unresolved/null, not the latest finite crossing. A wet forecast cannot cancel a current supported due decision.

For representative interval x_i and duration dt_i: H=sum(dt_i when threshold met); D=sum(max(x_i-threshold,0)*dt_i); L=longest contiguous known crossing episode. Reverse subtraction for cold. Gaps, unknown bins and noncrossing bins break L. Overlaps make integrals unavailable. Points can trigger without supplying duration; maxima supply no sustained exposure integral. Record the representative-bin approximation explicitly.

Keep recent/current screen, historical24h exposure and forecast24h screen distinct. Yesterday's high exposure is not automatically a current heat event. Example only: at32C screen,34C for1h and36C for2h gives3h crossing and10C-hours exceedance. These are weather metrics, not injury probabilities.

## 9. Single warning decision table

Numerical weather screens and RH90% context are engineering candidates, not calibrated cannabis damage/infection thresholds. Current and forecast evidence retain their phase. All14 routes execute independently so a water gap cannot hide a valid source hazard.

| ID | Output | Determination |
| --- | --- | --- |
| W01 | Heat preparation | Known air T>=32C in recent/current or forecast phase OR verified applicable heat event. Duration/exceedance are descriptive; no injury probability. |
| W02 | Cold/frost context | Air T<=5C; nested possible-frost context<=2C and air-freezing context<=0C, or verified source event. No tissue-temperature claim. |
| W03 | Wind preparation | Known gust>=15m/s OR mean wind>=10m/s OR verified source wind event. Gust maxima supply no sustained duration. |
| W04 | Rain preparation | Known point/interval rate>=10mm/h OR nonoverlapping known amount>=25mm within declared24h window OR verified rain/flood event. Point rate supplies no retained volume. |
| W05 | Source hazard | Latest trusted mapped event, matching location and valid window; noncancelled/nonconflicted. Preserve source type/severity. No coverage means unknown. |
| W06 | Watering | Approved supported profile/state/history: all R<=A ->water; all R>A ->not_due; otherwise uncertain. Unapproved model always uncertain. |
| W07 | Excess-root-water review | Only a user-initiated matching problem topic. No automatic weather-only root saturation/rot inference. |
| W08 | Container heat context | Known pot context plus W01; merge with heat. Ground ->not_applicable; unknown pot/ground ->unknown. |
| W09 | Humid-air context | Known modeled RH>=90% bin exposure>0, with phase, coverage and representative-value assumption. Not dew or leaf-wet hours. |
| W10 | Predictive PM | Disabled until validated native low-input model exists. No mandatory high-RH/rain gate; keep ambient evidence without infection probability. |
| W11 | Flower weather context | Reported flowering AND(reachable positive recent/current/forecast rain OR supported humid-air context). Unknown stage/reception remains unknown when relevant. No infection prediction. |
| W12 | Wet-canopy context | Reachable positive recent/current/forecast rain ->context_only. Missing relevant rain ->unknown; direct rain sheltered ->not_applicable. Complete declared dry windows can establish only screen not triggered. |
| W13 | Establishment review | Known establishment stage plus matching optional problem topic. Unknown stage ->unknown. No automatic damping-off prediction. |
| W14 | Root/wilt review | Matching optional root-wilt problem report. No automatic disease diagnosis or watering from wilt alone. |

Use paired same-interval air values for VPD and humidity context. Air VPD=`0.6108*exp(17.27*T/(T+237.3))*(1-RH/100)` kPa. It is not leaf VPD, soil moisture or a direct litre estimate. Humidity history is not measured leaf wetness; shelter from rain does not eliminate ambient humidity.

## 10. Cache, scheduling, cards and delivery

Deterministic evaluation uses an explicit time, immutable input snapshot, engine/profile/policy versions and canonical event/weather revisions. Cache keys include location, environment/lifecycle, pot/ground, used volume/medium/stage/sun/age/height, both rain-reception fields, anchor, logs, forcing revisions and model/policy changes. A future port must test those dependencies against actual app consumers; no application integration has happened yet.

Schedule reevaluation on new events/corrections, relevant fact/profile changes and source/data expiration, plus an agreed backend cadence. A daily bucket alone is insufficient. Stale cached advice must retain its old timestamp and become unavailable when its validity expires.

Merge heat/container and shared wet-weather context cards. Deduplicate one source episode across W01-W05 while retaining distinct hazards. Notification eligibility additionally requires product policy, app permission/subscription, episode/cooldown and validated claim. Cancellation removes current source evidence; escalation can bypass repeat cooldown. Dismissal/snooze/watering never resets biological or weather evidence. The reference sends zero notifications.

## 11. Calibration and real outcomes

Ordinary users continue basic setup plus watering logs. A separate research/opt-in cohort provides independent water/state/loss/retention references. Account for drainage, interception and non-water mass changes when choosing reference methods. Define the desired care endpoint before labeling cases; survival, wilting, yield response and a raw moisture percentage are not interchangeable targets.

Fit identifiable total-loss/state/refill profiles using training data. Choose model/policy on tuning data. Freeze predictions and holdout criteria before evaluating test outcomes. Separate growers/plants across partitions and evaluate future seasons/regions; hours from the same grower must not leak across splits. An analysis based only on watering timestamps cannot independently identify every storage/refill/loss parameter or prove that the grower watered at the right time.

The new evaluator checks watering outcomes only. Each adjudicated case requires case/group IDs, split, criterion, boolean independent label, decision, reference method/adjudicator and timing provenance. `latest_input_available_at_utc` means when information was available, not the forecast's future valid time: forecasts issued before evaluation are allowed; later observed/revised weather is not. Prediction freezing must precede label revelation. Empty/pending labels never become negatives.

It reports counts, decision coverage, accuracy/sensitivity on decided cases, all-positive capture, false watering per negative, explicit misses and due cases left without a water recommendation, including abstentions. For1TP/1TN/1FP/1FN plus1uncertain positive/1uncertain negative: coverage4/6, decided accuracy2/4, positive capture1/3. An accurate small decided subset cannot hide low coverage. Empty eligible data is not_evaluated; invalid/leaking evaluations suppress metrics. The tool never authorizes release, and it does not supply disease-performance or confidence-interval validation.

## 12. Release gates and remaining decisions

The companion release-policy file deliberately leaves numerical acceptance targets null. These must be preregistered by product/agronomic owners before holdout labels are used: minimum independent plants and positive/negative cases, minimum useful coverage, acceptable unnecessary watering and acceptable unaddressed due cases. Independent statistical review must consider uncertainty and domain coverage, not only point metrics. No arbitrary accuracy percentage is declared here.

Approval requires predefined outcome criterion, calibrated versioned profiles, independent domain validation, approved statistical review, source adapter tests, consumer integration and notification-policy checks. A later data/model/profile change reopens relevant gates. Validated synthetic tests are necessary for engineering consistency but cannot approve these agronomic gates.

Implement foundation and source-weather preparation first; run water model in shadow mode with debug estimates, no care activation. Validate supported container domains before broadening to ground/establishment. Keep predictive disease models disabled until prospective outcomes support their scope. Do not silently weaken the low-input promise to improve results.

## 13. Acceptance and implementation work

These are required integration tests and evidence gates, not claims that the app already passes them.

| ID | Area | Given / event | Required result | Current status |
| --- | --- | --- | --- | --- |
| I01 | Provider normalization | Real fixture current rate, hourly amount, daily total and point/max values | Correct units/time support; no overlapping sum or invented duration | specified_app_integration_pending |
| I02 | Source and historical selection | Observed-estimate, archived forecast and multiple-provider versions overlap | Declared selection per path; forecasts do not become occurred history; unresolved integral conflict is unknown | reference_cases_pass_adapter_pending |
| I03 | Calendar and logs | Date-only entry on23/25h IANA calendar day; backdate/edit/delete/retry | Correct UTC bounds; occurrence-time replay; exact-now water applied; retries idempotent | UTC_reference_pass_calendar_adapter_pending |
| I04 | Nullable output consumers | Watering unavailable but valid heat/hail event exists | needsWater remains null everywhere; independent hazard survives; no false all-clear | reference_pass_app_consumers_pending |
| I05 | Lifecycle and transitions | Repot/move/stage/medium/root-volume change occurs after anchor | Supported dated state transition or explicit reinitialization; new capacity creates no water | reference_abstention_pass_transition_model_pending |
| I06 | Dependency invalidation | Change used setup/log/weather/profile/policy/anchor revision | Advice cache key changes and affected history replays; stale advice cannot be served as fresh | app_integration_pending |
| I07 | Forecast and censoring | Wet forecast follows current low reserve; some future paths never cross | No current rain credit; no finite upper wait when censored; missing forecast does not erase current result | reference_pass_app_copy_pending |
| I08 | Warning contracts | Run all14 IDs with missing, zero, partial and conflicting data | States/reasons/phase/coverage survive; disease remains disabled/context; roots are review-only | reference_pass_adapter_pending |
| I09 | Notification episodes | Source alert updates, cancels, escalates or is retried | No duplicate delivery; cancellation removes active event; escalation bypasses repeat cooldown; no biological reset | planning_reference_pass_delivery_integration_pending |
| I10 | Low-input validation | Normal prediction receives only setup/logs/API; staff references hidden | Independent labels and held-out groups; report coverage, unnecessary water, misses and uncertain positives | requires_real_outcomes |
| I11 | Release protection | Client supplies approved:true or an unregistered profile version | Cannot enable care model; only trusted approved registry can activate supported domains | reference_gate_pass_server_registry_pending |
| I12 | Source freshness and expiration | Forecast or source event exceeds its declared validity/policy | Stale values rejected; expiration triggers reevaluation; no universal invented freshness default | policy_and_integration_pending |

## 14. Reproducible test commands

Run from the extracted spec directory with Python3.10+ and the standard library:

```powershell
python WeedGrow_Independent_Tests_v7.5.py --include-existing
python WeedGrow_Field_Evaluator_Tests_v8.0.py
python WeedGrow_Field_Evaluator_v8.0.py WeedGrow_Field_Dataset_v8.0.json
```

The first command runs115 reference checks, the1,000 seeded bank trials,96 exhaustive parameter sets and7 deliberate fault checks. The second runs14 independently checked evaluator cases. The third intentionally refuses the empty/unconfigured field dataset: a real predefined criterion and independent outcomes are still needed. The scripts are offline and write only their local reports. No application, live plant or notifications are changed.

Do not regenerate expected answers from a changed engine merely to make tests pass. Any legitimate model/contract change needs independent rationale, revised scope and reviewed expected conclusions. Keep measured holdout labels outside tuning. Preserve failed cases as regressions.

## 15. Complete factor ownership ledger

Every factor has an explicit role, including legitimate no-direct-effect or unsupported paths. The rules in sections3-9 override outdated wording in earlier references.

| Factor | Algorithmic role | Outputs |
| --- | --- | --- |
| F01 Location / timezone | Select weather scope and local-day conversion. Location revision mismatch rejects old forcing/state; IANA day bounds may be23/25h. | all |
| F02 Outdoor / greenhouse / indoor | Outdoor weather can prepare for external hazards. It cannot supply internal humidity or the indoor watering model. | W01-W06; health scope |
| F03 Plant lifecycle | Archived, harvested, dead or deleting: no active care cards or notifications. | all |
| F04 Pot versus ground | Match separate supported model domains. Never convert pot litres into a ground root-zone profile. | W06; W08/action context |
| F05 Pot size and units | Explicit litres or explicit converted units. Match profile/storage ranges; no unitless litre assumption or catchment from volume. | W06 |
| F06 Medium family | Select supported retention, delivery and loss profiles. Unknown needs a separately validated aggregate profile. | W06 |
| F07 Soil provenance / layout | Native, raised or store-bought alone does not establish texture, FC or PWP. No hydraulic coefficient from this label. | no direct numeric effect |
| F08 Reported growth stage | Match growth profile; flowering gates W11; establishment contextualizes optional review. Stage changes need dated transition handling. | W06/W10/W11/W13 |
| F09 Dated age and origin | Compute effective age only when known/datable; seed and clone origins must match the profile. No exact roots or flowering from age. | W06 profile selection |
| F10 Dated height | Use only within profile freshness/domain; otherwise explicit aggregate fallback. It is not measured leaf area or plant consumption. | W06 profile selection |
| F11 Sun category | Select validated exposure profile. Full/partial/shade is not a measured radiation fraction or a fixed extra drying bonus. | W06; action wording |
| F12 Soil rain reception | No: zero direct rain. Yes: supported catchment/delivery. Unknown: bracket zero/full; partial: supported bounds. | W06 |
| F13 Canopy rain reception | Direct rain forecast adds wet-canopy/flower preparation only if reachable. Shelter does not remove ambient humidity. | W11/W12 |
| F14 Watering occurrence time | Replay in occurrence order, including known events at evaluation time; never use edit time as the watering time. | W06 |
| F15 Watering amount | Known amount times supported delivery/retention; omitted amount uses supported scenario ranges or abstains. Zero stays zero. | W06 |
| F16 Log time precision | Date-only event becomes earliest/latest UTC bounds capped by recorded time; branch timing, rather than invent noon. | W06 |
| F17 Edits / retries / deletions | Canonical event identity/version; duplicate retry adds no water, separate real events both count, deletion removes prior input. | W06 |
| F18 Repot / move / medium or stage change | Do not reuse a pre-change anchor. Carry or rebuild state only through a supported transition; prototype abstains. | W06; location-scoped flags |
| F19 Air temperature | Heat/cold screen and paired-air features. ET0 already contains its weather contribution; no second heat multiplier. | W01/W02; W09-W12 context |
| F20 Air relative humidity | Pair with same-interval temperature for air VPD/context. No high-RH necessary PM gate, soil-moisture estimate or leaf VPD. | W09-W12; W06 through ET0 |
| F21 Reference ET0 | Use correct interval sum; multiply by fitted effective coefficients with explicit units. Missing history ET0 blocks this water route. | W06 |
| F22 Solar radiation / cloud | Backend ET0 forcing or validated exposure profile. No UV-to-PAR replacement, extra cloud bonus or duplicate evaporation term. | W06 indirectly |
| F23 Mean wind | Mechanical weather screen; ET0 already accounts for wind in its own forcing model. Not canopy ventilation measurement. | W03; W06 indirectly |
| F24 Wind gust | Separate mechanical exposure signal; preserve m/s and source definition. Not an extra water-loss multiplier. | W03 |
| F25 Rain rate | Integrate only over its known interval for water amount; mean hourly rate cannot reveal peak minute intensity. | W04; W06 via amount |
| F26 Rain amount / liquid phase | Non-overlapping liquid-rain amount enters retained-water model. Snow/frozen precipitation needs a separate melt pathway. | W04/W06/W11/W12 |
| F27 Rain probability | Planning uncertainty only. Do not multiply rain amount by probability without provider semantics; never pre-credit current storage. | forecast planning |
| F28 Dew point | Optional paired ambient derivation/context with provenance; not leaf condensation or measured wetness. Prototype uses paired T/RH. | W09 context |
| F29 Daylight / solar night | Use local solar intervals for context. ET0/energy already reflects duration; no independent daylight water bonus. | W09; W06 indirectly |
| F30 UV index | May inform a separately scoped exposure message; not energy, water use, PAR or an automatic cannabis injury probability. | no extra water score |
| F31 Data age / gaps / overlap | Per-path variable coverage. Missing data is unknown, not zero. Positive supported hazard evidence may survive other gaps. | all |
| F32 Source hazard products | Typed verified mapping, location/validity and latest update/cancellation. No source coverage is not an all-clear. | W01-W05 |
| F33 Profile validation / version | Scope, state range, climate/source domain and approved release registry are prerequisites. No production profiles are bundled. | W06; future disease models |
| F34 Optional problem report | Route only the requested topic. A root/wilt review is not disease detection or an automatic instruction to water. | W07/W13/W14 |
| F35 No-symptoms observation | A dated optional observation; not proof of no latent infection and not a daily requirement. | no automatic disease clearing |
| F36 Optional observations / lab inputs | Moisture/pH/photos require a separate validated observation/problem path; no blind bank reset or nutrient diagnosis. Leaf/root temperatures, PAR and lab physiology remain excluded. | no required base dependency |
| F37 Cultivar / strain name | Display/research metadata; not a verified stomatal response or disease-resistance assay. | no resistance multiplier |
| F38 API soil grids | Regional soil temperature/moisture is not the water state of this pot or local rooting zone. | no measured moisture claim |
| F39 UI waterLevel / sensorProfileId | A UI gauge is not measured water; a profile ID is not proof of working sensors. | no moisture reset |
| F40 Missing watering logs | Absence of a log is not proof no water was applied. Validate real log adherence and uncertainty; do not learn dryness from compliance. | W06 validity |
| F41 Scheduler / cache / delivery state | Invalidate on all real dependencies; reevaluate automatically. Cooldown is a delivery rule, never a biological reset. | all |
| F42 Forecast versus occurred nature | Separate present replay and conditional projection. Past forecasts remain forecast estimates, not observed rain/history. | all |

## 16. Evidence and artifact precedence

The JSON contract retains38 source records. Published measured values, author-selected protocols, derived arithmetic, engineering policy and calibration-required values must remain distinct. No new biological coefficients are assigned by this consolidation. The v7.4 executable remains an offline reference; v8 specifies production contracts it does not yet fully implement. In particular, total-loss identifiability, full domain validation, real provider/calendar adapters and app consumer integration are explicit handoff requirements.

The v7.5 independent known-answer catalogue and field-template guidance remain included. v8's field dataset/evaluator defines the executable scoring format. Its fields must be populated by trusted evaluation code and independent reference records, not filled by guessing outcomes. App source files remain unchanged.
