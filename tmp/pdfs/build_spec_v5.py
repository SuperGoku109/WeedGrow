from pathlib import Path
import re, json, math, html, ast
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'; SRC=ROOT/'output/spec'
OUT.mkdir(parents=True,exist_ok=True); SRC.mkdir(parents=True,exist_ok=True)
refs={
'R01':('Colorado State University: Irrigation Scheduling - The Water Balance Approach (reviewed 2025)','https://extension.colostate.edu/resource/irrigation-scheduling-the-water-balance-approach/','Weather accounting can guide irrigation; initial water, storage, crop loss and inputs must be characterized. Occasional reference checks help detect drift.'),
'R02':('University of Minnesota: Evapotranspiration-based irrigation scheduling or water-balance method','https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/evapotranspiration-based-irrigation-scheduling-or-water-balance-method','Independent description of input/output accounting and initial soil-water requirements; no universal cannabis coefficient.'),
'R03':('FAO-56 Chapter 8: ETc under soil water stress conditions','https://www.fao.org/4/X0490E/x0490e0e.htm','Available water, stress and depletion accounting; root depth and initial depletion matter.'),
'R04':('FAO-56 Chapter 2: FAO Penman-Monteith equation','https://www.fao.org/4/x0490e/x0490e06.htm','Grass reference demand differs from actual crop/system loss.'),
'R05':('Virginia Tech SPES-749P (2026): Identifying Water Stress in Container-Grown Plants','https://ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-749.html','Root development, canopy, medium and container geometry influence stress. General nursery evidence, not a cannabis dose table.'),
'R06':('Virginia Tech SPES-750P (2026): Measuring Nursery Plant Water Use in Containers','https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-750.html','Controlled paired weights can measure whole-container loss and inform profile calibration.'),
'R07':('UF/IFAS PP379: Field Guide to Hemp Diseases','https://ask.ifas.ufl.edu/publication/PP379','Powdery mildew, gray mold and root/seedling disease mechanisms; confirmation requires observation/diagnostics.'),
'R08':('Pacific Northwest Handbooks (March 2026): Hemp Gray Mold / Botrytis Bud Blight and Stem Canker','https://pnwhandbooks.org/plantdisease/host-disease/hemp-cannabis-sativa-gray-mold-botrytis-bud-blight-stem-canker','Botrytis-favouring conditions and cultural prevention; no general weather-only infection probability.'),
'R09':('Rutgers Cooperative Extension E374: Emerging Diseases of Hemp in New Jersey','https://extension.rutgers.edu/e374','Field leaf-spot and other disease observations; regional findings are not universal diagnostic rules.'),
'R10':('Cornell Hemp (2024): The role of weather in disease progression','https://hemp.cals.cornell.edu/resources/reports-factsheets/2024-factsheets/the-role-of-weather-in-disease-progression/','Weather, waterlogging, airflow and disease exposure; wind can also spread pathogens.'),
'R11':('UF/IFAS MG025: Cold Protection of Landscape Plants','https://ask.ifas.ufl.edu/publication/MG025/pdf','Radiational cooling can produce surface frost distinct from reported air temperature; general landscape evidence.'),
'R12':('University of Maryland Extension (2026): Growing Vegetables in Containers and Salad Tables','https://extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables','Container materials, wetting, drainage and hot surfaces; general container evidence.'),
'R13':('OpenWeather One Call API 3.0 documentation','https://openweathermap.org/api/one-call-3','Field semantics, forecast/current separation, UTC times, precipitation and official alerts.'),
'R14':('Open-Meteo Weather Forecast API documentation','https://open-meteo.com/en/docs','Candidate modelled reference ET/radiation and layer-labelled regional soil data; no on-site pot observation.'),
'R15':('Duong et al. (2023): Variation in Hydric Response of Two Industrial Hemp Varieties','https://www.mdpi.com/2311-7524/9/4/431','Cultivar/setup differences in controlled conditions limit transfer of universal coefficients.'),
'R16':('Gill et al. (2025): Water conservation and assimilation is driven by stomatal behaviour in industrial hemp','https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf','Water supply affects gas exchange; weather demand is not a linear actual transpiration meter.'),
'R17':('FAO-56 Chapter 3: Meteorological data','https://www.fao.org/4/x0490e/x0490e07.htm','VPD, radiation, wind-height and reduced-data ET methods and their limitations.'),
'R18':('Punja et al. (2023): Yeast and mold levels in cannabis inflorescences','https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2023.1192035/full','Greenhouse floral microclimate differs from ambient; not a fixed outdoor correction.'),
}
blocks=[]
def p(t): blocks.append(('p',t))
def h(t): blocks.append(('h',t))
def page(t,s=None):
    if blocks: blocks.append(('break',None))
    blocks.append(('title',t))
    if s: blocks.append(('strap',s))
def table(head,rows,widths): blocks.append(('table',(head,rows,widths)))
def bullets(x): blocks.append(('bullets',x))
def code(x): blocks.append(('code',x.strip()))
def callout(x): blocks.append(('callout',x))

page('WeedGrow\nPredictive outdoor care', 'SPECIFICATION v5.0  |  29 OCTOBER 2026  |  WATERING-LOG-FIRST PRODUCT')
p('Purpose: predict whether watering is due, estimate the root-zone water condition, and provide useful weather and health-risk warnings. Ordinary users log watering; routine moisture checks are not required. Designed for beginners and minimal ongoing data entry.')
callout('Normal supported experience: Watering recommended or No watering needed yet, clearly marked as an estimate. The engine maintains a water-balance estimate between events. It asks for extra information only when that information can resolve a material uncertainty.')
h('Status')
p('This version supersedes the inspection-first product contract in v4.0. It authorizes model-based watering recommendations without a fresh moisture observation when the setup and prediction method have demonstrated adequate performance. It does not claim that pot size, weather and plant size uniquely identify real root-zone moisture.')
p('Research-backed design, not a deployed or field-validated algorithm. Model parameters, supported setup profiles and prediction error remain to be established. Code defects identified in the earlier review still need implementation/retesting. No application code is changed by this specification.')
h('Evidence labels')
table(['Label','Meaning'],[['SCI','Established relationship supported by primary sources.'],['ENG','A product/engineering decision, including the low-effort user workflow.'],['CAL','A model parameter or claimed predictive performance requiring measured validation.'],['CODE','A finding from the earlier local-code audit, not proof of current deployed behaviour.']],[0.15,0.85])
p('The source literature supports water accounting and environmental exposure warnings. It does not provide a universal, validated cannabis-in-any-pot algorithm. The spec includes explicit alternatives for quantities that remain unidentifiable. Equations and example scenarios below are distinct from measured crop accuracy.')

page('01  Product decisions now fixed', 'USER REQUIREMENTS REPLACE THE DAILY-CHECK POLICY')
table(['Requirement','Normative behaviour'],[
['A useful watering decision','Estimate water_now or not_due in supported normal conditions. Use simple wording and a short reason. Never present a model estimate as a sensor reading.'],
['Watering is the routine user event','One-tap Watered with actual occurrence time. Existing optional amount remains optional. No daily root-moisture questionnaire.'],
['History drives current state','Integrate weather, estimated loss, received rain, applied irrigation and storage from the last usable state, with uncertainty carried forward.'],
['Age, stage, size and ground matter','Use these as distinct development/storage/loss features where their meaning is known. Do not combine them into arbitrary additive day deductions.'],
['Rain reception question','Add a clear setup question about rain reaching this plant soil/container; preserve per-plant overrides and effective dates.'],
['Beginner workflow','Ask simple one-time setup questions, offer Not sure, explain what missing information changes, and reuse saved answers.'],
['Unreliable estimates need alternatives','Use a verified setup profile, a limited calibration step, optional automation/sensors or a one-off exception check. Do not force a definite answer outside demonstrated support.'],
['Problems and prevention','Separate destructive-weather alerts, predicted water stress and disease-conducive conditions. Provide short, relevant preventive steps; no weather-only diagnosis.']
],[0.29,0.71])
h('v4.0 rules retired')
bullets(['A recent manual moisture check is no longer a prerequisite for every watering recommendation.', 'A two-hour manual-observation expiry does not turn every normal plant into a check request. Observation uncertainty ages through the physical/predictive model.', 'The generic 12/24-hour inspection schedule and <=5 L small-pot reminder rule are removed as physiological baselines.', 'The engine does not forbid all modelled rainfall replenishment: it estimates received/infiltrated rain with explicit assumptions and bounds, after rain actually occurs.', 'The system must still distinguish unknown from not_due. Forced Boolean certainty when the state is unidentifiable would mislead beginners.'])
p('A model-driven irrigation approach is established in agriculture. It requires a state estimate and characterized incoming/outgoing water, rather than the date of the last watering alone. [R01] [R02]')

