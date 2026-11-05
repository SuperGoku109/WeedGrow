# WeedGrow - Predictive outdoor care

SPECIFICATION v5.2  |  29 OCTOBER 2026  |  RANKED FACTORS AND COMBINATIONS

Purpose: predict whether watering is due, estimate the root-zone water condition, and provide useful weather and health-risk warnings. Ordinary users log watering; routine moisture checks are not required. Designed for beginners and minimal ongoing data entry.

Normal supported experience: Watering recommended or No watering needed yet, clearly marked as an estimate. The engine maintains a water-balance estimate between events. It asks for extra information only when that information can resolve a material uncertainty.

## Status

This version supersedes the inspection-first product contract in v4.0. It authorizes model-based watering recommendations without a fresh moisture observation when the setup and prediction method have demonstrated adequate performance. It does not claim that pot size, weather and plant size uniquely identify real root-zone moisture. The v5.2 warning contracts now define relevance, trigger, factor effect, missing-data outcome and claim limits for every listed warning. v5.2 adds ordinal factor priorities, explicit combinations, shared pathways and executed reference checks; numerical causal weights remain unestimated.

Research-backed design, not a deployed or field-validated algorithm. Model parameters, supported setup profiles and prediction error remain to be established. Code defects identified in the earlier review still need implementation/retesting. No application code is changed by this specification.

## Evidence labels

| Label | Meaning |
| --- | --- |
| SCI | Established relationship supported by primary sources. |
| ENG | A product/engineering decision, including the low-effort user workflow. |
| CAL | A model parameter or claimed predictive performance requiring measured validation. |
| CODE | A finding from the earlier local-code audit, not proof of current deployed behaviour. |

The source literature supports water accounting and environmental exposure warnings. It does not provide a universal, validated cannabis-in-any-pot algorithm. The spec includes explicit alternatives for quantities that remain unidentifiable. Equations and example scenarios below are distinct from measured crop accuracy.

<!-- page break -->

# 01  Product decisions now fixed

USER REQUIREMENTS REPLACE THE DAILY-CHECK POLICY

| Requirement | Normative behaviour |
| --- | --- |
| A useful watering decision | Estimate water_now or not_due in supported normal conditions. Use simple wording and a short reason. Never present a model estimate as a sensor reading. |
| Watering is the routine user event | One-tap Watered with actual occurrence time. Existing optional amount remains optional. No daily root-moisture questionnaire. |
| History drives current state | Integrate weather, estimated loss, received rain, applied irrigation and storage from the last usable state, with uncertainty carried forward. |
| Age, stage, size and ground matter | Use these as distinct development/storage/loss features where their meaning is known. Do not combine them into arbitrary additive day deductions. |
| Rain reception question | Add a clear setup question about rain reaching this plant soil/container; preserve per-plant overrides and effective dates. |
| Beginner workflow | Ask simple one-time setup questions, offer Not sure, explain what missing information changes, and reuse saved answers. |
| Unreliable estimates need alternatives | Use a verified setup profile, a limited calibration step, optional automation/sensors or a one-off exception check. Do not force a definite answer outside demonstrated support. |
| Problems and prevention | Separate destructive-weather alerts, predicted water stress and disease-conducive conditions. Provide short, relevant preventive steps; no weather-only diagnosis. |

## v4.0 rules retired

- A recent manual moisture check is no longer a prerequisite for every watering recommendation.
- A two-hour manual-observation expiry does not turn every normal plant into a check request. Observation uncertainty ages through the physical/predictive model.
- The generic 12/24-hour inspection schedule and <=5 L small-pot reminder rule are removed as physiological baselines.
- The engine does not forbid all modelled rainfall replenishment: it estimates received/infiltrated rain with explicit assumptions and bounds, after rain actually occurs.
- The system must still distinguish unknown from not_due. Forced Boolean certainty when the state is unidentifiable would mislead beginners.

A model-driven irrigation approach is established in agriculture. It requires a state estimate and characterized incoming/outgoing water, rather than the date of the last watering alone. [R01](https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/) [R02](https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/evapotranspiration-based-irrigation-scheduling-or-water-balance-method)

<!-- page break -->

# 02  What can be estimated honestly

THE KEY LIMIT IS IDENTIFIABILITY, NOT THE AVAILABILITY OF A FORMULA