page('02  What can be estimated honestly', 'THE KEY LIMIT IS IDENTIFIABILITY, NOT THE AVAILABILITY OF A FORMULA')
p('Weather-based accounting can estimate root-zone depletion between reference states. Initial moisture, active storage, actual water entering the zone and loss are essential. Knowing the complete outside weather would still leave those quantities unresolved if only pot volume and a Watered timestamp were known. [R01] [R03]')
table(['Quantity','Feasibility with low user effort','Alternative where support is inadequate'],[
['Past/future atmospheric demand','Estimate from documented weather inputs; compare errors by region and lead time.','Better reference ET source/local station; retain weather uncertainty.'],
['Actual current root moisture','Model estimate is feasible for validated setup/initialization ranges. Exact state is not uniquely recoverable from the existing fields.','One-time reference state, tested medium/setup profile, optional sensor or occasional exception confirmation.'],
['Retained water from Watered only','Event occurrence is known; retained amount is not. Watering style can narrow a validated prior.','Save normal watering style once; optional amount or one-time amount calibration.'],
['Root-accessible storage','Nominal pot size alone is insufficient; medium, geometry and rooting affect storage.','Tested profile, medium/bag identification, root-establishment context or measured calibration.'],
['Rain actually retained','Regional rain plus reception helps, but interception, runoff and drainage remain uncertain.','Bounded reception/catchment model; optional local rain gauge; no automatic full reset.'],
['Internal flower humidity / leaf wetness','Ambient weather is only a proxy. Exact internal conditions cannot be recovered.','Condition-based flower/leaf warning, optional local instrument or event-triggered inspection.'],
['Mildew or bud rot already present','Cannot be established from weather and watering logs.','Optional symptom/photo report or diagnostic support; alert to conducive conditions.'],
['Exact water dose / safe-until time','Needs more storage/input calibration than a timing recommendation.','Keep first-release output to timing and a qualified future window; dose is a separately validated feature.']
],[0.25,0.38,0.37])
p('Example: the same 10 L pot, plant and weather history could follow a light top-up or a thorough watering. Both appear as Watered in a timestamp-only log, but leave different reserves. No algorithm can distinguish these hidden histories without an additional assumption or measurement. This example demonstrates missing information, not poor weather forecasting.')
callout('Accuracy comes from a model tested for the intended setup range. When a setup falls outside that range, offer a concrete way to improve it. Never silently convert an unsupported assumption into certainty.')

page('03  Minimal setup and rain exposure', 'ASK ONCE; LOG WATERING DURING NORMAL USE')
table(['Input','User experience / model meaning'],[
['Existing location/environment','Use the garden pin and outdoor classification; reuse authorized garden defaults.'],
['Existing pot/ground and size','Pot volume with explicit units; ground/raised-bed type distinct. Missing size remains allowed but affects eligibility.'],
['Existing stage/age/size','Reuse recorded stage and height. Optional approximate canopy category/width improves model context; no daily measurements.'],
['NEW: rainReception','Question: Does rain reach the soil for this plant? Answers Yes / Sometimes or partly / No / Not sure.'],
['Medium profile','One-time choose a supported mix, identify the bag, or select Not sure. Broad soil provenance is insufficient for a precise storage profile.'],
['Drainage / additional supply','Simple setup options: ordinary freely draining pot, slow/blocked drainage, reservoir/self-watering, ground-connected, or unsure. Unknown specialist systems receive a tailored alternative.'],
['Normal watering style','One-time usual pattern: thorough watering of the active zone / small top-ups / varies or unsure. A declared style informs a prior; it does not prove each event followed it.'],
['Starting condition','Optional one-time reference: last watering and usual pattern, known current moisture, measured state, or unknown. Do not invent a full pot at signup.']
],[0.29,0.71])
code('''RainExposure = {
  reception: exposed | partial | sheltered | unknown,
  effectiveFrom, recordedAt, source: user,
  inheritedFromGarden?: string, plantOverride?: boolean
}
''')
p('Proposed Firestore mapping: Plant.rainReception stores the enum; rainReceptionEffectiveFrom and rainReceptionRecordedAt store its dates. A bounded-query exposure-change event stores revisions/inheritance and historical changes. Do not overload permanentProtection or store an unbounded history array on Plant.')
bullets(['Show the rain question during outdoor setup and allow Not sure. Existing outdoor plants receive a one-time progressive prompt, not a forced form reset.', 'The question concerns water entering the soil/container, not simply whether leaves get wet. Shade cloth, a cage or permanentProtection do not answer it automatically.', 'Yes does not mean 100% retention; No removes direct rainfall input but does not exclude roof runoff, splash or wind-driven entry when those pathways are reported.', 'Use a garden answer as a visible default; plants under a roof can override it. A changed answer has an effective date and updates the exposure/model episode.', 'If plants with unknown reception receive a storm, simulate plausible reception scenarios. Ask once if it changes the watering decision; never assume all plants were watered.'])
p('New fields require schema, permissions, backup/export, offline edits and migration support. Store absent values as unknown; an unanswered field must not quietly become exposed or free-draining.')
p('Avoid a new long setup form: always present the agreed rain question; reuse existing data and a supported profile wherever possible. Ask medium, drainage or normal-pattern questions progressively only when they materially improve a decision. All Not sure answers remain valid, with explicit limits and alternatives.')

page('04  Watering logs with minimal effort', 'EVENTS UPDATE THE WATER BALANCE; THEY DO NOT SUPPLY DRYNESS LABELS')
h('Normal action')
p('Watered records plant, actual time/precision and idempotent event identity. Optional volume and an unobtrusive This was a top-up exception are available. Defaults reuse the saved watering pattern, visibly labelled as assumed. Never require a moisture measurement before saving a watering.')
table(['Event data','Model update'],[
['Measured applied volume','Estimate infiltrated/root-retained input using the compatible setup model and its uncertainty; do not assume all applied water remains.'],
['No volume, saved normal pattern','Use an empirically calibrated event-input/post-event state distribution for that pattern and setup. Widen for variable adherence.'],
['No volume, pattern unknown','Acknowledge the event; retain broad input bounds. No automatic refill to field/container capacity.'],
['Small top-up','Use its own calibrated event class/optional amount. Never treat it as a thorough refill.'],
['Feeding with carrier water','Link carrier water to one irrigation event; nutrient concentration is not a water-volume input.'],
['Backdated/edit/delete/offline retry','Reconcile occurrence time, latest revision and duplicates; replay affected state from its checkpoint.']
],[0.32,0.68])
p('A user action is not proof the plant was dry. Repeated watering habits can show a routine, but cannot alone identify actual consumption or train an accurate personalized dry-state model. Keep future learning from actions separate from independent outcome labels.')
h('What happens after a normal watering')
p('Update the estimated reserve immediately and recompute. The normal card will often become No watering needed yet when the compatible model supports that result. Use wording Watering logged; estimate updated. A credible report of failed wetting, or a measured dry state after application, overrides a blind success assumption.')
p('A thorough event can initialize near a drained reference state only where an applicable calibration supports that assumption. The field water-balance literature describes near-field-capacity initialization after adequate wetting; it does not prove every logged outdoor pot watering accomplished that. [R03]')
h('Dates and missing events')
p('Date-only events remain time intervals. Two genuine waterings on one day remain separate. Missing logs are unknown events rather than known absence of water. An apparent contradiction may trigger one short Is this plant watered by a timer or someone else? question or an optional reference check; it must not silently fit a new loss coefficient.')

page('05  Weather inputs and their limits', 'HISTORY CHANGES CURRENT WATER; FORECASTS CHANGE FUTURE PATHS')
table(['Weather factor','Role in the engine'],[
['Temperature, humidity and dew point','Compatible paired samples support air VPD and coherent hourly weather. Air temperature is not root/leaf temperature.'],
['Radiation and reference ET','Primary atmospheric-loss driver when documented and benchmarked. Retain grass-reference method and interval.'],
['Sustained wind / gusts','Sustained wind contributes to reference demand where the method uses it. Gusts support physical hazard warnings. User shelter alters transfer uncertainty.'],
['Past rainfall / current rain','Non-overlapping, interval-defined received-rain estimates after the event, with source uncertainty. A current rate is not the full daily amount.'],
['Future rainfall and probability','Simulate future rain and no-rain paths. Probability of occurrence is not confidence in the predicted amount.'],
['Cloud, UV and daylight','Exposure context. No additional water points when equivalent effects already enter ET; UV/daylight are not measured plant PAR.'],
['Regional soil variables','Optional ground-context covariates with model/layer metadata. Never a sensor reading for a user pot or edited soil bed.'],
['Official weather alerts','Named hazard, geographic applicability, source, issue/start/end time and uncertainty. No returned alert is not proof of no threat.']
],[0.30,0.70])
p('The current One Call adapter must keep current, hourly forecasts and daily forecasts separate and preserve their units/UTC timestamps. Official alert retrieval must be enabled deliberately; the reviewed local calls excluded it. [R13] Modelled reference ET, radiation and surface pressure are available from candidate meteorological products such as Open-Meteo; they still need regional assessment. [R14]')
h('Mandatory data contract - ENG')
p('Every series retains provider/product/version, requested and returned coordinates/role, valid interval, aggregation, units, source nature, issue/availability time, fetch time and quality. Past-dated saved forecasts remain forecasts. Do not sum hourly rain and its overlapping daily total, or treat missing intervals as zero.')
p('Use UTC instants and plant IANA zones. Do not add timezone offsets before storing sunrise/sunset as UTC. Aggregate with true 23/24/25-hour local-day duration, and separate completed history from partial/current/future windows. Timestamp-only weather points cannot silently become an entire hour of exposure.')
h('Demand method selection')
p('Prefer documented grass-reference ET from a locally tested provider or complete FAO PM pipeline. Its weather variables describe a reference surface, not actual plant loss. Paired VPD is useful context but does not close the water balance alone. Hargreaves remains a reduced-data fallback requiring regional assessment, particularly in wind/humid conditions. [R04] [R17]')
p('If loss-driving data are missing, propagate a validated gap-imputation range or mark the model unsupported after its allowed gap. Do not turn an API outage into zero drying or an automatic moisture-check routine for every plant.')

page('06  A measured baseline, reused by users', 'PROFILE CALIBRATION REMOVES THE NEED FOR DAILY USER MEASUREMENTS')
p('The baseline is a physical/predictive setup profile, not two days since watering. A cohort profile can be calibrated by the product team using representative plants and instruments, then used by ordinary growers who only log watering. New users are not required to reproduce the calibration experiment.')
table(['Profile component','Required meaning'],[
['Supported setup domain','Pot/ground type, medium, drainage/additional supply, root establishment, plant size/stage range, climate and watering-pattern domain.'],
['Accessible water storage C','Accessible reserve at the drained reference above a specified lower bound, with uncertainty. The action threshold is defined separately. This is not nominal pot volume or all water.'],
['Irrigation event model','Retained-input or post-event-state distribution for thorough/top-up patterns and measured volumes. Includes normal novice variability.'],
['Rain capture/infiltration model','Contributing area or depth, reception, interception/run-on and drainage uncertainty; no fixed universal rain efficiency.'],
['System-loss function','Whole-system water loss in the correct units as a function of compatible weather, canopy/root development and setup.'],
['Action threshold','Root-relevant moisture/depletion target derived from independent observations and an acceptable missed-dry/extra-water tradeoff.'],
['Initialization and drift','Supported reference anchors, uncertainty growth, gap rules, change-point handling and out-of-domain criteria.'],
['Performance evidence','Independent/held-out validation, supported ranges, parameter versions and current error/coverage/decision metrics.']
],[0.31,0.69])
h('Parameter support policy')
p('No universal cannabis Kc, pot-water percentage, seedling litre requirement, available-water fraction or watering interval is installed by guess. Published studies can inform a testable prior; transfer to an outdoor app profile requires evidence. Cultivar and stomatal responses vary with setup and water availability. [R15] [R16]')
p('Uncertainty ranges must have a provenance: measurements, documented product data, externally assessed estimates or a clearly labelled pilot assumption. Arbitrary low/high numbers do not become credible because the engine simulates many scenarios. Frequency across unweighted scenarios is not a calibrated probability.')
h('Why size and roots remain separate')
p('A developing root zone in a large pot differs from an established root system occupying that pot. Canopy structure also changes loss. Container evidence supports considering these factors, while showing that size alone does not determine water use. [R05] A model profile must represent these interactions or reject the setup.')
p('A launch-ready profile library and its accuracy are not yet available in the reviewed material. Building and validating this library is the main remaining empirical work. The spec defines the computational contract and acceptance criteria; it does not imply that the missing parameter data already exist.')

page('07  Predictive container-water model', 'MAINTAIN RESERVE AND UNCERTAINTY BETWEEN LOGGED EVENTS')
code('''For each compatible parameter/state scenario k:
  Wraw_next = W_now + Iroot + Rroot + capillarySupply - systemLoss
  W_next, excess, unmetDemand = storage_and_drainage_step(Wraw_next, profile)

  systemLoss = lossModel(ET0_history, canopy, rootContext,
      stageContext, medium, geometry, wettingHistory, shelter)
''')
p('W is the defined root-accessible reserve in litres, not total pot water. Iroot and Rroot in this update mean water entering the control volume before the modelled drainage step. If a source instead supplies measured post-drain retained water/state, assimilate that result without repeating its drainage. Every flux uses the same volume and interval; loss is litres per interval. Reference ET in mm is never multiplied by pot litres.')
h('Storage and losses')
bullets(['For a simple freely draining profile, available reserve is bounded by its calibrated capacity and dry-state convention; excess input exits through the specified drainage route.', 'For slow drainage, excess above the drained reference can persist. Represent excess/saturation as a separate state and model drainage over time. Never clip overflow away while claiming there is no aeration concern.', 'Unmet potential demand is recorded separately when available reserve is exhausted. Do not accumulate physically negative available water and call it remaining storage.', 'A combined empirical whole-container loss model may cover substrate evaporation, transpiration and wall loss. Do not subtract those components again. A component model must explicitly account for each once.', 'Potential atmospheric demand and actual system loss differ under water limitation and changing stomatal behaviour. Do not apply an unbounded linear heat/VPD multiplier. [R16]'])
h('Uncertainty representation - ENG/CAL')
p('Carry compatible combinations of uncertain initial reserve, medium storage, active roots, rainfall reception and irrigation input. Preserve shared parameter dependence across time. Lower capacity and larger canopy need not be sampled as independent if the measured profile shows dependence. Validate the resulting intervals against held-out reference measurements.')
p('Parameters remain fixed during an episode except for explicitly modelled growth/change and justified data updates. Re-sampling the whole state from scratch at every refresh loses history and understates uncertainty. An optional moisture/weight measurement can update the existing estimate without becoming a required daily task.')
h('Refill evidence')
p('A normal watering narrows state only as much as its event model permits. For a compatible, calibrated thorough-watering pattern, the state can start near a drained reference with uncertainty. For unknown top-ups, the state stays broad. Explain a one-time alternative if broad input prevents useful predictions; do not automatically report successful saturation or a full reserve.')