Weather-based accounting can estimate root-zone depletion between reference states. Initial moisture, active storage, actual water entering the zone and loss are essential. Knowing the complete outside weather would still leave those quantities unresolved if only pot volume and a Watered timestamp were known. [R01](https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/) [R03](https://www.fao.org/4/X0490E/x0490e0e.htm)

| Quantity | Feasibility with low user effort | Alternative where support is inadequate |
| --- | --- | --- |
| Past/future atmospheric demand | Estimate from documented weather inputs; compare errors by region and lead time. | Better reference ET source/local station; retain weather uncertainty. |
| Actual current root moisture | Model estimate is feasible for validated setup/initialization ranges. Exact state is not uniquely recoverable from the existing fields. | One-time reference state, tested medium/setup profile, optional sensor or occasional exception confirmation. |
| Retained water from Watered only | Event occurrence is known; retained amount is not. Watering style can narrow a validated prior. | Save normal watering style once; optional amount or one-time amount calibration. |
| Root-accessible storage | Nominal pot size alone is insufficient; medium, geometry and rooting affect storage. | Tested profile, medium/bag identification, root-establishment context or measured calibration. |
| Rain actually retained | Regional rain plus reception helps, but interception, runoff and drainage remain uncertain. | Bounded reception/catchment model; optional local rain gauge; no automatic full reset. |
| Internal flower humidity / leaf wetness | Ambient weather is only a proxy. Exact internal conditions cannot be recovered. | Condition-based flower/leaf warning, optional local instrument or event-triggered inspection. |
| Mildew or bud rot already present | Cannot be established from weather and watering logs. | Optional symptom/photo report or diagnostic support; alert to conducive conditions. |
| Exact water dose / safe-until time | Needs more storage/input calibration than a timing recommendation. | Keep first-release output to timing and a qualified future window; dose is a separately validated feature. |

Example: the same 10 L pot, plant and weather history could follow a light top-up or a thorough watering. Both appear as Watered in a timestamp-only log, but leave different reserves. No algorithm can distinguish these hidden histories without an additional assumption or measurement. This example demonstrates missing information, not poor weather forecasting.

Accuracy comes from a model tested for the intended setup range. When a setup falls outside that range, offer a concrete way to improve it. Never silently convert an unsupported assumption into certainty.

<!-- page break -->

# 03  Minimal setup and rain exposure

ASK ONCE; LOG WATERING DURING NORMAL USE

| Input | User experience / model meaning |
| --- | --- |
| Existing location/environment | Use the garden pin and outdoor classification; reuse authorized garden defaults. |
| Existing pot/ground and size | Pot volume with explicit units; ground/raised-bed type distinct. Missing size remains allowed but affects eligibility. |
| Existing stage/age/size | Reuse recorded stage and height. Optional approximate canopy category/width improves model context; no daily measurements. |
| NEW: rainReception | Question: Does rain reach the soil for this plant? Answers Yes / Sometimes or partly / No / Not sure. |
| Medium profile | One-time choose a supported mix, identify the bag, or select Not sure. Broad soil provenance is insufficient for a precise storage profile. |
| Drainage / additional supply | Simple setup options: ordinary freely draining pot, slow/blocked drainage, reservoir/self-watering, ground-connected, or unsure. Unknown specialist systems receive a tailored alternative. |
| Normal watering style | One-time usual pattern: thorough watering of the active zone / small top-ups / varies or unsure. A declared style informs a prior; it does not prove each event followed it. |
| Starting condition | Optional one-time reference: last watering and usual pattern, known current moisture, measured state, or unknown. Do not invent a full pot at signup. |

```
RainExposure = {
  reception: exposed | partial | sheltered | unknown,
  effectiveFrom, recordedAt, source: user,
  inheritedFromGarden?: string, plantOverride?: boolean
}
```

Proposed Firestore mapping: Plant.rainReception stores the enum; rainReceptionEffectiveFrom and rainReceptionRecordedAt store its dates. A bounded-query exposure-change event stores revisions/inheritance and historical changes. Do not overload permanentProtection or store an unbounded history array on Plant.

- Show the rain question during outdoor setup and allow Not sure. Existing outdoor plants receive a one-time progressive prompt, not a forced form reset.
- The question concerns water entering the soil/container, not simply whether leaves get wet. Shade cloth, a cage or permanentProtection do not answer it automatically.
- Yes does not mean 100% retention; No removes direct rainfall input but does not exclude roof runoff, splash or wind-driven entry when those pathways are reported.
- Use a garden answer as a visible default; plants under a roof can override it. A changed answer has an effective date and updates the exposure/model episode.
- If plants with unknown reception receive a storm, simulate plausible reception scenarios. Ask once if it changes the watering decision; never assume all plants were watered.

New fields require schema, permissions, backup/export, offline edits and migration support. Store absent values as unknown; an unanswered field must not quietly become exposed or free-draining.

Avoid a new long setup form: always present the agreed rain question; reuse existing data and a supported profile wherever possible. Ask medium, drainage or normal-pattern questions progressively only when they materially improve a decision. All Not sure answers remain valid, with explicit limits and alternatives.

<!-- page break -->

# 04  Watering logs with minimal effort

EVENTS UPDATE THE WATER BALANCE; THEY DO NOT SUPPLY DRYNESS LABELS

## Normal action

Watered records plant, actual time/precision and idempotent event identity. Optional volume and an unobtrusive This was a top-up exception are available. Defaults reuse the saved watering pattern, visibly labelled as assumed. Never require a moisture measurement before saving a watering.

| Event data | Model update |
| --- | --- |
| Measured applied volume | Estimate infiltrated/root-retained input using the compatible setup model and its uncertainty; do not assume all applied water remains. |
| No volume, saved normal pattern | Use an empirically calibrated event-input/post-event state distribution for that pattern and setup. Widen for variable adherence. |
| No volume, pattern unknown | Acknowledge the event; retain broad input bounds. No automatic refill to field/container capacity. |
| Small top-up | Use its own calibrated event class/optional amount. Never treat it as a thorough refill. |
| Feeding with carrier water | Link carrier water to one irrigation event; nutrient concentration is not a water-volume input. |
| Backdated/edit/delete/offline retry | Reconcile occurrence time, latest revision and duplicates; replay affected state from its checkpoint. |

A user action is not proof the plant was dry. Repeated watering habits can show a routine, but cannot alone identify actual consumption or train an accurate personalized dry-state model. Keep future learning from actions separate from independent outcome labels.

## What happens after a normal watering

Update the estimated reserve immediately and recompute. The normal card will often become No watering needed yet when the compatible model supports that result. Use wording Watering logged; estimate updated. A credible report of failed wetting, or a measured dry state after application, overrides a blind success assumption.

A thorough event can initialize near a drained reference state only where an applicable calibration supports that assumption. The field water-balance literature describes near-field-capacity initialization after adequate wetting; it does not prove every logged outdoor pot watering accomplished that. [R03](https://www.fao.org/4/X0490E/x0490e0e.htm)

## Dates and missing events

Date-only events remain time intervals. Two genuine waterings on one day remain separate. Missing logs are unknown events rather than known absence of water. An apparent contradiction may trigger one short Is this plant watered by a timer or someone else? question or an optional reference check; it must not silently fit a new loss coefficient.

<!-- page break -->

# 05  Weather inputs and their limits

HISTORY CHANGES CURRENT WATER; FORECASTS CHANGE FUTURE PATHS

| Weather factor | Role in the engine |
| --- | --- |
| Temperature, humidity and dew point | Compatible paired samples support air VPD and coherent hourly weather. Air temperature is not root/leaf temperature. |
| Radiation and reference ET | Primary atmospheric-loss driver when documented and benchmarked. Retain grass-reference method and interval. |
| Sustained wind / gusts | Sustained wind contributes to reference demand where the method uses it. Gusts support physical hazard warnings. User shelter alters transfer uncertainty. |
| Past rainfall / current rain | Non-overlapping, interval-defined received-rain estimates after the event, with source uncertainty. A current rate is not the full daily amount. |
| Future rainfall and probability | Simulate future rain and no-rain paths. Probability of occurrence is not confidence in the predicted amount. |
| Cloud, UV and daylight | Exposure context. No additional water points when equivalent effects already enter ET; UV/daylight are not measured plant PAR. |
| Regional soil variables | Optional ground-context covariates with model/layer metadata. Never a sensor reading for a user pot or edited soil bed. |
| Official weather alerts | Named hazard, geographic applicability, source, issue/start/end time and uncertainty. No returned alert is not proof of no threat. |

The current One Call adapter must keep current, hourly forecasts and daily forecasts separate and preserve their units/UTC timestamps. Official alert retrieval must be enabled deliberately; the reviewed local calls excluded it. [R13](https://openweathermap.org/api/one-call-3) Modelled reference ET, radiation and surface pressure are available from candidate meteorological products such as Open-Meteo; they still need regional assessment. [R14](https://open-meteo.com/en/docs)

## Mandatory data contract - ENG

Every series retains provider/product/version, requested and returned coordinates/role, valid interval, aggregation, units, source nature, issue/availability time, fetch time and quality. Past-dated saved forecasts remain forecasts. Do not sum hourly rain and its overlapping daily total, or treat missing intervals as zero.

Use UTC instants and plant IANA zones. Do not add timezone offsets before storing sunrise/sunset as UTC. Aggregate with true 23/24/25-hour local-day duration, and separate completed history from partial/current/future windows. Timestamp-only weather points cannot silently become an entire hour of exposure.

## Demand method selection

Prefer documented grass-reference ET from a locally tested provider or complete FAO PM pipeline. Its weather variables describe a reference surface, not actual plant loss. Paired VPD is useful context but does not close the water balance alone. Hargreaves remains a reduced-data fallback requiring regional assessment, particularly in wind/humid conditions. [R04](https://www.fao.org/4/x0490e/x0490e06.htm) [R17](https://www.fao.org/4/x0490e/x0490e07.htm)

If loss-driving data are missing, propagate a validated gap-imputation range or mark the model unsupported after its allowed gap. Do not turn an API outage into zero drying or an automatic moisture-check routine for every plant.

<!-- page break -->

# 06  A measured baseline, reused by users

PROFILE CALIBRATION REMOVES THE NEED FOR DAILY USER MEASUREMENTS

The baseline is a physical/predictive setup profile, not two days since watering. A cohort profile can be calibrated by the product team using representative plants and instruments, then used by ordinary growers who only log watering. New users are not required to reproduce the calibration experiment.

| Profile component | Required meaning |
| --- | --- |
| Supported setup domain | Pot/ground type, medium, drainage/additional supply, root establishment, plant size/stage range, climate and watering-pattern domain. |
| Accessible water storage C | Accessible reserve at the drained reference above a specified lower bound, with uncertainty. The action threshold is defined separately. This is not nominal pot volume or all water. |
| Irrigation event model | Retained-input or post-event-state distribution for thorough/top-up patterns and measured volumes. Includes normal novice variability. |
| Rain capture/infiltration model | Contributing area or depth, reception, interception/run-on and drainage uncertainty; no fixed universal rain efficiency. |
| System-loss function | Whole-system water loss in the correct units as a function of compatible weather, canopy/root development and setup. |
| Action threshold | Root-relevant moisture/depletion target derived from independent observations and an acceptable missed-dry/extra-water tradeoff. |
| Initialization and drift | Supported reference anchors, uncertainty growth, gap rules, change-point handling and out-of-domain criteria. |
| Performance evidence | Independent/held-out validation, supported ranges, parameter versions and current error/coverage/decision metrics. |

## Parameter support policy

No universal cannabis Kc, pot-water percentage, seedling litre requirement, available-water fraction or watering interval is installed by guess. Published studies can inform a testable prior; transfer to an outdoor app profile requires evidence. Cultivar and stomatal responses vary with setup and water availability. [R15](https://www.mdpi.com/2311-7524/9/4/431) [R16](https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf)

Uncertainty ranges must have a provenance: measurements, documented product data, externally assessed estimates or a clearly labelled pilot assumption. Arbitrary low/high numbers do not become credible because the engine simulates many scenarios. Frequency across unweighted scenarios is not a calibrated probability.

## Why size and roots remain separate

A developing root zone in a large pot differs from an established root system occupying that pot. Canopy structure also changes loss. Container evidence supports considering these factors, while showing that size alone does not determine water use. [R05](https://ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html) A model profile must represent these interactions or reject the setup.

A launch-ready profile library and its accuracy are not yet available in the reviewed material. Building and validating this library is the main remaining empirical work. The spec defines the computational contract and acceptance criteria; it does not imply that the missing parameter data already exist.

<!-- page break -->

# 07  Predictive container-water model

MAINTAIN RESERVE AND UNCERTAINTY BETWEEN LOGGED EVENTS

```
For each compatible parameter/state scenario k:
  Wraw_next = W_now + Iroot + Rroot + capillarySupply - systemLoss
  W_next, excess, unmetDemand = storage_and_drainage_step(Wraw_next, profile)

  systemLoss = lossModel(ET0_history, canopy, rootContext,
      stageContext, medium, geometry, wettingHistory, shelter)
```

W is the defined root-accessible reserve in litres, not total pot water. Iroot and Rroot in this update mean water entering the control volume before the modelled drainage step. If a source instead supplies measured post-drain retained water/state, assimilate that result without repeating its drainage. Every flux uses the same volume and interval; loss is litres per interval. Reference ET in mm is never multiplied by pot litres.

## Storage and losses

- For a simple freely draining profile, available reserve is bounded by its calibrated capacity and dry-state convention; excess input exits through the specified drainage route.
- For slow drainage, excess above the drained reference can persist. Represent excess/saturation as a separate state and model drainage over time. Never clip overflow away while claiming there is no aeration concern.
- Unmet potential demand is recorded separately when available reserve is exhausted. Do not accumulate physically negative available water and call it remaining storage.
- A combined empirical whole-container loss model may cover substrate evaporation, transpiration and wall loss. Do not subtract those components again. A component model must explicitly account for each once.
- Potential atmospheric demand and actual system loss differ under water limitation and changing stomatal behaviour. Do not apply an unbounded linear heat/VPD multiplier. [R16](https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf)

## Uncertainty representation - ENG/CAL

Carry compatible combinations of uncertain initial reserve, medium storage, active roots, rainfall reception and irrigation input. Preserve shared parameter dependence across time. Lower capacity and larger canopy need not be sampled as independent if the measured profile shows dependence. Validate the resulting intervals against held-out reference measurements.

Parameters remain fixed during an episode except for explicitly modelled growth/change and justified data updates. Re-sampling the whole state from scratch at every refresh loses history and understates uncertainty. An optional moisture/weight measurement can update the existing estimate without becoming a required daily task.

## Refill evidence

A normal watering narrows state only as much as its event model permits. For a compatible, calibrated thorough-watering pattern, the state can start near a drained reference with uncertainty. For unknown top-ups, the state stays broad. Explain a one-time alternative if broad input prevents useful predictions; do not automatically report successful saturation or a full reserve.

<!-- page break -->

# 08  Ground and raised-bed water model

ESTIMATE WATER DEPTH WITHOUT INVENTING PER-PLANT LITRES

Ground profiles use water depth in the active root zone. Pot capacity does not apply. A raised bed needs an explicit soil connection/bottom and layering model, particularly where roots share a bed or additional roots compete.

```
TAW_mm = sum(1000 * (thetaFC_j - thetaWP_j) * thicknessM_j)
D_next = D_now + cropSystemET - infiltratedRain - infiltratedIrrigation
         - capillaryRise + deepPercolation

# D = depletion relative to the specified drained reference.
# TAW and the action threshold belong to a supported soil/root profile.
```

Soil-specific storage and rooting depth govern available water. Initial depletion is required, whether measured or estimated from a justified anchor. Crop stress affects loss as reserves decline. No universal depletion fraction is supplied for cannabis. [R03](https://www.fao.org/4/X0490E/x0490e0e.htm)

## Low-effort operation

Use a validated ground/soil profile where applicable, with the user selecting a supported class once. A timestamp-only hand watering still needs a characterized applied/wetted-depth distribution. An entire bed cannot be assumed refilled because one plant was watered.

| Unresolved ground factor | Practical alternative |
| --- | --- |
| Texture/structure/depth unknown | Offer a simple one-time soil-profile classification, optional soil test or compatible moisture sensor. Keep broad assumptions visible. |
| Wetted area or application amount unknown | Calibrate the normal watering method once, optionally from a measured container/irrigation rate; reuse it for ordinary logs. |
| High water table, run-on or competing roots | Use an appropriate supported system profile or present limited-support guidance; do not silently assume a closed root zone. |
| Root zone grows into new layers | Add the new layer with its estimated starting moisture and uncertainty. Do not create a free full reserve as roots deepen. |
| Saturated or layered conditions | Preserve excess/persistence and layer information; do not average away an aeration problem. |

For an estimated depth recommendation, no conversion to litres is needed to decide whether watering is due. A future volume feature needs the characterized wetted area and application losses. Treat canopy footprint as a descriptor until its relation to that control volume is established.

If the ground profile cannot support a useful binary estimate, explain the specific missing property and offer one of the alternatives above. Do not quietly substitute the pot model or a generic every-two-days timer.

<!-- page break -->

# 09  Watering decision policy

YES/NO FOR SUPPORTED ESTIMATES; A CLEAR EXCEPTION WHEN IT IS NOT KNOWABLE

## Primary decision

At asOf, evaluate whether current estimated reserve is below its supported action threshold. Default advice concerns current need. A separate future window can explain when need is projected before the next practical care opportunity. Do not label a currently sufficient plant dry just because a future hot day is forecast.

```
Each scenario has margin_k = reserve_k - threshold_k
  robust_water_now: every supported margin_k <= 0
  robust_not_due:   every supported margin_k > 0
  overlap:         scenario actions disagree

# Joint scenarios must cover the supported uncertainty, not convenient extremes.
```

For overlap, a separately validated probabilistic decision policy may still issue a binary estimate when its calibrated error/cost criteria are met. Otherwise return uncertain with one concrete recovery option. Do not choose an arbitrary probability cutoff, count unweighted scenarios as probability or hide an overlap as not_due.

| State | Normal card and behaviour |
| --- | --- |
| water_now, supported | Watering recommended. Estimated root-zone reserves are low. Show the main cause and next action; no exact dose unless independently eligible. |
| not_due, supported | No watering needed yet. Estimated reserves remain above the watering threshold. Show when it will be recalculated. |
| uncertain / unsupported | Estimate needs one setup detail or a reference update. Explain the specific reason and shortest alternative. This is an exception state, not a daily inspection product. |
| Credible current saturated roots | Withhold more-water advice pending drainage/current-state resolution; a separate weather hazard can coexist. |
| Credible current dry roots | Use the observation to update/override the compatible model. Reconcile any intervening event before acting. |
| Contradictory observation/model | Show a conflict and request a targeted optional correction; never silently discard the inconvenient evidence. |

## No watering is also a prediction

not_due means the model supports waiting now; it is not a promise that the entire medium is uniformly moist or that a plant is safe for a fixed number of days. Display Estimated rather than a measured soil-moisture percentage. Adequate model coverage and acceptable false-negative performance are required before issuing that claim.

A supported model estimate can exist without a fresh root measurement. Conversely, a recorded event cannot force not_due if the amount/wetting is insufficient. No weather-only score, calendar rule or unqualified watering reset can bypass this policy.

If the UI uses Estimated dry or Estimated moist, tie those words to the calibrated root-relevant class. Low available reserve does not mean literally no water or permanent wilting point, and sufficient does not prove every layer is equally moist.

<!-- page break -->

# 10  Cold start, drift and exceptions

ASK FOR THE ONE THING THAT WOULD CHANGE THE ANSWER

| Situation | Low-effort response |
| --- | --- |
| Known compatible setup + credible refill anchor | Initialize from the calibrated post-event state range and run the model. No daily moisture input. |
| Known setup + unknown initial water | Offer one optional reference answer or a documented normal watering event. Never recommend watering merely to initialize an unknown wet plant. |
| Unknown medium/storage profile | Offer supported mix/bag identification, a one-time calibration option or optional sensor. Clearly identify any temporary limited-support mode. |
| Long incomplete weather/event history | Propagate bounded validated gaps if possible. Otherwise ask one reference question; do not replay invented dry days. |
| New sensor/weight observation | Assimilate the observation with method/calibration uncertainty; no recurring manual input requirement is created. |
| Model disagreement with real observation | Reconcile input/event/setup errors, widen uncertainty and request the minimum corrective information. |
| Change of pot, medium or root environment | Create a setup epoch and apply a new supported profile. Old facts remain, affected calibration does not silently transfer. |
| Move of a portable pot | Carry water state and prior exposure; change the subsequent weather/shelter path. A pin correction is not a transplant. |

## Age, size and growth

Use a verified calendar age anchor with its meaning and uncertainty. Seed origin, rooted duration and user stage remain distinct. Unknown age does not become day zero. Dated height/canopy updates improve the appropriate loss/storage context; missing updates widen growth uncertainty within a validated stage range. No exact leaf-area growth curve is inferred from age alone.

Do not prompt for daily plant measurements. Reuse normal stage edits, repot/movement actions and optional photos/size updates. A substantial unrecorded canopy/root change can make a profile out of domain; explain that exception rather than pretending passive watering logs identify it.

## No hidden learning from behaviour

Watering events update inputs. They do not demonstrate actual moisture or identify the dry-state threshold. Personalization without sensor/independent outcomes is limited to declared setup/routine context and justified state propagation. Do not claim automatic plant-specific accuracy improvement because the user has logged many waterings.

A compatible profile can stay useful without individual calibration if its prediction error remains acceptable for that domain. If the domain is too heterogeneous, offer a smaller supported profile range or an optional measurement path. Repeated nuisance uncertainty prompts count as a product failure, not proof of algorithm safety.

<!-- page break -->

# 11  Rain reception and future rain

ESTIMATE ACTUAL REPLENISHMENT WITH BOUNDS

## Past/current rain

```
Rroot = rainfall_to_root_input(
  nonoverlappingHistory, reception, contributingAreaOrDepth,
  canopy/interception, runoff/runon, infiltration, drainageProfile)
# current rain rate needs a documented integration interval
# no direct mm-to-pot-litres or rain-threshold reset
```

Only occurred precipitation can affect present reserve. Prefer documented retrospective/site evidence and carry regional spatial uncertainty. Directly sheltered soil receives no direct-rain input; report separate possible runoff/splash pathways instead of silently making them zero or full.

For partial/unknown reception, evaluate supported capture bounds. A large storm may move the estimated reserve enough to produce not_due if the model supports it. It does not prove saturation, successful wetting or equal replenishment across all plants. A brief shower may have mainly surface effects; the response is profile-dependent.

## Contributing area

For a pot, incident rain litres equals mm times characterized catchment m2. Actual canopy channeling/interception can change the contributing area. For ground, use infiltrated depth on the defined root/wetted zone. Pot nominal litres do not supply the opening area. Unknown geometry should be estimated only with a validated profile/range or supplied once.

## Forecast rain

Future rain never enters current reserve. Run separate future scenarios, including a no-rain path; preserve issue time and lead. A currently dry estimate is not overruled merely because rain is forecast tomorrow. A currently sufficient estimate can support waiting for the next evaluation, with clear warning if a plausible dry path reaches the threshold first.

Do not multiply deterministic rain amount by probability by default: conditional versus unconditional amount semantics must be established first. Occurrence probability is not confidence in received/retained volume. Snow water equivalent remains a separate storage/melt pathway, not immediate liquid root replenishment.

## Exposure changes and event time

A changed shelter answer or movement has an effective time. Recalculate the relevant interval; do not retroactively apply today roof position to the whole weather history. An ambiguous change time produces a scenario range. Rain received before a pot is moved stays in that pot state afterwards.

The rain question is a high-value addition because it removes a major structural ambiguity with one short user answer. It still needs the medium/input model to convert exposure into a useful reserve prediction.

<!-- page break -->

# 12  Warning inventory and audit result

14 ORIGINAL WARNING ROWS COVERED; ROOT-ENVIRONMENT DUPLICATES MERGED

This section is authoritative for warning eligibility, factors and claim limits in v5.2. It replaces the broad v5.0 hazard/disease tables. Watering remains predictive with normal watering logs; this audit does not reintroduce routine manual moisture checks.

| ID / warning | Evaluation route | Output limit |
| --- | --- | --- |
| W01 Heat exposure | weather screen or official | Source/model-qualified exposure or estimate |
| W02 Cold, frost and freeze exposure | weather screen or official | Source/model-qualified exposure or estimate |
| W03 Strong wind and gust exposure | weather screen or official | Source/model-qualified exposure or estimate |
| W04 Heavy rain and possible runoff exposure | weather screen or official | Source/model-qualified exposure or estimate |
| W05 Severe storm, including explicitly supported hail | official or explicit hazard product | Source/model-qualified exposure or estimate |
| W06 Low reserve / drying soon | supported water model or qualified observation | Source/model-qualified exposure or estimate |
| W07 Persistent excess water / drainage concern | supported excess model or qualified site evidence | Environmental/condition warning; no diagnosis |
| W08 Container/root-zone heat exposure precaution | contextual container subwarning | Source/model-qualified exposure or estimate |
| W09 Possible dew/fog dampness | weather proxy or direct fog evidence | Source/model-qualified exposure or estimate |
| W10 Powdery-mildew-conducive conditions | informational exposure screen | Environmental/condition warning; no diagnosis |
| W11 Bud-rot / Botrytis conditions watch | flower tissue and informational exposure | Environmental/condition warning; no diagnosis |
| W12 Wet-weather leaf-spot conditions watch | foliage and informational wet weather | Environmental/condition warning; no diagnosis |
| W13 Wet conditions during germination/establishment | vulnerable stage and root environment | Environmental/condition warning; no diagnosis |
| W14 Root aeration / root-health context | alias or symptom context | Environmental/condition warning; no diagnosis |

## Important corrections

Soil and canopy wetting, wind shelter and sky exposure are separate. Human feels-like is not plant temperature. Bud-rot wording needs flowers; mildew does not. Root-excess/aeration cards merge. Missing data and no threshold observed never establish low disease probability. Full rules follow.

<!-- page break -->

# 12A  What eligibility actually means

RELEVANCE, TRIGGER, SUPPORT, PRIORITY AND DELIVERY ARE SEPARATE

| Concept | Normative interpretation |
| --- | --- |
| Relevance gate | Does the warning apply to this plant/tissue/setup? Example: the container subwarning requires pot; the bud label requires flowers. |
| Trigger | Has a valid source, model or versioned exposure rule produced the stated event? A relevant plant does not automatically have a triggered warning. |
| Modifier | Changes action wording, local relevance or evidence support. It is not an extra independent trigger or hidden numeric multiplier. |
| Interaction | The effect depends on context, such as wind drying surfaces while also dispersing spores. No universal up/down vote is assigned. |
| Support | How well the source represents the claim: on-site, regional, model-based, forecast, limited or unassessed. It is not a measured infection probability. |
| Priority | How soon action is useful, based on valid event timing/source importance. It does not automatically rise because many correlated fields are present. |
| Delivery | Grouping, deduplication, snooze, quiet hours and notification preferences applied after evaluation. Snooze cannot alter biology or truth of an event. |

```
WarningEvaluation = {
  warningId, family, asOf, rulesetVersion,
  relevance: relevant | not_relevant | unknown,
  evaluation: triggered | not_triggered | insufficient_data | disabled_policy,
  sourceNature, exposureWindow, sourceRefs, support,
  factorTrace: [{factor, role, knownValue?, fieldRef?, effect, limitation}],
  missingCriticalInputs[], unusedOrExcludedInputs[],
  outputClaim, actionPriority, dedupeKey, delivery
}
```

Use three-valued logic for unknown inputs. A known false required tissue gate yields not_relevant. An unknown required gate stays unknown. Missing a noncritical modifier does not invalidate an otherwise supported generic warning. OR branches must be evaluated separately; an absent gust cannot block a valid sustained-wind event.

The chosen branch controls the message. Weather-only evidence permits a qualified conditions watch. A symptom-only report permits Reported problem - cause unconfirmed, not a claim that conducive weather occurred. Direct wetness/sensor evidence states that measurement or observation, within its scope. Preserve independent evidence when multiple branches qualify.

In each contract, a hard scope/source failure blocks its own branch. A listed prohibited inference forbids that unsupported claim; it does not suppress an independently supported branch. The prose contracts have a companion executable eligibility reference; the app and feature producers are not implemented by it.

No annual strain label, age, soil pH, fertilizer name, companion-plant name, previous score or number of available fields is converted into an unsupported hazard multiplier. The full factor crosswalk below records their valid roles and limits.

<!-- page break -->

# 12B  Data availability: actual app versus proposed

CANONICAL INPUTS DO NOT MEAN THESE DATA ALREADY EXIST

| Input family / canonical fields | Existing source | Gap / required treatment |
| --- | --- | --- |
| Air T/RH/dew, wind/gust, cloud, daily min/max | WeatherCacheEntry and raw weather current/hourly/daily fields. | Legacy cache mixes time/source and drops raw hourly validity. New interval/provenance adapter required for duration rules. |
| Rain rate/accumulation/probability | rainfall/pop in legacy cache; distinct raw provider rain fields. | One stored rainfall value is not enough. Retain rate/sum, interval, nature and units. |
| Radiation, ET0, wind height | Not guaranteed by current app schema; candidate weather product. | New provider/canonical fields and benchmarked method. Never replace radiation with UV. |
| Official weather events / hail subtype | Raw provider alert capability. | Reviewed fetch excludes alerts; WeatherResponse decoder and persistence omit them. Add extraction, mapping, validity and scope. |
| Fog code / observed fog | Raw documented weather condition IDs or optional site observation. | Current app keeps description, not typed IDs. Preserve typed code; do not turn English summary into a precise fog measurement. |
| Stage, age, pot/ground, pot litres, height, sun | Existing Plant fields and journal heightCm. | Use recorded context and verified units; no tissue density/leaf area/root depth derived without support. |
| Soil rain reception | Proposed Plant.rainReception and dated changes from v5.0. | Still a proposed field, not implemented by this document. Retain exposed/partial/sheltered/unknown. |
| Canopy wetting, wind shelter, pot solar exposure | Optional proposed setup facts; permanentProtection is ambiguous. | Separate fields with source/time; unknown remains valid and does not create a new mandatory setup form. |
| Medium/drainage/reserve/excess model | Broad existing soilType; detailed profiles/models proposed. | Store profile version/domain and predictions with uncertainty. Broad soilType cannot initialize saturated roots. |
| Tissue presence/density/support, rooting and damage | Existing stage/training/pests plus optional proposed typed facts. | Only current confirmed facts count; tags/free text are not a dated wound/density measurement. |
| Symptoms, root observations and physical sensors | Current soilMoisture is an uncalibrated manual percent; inspectionResult only no_symptoms. | New typed positive/uncertain observations and instrument metadata needed; current photo URI is not interpreted evidence. |
| Diagnostics: root T, leaf wetness, EC/sample pH | Not guaranteed today. | Optional real measurements with method/depth/sample/time. Do not derive EC from nutrientMlPerL. |

The source API can provide national alerts, but availability is not identical to implemented app capability. OpenWeather lists SAWS among sources while also warning that agency feeds can cease. Verify actual regional delivery; an empty alert response does not establish safety. [R13](https://openweathermap.org/api/one-call-3)

<!-- page break -->

# 12C  Shared source and time gates

VALID TIME AND ACTUAL COVERAGE GOVERN THE CLAIM

- All plant warnings require current authorization, active/not-deleting status and correct outdoor routing. Recheck before sending queued notifications.
- Weather-based branches require compatible location/time/units. Missing GPS invalidates the weather join only; qualified site/model evidence can still support its own branch.
- Pilot current-weather freshness is at most two hours by valid time. Forecasts for the next 24 hours use a declared issue age at most three hours; received time may be an explicitly qualified proxy if issue time is unavailable.
- Official events use their own validity/cancellation/scope and update-age contract. A retrieved alert can remain valid longer than current weather; expiry removes the active-event claim, not the possibility of later symptom review.
- Do not mix past observations/current estimates with future forecasts in one measured exposure window. Keep retrospective and projected warnings labelled separately.
- For hourly point data, a documented interpolation/aggregation method is required. Pilot interpolation bridges only matched adjacent records at most 90 minutes apart, with an estimate flag. No invented hours beyond the series.
- Duration screens need at least 80% expected-duration coverage. A gap interrupts a claimed consecutive run; nonconsecutive qualifying exposure must be named accumulated exposure.
- Store lower/upper qualifying exposure bounds where gaps could change the result. If observed qualifying duration already meets the rule, it may trigger subject to coverage. If missing time could change a failure to success, return insufficient_data rather than a confident negative.
- Daily minima/maxima permit extrema context, not hours above a cutoff. Current rain rates and daily amounts have different meanings; deduplicate overlapping precipitation.

## Currentness is claim-specific - ENG

Historical weather windows are not invalid simply because they are old; their nature/completeness and relevance matter. A recent fetch may hold old observations. A fresh root/site observation carries its own method/scope/time relevance. No single weather expiry erases every independent warning.

## Coverage and support are not disease probability

An 80% covered episode is not 80% infection confidence. A regional rain probability is not flower wetness probability. A disabled rule or unavailable source is unassessed, never low risk. Unknown modifiers should be visible in the factor trace rather than silently treated as protective false values.

<!-- page break -->

# 12D  Explicit attention screens and maturity

ENG SETTINGS ARE TESTABLE DECISIONS, NOT BIOLOGICAL DAMAGE OR INFECTION LIMITS

| Screen key | Pilot setting | Scope and status |
| --- | --- | --- |
| heatAttentionC | 32 C actual air; current instant or supported future interval | Heat attention only. Duration is separately reported; not a cannabis injury threshold. |
| coldAttentionC / frostAttentionC | 5 C / 2 C; air-freezing label at <=0 C | Cold/possible surface-frost context. Calm/clear/RH are not required for air freezing. |
| gustAttentionMps / sustainedAttentionMps | 15 m/s / 10 m/s | Physical wind attention. Not an official global severe-wind definition or guaranteed damage speed. |
| rainRateAttentionMmH / rainDayAttentionMm | 10 mm/h / 25 mm per complete rolling 24 h | Rain event attention. Not infiltration, saturation, flood or cultivar damage thresholds. |
| dewSpreadC / dewHours | 0 to 2 C paired spread / 2 covered night hours | Possible saturation/dew context. Not observed leaf wetness or fog diagnosis. |
| needHorizonHours | 6 hours, with separate current decision | Future model projection/action planning. No forecast input credited now. |
| PM candidate exposure | T 15-28 C and RH >=85%, 4 covered hours in 24 h | Disabled production disease screen until pilot review; an informational exposure rule, not infection probability. |
| Flower humid candidate exposure | T 10-28 C and RH >=90%, 4 covered hours in 24 h; flowers required | Same maturity restriction. Direct symptom/wetness observations are distinct branches. |
| Leaf-spot candidate exposure | T 15-30 C and RH >=85%, 4 covered hours in 24 h plus a supported wet-weather pathway | Same maturity restriction. No pathogen identification; canopy route uncertainty must be disclosed. |
| Persistent root excess | Profile-specific abnormal-excess bound and normal drainage window | CAL, no universal numeric default. Current abnormal pooling/failed drainage is an independent observation route. |
| Root-temperature sensor route | Only a supported setup/sensor-specific screen; no default supplied | CAL, disabled without a supported threshold and instrument scope. A measured temperature alone does not prove injury. |
| Operational source/coverage gates | 2 h current, 3 h forecast age, 90 min interpolation gap, 80% duration coverage | ENG pilot service settings; test regional update cadence, gaps and user burden. |

Official, site-observed and model-supported routes remain independent of numeric weather screens. The pilot bands make exposure logic reproducible; being outside them never establishes that injury or disease is impossible. Disease-screen output is limited to conducive-condition scouting. Do not ship predicted infection odds from these numbers.

Each policy stores enabled status, version, rationale, source domain, units and acceptance evidence. Production promotion requires correct inputs and prospective usefulness/burden checks. Weather attention screens can be evaluated as informational notices; model-dependent warnings require the corresponding model calibration.

<!-- page break -->

# 12E  Factor crosswalk: development and setup

WHERE EACH FACTOR CAN MATTER; WHERE IT MUST NOT BECOME A POINT

| Factor | Valid effect on warnings | Eligibility / unknown handling |
| --- | --- | --- |
| Age / age basis | Context for establishment only when meaning is known; elapsed calendar time may advance a supported model. | Not an exact root-depth/canopy/tolerance predictor; age unknown is not seedling. |
| Recorded stage / tissue | Routes leaves, flowers and vulnerable establishment; heat/wind/rain apply more broadly. | Flowers gate W11, vulnerable establishment gates W13, pot gates W08. Stage does not supply tissue density. |
| Height / canopy size | Supported water-loss domain; wind-support action context. | No wind-warning prerequisite or linear water/temperature multiplier. |
| Pot litres / geometry | Storage/loss profile and practical handling. | Pot litres alone do not establish accessible water, opening area, stability or root temperature. |
| Ground / raised bed | Changes root control volume/drainage/run-on context. | Ground never receives a pot-only thermal/storage rule; raised does not mean sealed container. |
| Medium / drainage / root establishment | Model domain and root-excess evidence; germination zone differs from whole pot. | Broad soilType is not hydraulic capacity or proof of blocked drainage. |
| Soil rainReception | Current/future root input uncertainty and rain/drainage advice. | Does not measure canopy wetness, local humidity, hail protection or frost protection. |
| Canopy rain exposure / irrigation method | Wetting pathway for flower/leaf exposure. | Optional separate fact; root watering is not automatically overhead; unknown yields conditional pathway. |
| Wind shelter / cover / sky exposure | Warning-specific local relevance, protection and radiational context. | No universal shelter effectiveness. A net/roof/fence can affect wind, rain, sunlight and cooling differently. |
| Container material/colour / hot surface | W08 contextual relevance and assessed loss/heat model properties. | No assumed black pot or known root heat; plant Full Sun does not prove pot wall solar exposure. |
| Pruning/training/repot/movement | Dated model changes, tissue-damage context, location path. | Undated tags are not fresh wounds; moved pots carry their water; mature transplant is not a seedling. |
| Strain/strainType / companion names | Reported history/possible competition only with relevant evidence. | No fixed resistance, heat tolerance or water coefficient from names; companion plants can have competing effects. |

<!-- page break -->

# 12F  Factor crosswalk: weather and observations

EACH QUANTITY HAS A SPECIFIC ROLE AND SOURCE LIMIT

| Factor | Valid effect | Wrong inference to block |
| --- | --- | --- |
| T / duration / minimum/maximum | Event screens and matched atmospheric features; extrema are point summaries. | Daily Tmax paired with night RH; a peak turned into hours of heat; air copied to roots. |
| RH / dew point / VPD | Matched demand or dampness exposure, with time/quality. | Three independent votes for the same air moisture; RH converted to soil moisture. |
| Wind / gust / direction | Separate event statistics; local flow uncertainty and conditional drying/dispersal. | Gust substituted for mean ET wind; strong wind proves no fungus. |
| Rain rate / accumulation / probability | Separate actual input and forecast event routes. | Probability becomes confidence; mm becomes saturation; overlapping totals summed. |
| Cloud / radiation / UV / daylight | Radiation/sky-view context and supported ET; astronomical night routing. | UV is PAR/Rn; daylight is direct sun; clear regional sky proves unshaded pot. |
| History / forecasts / issue age / coordinates | Different time scopes and source support; model paths before/after movements. | Forecast ages into observed history; new fetch makes old observation current. |
| Watered / feeding carrier water | State input under the supported event profile, with dates and uncertainty. | A watering is a dry label/full refill; nutrient mL/L is water volume. |
| Root checks / sensors / pot weights | Optional relevant measurements or calibration support. | Uncalibrated percentage has a universal dry/wet limit; mixed depths averaged. |
| Symptoms / photos / pests / damage | Current confirmed reports can trigger review and context. | Photo URI, old tags or free text automatically identifies a pathogen. |
| pH / EC / nutrition | Typed current samples can frame differential causes. | Fertilizer schedule/name/concentration proves root salinity or explains wilt. |
| Negative inspections / snoozes / skips | Negative observation is time/tissue scoped; snooze/skip controls delivery only. | No symptoms means future immunity; snooze or not_due means healthy roots. |
| Official events / feels-like | Attributed event metadata and actual hazard type; human index limitations. | Human wind chill becomes plant freezing; generic storm becomes hail. |

<!-- page break -->

# 12G  Ranked roles, not interchangeable points

IMPLEMENTATION HIERARCHY - NO UNMEASURED CAUSAL PERCENTAGES

The v5.1 factor list did not make hierarchy and combinations explicit enough. v5.2 adds ordinal roles, formal AND/OR paths, joint-exposure arithmetic and executable reference fixtures. Existing factors and missing-data limits remain. Ranking here means decision dependency and action relevance, not a measured percentage contribution to disease.

| Rank / role | How the algorithm uses it | Can it trigger alone? |
| --- | --- | --- |
| G - mandatory gate | Check relevant tissue/setup: flowers, foliage, pot or vulnerable establishment. Unknown stays unknown. | No. Passing a gate permits evaluation; it is not evidence of an event. |
| Q - valid support | Check time, location, source, units and relevant model/sensor support. Failed quality yields unknown for that branch. | No. Good data alone is not a hazard. |
| P1 - primary route/component | Evaluate the explicit primary combination. Alternatives use OR; required components use AND. | Only when the complete named path is satisfied. |
| M2 - secondary modifier | Refine local relevance or feasible preparation. Report the effect direction/interaction. | No. Many modifiers cannot replace a missing P1 or gate. |
| C3 - context | Choose wording/actions, reconcile conflicts or scope prior observations. | No; a new positive symptom is its own P1 route where specified. |
| X - excluded inference | Do not use human feels-like as plant temperature, or rain chance as hail evidence. | No. Excluded from that predicate. |

## What this ranking does and does not say

Within P1, factors may be jointly required and have no defensible independent order. Temperature, RH and duration in an exposure screen are one interaction, not three weighted votes. G/Q are hard constraints, not very large coefficients. P1/C3 means the original grouped factor contains a positive-report trigger and time-scoped negative/history context.

Evidence reliability is a separate axis: a correctly scoped measurement directly supports the measured quantity; a regional proxy supports a qualified environmental claim; a symptom report supports a reported problem. None automatically identifies a pathogen. A source-attributed official event is retained with its own hazard and geographic scope.

Formula notation: C is the common authorization/active/outdoor gate. AIR, GUST, WIND, RATE and COMPLETE24H evaluate their condition only with valid scoped data; otherwise their result is unknown. MODEL additionally requires a supported, reconciled water model; EXCESS needs its assessed drainage profile. RECONCILED(true) is unknown while a material conflict is unresolved. These wrappers are source-support tests, not factor weights.

Do not assign humidity 40%, temperature 30% and canopy 30%. Those numbers would have no measured meaning here. The implementable first version is a rule/physics system with explicit interactions; numerical disease-effect weights require representative outcomes and validation.

<!-- page break -->

# 12H  Primary-driver ranking 01-07

P1 IS THE COMPLETE TRIGGER PATH; M2/C3 CANNOT REPLACE IT

| Warning | P1 / mandatory scope | M2 / C3 and limitation |
| --- | --- | --- |
| W01 Heat exposure | Applicable official event OR actual air-temperature screen; covered duration describes exposure. | Verified direct solar exposure, acclimation and establishment affect preparation relevance. Pot/ground and reserve affect actions; neither is a substitute heat trigger. |
| W02 Cold, frost and freeze exposure | Applicable official event OR actual air minimum/temperature, with source and window. | Cloud, local sky view, wind, acclimation and establishment change context, not the air-freezing predicate. Pot size/cover help choose protection; human wind chill contributes zero to this predicate. |
| W03 Strong wind and gust exposure | Applicable wind event OR separate gust/sustained-wind screens. | Verified local shelter, unsupported stature or instability change protection relevance. Pot volume/height alone cannot predict tipping; unknown supports do not block regional exposure. |
| W04 Heavy rain and possible runoff exposure | Applicable event OR valid intensity OR complete rolling-day accumulation; these are alternatives. | Received root input, drainage/run-on and canopy reception determine separate action paths. Rain chance qualifies a forecast; it is not retained volume or a cause-weight multiplier. |
| W05 Severe storm, including explicitly supported hail | Explicit applicable authoritative severe/hail product. Ordinary rain/RH are not substitutes. | Verified protection and portability affect preparation; source onset/expiry controls timing. Stage, size and pot/ground route actions; they do not establish hail occurrence. |
| W06 Low reserve / drying soon | Qualified root evidence OR supported reserve/action-threshold comparison; future crossing is a different branch. | Retained watering, occurred rain, accessible storage and actual loss are model terms, not warning points. Age/size/medium define the model domain; heat, last-watered age and forecast rain alone cannot replace state. |
| W07 Persistent excess water / drainage concern | Qualified abnormal site evidence OR the complete excess-plus-persistence model combination. | Input, drainage, loss and root access alter that state within an assessed profile. Regional humidity/rain and normal moist medium do not supply the missing root finding. |

This is an ordinal engineering hierarchy supported by the mechanisms and data limits, not an empirical ranking of causal effect sizes. The individual contracts give formal combinations. Numeric weather values are the v5.1 ENG attention screens, not cannabis injury thresholds; disease weather-screen policies remain off by default.

<!-- page break -->

# 12H  Primary-driver ranking 08-14

P1 IS THE COMPLETE TRIGGER PATH; M2/C3 CANNOT REPLACE IT

| Warning | P1 / mandatory scope | M2 / C3 and limitation |
| --- | --- | --- |
| W08 Container/root-zone heat exposure precaution | Pot is mandatory. Supported sensor route OR heat plus explicit pot/contact exposure. | Material, colour, insulation and geometry modify relevance; none proves a root temperature. Plant Full Sun and nominal pot litres cannot stand in for pot-wall exposure. |
| W09 Possible dew/fog dampness | Explicit fog OR supported paired dew-proxy episode. These are different mechanisms/routes. | Sky view, cloud and wind frame radiational context; they are not gates for explicit fog. No rain is needed; soil reception does not describe leaf surfaces or replenish roots. |
| W10 Powdery-mildew-conducive conditions | Foliage is mandatory. A current report is a symptom route; weather needs its own enabled paired episode. | Verified local crowding, shade/airflow and relevant history refine scouting relevance. Pot size, soil class and strain labels are not independent infection triggers. |
| W11 Bud-rot / Botrytis conditions watch | Flowers are mandatory. Supported persistent dampness or paired humid exposure is the environmental driver; reported symptoms use separate copy. | Verified density, slow local drying and fresh wounds strengthen inspection relevance. Pot volume, soil RH assumptions and age cannot bypass flower presence or supply infection odds. |
| W12 Wet-weather leaf-spot conditions watch | Foliage plus current spots OR an enabled joint temperature/humidity/wetting-context episode. | Reported splash/debris/history and slow local drying can refine an inspection. A roof/soil/strain label alone cannot establish inoculum, wetness or Septoria. |
| W13 Wet conditions during germination/establishment | Vulnerable establishment is mandatory. W07 abnormal excess or a relevant current report supplies the trigger. | Actual substrate T, rooting facts and current sanitation history frame the review. Air T, broad soil origin and clone/age labels do not prove damping-off or rooting status. |
| W14 Root aeration / root-health context | W07 evidence OR a current qualified symptom report, with different claims. | Scoped root temperature/EC/pH and actual injury can support differential review. Prior needsWater=false, regional RH and weather cannot supply a root diagnosis. |

This is an ordinal engineering hierarchy supported by the mechanisms and data limits, not an empirical ranking of causal effect sizes. The individual contracts give formal combinations. Numeric weather values are the v5.1 ENG attention screens, not cannabis injury thresholds; disease weather-screen policies remain off by default.

<!-- page break -->

# 12I  Warning relationships and shared pathways

14 DETECTORS DO NOT MEAN 14 INDEPENDENT SCORES OR PUSHES

| Shared mechanism / evidence | Permitted combination | Required separation |
| --- | --- | --- |
| Heat -> demand -> reserve | Heat can drive assessed loss; storage/input/loss then determine W06. Exposed container context can add W08. | W01 is not proof of W06; W08 folds into heat. |
| Rain -> two reception paths | Soil reception feeds root accounting. Canopy reception feeds wet-weather context. | Neither route implies the other. Regional rain alone is not saturated roots or measured wet flowers. |
| Reserve -> drainage -> root context | W07 needs abnormal excess/persistence or qualified site evidence. W14 reuses W07; W13 adds vulnerability. | One root-environment card, not three independent causes or severity points. |
| T + RH + time | Evaluate matched intervals to form one exposure feature. Dew/VPD can share the same underlying air data. | Do not add RH, dew and VPD as three independent disease votes. |
| Dampness + relevant tissue | W09 may supply an overlapping proxy pathway; W11 requires flowers, W12 foliage and its declared joint episode. | Dew/rain hours are not measured tissue-wetness hours; powdery mildew does not require free water. |
| Wind -> mechanical / drying / dispersal | W03 screens regional wind. Local flow may affect drying and dispersal in different directions. | No universal protective wind credit for W10-W12. |
| One storm -> several explicit hazards | W05 may group actual source-supported W03/W04/hail subtypes and retain child reasons. | Do not invent absent hail/flood subtypes from the generic storm. |
| Symptoms -> reported-problem review | A current report can bypass the weather-screen branch, while keeping required tissue context. | A symptom route cannot claim that qualifying weather occurred or that a pathogen is confirmed. |

Suggested delivery groups are watering, heat/container heat, cold/frost, storm/wind/rain, foliage/flower scouting, and root/establishment context. These are UI groups, not collapsed biological models. Preserve all actionable distinct hazards; grouping must not hide an urgent event or turn several reasons into a probability.

Evaluate dependencies in order: common/tissue/source gates -> W01 and W07 -> W08 using W01, W13/W14 using W07 -> other independent detectors -> reconcile actions -> group delivery. The reference evaluator derives dependency values; it does not accept a user-supplied W07=true as evidence.

<!-- page break -->

# 12J  How combinations become an exposure episode

JOINT, TIME-ALIGNED CONDITIONS - NOT SEPARATE DAILY VOTES

```
For each supported, non-overlapping interval i:
  PM_i = (15 <= T_i <= 28) AND (RH_i >= 85)
  Flower_i = (10 <= T_i <= 28) AND (RH_i >= 90)
  Leaf_i = (15 <= T_i <= 30) AND (RH_i >= 85)
           AND supportedWetWeatherRoute_i
  known qualifying hours = SUM(dt_i where joint predicate is true)
  possible qualifying hours = known + unresolved/gap hours
  coverage = time with valid paired T/RH / expected window time
```

These are unchanged ENG candidate screens, production-disabled until pilot review. Over a declared 24-hour window, the candidate threshold is four accumulated qualifying hours, not necessarily consecutive. A claim of consecutive hours would need a separate run/reset rule. Each retrospective or forecast episode has one source nature, location epoch and valid window; future hours never complete an occurred episode.

| Combination | Screen outcome / reason |
| --- | --- |
| 12 h warm/dry; different 12 h cool/humid | No qualifying PM hours. Warm duration plus humid duration does not equal simultaneous exposure. |
| 4 h jointly suitable; 20 h known unsuitable | Candidate qualifies with full coverage. These are conditions, not infection odds. |
| 3 h suitable; 20 h unsuitable; 1 h missing | Lower=3, upper=4; insufficient_data because the missing hour changes the answer. |
| 4 h suitable but only 19/24 h paired data | Insufficient_data under the pilot 80% coverage gate; do not present 19 h as a complete day. |
| Warm/humid period and wet-weather route at separate times | No joint leaf episode from those disconnected totals. Wetness persistence requires its own evidence/model. |

A wet-weather route is explicitly typed: scoped local wetness report/sensor, received canopy-rain context, or a time-aligned qualified dew/fog proxy. Unknown canopy rain reception can only support labelled regional/conditional rain context; confirmed no reception blocks that rain route, not independent dew or a direct wetness report. Do not extend a wet route through later hours with an invented drying time.

Known false conjunction components remain false even if another component is unknown. Missing/invalid components otherwise widen the bounds. Missing data never means zero exposure. A numeric branch with invalid source quality is unassessed; an absent optional symptom report merely leaves that report branch inactive.

The disease triangle requires suitable host, pathogen and environment. Most pathogen/susceptibility data are unobserved here, so environmental screens cannot be infection probabilities. [R25](https://horticulture.oregonstate.edu/nursery/nursery/disease-triangle) A grape Botrytis model demonstrates fitted T-by-wetness interactions, but its coefficients and crop/location validation do not transfer to cannabis. [R26](https://ipm.ucanr.edu/disease/database/grapebotrytis.html)

<!-- page break -->

# W01  Heat exposure

NORMATIVE WARNING CONTRACT  |  FAMILY: HEAT

## Required scope and source

Active outdoor plant and usable actual air temperature or applicable official heat alert. A forecast uses its own valid time; duration needs a supported series.

## Exact trigger combinations

```
C AND (officialHeat OR AIR(Tair >= 32 C))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Air temperature / duration (trigger) | Higher T and longer covered exposure strengthen the stated weather exposure; a single maximum cannot establish duration. | No numeric branch without T; an official alert can remain an attributed regional alert. |
| M2 - Radiation, sun exposure and acclimation (modifier) | Reported direct exposure or a recent verified move from shade can make a protection message more relevant; no fixed leaf-temperature correction. | Keep local solar/acclimation uncertainty; do not assume all outdoor plants are in full sun. |
| M2 - Stage / root establishment (routing) | Developing plants may merit earlier attention and suitable wording; this does not change the air measurement. | Generic heat message remains eligible; no inferred seedling status from unknown age. |
| C3 - Water reserve / root evidence (action_conflict) | Supported low reserve can separately justify watering. Adequate/wet reserve does not remove heat exposure. | Keep watering state separate; heat alone cannot fill the missing water model. |
| M2 - RH / VPD / wind (interaction) | They alter atmospheric demand and cooling context; wind is not universally protective and human heat index is not tissue temperature. | No additive heat severity from duplicated T/RH/VPD votes. |
| C3 - Pot/ground, size and shelter (routing) | Change feasible protection and model uncertainty; pot litres or soil provenance do not supply a heat-injury threshold. | Generic event remains, with site uncertainty. |

## Blocks, prohibited inferences and missing data

Inactive/non-outdoor plant; Wrong-location or stale numeric weather; Human feels-like value used as actual air/tissue temperature. A missing modifier does not block a valid temperature/official event. If both trigger routes are unavailable, return insufficient_data.

## Allowed message and limit

Hot conditions are forecast/current. Reduce avoidable exposure where practical; consult the independent watering estimate. Do not diagnose heat injury, infer root/leaf temperature, or prescribe water solely from wilt/heat. [R22](https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat) [R23](https://www.weather.gov/safety/cold-wind-chill-chart)

Interactions: Heat can raise demand, but only a supported reserve model/observation establishes current watering need. Related warnings: W08 adds container context to this card; W06 remains a separate water-state decision.

<!-- page break -->

# W02  Cold, frost and freeze exposure

NORMATIVE WARNING CONTRACT  |  FAMILY: COLD

## Required scope and source

Usable actual/forecast air temperature or an applicable official cold/frost/freeze product. Preserve hazard subtype.

## Exact trigger combinations

```
C AND (officialCold OR AIR(Tair <= 5 C))
Subtype: <=0 air freezing; else <=2 possible frost; else cold.
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Air minimum / hourly T and duration (trigger) | Lower actual T and longer known exposure affect the event description. Daily Tmin is a low point, not a duration. | Official alert route remains; numeric exposure subtype needs actual T. |
| M2 - Cloud, wind and nighttime (interaction) | Clear/calm nights can increase surface-cooling context; windy advective cold can also injure, so calm/clear is not a mandatory gate. | No automatic no-frost conclusion from missing sky/wind. |
| M2 - Dew point / surface wetness (modifier) | Supports frost/condensation context; it does not measure surface temperature, frost point or tissue ice. | Air freezing/cold branch does not require RH/dew point. |
| M2 - Stage / establishment / acclimation (routing) | Newly established or newly exposed plants can receive more cautious preparation copy; no universal cultivar cold tolerance. | Generic exposure notice; do not infer hardiness from age/strainType. |
| C3 - Pot versus ground / pot size / cover (routing) | Changes feasible protection and exposure uncertainty; pot dimensions alone do not compute a freezing time. | Do not assume a roof, windbreak or permanentProtection is frost-proof. |
| X - Wind chill / feels-like (excluded) | Human index is excluded from plant-temperature and air-freezing predicates. | A missing index is immaterial. |

## Blocks, prohibited inferences and missing data

Only wind chill below zero with actual T above screen and no official plant-relevant event; Tissue freezing asserted from ambient air alone. If only a generic human cold advisory exists, attribute that advisory without relabelling it confirmed plant frost/freeze.

## Allowed message and limit

Cold/possible frost/air freezing is forecast. Prepare appropriate protection before the event if practical. Surface frost can differ from reported air temperature; above-zero air is not proof of no frost. No fixed roof/cover protection credit. [R11](https://ask.ifas.ufl.edu/publication/MG025/pdf) [R21](https://www.weather.gov/source/zhu/ZHU_Training_Page/fog_stuff/Dew_Frost/Dew_Frost.htm) [R23](https://www.weather.gov/safety/cold-wind-chill-chart)

Interactions: Clear/calm conditions may support radiational cooling; advective freezing does not require them. Related warnings: W09 dampness may share air/dew evidence. Neither warning proves frost on a surface.

<!-- page break -->

# W03  Strong wind and gust exposure

NORMATIVE WARNING CONTRACT  |  FAMILY: WIND

## Required scope and source

Usable sustained wind/gust or an applicable wind/storm alert, with units and timestamp. A missing gust is not zero gust.

## Exact trigger combinations

```
C AND (officialWind OR GUST(gust >= 15 m/s)
       OR WIND(meanWind >= 10 m/s))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Gust and sustained wind (trigger) | Compare separate configured screens; gust is a peak, sustained wind is a different statistic. | Use the available branch without inventing the missing one. |
| Q - Wind height / coordinates / terrain (support) | Provider wind is regional/reference-height exposure; it is not measured at the pot. | Disclose local uncertainty; do not apply a guessed fence multiplier. |
| M2 - Wind shelter / direction (modifier) | Verified relevant shelter changes protection relevance; direction-specific shelter requires both direction and geometry. | Generic exposure remains; no exact speed reduction. |
| M2 - Height, canopy / flowers / supports (routing) | Reported tall/heavy/unsupported growth changes securing/support advice. Flowering does not prove a heavy dense canopy. | Do not suppress without dimensions or assign a damage percentage. |
| M2 - Pot geometry / stability / ground rooting (routing) | Reported unstable pots can receive a tipping precaution; ground plants still have branch/root exposure. | Pot volume or height alone cannot establish mechanical failure. |
| C3 - Humidity / rain / disease (interaction) | Can affect drying and dispersal context; never cancel disease warnings because wind is high. | Independent warning families remain independent. |

## Blocks, prohibited inferences and missing data

Double conversion of already-km/h wind; Gust used as sustained wind in ET without method support. No valid wind value and no mapped event -> insufficient_data. Missing local shelter -> regional warning with qualified exposure.

## Allowed message and limit

Strong wind/gusts are reported or forecast, with the valid window stated. Secure movable containers/supports and reduce avoidable exposure where feasible. No exact branch-breakage/tipping prediction or claim that wind guarantees healthy airflow. [R10](https://hemp.cals.cornell.edu/resources/reports-factsheets/2024-factsheets/the-role-of-weather-in-disease-progression/) [R17](https://www.fao.org/4/x0490e/x0490e07.htm)

Interactions: Wind can affect drying and dispersal; no universal disease-protection or ET multiplier. Related warnings: W05 may group the same storm; W10-W12 remain independent condition watches.

<!-- page break -->

# W04  Heavy rain and possible runoff exposure

NORMATIVE WARNING CONTRACT  |  FAMILY: RAIN

## Required scope and source

Valid rain rate/interval accumulation or an applicable heavy-rain/flood product. Occurrence source and units must be known.

## Exact trigger combinations

```
C AND (officialRain OR RATE(rate >= 10 mm/h)
       OR COMPLETE24H(amount >= 25 mm))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Intensity, total and duration (trigger) | High rate and high total are separate event branches. Coverage determines which branch can be evaluated. | No rate warning from a daily total alone. |
| Q - Probability / issue time (support) | Occurrence chance qualifies forecast wording; amount is not multiplied into retained water by default. | Missing probability is unknown; it is not 0 or 100%. |
| M2 - Soil rainReception (reception) | Changes plausible root input and drainage/erosion actions; sheltered roots can coexist with exposed foliage. | Keep root reception unknown; regional event notice can remain. |
| M2 - Canopy rain exposure (reception) | Separately changes foliage/flower wetting implications. A soil answer cannot establish this. | Conditional foliage wording only; no measured canopy wetness. |
| M2 - Drainage, slope/run-on, ground/container (routing) | Reported blocked drainage, slope/run-on or erosion susceptibility changes the precaution; these are not derived from soilType alone. | Warn about rain, not local flooding/saturation. |
| M2 - Stage / rooting / stature (routing) | Developing plants can receive soil-disturbance/support wording. No fixed rainfall damage threshold by age. | Generic practical preparation. |
| C3 - Rain already retained / water model (independent_state) | Actual occurred input may replenish a supported model. Future rain cannot update current storage. | No universal water-timer reset. |

## Blocks, prohibited inferences and missing data

Adding overlapping hourly and daily amounts; Claiming root saturation/local flood from regional mm alone; Low rain chance interpreted as amount confidence. Incomplete totals remain partial; missing local reception does not falsify the regional event. A definitely unexposed route removes that route-specific claim, not all weather context.

## Allowed message and limit

Heavy rain is forecast/reported. Check relevant drainage/runoff exposure and protect vulnerable setups where practical. Attention bands are ENG event screens, not local flood criteria or cannabis saturation thresholds.

Interactions: Rain + soil reception can feed the water model; rain + canopy exposure can feed a wet-weather pathway. Neither follows from the other. Related warnings: W05 may group the storm. W06/W07 require state/root evidence; W11/W12 need tissue-specific paths.

<!-- page break -->

# W05  Severe storm, including explicitly supported hail

NORMATIVE WARNING CONTRACT  |  FAMILY: STORM

## Required scope and source

An applicable authoritative severe-weather event or explicit documented severe/hail product. Preserve source subtype, location and validity.

## Exact trigger combinations

```
C AND (applicableExplicitHail OR applicableSevereProduct)
Hail wording ONLY IF applicableExplicitHail is true.
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Hazard type / source (trigger) | Hail, damaging wind and flooding remain distinct subtypes even within one storm. | Unknown generic event may be shown verbatim with attribution, not guessed into hail. |
| Q - Alert validity / geography / updates (gate) | Include only applicable, uncancelled current/upcoming events; revisions replace earlier versions. | Stale/unmatched events are not active plant warnings. |
| M2 - Regional lead time / stated severity (routing) | Controls prepare-now versus watch wording, preserving the authority scale without inventing plant damage probability. | Keep authority metadata unknown where unavailable. |
| M2 - Roof / cover / wind shelter (modifier) | May change protective actions; protection strength is unknown unless characterized. Mesh is not assumed hail-proof. | Do not suppress authoritative regional event on a vague cover label. |
| C3 - Flowering / size / pot-ground (routing) | Changes what can be secured or moved; not needed for storm eligibility. | Generic relevant protection remains. |
| X - Surface T / humidity / rain probability (excluded) | None is a substitute for a hail/severe-storm product. | No inference from these alone. |

## Blocks, prohibited inferences and missing data

Hail predicted from clouds or rain chance only; US severe-storm thresholds silently treated as global crop-damage limits; User asked to go outside during an active dangerous event. Unavailable hail capability is unassessed, not no hail risk. The reviewed app does not currently retain alerts; adapter work is required.

## Allowed message and limit

Source-attributed storm/hail warning. Prepare beforehand where feasible and follow local weather guidance. No guarantee of hail striking this plant or of a cover preventing damage. [R24](https://www.noaa.gov/jetstream/hail) [R13](https://openweathermap.org/api/one-call-3)

Interactions: Do not add wind + rain + clouds to manufacture a hail trigger. Related warnings: Group W03/W04 only when the source/event supports those subtypes; preserve each reason.

<!-- page break -->

# W06  Low reserve / drying soon

NORMATIVE WARNING CONTRACT  |  FAMILY: WATER_NEED

## Required scope and source

A supported, initialized water model or qualified root-relevant evidence. Daily user moisture logging is not required. Current and projected states are separate.

## Exact trigger combinations

```
C AND ((credibleDryNow AND RECONCILED(true))
 OR MODEL(waterNow OR (notDue AND crossingWithin6h)))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Reserve / action threshold / uncertainty (trigger) | Compatible reserve-threshold comparisons determine current need. Overlap requires a validated decision rule or uncertain. | No supported state -> no definite drought/need claim. |
| P1 - Watering time, amount or saved pattern (state_input) | Recent application can increase reserve according to its event model. A timestamp or small top-up is not guaranteed full refill. | Broad input uncertainty; no elapsed-days substitution. |
| P1 - Occurred rain and soil reception (state_input) | Characterized actual rain can replenish reserve. Unknown reception/capture widens state. | No automatic rain reset; future input remains separate. |
| P1 - ET, weather and actual loss (state_input) | Compatible atmospheric demand drives an assessed system-loss model; stomatal limits and components are accounted once. | Use validated gap bounds or mark unsupported; no zero demand. |
| G - Pot/ground, medium/drainage, roots and canopy (model_domain) | Determine accessible storage and loss within a supported profile. Size effects interact; larger pot alone is not a longer safe interval. | Missing critical profile property limits the model, not every independent warning. |
| M2 - Age/stage, transplant/pruning/movement (model_context) | Development changes supported parameter ranges; material setup changes trigger a new domain/state update. | No exact root volume or leaf area from age. |
| Q - Current wet or dry observation / wilt (action_conflict) | Reconcile a credible observation before an incompatible model action. Wilt alone does not distinguish drought, heat or root stress. | Optional observations improve state; their absence is not a daily-check gate. |

## Blocks, prohibited inferences and missing data

Hot/dry weather alone called proven dry soil; Same-day watering forces not_due despite failed wetting; Forecast rain cancels supported current need. Return the explicit watering exception if the model is unidentifiable; do not generate a drought alert to fill the UI. Hazard modules with usable inputs continue.

## Allowed message and limit

Estimated low reserves now, or an explicitly projected need window; explain the main event/weather cause. No exact soil percentage, dose or guaranteed safe-until time without the separately validated feature. [R01](https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/) [R03](https://www.fao.org/4/X0490E/x0490e0e.htm) [R05](https://ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html)

Interactions: Storage minus loss plus retained input is an accounting model. A dry input/initial state cannot be inferred merely from user watering behaviour. Related warnings: Main watering card absorbs this detector. W01/W11 can coexist; credible wet-root conflicts require reconciliation.

<!-- page break -->

# W07  Persistent excess water / drainage concern

NORMATIVE WARNING CONTRACT  |  FAMILY: ROOT_ENVIRONMENT

## Required scope and source

A model with an assessed excess/drainage state beyond its normal drain window, or credible current root-zone pooling/blocked-drainage/excess evidence. Wet air or regional rain alone is insufficient.

## Exact trigger combinations

```
C AND (abnormalRootPoolingOrFailedDrainage
 OR EXCESS(excessAboveBound AND pastNormalDrainWindow))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Excess state / normal drainage window (trigger) | Persistent abnormal excess raises the environmental concern; root-zone hydraulic meaning must be defined. | No calibrated drain state -> no model-based persistence assertion. |
| P1 - Current pooling / blocked drainage / active-root saturation (trigger) | Qualified abnormal site evidence can support an immediate drainage inspection. A reservoir designed for self-watering is not automatically abnormal. | A vague wet reading alone is weak context, not confirmed waterlogging. |
| P1 - Actual input / reception / runoff and reservoir (state_input) | Repeated received water or extra supply can sustain excess; each input needs its control-volume treatment. | Unknown event amounts/reception widen the assessment. |
| G - Medium, structure and pot/ground (model_domain) | Determine drainage/air-water context. store/native/raised/custom do not specify hydraulic properties. | No clay=saturated or shop mix=free-draining rule. |
| P1 - Loss, root development and weather (interaction) | May alter dry-down within the model; high humidity/cool air is not proof of saturated roots. | Do not require an arbitrary cool-air temperature. |
| Q - Time after watering / repeated observations (support) | Distinguishes transient normal wetness from a persistent issue. Source depth/scope and actual chronology matter. | No known persistence across missing periods. |
| C3 - Wilt, pH/EC, pests, root damage (diagnostic_context) | Can help frame alternatives when measured/reported, but do not establish oxygen concentration or pathogen identity. | No inferred deficiency, root rot or exact cause. |

## Blocks, prohibited inferences and missing data

A single normal moist check just after watering; High rainfall/low ET by itself diagnosed as root rot; Excess above a drained reference silently clipped out of the model. Weather-only conditions may support a rain precaution, not this present root finding. Retain insufficient_data when root excess is unsupported.

## Allowed message and limit

Possible persistent wet-root/drainage issue. Check current drainage or additional water supply before adding more water. This is a possible aeration/drainage environment, not measured low oxygen or a root-rot diagnosis. It shares one card with W14.

Interactions: Excess AND persistence belong together; a normal wet period immediately after watering is not enough. Related warnings: W14 inherits this environmental route; W13 adds vulnerable establishment. One root-environment card.

<!-- page break -->

# W08  Container/root-zone heat exposure precaution

NORMATIVE WARNING CONTRACT  |  FAMILY: HEAT

## Required scope and source

plantedIn=pot and a valid heat exposure trigger plus reported direct solar exposure of the pot/hot-contact context; alternatively a relevant sensor crossing a supported root-temperature screen. Plant Full Sun alone does not locate the pot wall in sun.

## Exact trigger combinations

```
C AND isPot AND (supportedRootTempScreen
 OR (W01_heat AND (potInSun OR hotContact)))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| G - Pot versus ground (gate) | This container-specific card requires pot. Ground retains general heat/root-context advice if relevant. | Unknown planting branch -> no specific hot-pot assertion. |
| P1 - Solar exposure of pot / hot surface (trigger_context) | Verified local exposure supports the precaution. Canopy shade can protect the pot wall even if the plant is in sun. | No pot-specific trigger from plant sunlight category alone. |
| P1 - Air heat / radiation / duration (trigger_context) | Supplies the regional heat setting, not a measured root temperature. | No numeric root-temperature extrapolation. |
| M2 - Material, wall colour and insulation (modifier) | Heat absorption/transfer context; porosity can also alter evaporative loss. Do not assign one universal material multiplier. | No assumed black plastic or measured thermal response. |
| M2 - Pot size / geometry / ground contact (modifier) | May change heat exchange/buffering in an assessed model; volume alone cannot determine root temperature. | Keep effect uncertain, not monotonic size points. |
| P1 - Root sensor / measured root zone (optional_trigger) | A compatible sensor supplies a local measurement, not proof of tissue injury; thresholds remain domain-specific. | Sensor absent does not invalidate a qualified exposure precaution. |

## Blocks, prohibited inferences and missing data

Ground plant shown a container-only warning; Outdoor full sun + unknown container colour/exposure used as confirmed hot roots. Unknown pot exposure -> generic W01 only, or qualified optional context in its details; no extra recurring setup prompt.

## Allowed message and limit

Exposure branch: the exposed container/hot surface may add root-zone heat exposure. Sensor branch: state the measured root-zone temperature and supported screen separately. Reduce avoidable container heating where practical. Do not claim root temperature or injury from air/colour/volume. This is folded into the heat card rather than a duplicate push. [R12](https://extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables)

Interactions: A hot air value plus an unknown/shaded pot wall cannot trigger the exposed-pot branch. A supported local sensor is an independent alternative. Related warnings: Fold into W01 heat family, with the sensor/exposure reason labelled.

<!-- page break -->

# W09  Possible dew/fog dampness

NORMATIVE WARNING CONTRACT  |  FAMILY: DAMPNESS

## Required scope and source

Compatible paired Tair/Tdew/night window for the dew proxy, or an explicit local observation/documented fog product. Fog does not require the nighttime dew proxy.

## Exact trigger combinations

```
C AND (explicitFog OR coveredNightDewProxy)
Dew proxy: 0 <= Tair-Tdew <= 2 C for >=2 covered hours.
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Paired air/dew point and time (trigger) | Smaller nonnegative spread indicates closer air saturation; source quality and concurrent pairing are mandatory. | No pairing -> no precise spread; daily minimum and unrelated dew point cannot be combined. |
| M2 - Night / sky view / cloud (modifier) | Clear sky can strengthen radiational-dew context; actual leaf surface and sky exposure are unknown. | No cloud gate for explicit fog; no invented clear-sky condition. |
| M2 - Wind / advection (interaction) | Light wind can favour radiational dew; fog can have other mechanisms and occur with wind/daylight. | Do not suppress explicit fog on a breezy or cloudy day. |
| M2 - Roof / cover / canopy position (modifier) | May alter radiational cooling and surface exposure; a soil rain shelter answer cannot describe all canopy surfaces. | No automatic dew immunity under a roof. |
| Q - Temperature near/below freezing (routing) | Use W02 frost/freezing context where liquid dew is not supported. Do not infer actual frost merely from this proxy. | Keep liquid/ice nature uncertain. |
| X - Rain / irrigation / water balance (excluded_input) | No rain is needed for dew/fog context. Condensation is not credited as root irrigation without a separate measured model. | No water replenishment or disease diagnosis from this warning. |

## Blocks, prohibited inferences and missing data

abs(Tair-Tdew) hides a physically inconsistent pair; Zero rain means no dampness; A rain-hours counter presented as leaf-wetness hours. No proxy data does not prove dry leaves. Retain unassessed/insufficient_data and keep explicit fog branch independent.

## Allowed message and limit

Conditions may favour dew, or fog is forecast/reported. Surfaces may remain damp; actual leaf wetness is unmeasured. Air saturation, surface dew, fog and frost are distinct. The proxy cannot pinpoint which leaves are wet. [R21](https://www.weather.gov/source/zhu/ZHU_Training_Page/fog_stuff/Dew_Frost/Dew_Frost.htm)

Interactions: Pair T/dew concurrently; do not use abs() to hide an invalid pair. Freezing context changes wording, not proof of ice. Related warnings: W11/W12 may reuse an eligible overlapping dampness proxy; do not count it as another independent disease vote.

<!-- page break -->

# W10  Powdery-mildew-conducive conditions

NORMATIVE WARNING CONTRACT  |  FAMILY: LEAF_DISEASE

## Required scope and source

Foliage context plus a source/time-compatible exposure episode or a credible current powdery-growth report. History alone changes context, not a new active trigger. Unemerged germination with no foliage is not a leaf-inspection target.

## Exact trigger combinations

```
C AND hasFoliage AND (currentPowderyGrowthReport
 OR (PMpilotEnabled AND pairedPMepisode))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| G - Foliage / stage (gate) | Leafed stages support a leaf scout. Flowering is not required; germination with explicitly no emerged tissue is not relevant. | Unknown foliage -> conditional tissue wording, not an assumed leaf inspection. |
| P1 - Paired temperature and humidity / duration (trigger) | Covered favourable ambient episodes support an informational conditions watch; do not use Tmax plus night RH. | Insufficient matching coverage -> no exposure conclusion. |
| M2 - Shade / local airflow / crowding (modifier) | Reported shade, crowding and limited local airflow can increase practical scouting relevance. These are local facts, not inferred from a group weather pin. | No assumption of a dense/still canopy; regional wind is a weak local proxy. |
| M2 - Rain / free leaf water / overhead watering (nonmonotonic) | Free water is not required; rain is not a monotone mildew multiplier or proof of elimination. Root watering is not foliage wetting. | Do not infer leaf wetness from soil reception or a generic watering log. |
| M2 - Wind (interaction) | May affect drying and dispersal in different directions; high wind cannot be an automatic protective veto. | No numeric wind protection credit. |
| M2 - Cultivar/history / prior symptoms (context) | A recent credible history can prioritize inspection; strain marketing/type does not quantify resistance. Current symptoms are separately labelled reports. | Unknown inoculum/susceptibility remains unknown. |
| C3 - Negative inspection / age / pot and soil (scope_only) | A dated negative check affects current symptom history, not future exposure. Pot size, age and soil class do not independently trigger airborne leaf mildew. | No low-risk or immunity assertion from missing symptoms. |

## Blocks, prohibited inferences and missing data

Rain required for mildew eligibility; RH below the pilot screen interpreted as no mildew possible; Fixed infection odds from weather; Root water withheld because mildew watch is active. An informational exposure warning may run with explicitly qualified regional context. Disabled/insufficient policy cannot be mapped to low disease risk.

## Allowed message and limit

Exposure branch: recent/forecast conditions may favour powdery mildew; inspect leaf surfaces if warranted. Symptom branch: powdery growth was reported; review the finding and keep its cause unconfirmed. Both may include feasible airflow advice. Hemp powdery mildew does not require free leaf water; broader powdery mildews differ in moisture/dispersal responses. No universal cannabis infection band is established here. [R07](https://ask.ifas.ufl.edu/publication/PP379/pdf) [R19](https://extension.psu.edu/powdery-mildew)

Interactions: Temperature AND RH AND covered duration form one weather feature. Rain is not required; wind/rain effects are not monotonic disease weights. Related warnings: Shares leaf-scout delivery with W12 when useful. W09 does not add independent mildew points.

<!-- page break -->

# W11  Bud-rot / Botrytis conditions watch

NORMATIVE WARNING CONTRACT  |  FAMILY: FLOWER_DISEASE

## Required scope and source

Flowers must be recorded or confirmed. The environmental route needs an enabled covered humid episode or supported persistent flower wetness. A current flower-problem report has a separate cause-unknown route. Brief wetting alone is insufficient; no universal persistence default is supplied.

## Exact trigger combinations

```
C AND hasFlowers AND (currentFlowerProblemReport
 OR supportedPersistentFlowerDampness
 OR (flowerPilotEnabled AND pairedFlowerEpisode))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| G - Flowers / stage (gate) | Recorded flowering or verified flowers enables a bud-focused watch. Dense/mature flowers are not inferred merely from that enum. | Unknown flowers -> no definite bud-specific eligibility; generic damp/leaf/root context may remain. |
| P1 - Temperature, humidity and duration (trigger) | Compatible covered episodes support conducive-condition messaging; no greenhouse threshold is a validated outdoor infection model. | No matched interval -> insufficient exposure evidence. |
| P1 - Canopy rain, dew/fog and overhead irrigation (trigger_context) | Can produce a damp-tissue pathway if supported. Rain at soil and a root-watering log do not establish flower wetting. | If canopy reception is unknown, use conditional/regional dampness wording only. |
| M2 - Flower/canopy density, airflow and shelter (modifier) | Reported dense tissue or limited airflow can increase inspection relevance; local airflow is not regional wind. | No fixed ambient-to-flower RH offset or assumed heavy buds. |
| M2 - Wounds / recent handling / damage (modifier) | Current dated tissue damage can add context for a susceptible-tissue concern. Old training tags do not prove a fresh wound. | No assumed injury from undated training/pest labels. |
| P1/C3 - Symptom history / negative inspection (context) | A report of deteriorating flowers routes to symptom review; previous absence does not prevent new exposure. | No confirmed infection without independent evidence. |
| C3 - Root moisture / irrigation need (action_conflict) | A root-dry plant can still need irrigation while flower wetting is minimized. Humid weather does not imply wet roots. | Keep main watering model and this scout independent. |

## Blocks, prohibited inferences and missing data

Bud-rot title for a verified flowerless plant; A fixed RH offset simulates flower interior humidity; Rain shelter for soil suppresses all flower/humidity risk; Blanket do-not-water instruction from disease watch. Missing flower tissue blocks this specific label; missing canopy microclimate limits support, not a claim of absence. A broader Botrytis symptom report needs tissue-aware review.

## Allowed message and limit

Exposure/wetness branch: damp/humid conditions warrant attention to flowering tissue; reduce avoidable prolonged flower wetting. Symptom-only branch: a flower-health problem was reported; review it without asserting recent humid conditions or Botrytis. Improve feasible airflow where appropriate. Botrytis-favouring tissue/environment relationships do not supply an infection probability or guarantee prevention. Flower microclimate can differ from ambient. [R08](https://pnwhandbooks.org/plantdisease/host-disease/hemp-cannabis-sativa-gray-mold-botrytis-bud-blight-stem-canker) [R18](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2023.1192035/full)

Interactions: T and humidity must overlap in time. Brief wetting alone does not pass the direct dampness route; persistence needs an accepted rule, with no universal default here. Wounds/density alone do not trigger. Related warnings: Group shared W09/W12 evidence; keep W06 root irrigation independent of flower-wetting precautions.

<!-- page break -->

# W12  Wet-weather leaf-spot conditions watch

NORMATIVE WARNING CONTRACT  |  FAMILY: LEAF_DISEASE

## Required scope and source

Foliage context and a documented wet-weather proxy/leaf-wetness observation or a credible new leaf-spot report. The output is a broad leaf-spot scout, not a Septoria identification.

## Exact trigger combinations

```
C AND hasFoliage AND (currentLeafSpotReport
 OR (leafPilotEnabled AND jointTempRHwetWeatherEpisode))
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| G - Foliage / stage (gate) | Leaf-bearing plants can qualify at multiple stages. Lower/inner foliage is an inspection target, not evidence that it is infected. | Unknown tissue -> conditional message or not relevant when no foliage is confirmed. |
| P1 - Leaf wetness / canopy rain / dew (trigger_context) | Supported wetting and time in humid conditions add exposure context; leaf-wetness sensor hours differ from provider rainy hours. | Unknown canopy path -> qualified regional wet-weather message only. |
| P1 - Paired temperature and humidity / time (trigger) | An explicit exposure band counts only matched covered intervals. Exact favourable limits vary among leaf-spot pathogens. | Do not fill missing hours or interpret an out-of-band day as no disease. |
| M2 - Airflow, canopy position / shade (modifier) | Reported slow-drying/crowded context can prioritize a scout. | No inferred inner-canopy moisture from a daily mean. |
| M2 - Debris/splash/history / cultivar (modifier) | Reported current disease history or splash context can add relevance; soilType or strainType is not evidence of inoculum/resistance. | Absent history is unknown, not proof of a clean site. |
| P1/C3 - Symptoms / previous negative check (context) | Dated new spots allow symptom review. Similar appearances have different causes; a prior negative is scoped in time. | No species/deficiency diagnosis or fake odds. |

## Blocks, prohibited inferences and missing data

Automatic Septoria diagnosis from rain/RH; Soil rainReception treated as leaf wetness; Leaf spots inferred from generic notes without confirmation. No exposure data -> unassessed, not low leaf-spot risk. Symptom reports can still be reviewed without weather.

## Allowed message and limit

Exposure branch: recent/forecast wet-weather conditions warrant attention to foliage. Symptom-only branch: new leaf spots were reported; review their cause without asserting wet weather. Neither branch identifies a pathogen. Rutgers/UF describe multiple leaf-spot diseases with overlapping symptoms and wetness associations. A regional weather proxy cannot distinguish them. [R09](https://extension.rutgers.edu/e374) [R07](https://ask.ifas.ufl.edu/publication/PP379/pdf)

Interactions: Count the INTERSECTION of T, RH and supported wet-weather route, not three totals from separate times. Label proxy versus measured leaf wetness. Related warnings: Shares leaf/flower scout context with W10/W11; distinct pathogens and routes remain distinct.

<!-- page break -->

# W13  Wet conditions during germination/establishment

NORMATIVE WARNING CONTRACT  |  FAMILY: ESTABLISHMENT

## Required scope and source

Recorded germination/seedling stage or explicitly confirmed susceptible rooting/establishment context, plus supported abnormal root-zone wet/drainage conditions or a current relevant symptom report. A mature transplant is not automatically a seedling.

## Exact trigger combinations

```
C AND vulnerableEstablishment
 AND (currentEstablishmentProblemReport OR W07_rootExcess)
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| G - Germination / seedlings / rooting context (gate) | Emerging tissue is the relevant scope; age alone does not define it. Explicit tissue/rooting facts override vague chronology. | Unknown clone establishment -> general root-context advice, no automatic damping-off eligibility. |
| P1 - Active germination/root-zone excess and drainage (trigger) | Abnormal persistent wetness or supported drainage failure warrants a wet-establishment precaution. Normal moisture for germination is not pathological. | No exposure claim from outside RH/rain alone. |
| M2 - Root/soil temperature versus air (modifier) | Actual soil/root readings can frame establishment context. Ambient cold does not measure substrate temperature; pathogen responses differ. | No cool-air-only damping-off trigger. |
| M2 - Sanitation, reused medium / history (context) | A dated user report can support hygiene/contextual advice; native/store/custom does not identify pathogen content. | No inference of contamination from medium origin alone. |
| C3 - Light, growth speed / salts (context) | Measured/reported constraints can frame alternative causes and slow establishment, without numerical disease points. | No low-light/EC assumption from weather UV or nutrient mL/L. |
| P1 - Collapse / failed emergence / negative checks (symptom_review) | Current reports warrant a differential inspection; mechanical damage, pests and other stresses can look similar. | No pathogen identity or assurance from missing reports. |

## Blocks, prohibited inferences and missing data

Flowering established plant receives a damping-off card from rain alone; Normal moist seed medium called waterlogged; Root temperature copied from air. If vulnerable stage or root excess is unknown, preserve that limitation. Independent heat/cold/rain preparation warnings remain available.

## Allowed message and limit

Excess branch: the young/germinating root zone may be staying excessively wet; review drainage. Symptom-only branch: an establishment problem was reported; investigate without asserting excess moisture. Keep the cause unconfirmed. Damping-off affects seeds/young seedlings and involves several organisms; established plants are less susceptible to that syndrome. General sources do not prove a cannabis threshold. [R20](https://ipm.ucanr.edu/home-and-landscape/damping-off-diseases-in-the-garden/)

Interactions: Young stage without abnormal wetness is not wet-establishment risk; abnormal wetness in a mature plant is W07, not a seedling diagnosis. Related warnings: Add establishment context to the W07/W14 root family, without another independent severity vote.

<!-- page break -->

# W14  Root aeration / root-health context

NORMATIVE WARNING CONTRACT  |  FAMILY: ROOT_ENVIRONMENT

## Required scope and source

Use W07 evidence for the environmental route, or a credible current root/foliage symptom report for an explicitly uncertain symptom-review route. This is not a second independent weather risk score.

## Exact trigger combinations

```
C AND (currentRootOrWiltReport OR W07_rootExcess)
Environmental route is W07, never a second weather score.
```

| Rank / factor | How it changes the warning | When missing |
| --- | --- | --- |
| P1 - Persistent excess / drainage evidence (inherited_trigger) | Same root condition and evidence as W07; never count it twice to increase severity. | No weather-only root-rot fallback. |
| P1 - Current wilt / discoloured roots / root injury report (symptom_review) | Can justify investigation when credible, with source and tissue scope. It does not identify drought versus root damage, oxygen, salt or disease. | No silent NLP diagnosis from old notes/photo URI. |
| C3 - Root-zone T, EC/pH and physical injury (diagnostic_context) | Compatible actual measurements can support a differential; sample type/time matter. They are not all available today. | Do not derive EC or toxicity from fertilizer name/concentration. |
| Q - Watering / rainfall / supported reserve (action_conflict) | A current credible wet/saturated root finding blocks a weather-only more-water instruction. Reconcile later dry evidence and intervening events chronologically. | An old wet observation is not a permanent veto. |
| C3 - Stage / root establishment / medium (routing) | Change relevant inspection scope and model domain. Poor drainage is not inferred from every soil label. | No age or strain disease coefficient. |
| X - Regional RH / cold weather / prior needsWater (excluded) | None establishes present root oxygen or a pathogen, and prior app output is not observational evidence. | These cannot supply the missing root trigger. |

## Blocks, prohibited inferences and missing data

Root-rot score increases because needsWater=false; W07 and W14 count as two independent root hazards; Named Pythium/Fusarium diagnosis from weather. No usable root evidence -> no present aeration/pathogen assertion. A symptom-only branch stays explicitly cause_unknown.

## Allowed message and limit

Possible root-environment problem or reported symptoms: investigate drainage/current roots and keep the cause unconfirmed. Environmental conditions, symptoms and confirmed disease are different claims. Heat alone can cause wilt even with adequate water. [R22](https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat) Root-disease organisms do not share one universal weather threshold.

Interactions: Wilt can have different causes. A symptom route does not establish excess water; a root-excess route does not identify a pathogen. Related warnings: One W07/W14 card with retained child reasons; W13 is tissue-specific context.

<!-- page break -->

# 13A  Cross-warning precedence and delivery

ONE FACT CAN AFFECT DIFFERENT WARNINGS IN DIFFERENT WAYS

| Combination | Required resolution |
| --- | --- |
| Heat + adequate/wet roots | Keep W01 heat exposure. Do not invent current drought or order more water. A supported future dry path may be stated separately. |
| Current dry estimate + mildew/flower watch | Needed root irrigation can coexist with a canopy precaution. Do not issue a blanket avoid-watering instruction from disease-conducive weather. |
| Heavy rain + sheltered soil | Keep regional storm context, qualify root input; do not assume flowers sheltered or local humidity low. |
| W07 excess + W14 root context | One root-environment card/dedupe key, distinct child reasons. No double scoring or repeated push. |
| W01 heat + W08 container heat | One heat card with container-specific context if supported. Root temperature remains unknown unless measured. |
| W09 dew/fog + leaf/flower watches | Share the weather episode as evidence. Dampness is not a second independent infection vote; combine practical inspection wording. |
| Storm wind + rain + explicit hail | One source/event storm card can preserve separate substantiated hazards. Never upgrade generic thunderstorm into all three automatically. |
| Leafed seedlings with leaf and root conditions | Tissue-aware messages can coexist; route W13 only with establishment/root conditions, W10/W12 only with foliage evidence. |
| Old stage conflicts with current tissue report | Resolve dated evidence. A current explicit flower report can establish flowers even if a stale stage says vegetative; an uninspected photo URI cannot. |
| New observation during cooldown | Recompute immediately. User notification settings still govern delivery; cooldown cannot preserve a stale state. |
| No current hazard threshold met | Record not_triggered for that policy and covered window. Never show no disease or guaranteed safe as a consequence. |

Current verified root findings, a source-attributed official event and a model projection are different claims. Do not convert their support levels into a single all-purpose confidence percentage. Delivery severity is action urgency and source context; it is not pathogen likelihood.

Maintain source/event identity, valid interval, location epoch and ruleset version for deduplication. Forecast revisions and genuinely changed observations may update a card; identical unresolved evidence should not create daily duplicate warnings. Routine user effort remains watering logs, with optional exception or symptom feedback.

<!-- page break -->

# 13B  Implementation readiness by capability

A WARNING CONTRACT IS NOT A CLAIM THAT THE CURRENT APP ALREADY SUPPORTS IT

| Warnings | Minimum implementation gap before reliable evaluation |
| --- | --- |
| W01/W02/W03 | Retain valid timestamps/nature/units; use actual T, sustained/gust separation and source-specific official event mapping. Generic point warnings can use fewer fields than duration branches. |
| W04 | Separate rain rate/sum, full/partial interval and forecast/history; implement per-plant soil rain reception and qualified canopy path. |
| W05 | Enable alerts or an explicit severe/hail product; extend decoding/storage/type contracts and verify agency coverage for actual launch regions. |
| W06 | Implement and validate the v5 predictive reserve/profile model; optional observations cannot be replaced by the old dryness ratio as ground truth. |
| W07/W14 | Assessed excess/drainage state or qualified abnormal site/symptom evidence; retire circular rootRot score and introduce deduplication. |
| W08 | Optional explicit pot solar/hot-surface context or calibrated root-temperature route. Pot size and Full Sun alone are insufficient. |
| W09 | Matched hourly T/dew/time or explicit typed fog code/site observation, with correct night and freezing distinctions. |
| W10/W11/W12 | Time-compatible hourly exposure and coverage, appropriate tissue context, accepted informational pilot policy; no field-tested infection model is claimed. |
| W13 | Explicit susceptible establishment context plus qualified root-zone excess/symptoms. Old clone enum cannot supply precise rooting state. |
| All cards / migrations | SuggestionKind currently has only watering/powderyMildew/rootRot. Add explicit typed warnings/outputs and update UI, queues, backup, rules, ownership and offline handling. |

## Minimal-burden proposed additions

The agreed rainReception question remains the primary new outdoor setup question. Other facts are optional/progressive: canopyRainExposure, irrigationMethod, windShelter, potSolarExposure/hotSurface, drainage/additional supply, rootingStatus, tissue presence/density and structural support. Never request all of them merely to populate warning cards. An absent optional fact should reduce specificity or leave a branch unassessed.

Positive/unsure symptom and abnormal-wetness reports need typed occurrence time, tissue/root scope and method. They are exception observations, not daily tasks. Sensor values need instrument/units/depth/calibration. A static manual profile/default is not live evidence.

Inspect actual source fill rates and new normalizer fixtures. The four previously reproduced parser problems are still code work to fix/retest; the research audit does not change production records. Human attention screen values and regional source service settings also need practical validation.

<!-- page break -->

# 13C  Verification of factors and warning rules

RESEARCH CHECK, CONTRACT COMPLETENESS AND IMPLEMENTATION FIXTURES ARE DISTINCT

Each W01-W14 contract has prerequisites, an explicit evaluation route, factor roles/directions, missing-data handling, suppressions, allowed wording, claim limits, primary-source references and three regression scenarios. The structured registry preserves those fields for engineering review. It does not contain a calibrated infection probability. v5.2 adds formal expressions, per-factor ordinal ranks and the reference evaluator; see sections 12G-12J and 13E-13F.

| Check performed | Result / boundary |
| --- | --- |
| Existing data/schema cross-check | Reviewed Plant/PlantLog/WeatherCacheEntry, WeatherResponse/normalizer and SuggestionKind. Existing, raw-API and proposed fields are separated. |
| Disease mechanism cross-check | Rechecked hemp disease guidance, Botrytis, leaf spots, powdery mildew distinctions and seedling damping-off scope. Numeric exposure screens remain ENG. |
| Weather mechanism cross-check | Rechecked dew/frost, human wind-chill limitations, heat/wilt context, API field semantics and severe/hail capability. |
| Factor completeness | All 14 original warning rows have contracts. Soil/canopy wetting and protection dimensions are separated; each missing modifier has a defined consequence. |
| Duplicate evidence | W07/W14 root family and W01/W08 heat family explicitly deduplicate; shared dew/humidity evidence is not independent infection votes. |
| Structured registry validation | Unique IDs, required keys, factor roles/effects/missing handling, source IDs and 42 scenario descriptions are mechanically checked by the builder. |
| Predictive biology | No new measured hazard/infection accuracy, root profile calibration or prospective trial outcome is claimed. |
| Application tests | 42 warning regression scenarios and inherited 48 v5 cases are specified, not executed app tests. The earlier 15 algebra fixtures remain separate numerical checks. |

Double-checking the mechanisms can reject invalid inferences; it cannot make the ENG threshold values experimentally proven. Promotion needs prospective event usefulness, false-alert burden, normal watering-decision accuracy and appropriate coverage/abstention metrics in target climates and setups.

<!-- page break -->

# 13D  Warning regression scenarios 01-14

SPECIFIED SEMANTIC CASES - NOT EXECUTED AGAINST AN IMPLEMENTED WARNING ENGINE

| Case | Warning | Input / expected semantic behaviour |
| --- | --- | --- |
| WARN-01 | W01 | Fresh T=33 C with wet roots: heat eligible, extra water not implied. |
| WARN-02 | W01 | Only feels_like=38 C, actual T missing: numeric heat trigger unavailable. |
| WARN-03 | W01 | No plant height or stage: a valid regional heat warning remains eligible. |
| WARN-04 | W02 | Tair=4 C and wind chill=-2 C: cold context only; no inferred air freeze. |
| WARN-05 | W02 | Tair=-1 C with strong wind: freeze branch is not suppressed by lack of calm air. |
| WARN-06 | W02 | Frost alert, sky/wind absent: attributed frost warning still eligible. |
| WARN-07 | W03 | 15 m/s gust, no height: eligible. |
| WARN-08 | W03 | Provider 5 m/s equals 18 km/h exactly once. |
| WARN-09 | W03 | Known sheltered plant retains regional warning with qualified local effect. |
| WARN-10 | W04 | 30 mm daily total, rate absent: amount watch only. |
| WARN-11 | W04 | Roof shelters soil but flowers are exposed: root and canopy paths differ. |
| WARN-12 | W04 | High forecast rain with dry roots now: current water estimate unchanged. |
| WARN-13 | W05 | Thunderstorm code + 90% rain, no hail field: no hail-specific warning. |
| WARN-14 | W05 | Explicit applicable hail alert qualifies without plant size. |

<!-- page break -->

# 13D  Warning regression scenarios 15-28

SPECIFIED SEMANTIC CASES - NOT EXECUTED AGAINST AN IMPLEMENTED WARNING ENGINE

| Case | Warning | Input / expected semantic behaviour |
| --- | --- | --- |
| WARN-15 | W05 | Cancelled or wrong-location alert is not active. |
| WARN-16 | W06 | Hot day but supported sufficient reserve: no current drought warning. |
| WARN-17 | W06 | Unknown top-up cannot be treated as a full reset. |
| WARN-18 | W06 | Dry now plus rain tomorrow: current need remains. |
| WARN-19 | W07 | Moist immediately after watering: no persistent-excess warning. |
| WARN-20 | W07 | Observed abnormal pooling at active roots can qualify without weather. |
| WARN-21 | W07 | Self-watering reservoir full alone is not root waterlogging. |
| WARN-22 | W08 | Ground plant with heat: W01 possible, W08 not relevant. |
| WARN-23 | W08 | Plant Full Sun but pot wall shaded: no inferred pot heating. |
| WARN-24 | W08 | Unknown pot material does not become black plastic. |
| WARN-25 | W09 | 0 rain with T/Tdew close at night: dew proxy may qualify. |
| WARN-26 | W09 | Tdew materially above Tair: quality failure, not abs shortcut. |
| WARN-27 | W09 | Daytime explicit fog can qualify without a nighttime interval. |
| WARN-28 | W10 | Vegetative leafed plant can qualify; flowering not required. |

<!-- page break -->

# 13D  Warning regression scenarios 29-42

SPECIFIED SEMANTIC CASES - NOT EXECUTED AGAINST AN IMPLEMENTED WARNING ENGINE

| Case | Warning | Input / expected semantic behaviour |
| --- | --- | --- |
| WARN-29 | W10 | Zero rain does not block a compatible PM episode. |
| WARN-30 | W10 | High wind cannot automatically cancel a PM watch. |
| WARN-31 | W11 | Vegetative and explicitly no flowers: no bud-rot watch. |
| WARN-32 | W11 | Flowering plus humidity under a rain roof: humidity pathway can remain. |
| WARN-33 | W11 | Dry-root need and flower watch coexist without contradictory water advice. |
| WARN-34 | W12 | Root drip watering alone is not a leaf-wetting event. |
| WARN-35 | W12 | Rain hours cannot be printed as leaf-wetness hours. |
| WARN-36 | W12 | Leaf spots reported on a dry day still allow symptom review. |
| WARN-37 | W13 | Established flowering plant with rain: no seedling-damping-off warning. |
| WARN-38 | W13 | Seedling with normal moist medium: no abnormal-wetness trigger. |
| WARN-39 | W13 | Unknown-rooted clone is not silently treated as a newly germinated seed. |
| WARN-40 | W14 | needsWater=false alone does not qualify. |
| WARN-41 | W14 | W07 and W14 merge into one root card with preserved reasons. |
| WARN-42 | W14 | Wilt without root evidence yields cause_unknown, not automatic drought or root rot. |

<!-- page break -->

# 13E  Worked combinations and action priority

EXPLICIT PATHS REPLACE AN ADDITIVE RISK SCORE

| Example combination | Required result |
| --- | --- |
| Flowers absent + humid episode + dense canopy + wounds | W11 not_relevant. Modifiers cannot overcome the missing flower gate. |
| Flowers known + enabled paired humid episode + no density/history info | W11 conditions watch. Unknown optional modifiers do not block the primary episode. |
| Flowers known + density/wounds only + no dampness/episode/report | No W11 trigger on those modifiers alone. Missing primary evidence is unassessed, not low disease risk. |
| Flowers known + current flower problem + weather pilot disabled | Reported flower-health problem, cause unconfirmed. The report route remains active. |
| Flowers briefly wet + no humid episode/report | Brief wetting alone does not qualify W11. Its direct dampness route needs supported persistence evidence. |
| Heat + supported sufficient reserves | W01 exposure can be active; no current drought/extra-water instruction. |
| Abnormal excess + elapsed past profile drain window | W07 qualifies if model support is valid. Either term alone is not the model trigger. |
| Current abnormal pooling + young vulnerable establishment | W07 root environment plus W13 context; W14 inherits, with one grouped card. |
| Unknown gust + valid sustained wind above its screen | W03 can qualify through sustained wind. Unknown OR true is true. |

## Delivery priority is not a ranking of causal factors - ENG

| Order | Deterministic routing decision |
| --- | --- |
| 1 - immediate applicable event | Preserve official event urgency and current valid window. Follow source/local safety guidance; do not direct outdoor action during dangerous conditions. |
| 2 - current supported care issue | A reconciled current watering need or qualified root/drainage problem receives timely care wording. Resolve contradictory evidence first. |
| 3 - preparation / inspection watch | Upcoming weather, predicted need window or condition scout is scheduled while useful, respecting settings. |
| 4 - contextual child reason | Container/establishment/shared dampness detail enriches its parent card without another repetitive push. |

Keep all matched branches in the explanation. For cold, the most specific supported numeric subtype is air freezing, otherwise possible frost, otherwise cold; retain an official subtype separately. For disease cards, a current symptom report leads with reported-problem wording and can also retain a separately supported conditions watch. Do not sum matched branches into severity.

<!-- page break -->

# 13F  Reference verification and future weights

LOGICAL CORRECTNESS IS TESTED; BIOLOGICAL EFFECT SIZE IS NOT ESTIMATED

The supplied reference evaluator executes 110 synthetic combination checks. They test every warning positive/negative path and common gate; required tissue/setup gates; three-valued AND/OR; independent alternatives; source-quality failure; disabled disease weather policy versus active symptom report; joint-duration arithmetic; dependency replay; and invariance to unrelated modifiers. All passed. These are real reference-code checks, separate from the 42 previously specified warning scenarios and 48 inherited core cases.

The evaluator accepts scoped, normalized features, not raw weather API payloads. It implements Boolean eligibility and one illustrative duration reducer. It does not implement provider normalization, moisture/storage calibration, symptom interpretation, severity prediction or the app integration. Source/tissue/model feature producers still need implementation and verification. Normal operation still uses watering logs without daily manual moisture checks.

## What must happen before numerical disease weights exist

| Requirement | Concrete implementation criterion |
| --- | --- |
| Define the outcome | For any future probability, name the pathogen/condition, tissue, prediction horizon and independent outcome standard. A weather episode and confirmed disease are different targets. |
| Collect appropriate observations | Use representative plants, setups, climates and timed symptom/reference observations. Missing checks remain missing; watered-after-alert is not a true disease/dry label. |
| Fit joint responses | Estimate temperature-by-wetness/duration effects and justified local modifiers within the supported domain. Avoid duplicate RH/dew/VPD votes. No copied grape coefficients. |
| Keep gates outside a score | Required tissue, authorization and source validity remain hard rules. A large score cannot compensate for false/unknown required scope. |
| Measure usefulness and calibration | Use prospective chronological/plant/location holdouts; report false alerts, misses, coverage and burden. If probabilities are produced, evaluate calibration and suitable scoring rules. |
| Assess added factors | Compare held-out performance with/without each added feature group and important interactions. Predictive feature importance is not proof of causal percentage contribution. |
| Version and fallback | Store fitted coefficients/functions, domain, references and validation. Outside supported input/domain, retain qualified rules or unassessed status. |

Numerical causal weights: not estimated. Ordinal factor roles: specified for all 89 mappings. Trigger combinations: executable as reference logic for all 14 warning IDs. Disease-weather production policies: still disabled pending validation. No production app warning engine or field accuracy is claimed.

<!-- page break -->

# 13G  Reference features and data bindings

FEATURE NAMES ARE A CONTRACT, NOT A CLAIM THAT THE APP ALREADY STORES THEM

| Reference input | Producer / meaning | Availability and limitation |
| --- | --- | --- |
| access.*, plant.active/notDeleting/outdoor | Ownership/share permission, status/deleting and environment. | Existing records; enforce access before reading protected features. |
| plant.pot/foliage/flowers/vulnerableEstablishment | plantedIn, current stage and confirmed tissue/rooting facts. | Pot is direct; stage-to-tissue rules need explicit scope. Unknown rooting or flowers stays unknown. |
| official.* | Applicable mapped alert/severe product with hazard subtype and valid interval. | New adapter/storage required; unavailable feed is not no regional hazard. |
| valid.*, air.C, wind.*, rain.* | Scoped air, gust/mean m/s, rain mm/h or complete rolling-24h mm. | Legacy cache is insufficient for every route. Wrapper quality includes provenance, units, location and coverage. |
| model.* | Supported predictive decision, future crossing, excess and profile drain window. | New model outputs; preserve interval/domain/reconciliation. waterNow and notDue cannot both be true. |
| root.* | Qualified current dry/pooling/drainage evidence and conflict reconciliation. | Optional typed observations; absent report is inactive, not evidence of normal roots. No daily-check gate. |
| exposure.* | Matched normalized intervals -> PM/flower/leaf/dew episode. | Derived features; preserve occurred versus forecast, source and duration bounds. Weather disease policies stay off. |
| sensor.* | Instrument availability, scope, calibration and supported root-temperature screen. | Optional new capability. No sensor means inactive sensor branch; present invalid support remains unassessed. |
| setup.* | Explicit pot solar/hot-contact context, with effective time. | Optional proposed fields; plant Full Sun is not a pot-wall observation. |
| siteOrProduct.fog, site.flowerDamp* | Typed fog product/report; current flower wetting plus supported persistence rule and evidence. | Brief wetting is insufficient for W11; no universal persistence default. A symptom report is a separate route. |
| symptom.* | Current scoped positive/uncertain tissue problem reports. | New typed reports required; current inspectionResult stores only no_symptoms. Do not infer from photo URI. |
| context.heat, context.rootExcess | Derived W01 / W07 result, recomputed before dependants. | Internal only. Triggered -> true, supported nontrigger -> false, insufficient -> unknown. |

Each real feature bundle also carries source nature, valid interval, location/setup epoch, provenance and uncertainty. The scalar reference checks omit these envelopes for compact synthetic testing; their producers must validate them before evaluation. A Boolean report feature means an eligible report exists, not confirmed disease. When facts conflict, reconcile chronology, tissue, depth and method instead of averaging.

A source is not made valid by setting a flag manually. The quality wrapper must be backed by producer checks and fixtures. An absent optional sensor/report is inactive; an invalid available measurement is unknown. No observation route is required for an otherwise supported normal model watering decision.

<!-- page break -->

# 14  Predictions that remain unsupported

PRACTICAL ALTERNATIVES WITHOUT AN EXPANDED DAILY LOGGING BURDEN

| Unsupported claim from current routine inputs | Alternative |
| --- | --- |
| Exact soil moisture percentage for any setup | Use an estimated reserve class/range for validated profiles. Optional calibrated sensor for a physical measurement. |
| The plant definitely retained a full watering | Use saved pattern plus calibrated input uncertainty; optional one-time amount measurement or event exception. |
| Exact roots/depth from plant age | Use developmental/profile ranges and uncertainty; optional transplant/rooting history. |
| Exact disease presence or pathogen identity | Event-triggered symptom/photo support or diagnostics; retain weather-condition warnings separately. |
| Exact pest infestation or pest species from weather | User/photo observation or a region-specific validated pest service. No general weather-only pest diagnosis. |
| Nutrient deficiency, pH lockout or excess salt from rain/age | Relevant medium/feed measurements and symptoms. No automatic fertilizer/pH correction from weather alone. |
| Exact root/leaf temperature or sunburn injury | Contextual heat/acclimation warning; optional actual local/tissue measurements. |
| Exact flowering/harvest date from age/daylight | User-confirmed stage and verified cultivar/phenology support where available. |
| Flooding at the individual plant from regional rain | Drainage/topography/site report or an appropriate flood product; report heavy-rain exposure separately. |
| Guaranteed future no-water period or no disease | Give qualified current recommendation and a future estimate with reevaluation/uncertainty. No guarantee. |

## The recommended product compromise - ENG

- Keep normal use to watering logs and saved setup context.
- Supply tested profile estimates for supported setups; show Estimated on the watering card.
- Keep optional sensor integration and one-time calibration as accuracy upgrades rather than mandatory equipment.
- Use a rare, specific exception prompt when a missing fact changes the action. A recurring Check moisture request is a sign that the supported model/profile coverage is inadequate.
- If the intended deployment truly requires a definite, accurate yes/no for every arbitrary setup with no reference feedback, that performance claim is unsupported. Narrow the supported setups or add a measurement source.

A one-time moisture answer or watering-method calibration is an alternative offered here, not a newly imposed daily requirement. It can improve initialization; it does not by itself validate all later predictions for an unknown medium.

<!-- page break -->

# 15  Output contract and novice interface

A SIMPLE CARD WITH A TRACEABLE ESTIMATE UNDERNEATH

```
PredictiveCareDecision = {
  plantId, asOf, algorithmVersion: "5.2", policyVersion,
  decision: water_now | not_due | uncertain | ineligible,
  recommendationBasis: predicted | observed | mixed,
  estimatedMoisture: low | sufficient | excess_possible | uncertain,
  model: {profileId?, profileVersion?, supportedDomain, calibrationStatus},
  reserveRange?, units?, thresholdRange?, uncertaintyMethod?,
  mainReasons[], evidenceRefs[], assumptions[], missingCriticalInputs[],
  hazards: [{kind, sourceNature, exposureWindow, support,
             actionPriority, preventativeAction, limitations}],
  nextEvaluationAt, projectedNeedWindow?, exceptionRecovery?,
  setupRevision, locationPathRevision, inputFingerprint,
  dataWarnings[], deliveryState
}
```

| Result | Card example |
| --- | --- |
| water_now | Needs watering - Estimated reserves are low after recent drying conditions. |
| not_due | Does not need watering yet - Estimated reserves remain sufficient after watering. |
| Supported rain replenishment | Does not need watering yet - Recent rain is estimated to have replenished this exposed setup. |
| uncertain | One setup detail needed - We cannot tell how much rain reaches this plant. |
| Disease-conducive conditions | Bud rot watch - Recent damp conditions warrant attention to flowering tissue. Presence is unconfirmed. |
| Official hazard | Strong wind forecast - Secure exposed pots/supports before the event where practical. |

Show Estimated in the main watering UI. A details view explains the most important model assumptions and last event; it does not show a fake precise soil-moisture percentage or a confidence percentage from field counts. A supported probability, if eventually shown, must be empirically calibrated for its stated outcome.

A warning does not require the user to fill a symptom form. Optional Saw a problem or Advice seems wrong feedback is available. A Watered event is acknowledged immediately, and updates the estimate without automatically proving a complete refill.

A correct not_due card can coexist with a heat or bud-rot watch. A supported dry estimate can coexist with a disease watch; disease-conducive humidity does not justify withholding needed root irrigation. Copy must not turn a canopy-wetting precaution into a blanket instruction not to water the roots.

<!-- page break -->

# 16  Execution and parameter contract

DETERMINISTIC STATE PROPAGATION; NO UNDOCUMENTED DEFAULTS

```
evaluate(snapshot, asOf):
  authorize_and_check_lifecycle()
  events = reconcile_revisions_duplicates_and_occurrence_intervals()
  setupPath, locationPath = reconstruct_effective_context()
  profile = select_supported_profile_with_versioned_eligibility()
  weather = normalize_history_current_forecasts_with_quality()
  states = initialize_or_load_valid_checkpoint(profile, events)
  states = replay_actual_inputs_and_supported_loss_to(asOf, states)
  states = assimilate_optional_observations_if_relevant(states)
  current = decide_current_watering(states, profile)
  future = project_separate_forecast_paths(states, weather)
  hazards = evaluate_independent_exposure_modules()
  return explain_and_apply_delivery_policy(current, future, hazards)
```

## Required parameter registry

| Parameter class | Policy |
| --- | --- |
| Storage, root access and action threshold | CAL: units, profile domain, definition, uncertainty/dependence, source and validation must be supplied. No guessed universal defaults. |
| Loss/weather-transfer function | CAL: predictor definitions, interval semantics, trained/assessed weather range, version and independent error. |
| Irrigation pattern and rain reception conversion | CAL: observed input/post-event variability, setup domain and bounds. Direct shelter is a structural restriction, not a universal retention efficiency. |
| Current/forecast freshness and gap tolerance | ENG, with effects assessed in validation. Product issue/update cadence, scheduler capability and model-error limits determine the values. |
| Decision threshold under overlap | CAL/ENG: calibrated probability/loss policy and measured acceptable errors. Otherwise preserve uncertain. |
| Disease and damage screens | Named ENG pilot unless a relevant validated model exists. No unlabelled transfer from another crop/region. |
| Delivery/cooldowns | ENG: user settings and event deduplication. Recompute state immediately on new data even while a push is suppressed. |

Parameter absence is a model-readiness error or unsupported-profile result, never an invitation to insert a pleasing constant. The age/size/medium features may narrow an already assessed profile; they do not manufacture missing calibration.

Unsupported watering-profile status does not suppress usable weather/hazard modules. Evaluate their independent inputs and return the applicable warnings alongside the explicit watering exception.

Cache/checkpoint keys include event revisions, profile and policy versions, setup/location path, weather product/method and time. Replay late corrections and deletions. Forecast issue/availability time is preserved for honest backtests; data recorded after a historical asOf are unavailable to that replay.

<!-- page break -->

# 17  Implementation and compatibility

THE NEW PREDICTIVE CONTRACT MUST REACH EVERY CONSUMER

| Work item | Required result |
| --- | --- |
| Weather normalizer | Correct the earlier reproduced mixed rain-rate/day total, forecast-as-observed, future-night aggregation and UTC-shift defects. Retain raw interval provenance. |
| Weather history and alerts | Use a real retrospective product for missing history, not a current forecast request. Enable official alert capability; benchmark reference ET inputs. |
| Plant/setup schema | Add rainReception, effective history, supported medium/drainage profile and optional saved watering pattern. Extend backups, ownership, offline edits and deletion together. |
| Prediction core | Implement the versioned profile selector, event/state replay, uncertainty, current action and separate future projection. No Firestore/HTTP inside the pure domain core. |
| UI adapters | Replace thresholdDays/legacy rain resets. Every consumer must understand uncertain. A Boolean false cannot mean both not_due and unknown. |
| Root/disease logic | Remove root-rot scoring that consumes needsWater. Add independent drainage/excess state and explicit flower/leaf/weather hazard types. |
| Presentation overrides | Remove same-day watering rules that force high confidence/not_due regardless of retained amount or later evidence. |
| Shadow release | Compare predictions with reference outcomes without new pushes first. Roll out only to domains whose performance passes the defined criteria. |
| Operational delivery | Share weather fetches geographically; retain individual water states. Recheck authorization/status before pushes and suppress inactive/harvested plants. |

## Scope of the earlier code evidence

The four parser behaviours were reproduced during the v4.0 audit against the local modules. That does not establish their frequency in stored data or that the current deployment is identical. Retest the actual implementation commit and inspect legacy weather records before migration. Do not claim the app was fixed by writing this document.

## Low effort must be measured

Track how often users receive the normal binary answer, how often a one-off question is needed, optional-field completion, notification burden and user abandonment. An engine that avoids mistakes by returning uncertain for nearly all ordinary plants fails the product requirement. An engine that always returns a Boolean without support fails the accuracy requirement.

Preserve untracked specialist setups with an explicit alternative; do not force them into a standard free-draining pot profile. Never apply a group-level rain or watering event to all member reserves without plant-specific evidence.

<!-- page break -->

# 18  Validation with little ordinary-user effort

INSTRUMENT A REFERENCE COHORT; KEEP NORMAL USE SIMPLE

## Calibration work belongs in the development pilot

Use volunteer/reference plants with calibrated substrate sensors, representative ground profiles and/or controlled pot weights. Collect actual retained/input outcomes and water state without asking every future user to measure daily. Paired pot weights support whole-system water loss when event/drainage/handling fluxes are characterized. [R06](https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-750.html)

- Include beginner watering variability, no-volume Watered events, top-ups, partial shelter, mixed weather, small/large/root-developing setups and soil/medium classes.
- Run a deployment-faithful evaluation that hides reference measurements from model inputs and provides only the ordinary proposed setup and watering logs. Otherwise a sensor-rich pilot exaggerates real-app performance.
- Compare the new model with the current heuristic, simple calendar/routine and an elapsed-time-plus-weather baseline. Separate supported-domain performance from rejected cases.
- Use chronological and held-out plant/owner/setup/location evaluation. Assess coast/interior/highland and seasons where relevant. Include realistic missed logs and weather outages.
- Measure missed independently confirmed dry states, unnecessary watering advice while sufficient/wet, timing error, normal binary coverage, exception rate and notification burden.
- For moisture/reserve ranges, measure coverage/bias and subgroup errors. Validate both initialization and error growth between reference anchors, not only one-day loss.
- For disease warnings, use independent timed inspections and label missing checks. Weather exposure accuracy and actual symptom prediction are different tasks.

## Promotion gates

| Gate | Required evidence |
| --- | --- |
| Computational correctness | Units, chronology, mass accounting, forecast separation, uncertainty boundaries and source-event replay pass executable tests. |
| Profile readiness | Storage/initialization/input/loss/threshold parameters exist with provenance and defined supported domain. |
| Useful predictions | Prospective missed-dry and unnecessary-water rates, coverage and burden meet preregistered product targets with uncertainty intervals. |
| Low user burden | Ordinary supported users receive routine predictions without daily moisture submissions; exception rate meets its target. |
| Hazard/scout readiness | Source validity, appropriate wording and useful event burden demonstrated; no unsupported pathogen or tissue-damage claim. |

No measured target rates or sufficient sample size can be claimed from the present review. Set them before promotion using pilot baseline rates, severity costs and statistical precision. Report uncertainty and subgroup failures; do not call equations correct proof that the app prediction is accurate.

<!-- page break -->

# 19  Worked examples and verified logic

ILLUSTRATIONS USE HYPOTHETICAL PROFILE VALUES, NOT CANNABIS DEFAULTS

| Case | Inputs and output |
| --- | --- |
| Supported not_due | Reserve scenarios 2.0 and 2.6 L, threshold 1.0 L: both are sufficient. No watering needed yet, estimated. |
| Supported water_now | Reserve scenarios 0.7 and 0.9 L, threshold 1.0 L: both are low. Watering recommended, estimated. |
| Unresolved overlap | Reserve scenarios 0.9 and 1.2 L, threshold 1.0 L: actions disagree. Use a validated overlap policy or a specific one-time recovery option. |
| Unknown watering amount | Starting reserve 1.0 L, loss 0.4 L; a 0.2 L retained top-up leaves 0.8 L, while a 2.0 L retained input leaves 2.6 L. Same timestamp, different action at a 1.0 L threshold. |
| Rain that already occurred | Starting 1.0 L plus supported retained rain 0.8 L minus loss 0.4 L gives 1.4 L. Current state may change. |
| Rain only forecast | Starting 1.0 L minus actual loss 0.4 L gives 0.6 L now. Tomorrow rain does not change that current value. |
| Overflow | Starting 4 L plus entering-water input 3 L minus loss 1 L gives 6 L before storage/drainage. A free-draining 5 L capacity has 1 L excess; slow-draining systems need another state. |
| Exhausted reserve | 0.2 L reserve with 0.5 L potential loss gives zero available reserve and 0.3 L unmet demand; not negative stored water. |

Fifteen standalone synthetic arithmetic/policy checks were executed for this revision. They verify the stated robust-decision boundaries, missing/invalid scenarios, accounting, replay and the unknown-input counterexample. All passed. They do not validate the choice of a profile, its action threshold or crop prediction accuracy.

The v4.0 review separately checked 24 numerical assertions and reproduced four local parser defects. Those earlier checks are not new v5 field results. The application prediction engine and the acceptance fixtures below have not been executed by writing this document.

<!-- page break -->

# 20  Acceptance cases: model and inputs

48 NORMATIVE IMPLEMENTATION FIXTURES - NOT EXECUTED APP TESTS

| ID | Fixture | Required behaviour |
| --- | --- | --- |
| V50-01 | Watered logged without a moisture check. | Supported model may issue water_now/not_due; no fresh-observation gate. |
| V50-02 | Ordinary supported user logs only watering. | No daily moisture/size task; maintain predicted state between events. |
| V50-03 | Rain exposure is unknown. | Keep unknown; ask the agreed one-time question when material, never default exposed. |
| V50-04 | One plant is roof-sheltered in an exposed garden. | Plant override applies to its rain inputs only. |
| V50-05 | Current rain.1h and daily forecast rain coexist. | Separate interval/rate and forecast nature; no mixed observed daily total. |
| V50-06 | Today daily[0] without current. | It remains forecast; cannot fill actual history. |
| V50-07 | Future same-date night humidity exists. | Forecast feature only; never completed humid exposure. |
| V50-08 | Sunrise 03:00Z, zone UTC+2. | Store 03:00Z, display 05:00 local. |
| V50-09 | Yesterday was not fetched. | Use explicit history capability or validated gap uncertainty, not a current request. |
| V50-10 | Weather outage. | No zero loss/rain invention; model gap limit or a specific recovery alternative. |
| V50-11 | Missing UV but valid loss-driving data. | Do not reject the whole weather context. |
| V50-12 | No source profile/initial state. | No fabricated wet reserve or universal two-day baseline. |
| V50-13 | A saved normal watering pattern applies. | Use its calibrated variability, not a guaranteed full reset. |
| V50-14 | Unknown amount and unknown pattern. | Retained input stays broad; no automatic refill. |
| V50-15 | Small top-up exception. | No full-event substitution; later action follows resulting reserve. |
| V50-16 | Feeding with linked carrier water. | Count actual carrier input once; concentration is not volume. |
| V50-17 | Duplicate retry and two genuine same-day waterings. | Deduplicate logical retry only. |
| V50-18 | Backdated edit/delete arrives. | Replay affected state; retain availability rules for backtesting. |
| V50-19 | Ground plant contains stale potSize. | Ground profile; no pot-capacity modifier. |
| V50-20 | Raised bed is open to native soil. | Use supported connected/layered model or declare unsupported. |
| V50-21 | Developing roots in a large container. | Do not allocate the entire nominal pot as an accessible reserve. |
| V50-22 | Age known, root establishment unknown. | No exact root volume/depth from age alone. |
| V50-23 | All supported margins positive / nonpositive. | Return not_due / water_now respectively. |
| V50-24 | Supported scenario actions overlap. | Validated overlap policy or uncertain; never raw scenario frequency as probability. |

<!-- page break -->

# 21  Acceptance cases: hazards and reliability

48 NORMATIVE IMPLEMENTATION FIXTURES - NOT EXECUTED APP TESTS

| ID | Fixture | Required behaviour |
| --- | --- | --- |
| V50-25 | Credible current wet observation contradicts model. | Reconcile and suppress blind extra-water instruction. |
| V50-26 | Credible dry observation after same-day watering. | Do not force high-confidence not_due from the event. |
| V50-27 | Different-depth readings. | Preserve root relevance/gradient; do not average arbitrary states. |
| V50-28 | Large regional rain with unknown reception. | Use justified scenarios; no universal saturation/reset. |
| V50-29 | Received characterized rain, roots initially low. | Allow supported model replenishment without mandatory manual check. |
| V50-30 | Dry now and rain forecast tomorrow. | Current dry recommendation is not cancelled by future input. |
| V50-31 | Snow/freezing context. | No immediate liquid infiltration assumption. |
| V50-32 | Slow-draining overflow. | Excess/persistence retained; no free-draining clipping shortcut. |
| V50-33 | Portable pot moved. | Carry reserve, segment weather path; do not reset wetness. |
| V50-34 | Repot / medium / major canopy change. | Appropriate profile/domain update and uncertainty, no guessed scaling. |
| V50-35 | Reference ET and VPD/T/RH/wind all available. | Avoid correlated additive drying votes. |
| V50-36 | Grid soil-moisture data available. | Model covariate only; no on-site pot moisture assertion. |
| V50-37 | High humidity / warm night and no symptoms. | Condition-based scout; no infection percentage/diagnosis. |
| V50-38 | Powdery mildew screen during rain. | No monotone rain multiplier or required free-leaf-water premise. |
| V50-39 | Flowering plus damp episodes. | Bud-rot/flower watch; no fixed ambient-to-flower RH offset. |
| V50-40 | Wet-weather leaf spots are possible. | General leaf-spot watch, not identified Septoria. |
| V50-41 | Seedling + persistent wetness. | Establishment/root-condition warning; no automatic damping-off diagnosis. |
| V50-42 | Strong wind but unknown local canopy exposure. | Qualified physical hazard; no disease-protection conclusion. |
| V50-43 | Hail not present in source alert/product. | Do not derive a hail warning from generic rain chance. |
| V50-44 | Cold/heat source is ambient air. | Exposure warning, not measured tissue damage or automatic watering. |
| V50-45 | Many watering logs but no independent outcomes. | No claimed learned plant-specific dryness accuracy. |
| V50-46 | Reference-cohort evaluation. | Hide instruments from model inputs to simulate ordinary user operation. |
| V50-47 | Many routine uncertain results. | Fail normal-coverage/user-burden gate; do not celebrate abstention alone. |
| V50-48 | Inactive/deleted/snoozed/shared/offline cases. | Eligibility/authorization/delivery correct; biology/state not rewritten by snooze. |

<!-- page break -->

# 22  What is still needed to make it accurate

CONCRETE OPEN WORK, WITH ALTERNATIVES

| Remaining uncertainty | How to resolve it | Practical fallback |
| --- | --- | --- |
| Which setups can receive dependable timing predictions? | Build measured storage/input/loss profiles and held-out validation for the launch domain. | Start with a smaller set of supported setups; expand after testing. |
| Does timestamp-only watering narrow state sufficiently? | Measure normal beginner watering patterns and their retained-water variation. | Save pattern once; offer optional amount or one-time method calibration. |
| Can initial state be set without routine measurements? | Validate inference from declared pattern/reference wetting and known setup history. | One optional initial reference answer or automatic instrument. |
| Which weather source/method works locally? | Benchmark history, ET and forecast error in actual regions; verify API entitlement/cost/scheduler. | Use a suitable alternative data product, with transparent uncertainty. |
| How much canopy/root growth can be inferred? | Evaluate stage/age/size features against observed development and decision errors. | Broad supported growth ranges; occasional normal profile update, not daily measuring. |
| Which disease screens are useful? | Compare event warnings against independent symptoms/inspections; quantify burden and misses. | Qualified condition/prevention messages, no unvalidated pathogen odds. |
| What error/exception rate is acceptable? | Agree product targets using reference-cohort baseline rates and uncertainty. | No broad accuracy claim until both usefulness and error criteria are met. |

## Decisions already accepted

Predict watering need in normal supported conditions; routine input is watering logs; add rain reception; design for beginners; offer alternatives when a quantity cannot be reliably inferred; add useful environmental and disease-condition warnings. These decisions do not need to be reconfirmed.

## Delivery status

v5.2 supplies the revised product contract, model structure, uncertainty/initialization policy, rain schema, capability/alternative list and acceptance plan. The actual field-tested parameter library, implemented model and measured predictive performance remain outstanding. The document is an implementation and validation baseline, not a claim those outcomes already exist.

The intended experience is a useful estimated yes/no watering answer with little routine effort. Achieving it requires measured model profiles and dependable weather/event accounting. Daily manual moisture logging is not the product requirement.

<!-- page break -->

# Evidence ledger: R01-R07

MECHANISMS RECHECKED; NUMERICAL CAUSAL WEIGHTS NOT ESTIMATED  |  29 OCTOBER 2026

## [R01](https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/) Colorado State University: Irrigation Scheduling - The Water Balance Approach (reviewed 2025)

Weather accounting can guide irrigation; initial water, storage, crop loss and inputs must be characterized. Occasional reference checks help detect drift.

[Open primary source](https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/)

## [R02](https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/evapotranspiration-based-irrigation-scheduling-or-water-balance-method) University of Minnesota: Evapotranspiration-based irrigation scheduling or water-balance method

Independent description of input/output accounting and initial soil-water requirements; no universal cannabis coefficient.

[Open primary source](https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/evapotranspiration-based-irrigation-scheduling-or-water-balance-method)

## [R03](https://www.fao.org/4/X0490E/x0490e0e.htm) FAO-56 Chapter 8: ETc under soil water stress conditions

Available water, stress and depletion accounting; root depth and initial depletion matter.

[Open primary source](https://www.fao.org/4/X0490E/x0490e0e.htm)

## [R04](https://www.fao.org/4/x0490e/x0490e06.htm) FAO-56 Chapter 2: FAO Penman-Monteith equation

Grass reference demand differs from actual crop/system loss.

[Open primary source](https://www.fao.org/4/x0490e/x0490e06.htm)

## [R05](https://ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html) Virginia Tech SPES-749P (2026): Identifying Water Stress in Container-Grown Plants

Root development, canopy, medium and container geometry influence stress. General nursery evidence, not a cannabis dose table.

[Open primary source](https://ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html)

## [R06](https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-750.html) Virginia Tech SPES-750P (2026): Measuring Nursery Plant Water Use in Containers

Controlled paired weights can measure whole-container loss and inform profile calibration.

[Open primary source](https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-750.html)

## [R07](https://ask.ifas.ufl.edu/publication/PP379/pdf) UF/IFAS PP379: Field Guide to Hemp Diseases

Powdery mildew, gray mold and root/seedling disease mechanisms; confirmation requires observation/diagnostics.

[Open primary source](https://ask.ifas.ufl.edu/publication/PP379/pdf)

<!-- page break -->

# Evidence ledger: R08-R14

MECHANISMS RECHECKED; NUMERICAL CAUSAL WEIGHTS NOT ESTIMATED  |  29 OCTOBER 2026

## [R08](https://pnwhandbooks.org/plantdisease/host-disease/hemp-cannabis-sativa-gray-mold-botrytis-bud-blight-stem-canker) Pacific Northwest Handbooks (March 2026): Hemp Gray Mold / Botrytis Bud Blight and Stem Canker

Botrytis-favouring conditions and cultural prevention; no general weather-only infection probability.

[Open primary source](https://pnwhandbooks.org/plantdisease/host-disease/hemp-cannabis-sativa-gray-mold-botrytis-bud-blight-stem-canker)

## [R09](https://extension.rutgers.edu/e374) Rutgers Cooperative Extension E374: Emerging Diseases of Hemp in New Jersey

Field leaf-spot and other disease observations; regional findings are not universal diagnostic rules.

[Open primary source](https://extension.rutgers.edu/e374)

## [R10](https://hemp.cals.cornell.edu/resources/reports-factsheets/2024-factsheets/the-role-of-weather-in-disease-progression/) Cornell Hemp (2024): The role of weather in disease progression

Weather, waterlogging, airflow and disease exposure; wind can also spread pathogens.

[Open primary source](https://hemp.cals.cornell.edu/resources/reports-factsheets/2024-factsheets/the-role-of-weather-in-disease-progression/)

## [R11](https://ask.ifas.ufl.edu/publication/MG025/pdf) UF/IFAS MG025: Cold Protection of Landscape Plants

Radiational cooling can produce surface frost distinct from reported air temperature; general landscape evidence.

[Open primary source](https://ask.ifas.ufl.edu/publication/MG025/pdf)

## [R12](https://extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables) University of Maryland Extension (2026): Growing Vegetables in Containers and Salad Tables

Container materials, wetting, drainage and hot surfaces; general container evidence.

[Open primary source](https://extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables)

## [R13](https://openweathermap.org/api/one-call-3) OpenWeather One Call API 3.0 documentation

Field semantics, forecast/current separation, UTC times, precipitation and official alerts.

[Open primary source](https://openweathermap.org/api/one-call-3)

## [R14](https://open-meteo.com/en/docs) Open-Meteo Weather Forecast API documentation

Candidate modelled reference ET/radiation and layer-labelled regional soil data; no on-site pot observation.

[Open primary source](https://open-meteo.com/en/docs)

<!-- page break -->

# Evidence ledger: R15-R21

MECHANISMS RECHECKED; NUMERICAL CAUSAL WEIGHTS NOT ESTIMATED  |  29 OCTOBER 2026

## [R15](https://www.mdpi.com/2311-7524/9/4/431) Duong et al. (2023): Variation in Hydric Response of Two Industrial Hemp Varieties

Cultivar/setup differences in controlled conditions limit transfer of universal coefficients.

[Open primary source](https://www.mdpi.com/2311-7524/9/4/431)

## [R16](https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf) Gill et al. (2025): Water conservation and assimilation is driven by stomatal behaviour in industrial hemp

Water supply affects gas exchange; weather demand is not a linear actual transpiration meter.

[Open primary source](https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf)

## [R17](https://www.fao.org/4/x0490e/x0490e07.htm) FAO-56 Chapter 3: Meteorological data

VPD, radiation, wind-height and reduced-data ET methods and their limitations.

[Open primary source](https://www.fao.org/4/x0490e/x0490e07.htm)

## [R18](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2023.1192035/full) Punja et al. (2023): Yeast and mold levels in cannabis inflorescences

Greenhouse floral microclimate differs from ambient; not a fixed outdoor correction.

[Open primary source](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2023.1192035/full)

## [R19](https://extension.psu.edu/powdery-mildew) Penn State Extension: Powdery Mildew

Humidity, free-water and dispersal relationships vary among powdery mildews. General context; no cannabis-specific infection threshold.

[Open primary source](https://extension.psu.edu/powdery-mildew)

## [R20](https://ipm.ucanr.edu/home-and-landscape/damping-off-diseases-in-the-garden/) UC IPM (2024): Damping-off Diseases in the Garden

Vulnerable emerging seedlings, root-zone conditions and differences between air and soil temperature. General host evidence.

[Open primary source](https://ipm.ucanr.edu/home-and-landscape/damping-off-diseases-in-the-garden/)

## [R21](https://www.weather.gov/source/zhu/ZHU_Training_Page/fog_stuff/Dew_Frost/Dew_Frost.htm) National Weather Service: Dew and Frost Development

Dew-point depression, radiational cooling, cloud and wind context; ambient conditions do not measure a leaf surface.

[Open primary source](https://www.weather.gov/source/zhu/ZHU_Training_Page/fog_stuff/Dew_Frost/Dew_Frost.htm)

<!-- page break -->

# Evidence ledger: R22-R26

MECHANISMS RECHECKED; NUMERICAL CAUSAL WEIGHTS NOT ESTIMATED  |  29 OCTOBER 2026

## [R22](https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat) University of Minnesota Extension (2026): Keep gardens thriving through the heat

Heat-related wilt can occur despite adequate soil water. General garden evidence; no universal cannabis injury temperature.

[Open primary source](https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat)

## [R23](https://www.weather.gov/safety/cold-wind-chill-chart) National Weather Service: Understanding Wind Chill

Human wind-chill index definition and skin-oriented assumptions; not a plant temperature model.

[Open primary source](https://www.weather.gov/safety/cold-wind-chill-chart)

## [R24](https://www.noaa.gov/jetstream/hail) NOAA JetStream: Thunderstorm Hazards - Hail

Hail is a storm process; do not infer it from surface RH, rain chance or surface freezing temperature.

[Open primary source](https://www.noaa.gov/jetstream/hail)

## [R25](https://horticulture.oregonstate.edu/nursery/nursery/disease-triangle) Oregon State University Horticulture: Disease Triangle

Disease requires a susceptible host, suitable pathogen and environment. Unobserved pathogen presence limits weather-only disease claims.

[Open primary source](https://horticulture.oregonstate.edu/nursery/nursery/disease-triangle)

## [R26](https://ipm.ucanr.edu/disease/database/grapebotrytis.html) UC IPM archived research model: Botrytis Bunch Rot of Grape

Example of fitted temperature/wetness interactions and crop/location validation. Archived grape models are not cannabis weights, thresholds or recommendations.

[Open primary source](https://ipm.ucanr.edu/disease/database/grapebotrytis.html)