page('08  Ground and raised-bed water model', 'ESTIMATE WATER DEPTH WITHOUT INVENTING PER-PLANT LITRES')
p('Ground profiles use water depth in the active root zone. Pot capacity does not apply. A raised bed needs an explicit soil connection/bottom and layering model, particularly where roots share a bed or additional roots compete.')
code('''TAW_mm = sum(1000 * (thetaFC_j - thetaWP_j) * thicknessM_j)
D_next = D_now + cropSystemET - infiltratedRain - infiltratedIrrigation
         - capillaryRise + deepPercolation

# D = depletion relative to the specified drained reference.
# TAW and the action threshold belong to a supported soil/root profile.
''')
p('Soil-specific storage and rooting depth govern available water. Initial depletion is required, whether measured or estimated from a justified anchor. Crop stress affects loss as reserves decline. No universal depletion fraction is supplied for cannabis. [R03]')
h('Low-effort operation')
p('Use a validated ground/soil profile where applicable, with the user selecting a supported class once. A timestamp-only hand watering still needs a characterized applied/wetted-depth distribution. An entire bed cannot be assumed refilled because one plant was watered.')
table(['Unresolved ground factor','Practical alternative'],[
['Texture/structure/depth unknown','Offer a simple one-time soil-profile classification, optional soil test or compatible moisture sensor. Keep broad assumptions visible.'],
['Wetted area or application amount unknown','Calibrate the normal watering method once, optionally from a measured container/irrigation rate; reuse it for ordinary logs.'],
['High water table, run-on or competing roots','Use an appropriate supported system profile or present limited-support guidance; do not silently assume a closed root zone.'],
['Root zone grows into new layers','Add the new layer with its estimated starting moisture and uncertainty. Do not create a free full reserve as roots deepen.'],
['Saturated or layered conditions','Preserve excess/persistence and layer information; do not average away an aeration problem.']
],[0.37,0.63])
p('For an estimated depth recommendation, no conversion to litres is needed to decide whether watering is due. A future volume feature needs the characterized wetted area and application losses. Treat canopy footprint as a descriptor until its relation to that control volume is established.')
p('If the ground profile cannot support a useful binary estimate, explain the specific missing property and offer one of the alternatives above. Do not quietly substitute the pot model or a generic every-two-days timer.')

page('09  Watering decision policy', 'YES/NO FOR SUPPORTED ESTIMATES; A CLEAR EXCEPTION WHEN IT IS NOT KNOWABLE')
h('Primary decision')
p('At asOf, evaluate whether current estimated reserve is below its supported action threshold. Default advice concerns current need. A separate future window can explain when need is projected before the next practical care opportunity. Do not label a currently sufficient plant dry just because a future hot day is forecast.')
code('''Each scenario has margin_k = reserve_k - threshold_k
  robust_water_now: every supported margin_k <= 0
  robust_not_due:   every supported margin_k > 0
  overlap:         scenario actions disagree

# Joint scenarios must cover the supported uncertainty, not convenient extremes.
''')
p('For overlap, a separately validated probabilistic decision policy may still issue a binary estimate when its calibrated error/cost criteria are met. Otherwise return uncertain with one concrete recovery option. Do not choose an arbitrary probability cutoff, count unweighted scenarios as probability or hide an overlap as not_due.')
table(['State','Normal card and behaviour'],[
['water_now, supported','Watering recommended. Estimated root-zone reserves are low. Show the main cause and next action; no exact dose unless independently eligible.'],
['not_due, supported','No watering needed yet. Estimated reserves remain above the watering threshold. Show when it will be recalculated.'],
['uncertain / unsupported','Estimate needs one setup detail or a reference update. Explain the specific reason and shortest alternative. This is an exception state, not a daily inspection product.'],
['Credible current saturated roots','Withhold more-water advice pending drainage/current-state resolution; a separate weather hazard can coexist.'],
['Credible current dry roots','Use the observation to update/override the compatible model. Reconcile any intervening event before acting.'],
['Contradictory observation/model','Show a conflict and request a targeted optional correction; never silently discard the inconvenient evidence.']
],[0.31,0.69])
h('No watering is also a prediction')
p('not_due means the model supports waiting now; it is not a promise that the entire medium is uniformly moist or that a plant is safe for a fixed number of days. Display Estimated rather than a measured soil-moisture percentage. Adequate model coverage and acceptable false-negative performance are required before issuing that claim.')
p('A supported model estimate can exist without a fresh root measurement. Conversely, a recorded event cannot force not_due if the amount/wetting is insufficient. No weather-only score, calendar rule or unqualified watering reset can bypass this policy.')
p('If the UI uses Estimated dry or Estimated moist, tie those words to the calibrated root-relevant class. Low available reserve does not mean literally no water or permanent wilting point, and sufficient does not prove every layer is equally moist.')

page('10  Cold start, drift and exceptions', 'ASK FOR THE ONE THING THAT WOULD CHANGE THE ANSWER')
table(['Situation','Low-effort response'],[
['Known compatible setup + credible refill anchor','Initialize from the calibrated post-event state range and run the model. No daily moisture input.'],
['Known setup + unknown initial water','Offer one optional reference answer or a documented normal watering event. Never recommend watering merely to initialize an unknown wet plant.'],
['Unknown medium/storage profile','Offer supported mix/bag identification, a one-time calibration option or optional sensor. Clearly identify any temporary limited-support mode.'],
['Long incomplete weather/event history','Propagate bounded validated gaps if possible. Otherwise ask one reference question; do not replay invented dry days.'],
['New sensor/weight observation','Assimilate the observation with method/calibration uncertainty; no recurring manual input requirement is created.'],
['Model disagreement with real observation','Reconcile input/event/setup errors, widen uncertainty and request the minimum corrective information.'],
['Change of pot, medium or root environment','Create a setup epoch and apply a new supported profile. Old facts remain, affected calibration does not silently transfer.'],
['Move of a portable pot','Carry water state and prior exposure; change the subsequent weather/shelter path. A pin correction is not a transplant.']
],[0.34,0.66])
h('Age, size and growth')
p('Use a verified calendar age anchor with its meaning and uncertainty. Seed origin, rooted duration and user stage remain distinct. Unknown age does not become day zero. Dated height/canopy updates improve the appropriate loss/storage context; missing updates widen growth uncertainty within a validated stage range. No exact leaf-area growth curve is inferred from age alone.')
p('Do not prompt for daily plant measurements. Reuse normal stage edits, repot/movement actions and optional photos/size updates. A substantial unrecorded canopy/root change can make a profile out of domain; explain that exception rather than pretending passive watering logs identify it.')
h('No hidden learning from behaviour')
p('Watering events update inputs. They do not demonstrate actual moisture or identify the dry-state threshold. Personalization without sensor/independent outcomes is limited to declared setup/routine context and justified state propagation. Do not claim automatic plant-specific accuracy improvement because the user has logged many waterings.')
p('A compatible profile can stay useful without individual calibration if its prediction error remains acceptable for that domain. If the domain is too heterogeneous, offer a smaller supported profile range or an optional measurement path. Repeated nuisance uncertainty prompts count as a product failure, not proof of algorithm safety.')

page('11  Rain reception and future rain', 'ESTIMATE ACTUAL REPLENISHMENT WITH BOUNDS')
h('Past/current rain')
code('''Rroot = rainfall_to_root_input(
  nonoverlappingHistory, reception, contributingAreaOrDepth,
  canopy/interception, runoff/runon, infiltration, drainageProfile)
# current rain rate needs a documented integration interval
# no direct mm-to-pot-litres or rain-threshold reset
''')
p('Only occurred precipitation can affect present reserve. Prefer documented retrospective/site evidence and carry regional spatial uncertainty. Directly sheltered soil receives no direct-rain input; report separate possible runoff/splash pathways instead of silently making them zero or full.')
p('For partial/unknown reception, evaluate supported capture bounds. A large storm may move the estimated reserve enough to produce not_due if the model supports it. It does not prove saturation, successful wetting or equal replenishment across all plants. A brief shower may have mainly surface effects; the response is profile-dependent.')
h('Contributing area')
p('For a pot, incident rain litres equals mm times characterized catchment m2. Actual canopy channeling/interception can change the contributing area. For ground, use infiltrated depth on the defined root/wetted zone. Pot nominal litres do not supply the opening area. Unknown geometry should be estimated only with a validated profile/range or supplied once.')
h('Forecast rain')
p('Future rain never enters current reserve. Run separate future scenarios, including a no-rain path; preserve issue time and lead. A currently dry estimate is not overruled merely because rain is forecast tomorrow. A currently sufficient estimate can support waiting for the next evaluation, with clear warning if a plausible dry path reaches the threshold first.')
p('Do not multiply deterministic rain amount by probability by default: conditional versus unconditional amount semantics must be established first. Occurrence probability is not confidence in received/retained volume. Snow water equivalent remains a separate storage/melt pathway, not immediate liquid root replenishment.')
h('Exposure changes and event time')
p('A changed shelter answer or movement has an effective time. Recalculate the relevant interval; do not retroactively apply today roof position to the whole weather history. An ambiguous change time produces a scenario range. Rain received before a pot is moved stays in that pot state afterwards.')
p('The rain question is a high-value addition because it removes a major structural ambiguity with one short user answer. It still needs the medium/input model to convert exposure into a useful reserve prediction.')

page('12  Hazards that the data can support', 'WARN ABOUT EXPOSURE; DO NOT PROMISE EXACT DAMAGE OR PREVENTION')
table(['Hazard / capability','Inputs','Useful output and action'],[
['Heat event - weather warning','Valid hourly temperature/forecast, radiation/sun class, shelter, developmental context.','Heat exposure warning and relevant protection/monitoring guidance. No measured leaf/root temperature or automatic extra-water command.'],
['Cold/frost/freeze - weather warning','Minimum/hourly forecast, official warnings, wind/cloud/dew context and location.','Prepare suitable protection before the event. Frost at the plant is possible even when the reported air value does not equal surface temperature.'],
['Strong wind/gusts - weather warning','Wind/gust forecast and official alerts; plant stature, support/shelter if reported.','Secure movable containers/supports and protect from exposure where practical. No precise branch-breakage prediction.'],
['Heavy rain/runoff - weather warning','Rain intensity/accumulation where available, alert, reception, ground/container and drainage context.','Review drainage/possible pooling and protect vulnerable setups before the event. Rain amount alone does not diagnose waterlogging.'],
['Hail/severe storm - alert-based','Applicable official alert or a documented explicit hail/severe-weather product.','Prepare shelter before conditions arrive where feasible. Do not invent hail predictions from humidity/clouds/rain probability.'],
['Drying/drought concern - model-based','Supported water balance and future no-rain demand path.','Current watering recommendation or an estimated approaching-demand window, with uncertainty.'],
['Persistent excess-water concern - model/observation','Supported excess-storage/drainage state, repeated input, or reported pooling/wetness.','Check drainage/additional water source; avoid contradictory automatic irrigation. No pathogen identification.'],
['Hot-container exposure - contextual','Heat/sun plus reported dark/heat-absorbing container or hot surface.','Contextual container-heat precaution; root temperature and injury are unmeasured.'],
['Dew/fog dampness - contextual','Paired dew-point proximity, humid-night history and local evidence if available.','Flag possible damp conditions for disease scouting. It is not observed leaf wetness or root-water refill.']
],[0.28,0.32,0.40])
p('Cold-warning logic must distinguish air and surface exposure; radiational frost depends on the local energy balance. [R11] Container properties and nearby hot surfaces can modify exposure. [R12] These sources support the mechanism and contextual message, not exact cultivar injury thresholds.')
p('Use official alerts where applicable, and show provider issue/valid time and geography. Absence of an alert is not a low-risk measurement. Tell users to prepare before a storm or inspect after it when safe; do not send them into destructive conditions to check a plant.')

page('13  Disease warnings and prevention', 'CONDUCIVE CONDITIONS CAN BE FLAGGED; PRESENCE CANNOT BE PINPOINTED FROM WEATHER')
table(['Problem','What can be inferred','Qualified preventive/scouting message'],[
['Powdery mildew','Coherent favourable ambient exposure and reported susceptibility/history; infection itself is unknown.','Explain conditions may favour mildew; suggest airflow/appropriate spacing and an occasional symptom inspection after a meaningful episode.'],
['Bud rot / Botrytis','Flowering plus damp/humid/rain episodes and reported density/wounds can justify flower attention.','Avoid unnecessary prolonged flower wetting, promote feasible airflow, and inspect flowers if the warning warrants it. No automatic diagnosis or broad water withholding.'],
['Fungal leaf spots, including Septoria-type concern','Wet-weather leaf-disease exposure may warrant a general leaf-spot scout; species is unknown.','Check lower/inner foliage for new spots after a suitable episode; distinguish symptom report from identified pathogen.'],
['Damping-off / seedling root disease','Developing seed/seedling/cutting plus supported persistent-wetness or poor-drainage context.','Warn about the wet-root environment and inspect establishment if symptoms appear. Weather alone cannot diagnose damping-off.'],
['Root oxygen / root-disease conditions','Persistent excess water can be modelled within a drainage profile or reported directly.','Prioritize drainage/aeration concern. Do not identify Pythium, Fusarium or root rot solely from rain/weather.']
],[0.27,0.36,0.37])
p('Powdery mildew on hemp does not require free leaf water; it must not be modelled as the same wetness process as other foliar disease. [R07] Botrytis is favoured by suitable damp conditions and susceptible tissue; cultural measures can reduce conducive conditions, without guaranteeing prevention. [R08] Rutgers field observations support a general wet-weather leaf-spot category rather than an automatic Septoria diagnosis. [R09]')
p('Cornell guidance supports using weather, airflow and waterlogging context, and notes that strong wind can also move pathogens. High wind does not establish disease protection. [R10] Ambient air cannot be converted to exact internal flower RH through a fixed greenhouse-derived offset. [R18]')
h('Scouting burden and messaging')
p('Weather-driven disease warnings should be event-based and deduplicated, not daily mandatory logs. A recent no_symptoms observation applies to its time; it does not establish immunity. Optional photos/positive symptom reports can trigger a separate diagnostic-support flow.')
p('Separate support for the weather episode from support for infection. Use Conditions may favour... rather than Your plant has... or an invented disease probability. The product can help reduce preventable exposure, but cannot guarantee disease prevention or pinpoint unobserved infections.')
h('Unvalidated screens')
p('The earlier RH/duration disease cutoffs are pilot screens, not validated cannabis infection models. Keep them behind a versioned pilot flag until symptom/reference comparisons demonstrate useful performance. Public scouting claims require a documented exposure rule and clear limitations. Do not import thresholds from unrelated crops as proven rules.')

page('14  Predictions that remain unsupported', 'PRACTICAL ALTERNATIVES WITHOUT AN EXPANDED DAILY LOGGING BURDEN')
table(['Unsupported claim from current routine inputs','Alternative'],[
['Exact soil moisture percentage for any setup','Use an estimated reserve class/range for validated profiles. Optional calibrated sensor for a physical measurement.'],
['The plant definitely retained a full watering','Use saved pattern plus calibrated input uncertainty; optional one-time amount measurement or event exception.'],
['Exact roots/depth from plant age','Use developmental/profile ranges and uncertainty; optional transplant/rooting history.'],
['Exact disease presence or pathogen identity','Event-triggered symptom/photo support or diagnostics; retain weather-condition warnings separately.'],
['Exact pest infestation or pest species from weather','User/photo observation or a region-specific validated pest service. No general weather-only pest diagnosis.'],
['Nutrient deficiency, pH lockout or excess salt from rain/age','Relevant medium/feed measurements and symptoms. No automatic fertilizer/pH correction from weather alone.'],
['Exact root/leaf temperature or sunburn injury','Contextual heat/acclimation warning; optional actual local/tissue measurements.'],
['Exact flowering/harvest date from age/daylight','User-confirmed stage and verified cultivar/phenology support where available.'],
['Flooding at the individual plant from regional rain','Drainage/topography/site report or an appropriate flood product; report heavy-rain exposure separately.'],
['Guaranteed future no-water period or no disease','Give qualified current recommendation and a future estimate with reevaluation/uncertainty. No guarantee.']
],[0.44,0.56])
h('The recommended product compromise - ENG')
bullets(['Keep normal use to watering logs and saved setup context.', 'Supply tested profile estimates for supported setups; show Estimated on the watering card.', 'Keep optional sensor integration and one-time calibration as accuracy upgrades rather than mandatory equipment.', 'Use a rare, specific exception prompt when a missing fact changes the action. A recurring Check moisture request is a sign that the supported model/profile coverage is inadequate.', 'If the intended deployment truly requires a definite, accurate yes/no for every arbitrary setup with no reference feedback, that performance claim is unsupported. Narrow the supported setups or add a measurement source.'])
p('A one-time moisture answer or watering-method calibration is an alternative offered here, not a newly imposed daily requirement. It can improve initialization; it does not by itself validate all later predictions for an unknown medium.')

page('15  Output contract and novice interface', 'A SIMPLE CARD WITH A TRACEABLE ESTIMATE UNDERNEATH')
code('''PredictiveCareDecision = {
  plantId, asOf, algorithmVersion: "5.0", policyVersion,
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
}''')
table(['Result','Card example'],[
['water_now','Needs watering - Estimated reserves are low after recent drying conditions.'],
['not_due','Does not need watering yet - Estimated reserves remain sufficient after watering.'],
['Supported rain replenishment','Does not need watering yet - Recent rain is estimated to have replenished this exposed setup.'],
['uncertain','One setup detail needed - We cannot tell how much rain reaches this plant.'],
['Disease-conducive conditions','Bud rot watch - Recent damp conditions warrant attention to flowering tissue. Presence is unconfirmed.'],
['Official hazard','Strong wind forecast - Secure exposed pots/supports before the event where practical.']
],[0.30,0.70])
p('Show Estimated in the main watering UI. A details view explains the most important model assumptions and last event; it does not show a fake precise soil-moisture percentage or a confidence percentage from field counts. A supported probability, if eventually shown, must be empirically calibrated for its stated outcome.')
p('A warning does not require the user to fill a symptom form. Optional Saw a problem or Advice seems wrong feedback is available. A Watered event is acknowledged immediately, and updates the estimate without automatically proving a complete refill.')
p('A correct not_due card can coexist with a heat or bud-rot watch. A supported dry estimate can coexist with a disease watch; disease-conducive humidity does not justify withholding needed root irrigation. Copy must not turn a canopy-wetting precaution into a blanket instruction not to water the roots.')

page('16  Execution and parameter contract', 'DETERMINISTIC STATE PROPAGATION; NO UNDOCUMENTED DEFAULTS')
code('''evaluate(snapshot, asOf):
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
''')
h('Required parameter registry')
table(['Parameter class','Policy'],[
['Storage, root access and action threshold','CAL: units, profile domain, definition, uncertainty/dependence, source and validation must be supplied. No guessed universal defaults.'],
['Loss/weather-transfer function','CAL: predictor definitions, interval semantics, trained/assessed weather range, version and independent error.'],
['Irrigation pattern and rain reception conversion','CAL: observed input/post-event variability, setup domain and bounds. Direct shelter is a structural restriction, not a universal retention efficiency.'],
['Current/forecast freshness and gap tolerance','ENG, with effects assessed in validation. Product issue/update cadence, scheduler capability and model-error limits determine the values.'],
['Decision threshold under overlap','CAL/ENG: calibrated probability/loss policy and measured acceptable errors. Otherwise preserve uncertain.'],
['Disease and damage screens','Named ENG pilot unless a relevant validated model exists. No unlabelled transfer from another crop/region.'],
['Delivery/cooldowns','ENG: user settings and event deduplication. Recompute state immediately on new data even while a push is suppressed.']
],[0.35,0.65])
p('Parameter absence is a model-readiness error or unsupported-profile result, never an invitation to insert a pleasing constant. The age/size/medium features may narrow an already assessed profile; they do not manufacture missing calibration.')
p('Unsupported watering-profile status does not suppress usable weather/hazard modules. Evaluate their independent inputs and return the applicable warnings alongside the explicit watering exception.')
p('Cache/checkpoint keys include event revisions, profile and policy versions, setup/location path, weather product/method and time. Replay late corrections and deletions. Forecast issue/availability time is preserved for honest backtests; data recorded after a historical asOf are unavailable to that replay.')

page('17  Implementation and compatibility', 'THE NEW PREDICTIVE CONTRACT MUST REACH EVERY CONSUMER')
table(['Work item','Required result'],[
['Weather normalizer','Correct the earlier reproduced mixed rain-rate/day total, forecast-as-observed, future-night aggregation and UTC-shift defects. Retain raw interval provenance.'],
['Weather history and alerts','Use a real retrospective product for missing history, not a current forecast request. Enable official alert capability; benchmark reference ET inputs.'],
['Plant/setup schema','Add rainReception, effective history, supported medium/drainage profile and optional saved watering pattern. Extend backups, ownership, offline edits and deletion together.'],
['Prediction core','Implement the versioned profile selector, event/state replay, uncertainty, current action and separate future projection. No Firestore/HTTP inside the pure domain core.'],
['UI adapters','Replace thresholdDays/legacy rain resets. Every consumer must understand uncertain. A Boolean false cannot mean both not_due and unknown.'],
['Root/disease logic','Remove root-rot scoring that consumes needsWater. Add independent drainage/excess state and explicit flower/leaf/weather hazard types.'],
['Presentation overrides','Remove same-day watering rules that force high confidence/not_due regardless of retained amount or later evidence.'],
['Shadow release','Compare predictions with reference outcomes without new pushes first. Roll out only to domains whose performance passes the defined criteria.'],
['Operational delivery','Share weather fetches geographically; retain individual water states. Recheck authorization/status before pushes and suppress inactive/harvested plants.']
],[0.29,0.71])
h('Scope of the earlier code evidence')
p('The four parser behaviours were reproduced during the v4.0 audit against the local modules. That does not establish their frequency in stored data or that the current deployment is identical. Retest the actual implementation commit and inspect legacy weather records before migration. Do not claim the app was fixed by writing this document.')
h('Low effort must be measured')
p('Track how often users receive the normal binary answer, how often a one-off question is needed, optional-field completion, notification burden and user abandonment. An engine that avoids mistakes by returning uncertain for nearly all ordinary plants fails the product requirement. An engine that always returns a Boolean without support fails the accuracy requirement.')
p('Preserve untracked specialist setups with an explicit alternative; do not force them into a standard free-draining pot profile. Never apply a group-level rain or watering event to all member reserves without plant-specific evidence.')

page('18  Validation with little ordinary-user effort', 'INSTRUMENT A REFERENCE COHORT; KEEP NORMAL USE SIMPLE')
h('Calibration work belongs in the development pilot')
p('Use volunteer/reference plants with calibrated substrate sensors, representative ground profiles and/or controlled pot weights. Collect actual retained/input outcomes and water state without asking every future user to measure daily. Paired pot weights support whole-system water loss when event/drainage/handling fluxes are characterized. [R06]')
bullets(['Include beginner watering variability, no-volume Watered events, top-ups, partial shelter, mixed weather, small/large/root-developing setups and soil/medium classes.', 'Run a deployment-faithful evaluation that hides reference measurements from model inputs and provides only the ordinary proposed setup and watering logs. Otherwise a sensor-rich pilot exaggerates real-app performance.', 'Compare the new model with the current heuristic, simple calendar/routine and an elapsed-time-plus-weather baseline. Separate supported-domain performance from rejected cases.', 'Use chronological and held-out plant/owner/setup/location evaluation. Assess coast/interior/highland and seasons where relevant. Include realistic missed logs and weather outages.', 'Measure missed independently confirmed dry states, unnecessary watering advice while sufficient/wet, timing error, normal binary coverage, exception rate and notification burden.', 'For moisture/reserve ranges, measure coverage/bias and subgroup errors. Validate both initialization and error growth between reference anchors, not only one-day loss.', 'For disease warnings, use independent timed inspections and label missing checks. Weather exposure accuracy and actual symptom prediction are different tasks.'])
h('Promotion gates')
table(['Gate','Required evidence'],[
['Computational correctness','Units, chronology, mass accounting, forecast separation, uncertainty boundaries and source-event replay pass executable tests.'],
['Profile readiness','Storage/initialization/input/loss/threshold parameters exist with provenance and defined supported domain.'],
['Useful predictions','Prospective missed-dry and unnecessary-water rates, coverage and burden meet preregistered product targets with uncertainty intervals.'],
['Low user burden','Ordinary supported users receive routine predictions without daily moisture submissions; exception rate meets its target.'],
['Hazard/scout readiness','Source validity, appropriate wording and useful event burden demonstrated; no unsupported pathogen or tissue-damage claim.']
],[0.29,0.71])
p('No measured target rates or sufficient sample size can be claimed from the present review. Set them before promotion using pilot baseline rates, severity costs and statistical precision. Report uncertainty and subgroup failures; do not call equations correct proof that the app prediction is accurate.')

# Meaningful algebra/policy fixtures, separate from implementation or field tests.
checks=[]
def assert_case(key,condition,detail):
    checks.append({'id':key,'passed':bool(condition),'detail':detail})
    if not condition: raise AssertionError(checks[-1])
def classify(margins):
    if not margins or not all(math.isfinite(x) for x in margins): return 'uncertain'
    if all(x<=0 for x in margins): return 'water_now'
    if all(x>0 for x in margins): return 'not_due'
    return 'uncertain'
def freely_draining(w,i,r,loss,c):
    raw=w+i+r-loss
    return max(0,min(c,raw)),max(0,raw-c),max(0,-raw)
assert_case('V5M-01',classify([-0.3,-0.1])=='water_now','All supported reserves below action threshold.')
assert_case('V5M-02',classify([0.3,0.1])=='not_due','All supported reserves above action threshold.')
assert_case('V5M-03',classify([-0.1,0.2])=='uncertain','Overlapping actions remain uncertain without a calibrated overlap policy.')
assert_case('V5M-04',classify([0])=='water_now','Exactly at action boundary is due.')
assert_case('V5M-05',classify([])=='uncertain','No valid state scenarios cannot become not_due.')
assert_case('V5M-06',classify([float('nan')])=='uncertain','Nonfinite state is rejected.')
assert_case('V5M-07',freely_draining(3,1,0,0.5,5)==(3.5,0,0),'Consistent retained input/loss units.')
assert_case('V5M-08',freely_draining(4,3,0,1,5)==(5,1,0),'Freely draining excess is separately accounted.')
assert_case('V5M-09',freely_draining(0.2,0,0,0.5,5)==(0,0,0.3),'Unmet potential demand is separate from negative reserve.')
assert_case('V5M-10',freely_draining(1,0,0,0.4,5)[0]==0.6,'No occurred rain in current state; future forecast is not passed as input.')
assert_case('V5M-11',abs(freely_draining(1,0,0.8,0.4,5)[0]-1.4)<1e-9,'Actual characterized rain can replenish reserve.')
assert_case('V5M-12',classify([freely_draining(1,0.2,0,0.4,5)[0]-1,freely_draining(1,2,0,0.4,5)[0]-1])=='uncertain','Same Watered timestamp with unknown top-up/full input cannot uniquely determine the action.')
assert_case('V5M-13',abs(10*math.pi*0.1**2-0.314159265)<1e-8,'Rain geometry: 10 mm over a 20 cm diameter opening is 0.314 L incident, before losses.')
assert_case('V5M-14',abs((30+5-8-10)-17)<1e-9,'Illustrative ground depletion in consistent mm.')
assert_case('V5M-15',freely_draining(freely_draining(1,1,0,0.5,5)[0],0,0,0.5,5)==freely_draining(1,1,0,1,5),'Compatible two-step replay preserves water accounting.')
SRC.joinpath('WeedGrow_Outdoor_Algorithm_v5.0_Verification.json').write_text(json.dumps({'scope':'15 synthetic arithmetic and policy fixtures; not the implemented engine or field accuracy','checks':checks},indent=2),encoding='utf-8')

page('19  Worked examples and verified logic', 'ILLUSTRATIONS USE HYPOTHETICAL PROFILE VALUES, NOT CANNABIS DEFAULTS')
table(['Case','Inputs and output'],[
['Supported not_due','Reserve scenarios 2.0 and 2.6 L, threshold 1.0 L: both are sufficient. No watering needed yet, estimated.'],
['Supported water_now','Reserve scenarios 0.7 and 0.9 L, threshold 1.0 L: both are low. Watering recommended, estimated.'],
['Unresolved overlap','Reserve scenarios 0.9 and 1.2 L, threshold 1.0 L: actions disagree. Use a validated overlap policy or a specific one-time recovery option.'],
['Unknown watering amount','Starting reserve 1.0 L, loss 0.4 L; a 0.2 L retained top-up leaves 0.8 L, while a 2.0 L retained input leaves 2.6 L. Same timestamp, different action at a 1.0 L threshold.'],
['Rain that already occurred','Starting 1.0 L plus supported retained rain 0.8 L minus loss 0.4 L gives 1.4 L. Current state may change.'],
['Rain only forecast','Starting 1.0 L minus actual loss 0.4 L gives 0.6 L now. Tomorrow rain does not change that current value.'],
['Overflow','Starting 4 L plus entering-water input 3 L minus loss 1 L gives 6 L before storage/drainage. A free-draining 5 L capacity has 1 L excess; slow-draining systems need another state.'],
['Exhausted reserve','0.2 L reserve with 0.5 L potential loss gives zero available reserve and 0.3 L unmet demand; not negative stored water.']
],[0.27,0.73])
p('Fifteen standalone synthetic arithmetic/policy checks were executed for this revision. They verify the stated robust-decision boundaries, missing/invalid scenarios, accounting, replay and the unknown-input counterexample. All passed. They do not validate the choice of a profile, its action threshold or crop prediction accuracy.')
p('The v4.0 review separately checked 24 numerical assertions and reproduced four local parser defects. Those earlier checks are not new v5 field results. The application prediction engine and the acceptance fixtures below have not been executed by writing this document.')

acceptance=[
('Watered logged without a moisture check.','Supported model may issue water_now/not_due; no fresh-observation gate.'),
('Ordinary supported user logs only watering.','No daily moisture/size task; maintain predicted state between events.'),
('Rain exposure is unknown.','Keep unknown; ask the agreed one-time question when material, never default exposed.'),
('One plant is roof-sheltered in an exposed garden.','Plant override applies to its rain inputs only.'),
('Current rain.1h and daily forecast rain coexist.','Separate interval/rate and forecast nature; no mixed observed daily total.'),
('Today daily[0] without current.','It remains forecast; cannot fill actual history.'),
('Future same-date night humidity exists.','Forecast feature only; never completed humid exposure.'),
('Sunrise 03:00Z, zone UTC+2.','Store 03:00Z, display 05:00 local.'),
('Yesterday was not fetched.','Use explicit history capability or validated gap uncertainty, not a current request.'),
('Weather outage.','No zero loss/rain invention; model gap limit or a specific recovery alternative.'),
('Missing UV but valid loss-driving data.','Do not reject the whole weather context.'),
('No source profile/initial state.','No fabricated wet reserve or universal two-day baseline.'),
('A saved normal watering pattern applies.','Use its calibrated variability, not a guaranteed full reset.'),
('Unknown amount and unknown pattern.','Retained input stays broad; no automatic refill.'),
('Small top-up exception.','No full-event substitution; later action follows resulting reserve.'),
('Feeding with linked carrier water.','Count actual carrier input once; concentration is not volume.'),
('Duplicate retry and two genuine same-day waterings.','Deduplicate logical retry only.'),
('Backdated edit/delete arrives.','Replay affected state; retain availability rules for backtesting.'),
('Ground plant contains stale potSize.','Ground profile; no pot-capacity modifier.'),
('Raised bed is open to native soil.','Use supported connected/layered model or declare unsupported.'),
('Developing roots in a large container.','Do not allocate the entire nominal pot as an accessible reserve.'),
('Age known, root establishment unknown.','No exact root volume/depth from age alone.'),
('All supported margins positive / nonpositive.','Return not_due / water_now respectively.'),
('Supported scenario actions overlap.','Validated overlap policy or uncertain; never raw scenario frequency as probability.'),
('Credible current wet observation contradicts model.','Reconcile and suppress blind extra-water instruction.'),
('Credible dry observation after same-day watering.','Do not force high-confidence not_due from the event.'),
('Different-depth readings.','Preserve root relevance/gradient; do not average arbitrary states.'),
('Large regional rain with unknown reception.','Use justified scenarios; no universal saturation/reset.'),
('Received characterized rain, roots initially low.','Allow supported model replenishment without mandatory manual check.'),
('Dry now and rain forecast tomorrow.','Current dry recommendation is not cancelled by future input.'),
('Snow/freezing context.','No immediate liquid infiltration assumption.'),
('Slow-draining overflow.','Excess/persistence retained; no free-draining clipping shortcut.'),
('Portable pot moved.','Carry reserve, segment weather path; do not reset wetness.'),
('Repot / medium / major canopy change.','Appropriate profile/domain update and uncertainty, no guessed scaling.'),
('Reference ET and VPD/T/RH/wind all available.','Avoid correlated additive drying votes.'),
('Grid soil-moisture data available.','Model covariate only; no on-site pot moisture assertion.'),
('High humidity / warm night and no symptoms.','Condition-based scout; no infection percentage/diagnosis.'),
('Powdery mildew screen during rain.','No monotone rain multiplier or required free-leaf-water premise.'),
('Flowering plus damp episodes.','Bud-rot/flower watch; no fixed ambient-to-flower RH offset.'),
('Wet-weather leaf spots are possible.','General leaf-spot watch, not identified Septoria.'),
('Seedling + persistent wetness.','Establishment/root-condition warning; no automatic damping-off diagnosis.'),
('Strong wind but unknown local canopy exposure.','Qualified physical hazard; no disease-protection conclusion.'),
('Hail not present in source alert/product.','Do not derive a hail warning from generic rain chance.'),
('Cold/heat source is ambient air.','Exposure warning, not measured tissue damage or automatic watering.'),
('Many watering logs but no independent outcomes.','No claimed learned plant-specific dryness accuracy.'),
('Reference-cohort evaluation.','Hide instruments from model inputs to simulate ordinary user operation.'),
('Many routine uncertain results.','Fail normal-coverage/user-burden gate; do not celebrate abstention alone.'),
('Inactive/deleted/snoozed/shared/offline cases.','Eligibility/authorization/delivery correct; biology/state not rewritten by snooze.')
]
for start,end,label in [(0,24,'20  Acceptance cases: model and inputs'),(24,48,'21  Acceptance cases: hazards and reliability')]:
    page(label,'48 NORMATIVE IMPLEMENTATION FIXTURES - NOT EXECUTED APP TESTS')
    table(['ID','Fixture','Required behaviour'],[[f'V50-{i+1:02}',a,b] for i,(a,b) in enumerate(acceptance) if start<=i<end],[0.13,0.38,0.49])

page('22  What is still needed to make it accurate', 'CONCRETE OPEN WORK, WITH ALTERNATIVES')
table(['Remaining uncertainty','How to resolve it','Practical fallback'],[
['Which setups can receive dependable timing predictions?','Build measured storage/input/loss profiles and held-out validation for the launch domain.','Start with a smaller set of supported setups; expand after testing.'],
['Does timestamp-only watering narrow state sufficiently?','Measure normal beginner watering patterns and their retained-water variation.','Save pattern once; offer optional amount or one-time method calibration.'],
['Can initial state be set without routine measurements?','Validate inference from declared pattern/reference wetting and known setup history.','One optional initial reference answer or automatic instrument.'],
['Which weather source/method works locally?','Benchmark history, ET and forecast error in actual regions; verify API entitlement/cost/scheduler.','Use a suitable alternative data product, with transparent uncertainty.'],
['How much canopy/root growth can be inferred?','Evaluate stage/age/size features against observed development and decision errors.','Broad supported growth ranges; occasional normal profile update, not daily measuring.'],
['Which disease screens are useful?','Compare event warnings against independent symptoms/inspections; quantify burden and misses.','Qualified condition/prevention messages, no unvalidated pathogen odds.'],
['What error/exception rate is acceptable?','Agree product targets using reference-cohort baseline rates and uncertainty.','No broad accuracy claim until both usefulness and error criteria are met.']
],[0.30,0.37,0.33])
h('Decisions already accepted')
p('Predict watering need in normal supported conditions; routine input is watering logs; add rain reception; design for beginners; offer alternatives when a quantity cannot be reliably inferred; add useful environmental and disease-condition warnings. These decisions do not need to be reconfirmed.')
h('Delivery status')
p('v5.0 supplies the revised product contract, model structure, uncertainty/initialization policy, rain schema, capability/alternative list and acceptance plan. The actual field-tested parameter library, implemented model and measured predictive performance remain outstanding. The document is an implementation and validation baseline, not a claim those outcomes already exist.')
callout('The intended experience is a useful estimated yes/no watering answer with little routine effort. Achieving it requires measured model profiles and dependable weather/event accounting. Daily manual moisture logging is not the product requirement.')

for start,end in [(1,7),(7,13),(13,19)]:
    page(f'Evidence ledger: R{start:02}-R{end-1:02}','PRIMARY SOURCES REVIEWED 29 OCTOBER 2026')
    for k in range(start,end):
        key=f'R{k:02}'; title,url,note=refs[key]
        h(f'[{key}] {title}'); p(note); blocks.append(('link',(url,'Open primary source')))
    if start==13:
        h('Review provenance')
        p('Builds on the supplied 33-page v3.1 document and the prior v4.0 local-code audit, with the current user clarification governing this product revision. Prior audit results are labelled as prior results; no production data, deployed entitlements or crop outcomes were accessed.')

# Reuse only the previously reviewed presentation code, never its v4 content.
# The emitted files are v5.0; the v4.0 PDF and source remain unchanged.
renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('v4.0','v5.0').replace("'v4_acceptance_cases':64","'v5_acceptance_cases':48")
renderer=renderer.replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','PREDICTIVE DESIGN; PROFILE AND FIELD VALIDATION PENDING')
exec(compile(renderer,'reviewed_pdf_renderer_v5','exec'))
