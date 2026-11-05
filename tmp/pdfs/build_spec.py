from pathlib import Path
import re, json, math, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'output'/'pdf'
SRC = ROOT/'output'/'spec'
OUT.mkdir(parents=True,exist_ok=True); SRC.mkdir(parents=True,exist_ok=True)
refs = {
'R01': ('FAO-56, Chapter 2: FAO Penman-Monteith equation', 'https://www.fao.org/4/x0490e/x0490e06.htm', 'Standard grass-reference ET definition and daily equation; reference demand is distinct from actual plant water loss.'),
'R02': ('FAO-56, Chapter 3: Meteorological data', 'https://www.fao.org/4/x0490e/x0490e07.htm', 'Vapour pressure, extraterrestrial radiation, wind-height conversion, Hargreaves Equation 52 and regional limitations.'),
'R03': ('FAO-56, Chapter 4: Determination of ETo', 'https://www.fao.org/4/x0490e/x0490e08.htm', 'Time-step requirements, radiation workflow and published Example 17 used in the numerical check.'),
'R04': ('FAO-56, Chapter 8: ETc under soil water stress conditions', 'https://www.fao.org/4/x0490e/x0490e0e.htm', 'Available water, depletion, stress coefficients and root-zone water accounting.'),
'R05': ('Zotarelli et al., UF/IFAS AE459: Step by Step Calculation of the Penman-Monteith Evapotranspiration', 'https://edis.ifas.ufl.edu/publication/AE459/pdf', 'Independent practical reference for input units, local pressure and complete-weather calculations.'),
'R06': ('Oregon State University, EM 9868: Soil moisture monitoring to support irrigation scheduling', 'https://extension.oregonstate.edu/catalog/em-9868-soil-moisture-monitoring-support-irrigation-scheduling', 'Content versus matric potential; soil structure, depth and representative monitoring.'),
'R07': ('University of Minnesota Extension: Soil moisture sensors for irrigation scheduling', 'https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/soil-moisture-sensors-for-irrigation-scheduling', 'Sensor placement, multiple depths and soil-specific interpretation.'),
'R08': ('Criscione, Virginia Tech, SPES-750P (2026): Measuring Nursery Plant Water Use in Containers', 'https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-750.html', 'Paired container weights and variability with canopy, medium and weather. Not a cannabis-specific coefficient.'),
'R09': ('University of Maryland Extension (updated 2026): Growing Vegetables in Containers and Salad Tables', 'https://extension.umd.edu/resource/growing-vegetables-containers-and-salad-tables', 'Container drainage, geometry, porous materials, hot surfaces and rewetting dry media; general container evidence.'),
'R10': ('Denton et al. (2025): Water use and productivity of Cannabis sativa L., KwaZulu-Natal Midlands, South Africa', 'https://pubmed.ncbi.nlm.nih.gov/40883853/', 'Field eddy-covariance water use in one production system; does not identify water use by a single outdoor pot. DOI 10.1186/s42238-025-00325-4.'),
'R11': ('Duong et al. (2023): Variation in Hydric Response of Two Industrial Hemp Varieties to Induced Water Stress', 'https://www.mdpi.com/2311-7524/9/4/431', 'Two cultivars in a controlled greenhouse experiment showed different water-use responses; cannot supply universal stage coefficients.'),
'R12': ('Gill et al. (2025): Water conservation and assimilation is driven by stomatal behaviour in industrial hemp', 'https://researchnow-admin.flinders.edu.au/ws/portalfiles/portal/153745716/Gill_Water_P2025.pdf', 'Water availability changes stomatal behaviour and gas exchange. DOI 10.1016/j.envexpbot.2025.106119.'),
'R13': ('Zhang et al. (2021): Photoperiodic Flowering Response of Essential Oil, Grain, and Fiber Hemp Cultivars', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8367441/', 'Cultivar-dependent critical photoperiod and day-neutral responses; outdoor flowering is not a universal 12-hour switch.'),
'R14': ('Korus et al., UF/IFAS PP379 (2024): Field Guide to Hemp Diseases', 'https://edis.ifas.ufl.edu/publication/PP379/pdf', 'Distinct powdery mildew, gray mold and root-disease mechanisms. Weather exposure is not pathogen diagnosis.'),
'R15': ('Punja et al. (2023): Total yeast and mold levels in high THC-containing cannabis inflorescences', 'https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2023.1192035/full', 'Measured flower microclimates differed from ambient in greenhouse plants; no justified fixed outdoor humidity offset.'),
'R16': ('OpenWeather: One Call API endpoint version 3.0 documentation', 'https://openweathermap.org/api/one-call-3', 'Current, hourly and daily field semantics; rain units, probability, timestamps and historical endpoint shapes.'),
'R17': ('OpenWeather: Migrating from One Call API 3.0 to 4.0', 'https://openweathermap.org/api/one-call-3-migration', 'Separate timeline resources and changed response paths require a version-specific adapter.'),
'R18': ('OpenWeather: One Call API endpoint version 4.0 documentation', 'https://openweathermap.org/api/one-call-4?collection=one_call_api', 'Current product contract, timeline pagination and alert retrieval; recheck contract and entitlement during implementation.'),
'R19': ('Open-Meteo: Weather Forecast API documentation', 'https://open-meteo.com/en/docs', 'Candidate modelled grass-reference ET, shortwave radiation, wind height and surface pressure; not on-site root moisture.'),
'R20': ('Open-Meteo: Historical Forecast API documentation', 'https://open-meteo.com/en/docs/historical-forecast-api', 'Stitched historical forecasts differ from archived individual model runs; preserve issue time for honest backtests.'),
'R21': ('Open-Meteo: Pricing and commercial use', 'https://open-meteo.com/en/pricing', 'Commercial deployment needs suitable terms/capacity; evaluation does not establish a production entitlement.'),
}

blocks=[]
def p(t): blocks.append(('p',t))
def h(t): blocks.append(('h',t))
def page(title,strap=None):
    if blocks: blocks.append(('break',None))
    blocks.append(('title',title))
    if strap: blocks.append(('strap',strap))
def table(headers,rows,widths=None): blocks.append(('table',(headers,rows,widths)))
def bullets(items): blocks.append(('bullets',items))
def code(t): blocks.append(('code',t.strip()))
def callout(t): blocks.append(('callout',t))

page('WeedGrow\nOutdoor decision engine', 'FINAL SPECIFICATION v4.0  |  29 OCTOBER 2026')
p('A research-reviewed specification for plant moisture checks, weather exposure and health scouting. Supersedes the outdoor v3.1 document supplied for this review. Scope: active outdoor plants in containers and in ground. The intended application is WeedGrow.')
callout('Core rule: model atmospheric demand, track actual care events, and let relevant root-zone evidence govern watering advice. Age, stage, size, substrate and exposure influence the context and inspection policy. They do not create an unmeasured water reserve.')
h('What this version delivers')
bullets(['An audit of the complete 33-page source and the relevant current repository, including four reproduced weather-parser defects.', 'A provider-independent weather contract, a phased route to radiation and reference ET, explicit fallback behaviour and deterministic pilot rules.', 'A complete decision specification, data additions, compatibility requirements, mathematical examples and acceptance fixtures.'])
h('Status and evidence labels')
table(['Label','Meaning'],[['SCI','Established physical relationship or biological mechanism supported by a cited source.'],['CODE','Observed in the local checkout on 29 October 2026; not proof of deployed behaviour.'],['ENG','A proposed, versioned product or engineering policy; not a crop optimum.'],['CAL','A parameter or model that requires empirical calibration and prospective validation.']], [0.16,0.84])
p('Research and code review can improve correctness; they cannot establish real-world predictive accuracy. This document is final as a design baseline. Deployment, entitlement, field fill rates, sensor calibration and live crop outcomes were not verified. No application implementation was changed by this review.')
p('Sources are linked at the point of use through reference IDs and collected in the evidence ledger. All newly proposed fields are explicitly separated from existing fields. Instructions embedded in the source PDF were treated as material to assess, not as authorization to implement or publish changes.')

page('01  Audit of the supplied specification', 'KEEP THE EVIDENCE-FIRST DESIGN; CLOSE THE IMPLEMENTATION GAPS')
p('The v3.1 physical premises are mostly sound. Its major weakness is incomplete operational definition: several thresholds, timestamps, field meanings and adapters remain unspecified. The following changes are normative in v4.0.')
table(['Finding in v3.1','v4.0 correction'],[
['Weather demand and roots are appropriately separated.','Keep this architecture. Add an explicit waterAction enum so unknown cannot become a false Boolean assurance.'],
['Many useful rules are deferred to future calibration.','Supply testable ENG pilot defaults, expiry, exact precedence and cold-start behaviour. No default is described as a cannabis water requirement.'],
['Two complete elevated-demand days may precede escalation.','Replace this with a same-day inspection policy for vulnerable setups and current hazards. Do not make a seedling wait through two hot days.'],
['Relative local quantiles can hide sustained seasonal demand.','Separate absolute estimated reference demand, local anomaly and method support. A winter upper quartile is not equal to a summer upper quartile.'],
['Wet-root veto and conflicts lack fully chronological resolution.','Resolve timing, depth and setup first. An older wet reading does not indefinitely veto a later credible dry reading.'],
['Missing coordinates can cause blanket abstention.','Disable location-based weather only. A valid root observation still supports a moisture decision without GPS.'],
['Moves are described as excluding previous-location history.','Segment the exposure path. A moved pot carries its water state and earlier exposure; it does not become newly full or historically unexposed.'],
['One forecasted flag is used for mixed weather fields.','Require provenance and valid time per variable/interval. Never turn a forecast into an observation because its date has passed.'],
['Rain probability can be mistaken for forecast confidence.','Keep occurrence probability separate from data reliability and amount uncertainty. No default rain_mm times probability storage credit.'],
['The future dry-time model assumes a one-way transition.','Define moisture episodes and handle watering/rain as interventions. Intermittent rewetting invalidates a single monotone dry-down likelihood.'],
['Schema examples in section 4.2 have broken enum table cells.','Replace with explicit typed contracts and proposed fields. Do not implement from the corrupted table.'],
['168 cases are specified, not run.','Retain them as a migration registry, reconcile revised expectations and add the v4 cases below. Report executed checks separately.']
],[0.39,0.61])
p('The original Hargreaves formula correctly includes the 0.408 conversion when extraterrestrial radiation is provided in MJ/m2/day. The reproduced value is 5.8884 mm/day for its example. No correction to that formula is warranted. [R02]')

page('02  Verified repository findings', 'LOCAL CODE EVIDENCE; PRIORITY BEFORE SHIPPING THE NEW ENGINE')
p('File paths below are relative to C:/Users/Zane/dev/WeedGrow. Line anchors refer to the reviewed checkout and may move. CODE findings concern source behaviour and synthetic inputs, not real stored records.')
table(['Priority / source','Observed behaviour and required correction'],[
['P0 - weatherMeasurements.ts:74,130-152','Current one-hour rain is stored in rainfall under a daily key. With current absent, daily[0] is marked forecasted=false. Separate current rate, interval accumulation and daily forecast.'],
['P0 - weatherMeasurements.ts:40-54,102-112','Future hourly forecast samples produce today nightHumidity, peakTemp and rainHours attached to a non-forecast record. Preserve hourly samples and provenance; separate actual history from upcoming conditions.'],
['P0 - weatherMeasurements.ts:80-85','Sunrise/sunset receive timezone_offset before ISO serialization with Z. Store the original Unix instant; apply IANA time zone only for presentation and day grouping.'],
['P0 - wateringEngine.ts:162,499,609-658','Two-day baseline is adjusted by stage/pot/sun/weather and clamped to one-four days; actual age, soil hydraulics and root observations do not govern it. Missing history becomes lookbackDays+1. Replace assumed dry-down with evidence and unknown.'],
['P0 - wateringEngine.ts:1118,1186-1200','Regional/recent rain suppresses watering and resets inferred elapsed water time. Forecast rain can postpone advice. No plant reception or retention is established. Remove these hydration assertions.'],
['P0 - rootRotAlgorithm.ts:84-187','Root-rot score consumes needsWater, rain, probability and correlated weather inputs; heavy rain is said to saturate roots. Separate drainage observations from disease scouting and remove circular evidence.'],
['P0 - plantCare.ts:26,43','UI can say Not due from a Boolean; same-day watering forces high confidence and needsWater=false. Render explicit state and time. Logged application cannot override later dry/wet observations.'],
['P1 - fetchWeather.ts:20; operations.ts:34','Both use One Call 3.0 and exclude alerts and minutely. The normalizer drops issue/valid times and raw hourly series. Add a versioned adapter and retain actionable hourly data; request alerts deliberately.'],
['P1 - refreshPlantWeather.ts; operations.ts','Six-hour outer caching can dominate the 30-minute network cache. Asking for yesterday still calls the current/forecast endpoint; no retrospective retrieval is present in these paths. Implement an explicit history product.'],
['P1 - plantSectionForm.ts; plantValidation.ts','Current height editing/validation uses cm. This resolves v3.1 uncertainty for current writes. Older data still need provenance; dated journal.heightCm is a different observation.'],
['P1 - plantAge.ts; logMeasurements.ts','startedOn yields calendar age; ageDays alone is returned as a recorded value. soilMoisture is a user-entered percent without method/depth calibration. Do not reinterpret either as biological root size or verified reserve.']
],[0.34,0.66])
p('Synthetic reproduction confirmed all four parser behaviours: 3 mm/h represented as daily rainfall; forecast RH 93% attached to today marked non-forecast; sunrise 03:00Z stored as 05:00Z at UTC+2; and a 38 mm daily forecast marked non-forecast without current conditions. Existing parser tests encode some mixed-field behaviour and must be updated with migration.')

page('03  Existing input coverage', 'WHAT THE APPLICATION CAN USE TODAY')
p('This crosswalk is the normative factor policy. Schema presence does not prove population. Fields with little causal information are retained for display/audit and must not acquire invented coefficients.')
table(['Existing input','Required use','Boundary'],[
['status, deleting, environment, owners','Eligibility and authorization before evaluation.','Only active outdoor plants; enforce access before aggregating logs or weather.'],
['growthStage; startedOn; ageDays/ageKnown/ageEstimated/ageRecordedAt','Developmental context and uncertainty; dated age reconstruction as below.','No automatic stage changes or fixed stage litres.'],
['height; journal.heightCm; trainingTags and training logs','Dated stature trend, recent canopy disturbance, measurement age.','Height is not leaf area. Tags without event time are historical context only.'],
['plantedIn, potSize','Separate pot and ground branches; parse explicit physical units.','No guessed litres for bare digits; no pot rule for ground.'],
['soilType, soilPh, environmentNotes','Medium provenance and chemical/physical context.','native/raised/store/custom is not texture, retention or measured drainage.'],
['sunlightExposure, permanentProtection, companionPlants','Reported shade, protection and possible competition context.','A net/cage/cover does not specify rain reception or wind at the canopy.'],
['location.*, locationMode/groupId, locationTimeZone, locationRevision, locationChangedAt, weatherHistoryBefore','Resolve effective location and path; join only applicable weather.','Display labels are not coordinates; device time zone is not the plant zone.'],
['PlantLog waterMl, type, calendarDay, timeZone, occurrencePrecision, timestamp, recordedAt, mutationId, editedAt','Reconcile real applied events and chronology.','Applied water is distinct from retained water. Feeding water must be counted once.'],
['soilMoisture, waterLevel, careCheck, inspectionResult, description','Qualified context; typed negative symptom check.','Uncalibrated percent and 0-1 waterLevel have no biological cutoff. no_symptoms is not future immunity.'],
['WeatherCacheEntry and group.currentWeather','Provenance-limited weather display during migration.','Legacy daily fields cannot reconstruct complete hourly exposure or on-site rain.'],
['sensorProfileId, manual sensor defaults','Source linkage and context only.','A profile or defaultTemp/defaultHumidity is not live telemetry.'],
['watering/feeding routines, reminderSchedule, snoozes/skips','Reminder and notification policy after biological evaluation.','Routine, skip, snooze and an app alert are not water-state measurements.'],
['strain/strainType, fertilizer, pH/nutrient logs, pests','User-confirmed context, symptom differential and scouts.','No strain-name ET/resistance coefficient or automatic feeding recommendation.'],
['name, photos/notes, harvest, audit/revision/summary fields','Display, user-authorized observations, lifecycle and cache correctness.','No image-based measurement without a separate validated pipeline; summaries and prior outputs are never labels.']
],[0.28,0.35,0.37])
p('The original appendix remains useful as a documentary inventory. Its grouped entries should not be treated as 168 independently observed physiological inputs. Derived WateringInsight and SuggestionCard fields are outputs only.')

page('04  Age, stage and plant size', 'DEVELOPMENTAL BASELINE WITHOUT FABRICATED WATER VOLUMES')
h('Age resolution - ENG')
bullets(['If ageKnown=false, return unknown age even when an old numeric value remains. A valid startedOn is the user-defined growing-start anchor, not automatically germination or transplant.', 'For startedOn, calculate the difference in local calendar dates in the plant IANA zone. For ageDays alone with a verified ageRecordedAt meaning, add elapsed local dates and retain estimated status. If the anchor meaning cannot be verified, report age as recorded, without silently incrementing it.', 'Store ageBasis for new records: sowing, emergence, cutting_taken, rooting, acquisition, estimated or unknown. Clone chronological age and rooted duration are separate.', 'Age affects cohort choice, confidence and requests to refresh stage/size. It cannot identify root occupancy or cause an unconfirmed stage transition. Never use account creation time as plant age.'])
table(['Recorded context','Moisture/inspection consequence','Independent scouting'],[
['germination','Represent the germination zone. No whole-container reserve or mature-root assumption.','Emergence/root establishment and adverse exposure; no direct-sun quota.'],
['seedling','Treat root extent as developing; observations must represent that active zone.','Same-day attention during a current hazard; root wetness and dryness are both relevant.'],
['clone','Rooting status unknown until supplied. Rooted cutting duration is more useful than days since cutting.','Root establishment and general foliage stress; do not treat an old cutting as a mature root system.'],
['vegetative','Canopy/root extent may change; use dated growth and observations.','General weather, pest and leaf inspection.'],
['flowering','Keep observation-based moisture logic; no automatic dry-down or late-flower dose reduction.','Flower-tissue scouting becomes eligible in addition to leaf scouting.'],
['recent transplant, repot or major pruning','Start a relevant setup/canopy revision; widen prediction uncertainty and request a check.','Stress inspection with event context, without attributing wilt to one cause.']
],[0.21,0.48,0.31])
h('Size features - SCI/CAL')
p('Current Plant.height is cm in the editor; journal.heightCm is dated. Add dated canopyWidthCm and canopyLengthCm when useful. An elliptical projected footprint is pi*width*length/4 after conversion to metres; this is a geometric descriptor, not leaf area or an automatic ET multiplier. Missing dimensions remain missing. A broad, trained plant can have more leaf area than a taller narrow plant. [R08]')
p('Plant-specific water use and response vary with genotype and setup. The two-cultivar greenhouse study and the South African field study do not establish one Kc for all users. Outdoor flowering must stay user-confirmed; cultivar photoperiod sensitivity varies. [R10] [R11] [R13]')

page('05  Root environment and soil', 'POTS, FIELD SOIL AND RAISED BEDS NEED DIFFERENT CONTEXT')
p('Soil water availability depends on physical structure, water-holding properties, rooting depth and the energy needed to extract water. Moisture content and matric potential describe different aspects. A generic user soil category cannot establish either. [R06]')
table(['Setup','Use now','Additional information that improves the model'],[
['Container','Physical volume, planting stage, recent checks and exposure. Unknown volume is valid missing data.','Filled volume, diameter/depth, material/porosity, drainage holes, saucer/reservoir, ground contact, root restriction, mix and recent repot.'],
['Native in-ground soil','Independent root-zone observations and local weather history. Ignore potSize even if old data contain it.','Texture by layer, compaction, depth/restriction, drainage behaviour, slope/run-on, mulch, irrigation wetted footprint and groundwater influence.'],
['Raised bed','Explicit bed or ground-connected container classification. Do not map soilType=raised automatically to a sealed pot.','Bed dimensions, bottom open/closed, shared roots, fill layers, native-soil connection and irrigation zones.'],
['Soilless/coco or engineered medium','Acknowledge different hydraulic/fertigation behaviour. Generic dry-to-touch soil rules are not a universal target.','Medium-specific calibrated observations, irrigation/reservoir configuration and EC context before numeric scheduling.'],
['Self-watering pot / roots escaping into ground','Flag an additional water source; observation/check policy remains usable.','Reservoir level and connection, wicking, capillary supply or roots outside the nominal container. A closed-pot balance is ineligible.']
],[0.22,0.35,0.43])
h('Interpretation requirements')
bullets(['Pot size sets geometry and possible buffering, while plant-accessible storage depends on roots, medium and wetting. Newly planted roots do not automatically access the whole pot.', 'Canopy interception, an overhanging roof, porous container walls, reflected heat, mulch and wind shelter are separate factors. Use reported facts as context or calibrated features, not guessed percentage corrections.', 'An observed drainage problem is more informative than assuming clay means saturated or sand means dry. Sandy/clayey labels alone cannot establish soil-specific field capacity.', 'A dry surface and moist deeper soil can coexist. The representative observation is conditional on rooting context, wetting pattern and depth. No universal 2 cm check represents every outdoor plant.', 'Dry media can wet unevenly; water running out does not demonstrate that the active root zone was rehydrated. Record wetting success or uncertainty. [R09]'])
p('The source appendix statement that applied water can update a reservoir is conditional: it may do so only inside an eligible calibrated model with explicit infiltration and loss assumptions. The qualitative release records the event and requests relevant observations; it does not invent a reservoir.')

page('06  New data that earns its place', 'PROGRESSIVE, OPTIONAL INPUTS; DO NOT EXPAND THE WHOLE ADD-PLANT FORM')
p('P0 additions remove ambiguities that currently prevent a reliable decision. P1/P2 additions improve measured models. Missing optional information never prevents logging a plant or obtaining a qualified check reminder.')
table(['Priority / proposed input','Contract and intended use'],[
['P0 - root observation','state = dry, slightly_dry, moist, wet, saturated or unsure; actual observation time/precision; method; active_root_zone, surface or unknown scope; optional depth/location; setup revision.'],
['P0 - rain reception','exposed, partial, sheltered or unknown, with effective time. This is exposure, not an infiltration or retention percentage.'],
['P0 - setup revision/events','Stable setupRevision; dated repot/transplant, medium/drainage changes and irrigation-source changes. Preserve revisions and corrections.'],
['P0 - weather envelopes','Provider/product/schema, source nature, issue/availability time if known, valid interval, aggregation and units for each series. See sections 8-10.'],
['P1 - root establishment / age basis','origin seed/cutting/unknown; rootingStatus unrooted/rooted/unknown; optional rootedAt/transplantedAt. Keep independent of growthStage.'],
['P1 - medium and drainage','substrateClass mineral_soil/peat_mix/coco/bark_mix/mixed/unknown; mineral texture separately; drainage free/slow/blocked/unknown and its observation time.'],
['P1 - irrigation outcome','Retained amount only if measured; runoff/drainage and wetting success separately; water source and event linkage.'],
['P1 - canopy and exposure','Dated width/length/height; optional direct-sun estimate, wind shelter, mulch, container material and local heat exposure. Record user estimates as estimates.'],
['P2 - pot weight','massGrams, resolution, instrument, post-drain status, fixtures, setup revision and time. Paired observations support whole-system mass loss.'],
['P2 - sensor calibration','Instrument/type, units, calibration method/version, valid range, medium, depth/position, uncertainty and valid dates. VWC, tension and arbitrary percent are distinct.'],
['P2 - ground layers','Measured thickness, representative VWC, field capacity, wilting point and active root depth/coverage. Needed for a quantitative ground balance.'],
['P2 - symptom check','Separate symptom kind, observed/absent/unsure, tissue, time and optional photo. User report is not a confirmed pathogen diagnosis.']
],[0.30,0.70])
h('One-tap observation flow - ENG')
p('Ask what was checked and how it felt: dry, slightly dry, moist, wet, saturated or unsure. Preserve a quick active-root-zone acknowledgement; allow surface-only or unsure. Time defaults to now only for a check being recorded now. Backdated checks require their actual time/precision. Method and scope can be selected once and reused as an explicitly user-confirmed preference.')
p('Store observations as bounded-query, plant-scoped events or a safely extended typed journal. Do not place an ever-growing array on Plant. New fields must round-trip through backup/export, offline queues, deletion, permissions and editing before release.')

page('07  Evidence, event time and movement', 'RECONSTRUCT WHAT WAS KNOWN AND WHAT THE PLANT EXPERIENCED')
h('Canonical evidence envelope - ENG')
code('''Evidence<T> = {
  id, revision, value: T | null, unit,
  sourceKind, provider?, product?, method?, sourceRef,
  validFrom?, validTo?, observedAt?, occurrencePrecision,
  issuedAt?, availableAt?, recordedAt?, fetchedAt?,
  coordinates?, coordinateRole?, locationEpoch?, setupRevision?,
  depthCm?, position?, rootScope?, calibrationId?,
  quality, uncertainty?, warnings[]
}''')
p('sourceKind must distinguish on_site_observation, user_report, calibrated_sensor, uncalibrated_sensor, provider_current_estimate, provider_history_estimate, forecast, manual_default and derived. quality is usable, qualified, stale, conflict, invalid or missing. A recently fetched estimate is not a fresh on-site measurement.')
h('Chronology')
bullets(['Use closed-open intervals [start,end). A date-only care event occupies its local calendar day; do not convert it to a known midnight action. At 07:00 on 29 October, watering sometime on 28 October is 7-31 hours old in a 24-hour-day zone.', 'For live decisions, never use future observations. For historical replay, require both occurrence/valid time and availability/revision time to be at or before asOf. A backdated record entered tomorrow was not known today.', 'Deduplicate by logical event/mutation identity within owner/plant scope, not calendar day or raw amount. Two real waterings on one day remain two. Superseded edits and tombstones invalidate derived checkpoints.', 'careSummary is an index to source events. Use it as a clearly limited fallback when the log is unavailable; do not add it as another event.', 'Water used for feeding is an irrigation input only when a carrier-water volume is recorded and linked to one applied event. nutrientMlPerL is concentration, not water volume.', 'Do not enforce arbitrary numeric maxima as biological rules. Reject malformed units/negative measurements; flag implausible but potentially valid large amounts for review.'])
h('Movement correction to v3.1')
p('A portable pot retains its physical water and roots when moved. Reconstruct its location path and split weather exposure at the move instant. Preserve earlier observations with time/setup relevance, widen demand uncertainty and evaluate new exposure from arrival. Do not apply old-site weather after arrival or reset storage/elapsed time. A planted-in-ground move usually implies transplant and a changed control volume, so retire the old ground calibration.')
p('If a garden pin is corrected rather than a plant physically moved, label locationChangeKind=pin_correction; do not invent a transplant. Unknown move time creates an exposure interval with uncertainty. Stable location IDs and provider cells are not interchangeable with plant-specific locationRevision numbers.')

page('08  Weather API contract', 'REPLACE A MIXED DAILY RECORD WITH TYPED SERIES')
p('The repository currently calls One Call 3.0. Its official contract distinguishes current rain rate, daily amount, probability, forecast hours and UTC instants. Historical timestamp and daily-aggregation responses have different shapes and need separate decoders. [R16]')
table(['Provider field / family','Adapter rule for WeedGrow'],[
['current.dt and current conditions','provider_current_estimate at one time; never a complete-day observation.'],
['current.rain.1h / hourly.rain.1h','Preserve documented mm/h semantics and interval metadata; do not store as a daily total.'],
['daily.rain; daily.pop','Daily mm and occurrence probability 0-1. Keep them separate.'],
['hourly[] / daily[]','Forecast series; daily[0] is not finalized observed today.'],
['temp/humidity/dew_point','Use matched hourly records for air VPD; daily summaries do not establish concurrent extrema.'],
['pressure; wind_speed/gust','Pressure is sea-level hPa in this contract; metric wind is m/s. Retain pressure role and wind-height uncertainty.'],
['sunrise/sunset; timezone','Unix UTC instants; IANA location zone for grouping/display. No offset added to the stored instant.']
],[0.33,0.67])
h('Normative canonical weather schema - ENG')
code('''WeatherSeries = {
  provider, product, schemaVersion, methodVersion?, requestId,
  requestedCoordinates, returnedCoordinates?, gridCellId?, elevationM?,
  timeZone, fetchedAt, issuedAt?, availabilityAt,
  nature: current_estimate | history_estimate | forecast | on_site,
  samples: [{variable, value, unit, validFrom, validTo?,
    aggregation: instant | mean | rate | interval_sum | min | max,
    timeLabel: start | end | instant, measurementHeightM?, quality}],
  completeness, responseWarnings[], rawReference
}''')
p('A point timestamp is not automatically one hour of experienced exposure. The product adapter must document whether the value is instantaneous, an hourly mean, an hourly rate or an interval sum. Preserve missing values per variable. Lack of UV must not discard valid temperature/humidity/rain.')
p('Reject mismatched array lengths, nonfinite values, impossible ranges and conflicting units per series. Do not silently clip invalid RH into a plausible value. Absent precipitation becomes an adapter-qualified zero only where the documented complete product encodes omission as no phenomenon; incomplete responses and missing intervals remain unknown.')
p('Treat old WeatherCacheEntry.forecasted=false as legacy mixed evidence, not proof of measured daily history. Recover raw responses where available; otherwise retain for display and qualified context. It cannot support a full-day accumulation, duration counter or exact VPD replay.')
p('Returned coordinates can echo a request rather than identify a station or cell centre. Retain coordinateRole and resolution if known; geographic matching does not prove on-site representativeness.')

page('09  Retrieval, caching and provider migration', 'FETCH ONCE PER RELEVANT LOCATION; EVALUATE EACH PLANT SEPARATELY')
h('Retrieval policy - ENG')
bullets(['Use a server-side weather gateway with credentials, request coalescing, quota/circuit-breaker controls and typed provider adapters. Do not expose a new paid provider key in a distributed client bundle.', 'Key fetches by provider/product, requested location or deliberate grid key, time range, variables/units and schema version. Share geographic weather requests; attach each plant exposure path and shelter afterwards.', 'Pilot active-site refresh: 30 minutes while the app is used or an enabled near-term hazard is being monitored; routine background context may be six-hourly with an explicit stale-live flag. Do not imply live monitoring where the scheduler cannot provide it.', 'Current estimate action freshness: two hours by valid time. Near-term forecast freshness: issued/received within three hours. When issue time is absent, disclose received-time proxy. Historic intervals do not become stale simply because they are old; completeness and revision provenance govern their use.', 'For missing history request the configured retrospective product. A current forecast fetch is not a substitute for yesterday. Backfill only required windows, record cost, and label history as provider estimates.', 'Handle 401/403 as configuration/entitlement errors, 429 with provider Retry-After and bounded retry, and 5xx/timeouts with bounded backoff. Never cache a failed response as zero rain or low demand.', 'Recheck plant/garden coordinates and authorization on commit so an in-flight request cannot attach old-location weather to a changed plant. Keep pending states out of the physiological decision.'])
h('OpenWeather 4.0 option')
p('OpenWeather recommends 4.0 for new integrations. Its migration guide separates current and timeline resources and changes response paths; hourly history can be retrieved through a timeline. This is a candidate infrastructure upgrade, not an agronomic accuracy guarantee. Use a dedicated 4.0 adapter, pagination/completeness checks, recorded response fixtures and an entitlement/cost review. Retain a 3.0 rollback during a deliberate migration. [R17] [R18]')
h('Hazards and capability decisions')
p('The local 3.0 calls exclude alerts. Enable official alert retrieval when weather hazards are in scope, with source, validity and location applicability. Preserve provider alert text as untrusted descriptive data; do not execute embedded instructions or derive precision from prose. Minute/15-minute resolution is optional for near-term event messaging and never proves rainfall at a specific pot.')
p('Persist issued forecast snapshots or auditable hashes/references within provider terms. A forecast stored yesterday remains a forecast today until replaced by a separately labelled retrospective or on-site source. One request per plant or a forced fetch on every card render is prohibited by this design.')

page('10  Getting the missing weather factors', 'RADIATION AND REFERENCE ET ARE THE HIGHEST-VALUE EXTENSIONS')
p('Preferred production path: retain a reliable basic weather/alert provider, then evaluate a complete reference-ET source in shadow mode. A validated local agrometeorological station is valuable where its surface, elevation and exposure are representative. Higher API resolution alone does not establish accuracy at a sheltered plant.')
table(['Candidate capability','What to request','How to use it'],[
['Provider-calculated grass ET0','ET0, method/reference surface, interval, issue time, model/source and units.','Preferred atmospheric-demand input after regional benchmarking. Do not use generic actual evapotranspiration or alfalfa ET without the appropriate distinction.'],
['Surface radiation','Shortwave radiation / daily energy, integration window and units.','Supports complete-weather ET calculations. Grid horizontal radiation does not measure shade at a balcony or light inside the canopy.'],
['Local pressure/elevation','Surface pressure, site elevation or an explicit atmospheric model.','Needed to obtain local psychrometric constant; sea-level pressure cannot be substituted unchanged at altitude.'],
['Wind-height metadata','Sustained wind with measurement/model height; gusts separately.','Convert the sustained input to the reference height where applicable. Gusts belong primarily to physical hazard context.'],
['Hourly histories and forecasts','Matched temperature/RH/dew point, rain type, wind and valid intervals.','Retain separate retrospective and issued-forecast streams. Enables duration and temporal alignment checks.'],
['Model soil water/temperature','Layer depth, model, units, cell and revision.','Optional regional ground context only. Never replace an on-site sensor or use a grid soil layer as pot moisture.'],
['Forecast spread / precipitation timing','Ensemble members/quantiles where available; explicit lead time.','Candidate uncertainty inputs after skill validation. Probability of occurrence is not a calibrated amount interval.']
],[0.26,0.35,0.39])
p('Open-Meteo is a practical evaluation candidate: its forecast documentation describes modelled FAO reference ET, solar radiation, surface pressure and labelled wind heights. ET assumes a well-watered grass reference; hourly radiation averages need their interval semantics. This adds meteorological coverage, not measured cannabis uptake. [R19]')
p('For deployment, verify commercial terms, provider availability, model coverage for the actual user regions and quotas. Do not assume a prototype endpoint is an entitled commercial backend. No provider subscription was changed in this review. [R21]')
h('Benchmarks before promotion - ENG/CAL')
bullets(['Compare provider ET and any locally computed ET with independent complete-weather reference data where available. Stratify humid coast, windy exposure, dry interior, highland, summer/winter and forecast lead time.', 'Use the same reference surface, time zone, accumulation interval and units. Document station representativeness and interpolation/elevation differences.', 'Measure bias, MAE, missingness and reliability by region and method. Fix a method per evaluated episode; a provider/method switch must create a visible discontinuity flag.', 'Do not interpret API soil water, canopy footprint or a modelled ET number as enough to enable litre advice. Root-zone/storage eligibility is a separate gate.'])

page('11  Weather mathematics', 'FORMULAS CHECKED; BIOLOGICAL INFERENCES REMAIN SEPARATE')
h('Air vapour-pressure deficit - SCI')
code('''es(T) = 0.6108 * exp(17.27*T/(T+237.3))       # kPa; T in C
VPDair = es(T) * (1 - RH/100)                # paired RH in %
# Alternatively: ea = es(Tdew); VPDair = es(Tair) - ea
exposure = sum(VPDair_i * coveredHours_i)    # kPa*h, not water
''')
p('Use simultaneous compatible air samples, not afternoon Tmax and nighttime RH. At 30 C/40% RH the result is 2.5458 kPa; at 22 C/75% RH it is 0.6610 kPa. Air VPD is not leaf-air VPD, and its time integral is not ET. Keep raw negative/inconsistent dew-point results flagged rather than hiding them with an absolute value. [R02]')
h('Reduced-data ET0 - SCI formula, CAL local performance')
code('''Tmean = (Tmax + Tmin) / 2
ET0_H = 0.0023*(Tmean+17.8)*sqrt(Tmax-Tmin)*(0.408*Ra_MJ)
# ET0_H in mm/day; Ra_MJ in MJ/m2/day
phi = latitude * pi/180; J = day of year
dr = 1 + 0.033*cos(2*pi*J/365)
deltaSolar = 0.409*sin(2*pi*J/365 - 1.39)
x = -tan(phi)*tan(deltaSolar)
ws = 0 if x >= 1 else pi if x <= -1 else acos(x)
Ra_MJ = (24*60/pi)*0.0820*dr * (
  ws*sin(phi)*sin(deltaSolar) + cos(phi)*cos(deltaSolar)*sin(ws))
''')
p('Use latitude/date and valid complete-day extrema. Hargreaves tends to underestimate in strong wind and overestimate in high humidity; compare it with complete-weather PM locally before action-driving use. Polar limits and leap-year day conventions need explicit tests. Ra is extraterrestrial energy, not incident solar radiation. [R02]')
callout('Verified original fixture: latitude -34 degrees, J=15, Tmin=18 C, Tmax=30 C gives Ra=43.3355 MJ/m2/day and ET0_H=5.8884 mm/day. This is reference atmospheric demand, not 5.89 L for a pot.')
h('Numerical validity - ENG')
p('Invalid Tmin>Tmax, nonfinite values, unreliable dates/coordinates and out-of-domain cold conditions return method_unavailable. Zero temperature range is a degenerate low-information Hargreaves input; do not infer a reliably zero-demand day. Hargreaves remains experimental by default. Do not reconstruct missing extrema from one current temperature.')
p('Conversion fixtures: 500 W/m2 averaged for one hour integrates to 1.8 MJ/m2; 5 m/s is 18 km/h. Rate and interval-sum rain must be handled with their own time semantics. One millimetre across one square metre is one litre as geometry, not a statement of plant uptake.')

page('12  Complete-weather reference ET', 'USE AN AUDITED CALCULATION PIPELINE OR A DOCUMENTED PROVIDER RESULT')
p('Reference ET0 describes potential loss from a standardized, well-watered grass surface. Actual crop/system ET additionally depends on canopy, rooting, water supply and surface conditions. The FAO daily Penman-Monteith expression is: [R01]')
code('''ET0 = [0.408*D*(Rn-G) + gamma*(900/(T+273))*u2*(es-ea)]
      / [D + gamma*(1 + 0.34*u2)]
# ET0 mm/day; Rn,G MJ/m2/day; T C; u2 m/s at 2 m
# es,ea kPa; D and gamma kPa/C
''')
p('Use consistent daily inputs. Temperature, humidity, radiation and wind must represent the same location/date and reference calculation. Daily wind is a time mean, not gust or daily maximum. Monthly or daily constants must not be reused for an hourly implementation. [R03]')
h('Required complete pipeline')
table(['Step','Implementation requirement'],[
['Thermodynamics','Derive saturation-pressure slope and daily vapour pressures with the selected published procedure. Daily saturation pressure uses extrema; averaging VPD from a few unmatched periods is not a substitute.'],
['Pressure','Use local surface pressure in kPa or document an elevation-based estimate. gamma=0.000665*P_kPa. 1013 hPa is 101.3 kPa; at 1700 m standard-atmosphere pressure is about 82.75 kPa.'],
['Wind','Use u2 or documented height conversion u2=uz*4.87/ln(67.8*z-5.42). z is metres above ground. Preserve raw/calculation values and any reference-method low-wind convention.'],
['Radiation','Use actual/modelled shortwave energy with a named net-shortwave/net-longwave algorithm, vapour pressure, elevation and clear-sky checks. UV and cloud fraction alone are not Rn.'],
['Ground heat','Daily G=0 is a disclosed daily-reference approximation where applicable. Hourly/night calculations need the selected hourly method.'],
['Method trace','Record all assumptions, missing-data methods, units, reference surface and software/method version. A result with estimated inputs remains an estimate.']
],[0.22,0.78])
p('The local-pressure and height conversions above follow the practical FAO-56 calculation guide. [R05] Do not quietly assume that a sea-level pressure field is local pressure or that undocumented provider wind was measured at 2 m.')
h('Implementation choice - ENG')
p('Release preference is provider-supplied documented grass ET0 with regional checks. If computing PM locally, implement a maintained, verified full radiation/thermodynamic pipeline and compare every helper against published examples before promotion. This spec does not authorize an improvised Rn = UV or cloud multiplier. Preserve the signed raw result; a nonnegative demand projection must not credit condensation as root irrigation.')
p('Published arithmetic check: FAO Example 17 rounded inputs T=30.2 C, Rn=14.33, G=0.14, D=0.246, gamma=0.0674, u2=2 and vapour deficit=1.57 produce 5.7134 mm/day, consistent with the published 5.7. This is an equation check, not a daily forecast validation. [R03]')

page('13  Time windows, coverage and demand', 'DO NOT TURN MISSING HOURS INTO QUIET WEATHER')
h('Canonical time windows - ENG')
bullets(['Store UTC instants without shifting. Convert into the plant IANA zone when constructing local days. Local days can be 23, 24 or 25 hours; elapsed exposure uses actual duration.', 'Store point values separately from interval means/sums. Pilot integration of hourly point weather may use trapezoids only between valid neighbouring samples at most 90 minutes apart, with an interpolation flag. An isolated current sample supports a current description, not hours of exposure.', 'For overnight features use sunset to the following sunrise where available, split across the two local dates as needed. A 20:00-07:00 fallback must be labelled clock_night; it is not astronomical night.', 'Deduplicate overlapping precipitation intervals and prefer a documented complete series/product. Hourly rain and its daily aggregate are alternative estimates, never additive inputs. Daily totals cannot be split uniformly into exact event times.', 'Separate completed retrospective windows, current partial windows and future windows. Show coverage fractions and the actual interval for every duration or accumulated feature.'])
table(['Derived feature','Gate / pilot rule'],[
['Current paired VPD','Usable current pair with compatible source/time. Display as instantaneous air demand.'],
['24-hour mean/integral','At least 80% valid duration and no unsupported gap over three hours for a qualified summary. No extrapolation to a full-day total from the partial sum.'],
['Rain total used as complete history','100% non-overlapping documented interval coverage or a provider complete-period aggregate. Otherwise report a partial amount/lower bound and missing duration.'],
['Consecutive hourly/night counter','A gap interrupts knowledge of the run. It does not add a zero or make non-adjacent days consecutive.'],
['ET0 choice','Documented regional-supported provider/complete-weather PM first; experimental Hargreaves only with its flag; paired VPD as air-only fallback. No compatible data gives unknown.']
],[0.31,0.69])
h('Demand labels - ENG pilot, not crop stress thresholds')
p('For a complete comparable 24-hour grass ET0 estimate, provisional low is below 2 mm, moderate 2 to below 5 mm, and elevated at least 5 mm. Retain value, method, source nature and uncertainty. Use rolling 24-hour windows for these bands; a 23/25-hour local-day estimate keeps its actual interval without silent rescaling. Partial-day totals are ineligible. A forecast label is projected demand, not past exposure.')
p('When ET0 is unavailable, a current paired air VPD at least 2 kPa may mark airDemand=elevated for a check prompt; lower VPD is reported descriptively, with dryingPressure=unknown. Air VPD alone cannot establish low total evaporation. Threshold 2 kPa is an ENG screen, not a validated cannabis target. Never add points for T, RH, VPD, wind and UV on top of the same ET estimate.')
p('Optional local anomaly uses a fixed-version seasonal reference and reports sample count/period. It does not replace absolute demand or create extra biological points. Cold start does not require waiting for enough percentile history to offer a routine check.')

page('14  Rain, effective water and forecasts', 'KEEP EXPOSURE, INFILTRATION AND STORAGE DISTINCT')
code('''provider rain -> rain reaching the planting area -> infiltration
              -> root-zone retention -> plant-accessible water
# Each arrow has its own measurement/assumption and uncertainty.
''')
p('A rain gauge near the plant improves knowledge of rainfall, but not automatically infiltration. An exposed pot can receive less through canopy interception or more through run-on; sheltered is not necessarily zero if wind-blown rain or runoff can enter. Store rainReception as a reported exposure class, not a guessed efficiency.')
h('Qualitative release - ENG')
bullets(['Keep reported rain as environmental context. Never reset daysSinceAppliedWater, assert saturated roots, or tell the grower to skip watering from a regional mm threshold alone.', 'A substantial observed/provider-estimated event plus plausible reception may prompt a post-event root check. Credit no numeric retained amount until a calibrated model is eligible.', 'A credible dry observation that predates actual watering or a plausible intervening rain event becomes historical/uncertain; request a new check. A future forecast does not invalidate current dryness.', 'Snowfall, frozen soil and thaw are distinct states. A snow water-equivalent value is not immediate liquid infiltration. Do not pass snow through as today root-water refill.', 'Keep rain occurrence probability, forecast amount, forecast issue age, amount uncertainty and provider quality separate. Do not call a 90% rain probability 90% confidence in the amount.', 'Do not multiply deterministic provider rain by pop by default. Some amounts already represent a model/ensemble summary; multiplying can discount twice. Only a provider-defined conditional-amount model permits that explicit expectation.'])
h('Future quantitative rain geometry - CAL')
p('For a measured open area A in m2 and incident rain P in mm, incident volume is P*A litres. Example: 10 mm over a circular 20 cm diameter opening is approximately 0.314 L. Container nominal volume does not supply opening area, effective catchment or retained water. A projected canopy area is also not automatically the contributing root catchment.')
h('Forecast scheduling')
p('With a recent relevant moist check, a credible near-term forecast may support waiting until a named recheck time before deciding about irrigation. It does not create a no-water guarantee or delay the latest check deadline. If roots are dry, conflicting or unknown, precipitation probability cannot suppress a warranted current check.')
p('Show optional wording such as Rain may arrive this afternoon; check moisture before deciding to irrigate. Avoid Delay watering because the forecast is 90%. If ensemble scenarios are later used, simulate each future water path separately without altering current storage, and validate any rain-aware scheduling benefit against a no-forecast baseline.')

page('15  Resolve the root evidence first', 'TIME, DEPTH AND RELEVANCE PRECEDE A WET-ROOT VETO')
h('Qualifying an observation - ENG')
p('An observation is relevant when it belongs to the authorized plant/current physical setup, has a credible occurrence time and method, and represents the active root zone or explicitly acknowledges uncertainty. A direct user check can qualify without a sensor. A sensor needs medium/instrument interpretation; an uncalibrated percentage cannot become a dry/wet classification.')
p('Retain two concepts: lastRootObservation (a historical fact) and currentMoistureFinding (the present evidence interpretation). Expiry changes the latter; it does not erase the former or prove the opposite state.')
table(['Resolver order','Required behaviour'],[
['1. Select relevant episode','Ignore future or wrong-plant/setup records; apply corrections and deduplication. Surface-only observations support a targeted recheck, not a whole-root conclusion.'],
['2. Establish event order','A later relevant reading after a real intervention supersedes the earlier state. If date-only intervals overlap, preserve ambiguous ordering instead of selecting a fabricated latest instant.'],
['3. Check compatibility','Different depths/positions may describe true variation. Mark depth_variation; do not average ordinal states or incompatible sensor units.'],
['4. Resolve conflict','Comparable contemporaneous evidence with irreconcilable states yields conflict. Do not always prefer a user report or always prefer a sensor without quality/relevance comparison.'],
['5. Apply currentness','Pilot user/manual state interpretation expires after two hours; continuous calibrated sensor state expires after 15 minutes without an update. These are conservative interface validity settings, not known dry-down times.'],
['6. Invalidate currentness on events','Watering, verified received rain, repot/transplant, a sensor move or a material setup change after the reading requests re-evaluation. Regional rain with plausible exposure creates uncertainty/recheck, not a replacement wet finding.'],
['7. Preserve historical context','After expiry show the last state/time as history, then use the check-deadline policy. An old moist/wet report is never displayed as current safety.']
],[0.28,0.72])
h('Present action precedence')
bullets(['Conflict or unresolved depth relevance: request a targeted check; withhold a definite irrigation conclusion.', 'Fresh credible saturated active roots: drainage/aeration inspection; withhold more-water advice. Wet ordinary post-watering roots can warrant observation without diagnosing waterlogging.', 'Fresh credible dry active roots: waterAction=conditional_water; advise acting only if the current relevant check still confirms dryness. No fixed volume.', 'Fresh slightly_dry: targeted recheck with method/setup context. It is not a universal irrigation threshold, especially across different media.', 'Fresh moist: checked_ok as a dated finding, with a future check deadline. Weather can add an exposure scout but cannot overwrite this with a definite water instruction.'])
p('Example: a wet reading at 08:00 and credible dry reading at the same root scope at 16:00 can both be true. The later finding governs, with an unusual-change flag if warranted. A stale wet reading does not override dryness forever. Wilted foliage alone cannot select drought versus root oxygen, salt, heat or damage.')

page('16  A usable inspection baseline', 'DETERMINISTIC PILOT RULESET inspection-4.0-pilot1')
p('These settings schedule observations, not water applications. They replace the legacy two-day watering baseline and v3.1 two-elevated-day wait. Users can select a reminder routine; the engine preserves the distinction between that routine and an evidence-triggered inspection.')
table(['Parameter','Pilot value / semantics'],[
['vulnerableSetup','Any germination/seedling/clone stage; unrooted status; known pot <=5 L; or a major root/setup change within seven days. Unknown size alone is not small. Rooted is not automatically fully established.'],
['Routine check cadence','12 hours for vulnerableSetup, 24 hours otherwise. This is an ENG reminder frequency, not an experimentally valid irrigation interval.'],
['Anchor','Last meaningful root observation with known scope, even after present-state expiry. An unsure/surface-only value requests an initial relevant check. Watering and forecast rain do not reset the anchor.'],
['No relevant check ever','Request an initial check today. Do not assume dry or wet and do not invent a days-since value.'],
['Elevated demand adjustment','For unknown/outdated roots, shorten the next requested check to within four hours for vulnerableSetup or 12 hours otherwise. Use a supported current/past demand signal or label forecast-driven planning explicitly.'],
['Current material hazard','A current heat, cold, damaging-wind or standing-water concern can request inspection now; it never directly commands watering.'],
['Fresh moist observation','No immediate water action; retain the routine deadline, shorten a future deadline for exposure if appropriate, and disclose the two-hour state expiry.'],
['Fresh dry/conflict/root-saturated','Inspection/action today as specified in section 15; evidence overrides reminder timing.'],
['Notification delivery','One unresolved root-check push per plant per 24 hours by default. New independently observed dry/saturated states or materially escalated official hazards may bypass cooldown, subject to user notification settings.']
],[0.30,0.70])
code('''anchor = lastRelevantCheckTimeOrInterval
due = anchor ? anchor + cadence : asOf
if unknownOrOutdatedRoot && supportedElevatedDemand:
    due = min(due, asOf + (vulnerableSetup ? 4h : 12h))
if currentMaterialHazard || freshDryOrConflictOrSaturation:
    due = asOf
# Do not move an unresolved deadline later at each refresh.
priority = today if due <= endOfPlantLocalDay
           else soon if due <= asOf+24h else normal
''')
p('For a date-only anchor, derive a due-time range. Use the earliest plausible due time for an inspection reminder and show timing uncertainty; do not choose a false exact hour. An expired unresolved deadline remains due until a relevant observation or explicit delivery preference resolves it.')
p('If weather is missing, root evidence and routine checks still work with demand=unknown. Missing GPS disables weather joins only. An ineligible plant suppresses all outdoor recommendations. No-weather or low-support advice is never titled Watering on track.')

page('17  Independent scouting and weather hazards', 'NO PATHOGEN DIAGNOSIS OR FALSE LOW-RISK STATE')
p('Powdery mildew can occur without free leaf water, while gray mold and other flower issues have different exposure pathways. The hemp disease guide supports scouting these separately. Station/grid conditions do not establish infection, local inoculum or internal flower wetness. [R14]')
table(['Module','Required logic','Output'],[
['Powdery mildew','Use reported symptoms/history and coherent favourable-weather episodes. Rain is not a monotone risk multiplier; wind does not guarantee protection.','Leaf scout with exposure support or unknown. Do not infer absence from hot/dry station weather.'],
['Flower / Botrytis','Flowering enables targeted flower inspection during damp/humid/rain exposure. Include dew/fog possibility and tissue/wound reports.','Flower-tissue scout, not a diagnosis or infection probability. No fixed ambient-to-flower RH offset.'],
['Root aeration/drainage','Use active-root saturation, repeated wet evidence, pooling or failed drainage. Weather-only rain prompts a check but does not establish waterlogging.','Drainage/aeration concern. Do not call ordinary post-irrigation moisture root rot.'],
['Heat/cold/wind/storm','Use valid current/forecast hazards and official alert applicability, with shelter and stage context. Gusts and sustained wind are distinct.','Inspect/prepare for the specified event. Never prescribe water because air is hot.'],
['Pests, chemistry and injury','Keep reported history, recent inspections, pH/EC sample type and symptoms separate.','Targeted observation or differential context. No automatic diagnosis, pesticide or fertilizer prescription.']
],[0.22,0.49,0.29])
h('Testable exposure screens - ENG pilot, disabled unless configured')
p('A configured pilot may count matched hours at RH>=85% and 15-28 C during one night for a mildew scout, or RH>=90% / observed dampness during flowering for a flower scout. Require at least four qualifying covered hours and 80% window coverage; show exposure support and missing microclimate. These deliberately explicit candidate screens are not validated infection models or universal pathogen limits. If disabled, use manual/history scouting and label weather susceptibility unassessed.')
p('Pilot heat screen: air>=32 C; near-freezing screen: air<=2 C; strong-gust screen: gust>=15 m/s. Current events or forecasts in the next six hours warrant an event check/preparation prompt. These ENG attention screens do not predict tissue temperature, damage or cultivar tolerance. Prefer an applicable official warning when available; no returned warning does not prove no hazard.')
p('For a dew-proximity screen use paired Tair-Tdew between 0 and 2 C, with consistency checks; do not use abs(Tair-Tdew) to disguise an impossible pair. This flags condensation potential only. Leaves may cool below air temperature. Near-freezing air can warrant a frost scout without claiming frost was measured.')
p('The greenhouse inflorescence study measured a distinct flower microclimate; its observed offset cannot be generalized to an outdoor pot. [R15] A dated no_symptoms report states only what was seen then. Group equivalent weather notifications, while retaining each plant moisture state and independent scout reason codes.')

page('18  Outputs and interface semantics', 'AN EXPLICIT ACTION CONTRACT PREVENTS A MISLEADING BOOLEAN')
code('''OutdoorDecision = {
  algorithmVersion: "4.0", policyVersion, asOf, plantId,
  inputFingerprint, setupRevision, locationPathRevision,
  eligibility: active | inactive | unsupported,
  moistureFinding: checked_ok | possible_dry | possible_wet |
     depth_variation | conflict | check | unknown,
  waterAction: none | inspect_first | conditional_water | withhold_pending_check,
  inspectionPriority: today | soon | normal | unknown,
  nextCheckDueAt?, nextCheckDueRange?, lastRootObservation?,
  weatherDemand: {method, value?, unit?, interval?, nature,
     dryingPressure, airDemand?, coverage, evidenceSupport},
  hazardScouts: [{kind, priority, screenVersion, evidenceRefs,
     missingData, exposureWindow, sourceNature}],
  reasonCodes[], evidenceRefs[], warnings[], suppressed[],
  evidenceSupport: strong | qualified | limited | insufficient,
  validUntil, deliveryState
}''')
p('Support describes evidence for the particular claim. Missing weather does not erase strong root evidence; abundant weather does not create strong root evidence. Never present a support tier as measured predictive accuracy. validUntil is the earliest relevant evidence expiry, next evaluation requirement or policy boundary, not a hydration guarantee.')
table(['Condition','User-facing meaning'],[
['Fresh moist','You checked the root zone at 09:00 and reported it moist. Next check due this evening.'],
['Unknown roots + elevated weather','Drying conditions are elevated. Check near the active roots before deciding whether to water.'],
['Fresh credible dry','You reported dry conditions near active roots. If still dry on the current check, water appropriately for this setup.'],
['Wet/saturated','The root zone was reported very wet. Check drainage and current moisture before adding water.'],
['Different depths','Surface and deeper readings differ. Check the area the roots are using.'],
['Weather unavailable','Weather data are unavailable. Record a root-zone check; your reminder remains available.'],
['Rain forecast','Rain is forecast for this interval; it has not been counted as water received.'],
['Scouting','These conditions warrant inspection for symptoms. Disease presence is unconfirmed.']
],[0.28,0.72])
p('Stable codes include ROOT_DRY_REPORTED, ROOT_MOIST_REPORTED, ROOT_DEPTH_VARIATION, ROOT_CONFLICT, ROOT_CHECK_OUTDATED, RAIN_RECEPTION_UNKNOWN, WEATHER_PARTIAL, WEATHER_FORECAST_ONLY, WEATHER_METHOD_CHANGED, SETUP_CHANGED and LOCATION_PATH_PARTIAL. Sort reason codes/evidence references for deterministic output.')
p('Remove numeric dryness gauges and exact safe-until countdowns. If a legacy needsWater field is unavoidable during migration, it cannot express all states: use a new adapter contract and update every consumer. Mapping unknown to false without an explicit unknown UI is prohibited.')

page('19  A baseline that can improve', 'PERSONALIZE CHECK TIMING BEFORE PREDICTING A WATER DOSE')
h('Cold start versus learned baseline')
p('Cold start uses the deterministic inspection cadence with explicit unknown moisture. The learned baseline is a distribution of time/exposure to a relevant dry observation under a stable setup. It is conditioned on planting branch, broad development, observed canopy, medium/drainage and climate where supported. There is no universal outdoor two-day physiological baseline.')
bullets(['Keep actual age with its basis and uncertainty as a candidate predictor. Use stage and root establishment separately. Size measurements need dates; missing size is a missing feature, not a zero-size plant.', 'Treat pot volume, root status and canopy together as candidate contextual features. Do not force monotonic longer dry-down with bigger pots when canopy/root occupancy differs.', 'Start with cohort shrinkage and a simple, auditable model. A plant without enough independent observations inherits an uncertainty-aware prior only if that prior has been validated; otherwise retain the ENG check policy.', 'Prefer predicting a useful inspection window or expected whole-system mass loss, not a generic water-needs score. Compare any extra feature with a simpler baseline before adding complexity.', 'Strain marketing names, sativa/indica labels and user routines are not substitutes for measured plant/setup response. pH, feed concentration, pest reports and pruning can identify change or diagnostic uncertainty without being given arbitrary ET coefficients.'])
h('Correct dry-down episode definition - CAL')
p('Define an episode after a known relevant moist state under a stable setup. A first later dry state interval-censors transition time between last observed moist and first observed dry. A watering/rain rewetting event can end or interrupt the episode; it does not provide a dry label or a known new moist start. Require a new observed moisture anchor or use an explicit multistate/intervention model.')
code('''h(t | history) = sigmoid(beta0 + beta1*elapsedTime
     + beta2*cumulativeComparableDemand + setup/stage/size features)
S(t) = product(1 - h_k)
P(a < Tdry <= b) = S(a) - S(b)   # only a compatible monotone episode
''')
p('If rewetting could have occurred between checks, this likelihood is not automatically valid: moisture can return to moist and dry again. Unknown interventions require exclusion, censoring or a documented observation/intervention model. Treat watering-triggered censoring as potentially informative and report the bias; do not assert it is random censoring.')
h('Change and drift')
p('A repot, medium/drainage change, instrument change, major canopy change or transplant invalidates affected learned parameters. A moved pot retains water history while exposure coefficients may no longer transfer. Ordinary stage progression/age growth can trigger reweighting and uncertainty expansion instead of deleting all past facts. Detect out-of-range weather, sizes and growing systems and fall back to check prompts.')
p('Do not condition only on the latest weather reading: cumulative actual exposure since the relevant anchor matters. Rainfall affects both wetting uncertainty and episode definition. Save the model version, training window, supported setup range, calibration date and prospective error statistics.')

page('20  Optional calibrated container model', 'WHOLE-SYSTEM LOSS FIRST; DOSE ONLY WITH A MEASURED TARGET')
p('Paired post-drain pot masses can support container-system water accounting. This measures a combined system, including substrate evaporation, and needs consistent fixtures/conditions. It is not a direct transpiration measurement. [R08]')
code('''Loss_g = Mstart - Mend + I_g + R_g - D_g - Q_g + deltaM_nonwater
# All fluxes use the same interval and control volume.
# D=measured drainage, Q=other measured liquid outflow.
# If M includes drainage outside the pot, define a different control volume.
''')
p('deltaM_nonwater is net biomass/medium/fixture gain (negative for removed material). The sign is positive because biomass gain can mask water loss. About one gram water is one millilitre near room temperature; preserve uncertainty from density, scale resolution and sampling.')
table(['Eligibility','Required condition'],[
['Observation protocol','Repeatable mass with known resolution, setup and drain state; no untracked wet leaves, fixture changes or pot/ground water connections.'],
['Flux accounting','Rain/irrigation/drainage known or demonstrably absent. Unknown inputs make precise interval loss unidentifiable; do not fit unexplained mass change as transpiration.'],
['Biomass and handling','Growth/pruning/harvest/medium changes considered. Major unmeasured changes exclude the interval.'],
['Loss model','Simple nonnegative, regularized prediction from comparable ET exposure and elapsed time, with stage/canopy/setup drift and plant/cohort shrinkage.'],
['Prediction interval','Held-out prospective coverage demonstrated within the supported domain. No normal-looking confidence percentage fabricated from log count.'],
['Moisture target','A personally calibrated, root-relevant target mass range with acceptable aeration and repeatable wetting; total pot mass is not itself available water.']
],[0.25,0.75])
code('''predictedLoss = betaPlant * comparableDemand + bPlant * elapsedDays
# Candidate empirical system model, not a generic Kc formula.
netRefill_mL = max(0, Mtarget - Mnow) / waterDensity_g_per_mL
grossLow = netRefillLow / retentionHigh
grossHigh = netRefillHigh / retentionLow
# Require 0 < retentionLow <= retentionHigh <= 1; otherwise no dose.
''')
p('The refill expression is eligible only when the target, present mass and retention fraction are characterized. Do not add a second drainage allowance if retained input is already used; report a range and wetting/drainage assumptions. No universal target percentage, forced wilting calibration or default efficiency is specified.')
p('Examples: 6200 g to 5850 g with no inflow/outflow and negligible nonwater change is about 350 g loss. With Mstart=6200, Mend=6000, irrigation=500, drainage=100 and biomass gain=20 g, loss is 620 g. Neither example identifies a universal next-day irrigation dose. A learned loss forecast alone cannot graduate to a retained-water recommendation.')

page('21  Optional calibrated ground model', 'LAYERED ROOT-ZONE BALANCE; NEVER SUBSTITUTE POT VOLUME')
p('For measured soil layers, root depth and soil-specific field capacity/wilting point, total available water and depletion can be represented in millimetres. Soil-water stress affects crop transpiration separately from surface evaporation. The depletion fraction is crop/demand dependent and must not default to an untested cannabis value. [R04]')
code('''TAW_mm = sum_j(1000 * (thetaFC_j-thetaWP_j) * layerThicknessM_j)
DrRaw_mm = sum_j(1000 * (thetaFC_j-thetaNow_j) * layerThicknessM_j)
RAW_mm = calibrated_p * TAW_mm

Dr_next = Dr_prev - (P_runonAdjusted - runoff) - Inet - CR + ETc + DP
# consistent root-zone footprint, layer depths and time step
# If P is already infiltrated, do not subtract runoff a second time.
''')
p('The same active root control volume must apply to all terms. Inet is infiltrated irrigation, CR capillary rise, DP deep percolation below the active zone. ETc requires a validated crop/system relationship or measured loss; potential ET0 alone does not close the balance. Do not assume absent groundwater, run-on, mulch, competing roots or drainage without recording the assumption.')
h('Measured observations and bookkeeping')
bullets(['Keep raw layer observations and DrRaw even if they imply above-field-capacity or below-wilting-point conditions. Conventional FAO depletion bookkeeping is bounded to its defined available-water range; saturation/excess, sensor uncertainty and unmet-demand residuals belong in separate state variables.', 'An above-field-capacity reading is not a negative irrigation requirement. A saturated profile requires drainage/aeration context, not a claim that all excess water is plant-available.', 'New root depth exposes additional soil storage. Include measured/estimated initial water in newly included layers and its uncertainty; do not create free water or assume that layer starts empty.', 'Layer averaging is appropriate only for compatible calibrated quantities with documented thickness/representativeness weights. Do not average unrelated ordinal dry/wet reports or isolated percent sensor scales.', 'Texture/field capacity/wilting point tables are potential priors for a research model, not verified soil properties. The current soilType enum cannot initialize a validated water balance.'])
h('Unit and area discipline')
p('Example: thetaFC=0.30, thetaWP=0.15 and depth=0.40 m give TAW=60 mm. thetaNow=0.225 gives DrRaw=30 mm. If previous Dr=30, infiltrated rain=8, Inet=10, ETc=5 and other fluxes=0, the next depletion is 17 mm. These are arithmetic examples, not cannabis thresholds.')
p('A future net refill depth may be max(0,Dr-currentTargetDepletion). Volume is refill depth times the characterized wetted/root-zone area in litres; application efficiency and distribution uniformity need their own measured treatment. A guessed canopy radius or planting density cannot justify per-plant litres for sparse outdoor plants.')

page('22  Architecture and migration work', 'PURE CORE, VERSIONED ADAPTERS AND A COMPLETE UI UPDATE')
code('''Authorized snapshot + event revisions + weather envelopes
   -> normalize / reconcile / reconstruct location and setup path
   -> root resolver + development context + weather features
   -> moisture decision and separate scouts
   -> decision envelope -> presentation / notification policy
   -> independent observations -> evaluation / optional calibration
''')
h('Implementation sequence - ENG')
table(['Phase','Concrete work and acceptance'],[
['P0 - provenance','Create variable/interval weather adapters; fix four reproduced parser defects. Preserve UTC instants. Add retrospective retrieval and quality-aware legacy handling.'],
['P0 - observations','Add optional typed root observation and setup/rain-reception facts. Extend storage/security/indexes/offline/backup contracts together.'],
['P0 - moisture core','Replace thresholdDays and rain-reset logic with the explicit state/action/deadline contract. Use a frozen asOf and stable input revisions; no Firestore/HTTP inside the pure engine.'],
['P0 - every consumer','Update wateringAlgorithm, rootRotAlgorithm, card types, plantCare status/presentation and notification paths. Remove high confidence inferred from weather count or same-day watering.'],
['P1 - weather demand','Retain raw hourly provenance and completed windows. Compute paired VPD; evaluate complete reference ET/radiation provider in shadow mode. Hargreaves stays experimental.'],
['P1 - independent scouts','Add flower-tissue/weather/drainage kinds. Replace rootRot diagnosis wording, circular dependencies and unsupported high/very-high mildew claims.'],
['P1 - bounded data access','Use recent-window queries plus source-event checkpoints. Invalidate checkpoints on late edits/deletes. Share weather fetches by geography; never share plant root state.'],
['P2 - outcomes','Collect independently scheduled observations, missingness and user actions separately. Establish cohort/plant validation and model promotion gates.']
],[0.25,0.75])
p('Recommended module boundaries: domain/evidence, domain/development, domain/weather, domain/moisture, domain/scouts, infrastructure/providers, infrastructure/events, adapters/presentation and evaluation. Respect current repository architecture; these are logical responsibilities, not a demand to reorganize unrelated code.')
p('Feature flags: outdoorEvidenceEngine, rootObservationInput, outdoorWeatherDemand, outdoorScouts, dryDownLearning, numericPotModel and numericGroundModel. Shadow evaluation sends no new care notifications. A rollback retains source observations and schema compatibility; it must not silently re-enable known misleading hydration claims in the UI.')
p('Decision cache key includes input revisions/fingerprint, algorithm/policy version, asOf bucket/validity, location-path and setup revisions, weather method/issue version. Expire on the earliest material boundary. Derived decisions never enter the observation pipeline or training labels.')

page('23  Operational correctness and delivery', 'CONSISTENT DECISIONS ACROSS OFFLINE, GROUPED AND SHARED PLANTS')
bullets(['Perform authorization and lifecycle filtering before evaluation, and again before sending a notification. A queued alert for a now-harvested, deleted or inaccessible plant must not be delivered.', 'One logical event has a stable client mutation ID; corrected versions and deletion tombstones remain replayable. A source event edit causes recomputation from the earliest affected checkpoint.', 'No network dependency is allowed to erase a usable root finding. Weather errors annotate that component; unavailable root evidence annotates that component. Unknown should propagate only where the missing field is required.', 'Rate-limit delivery, not evidence evaluation. New meaningful evidence updates the decision immediately. A cooldown cannot keep a stale checked_ok state visible after a dry report.', 'Deduplicate equivalent weather hazards at the garden/user level. A garden alert must not become Water all plants, and a check on one plant cannot certify the group.', 'A snooze/skip/routine changes delivery or a preference. It never changes actual root state, resets water history or supplies a negative training label.', 'A fresh observation after a reminder resolves the request only if it addresses the intended scope. An unsure or surface-only answer should not falsely certify deeper roots.', 'Preserve logs during offline use and show weather issue/update age. Later-synced observations use occurrence time for physiology and availability time for honest historical evaluation.', 'Respect user notification switches, quiet hours and locale. Explain background monitoring limitations instead of presenting guaranteed real-time crop protection.', 'Use only necessary location precision in evaluation/analytics. Keep private notes/photos out of centralized model features by default; support authorized retention and derivative deletion.'])
h('Parameter registry')
p('Every configurable value needs key, version, type (SCI/ENG/CAL), units, scope, default, supported range, rationale, validation status and change date. Defaults in sections 9, 13, 16 and 17 are ENG pilot settings. Sensor thresholds, retained-water fractions, Kc, root depth and model coefficients are CAL and have no production default.')
h('Alert stability')
p('Cache unresolved dueAt instead of recalculating a later deadline from now on every render. Within an issue window, suppress identical pushes; new state, newly applicable official warning or changed evidence can legitimately reverse advice. Show root concern and weather demand separately when they coexist. Neither weather-only scores nor forecast rain can overturn a current observation-based action.')
p('Manual defaults and sensor-profile existence must never upgrade evidence support. Stable reason codes, source references, suppressed reasons, model/policy versions and missing-data flags are required on every decision, including an abstention.')

page('24  Verification completed for this review', 'ARITHMETIC AND LOCAL REPRODUCTION ARE NOT FIELD VALIDATION')
p('Executed independently: 24 numerical assertions in a standalone Python script and four synthetic parser reproductions against the actual TypeScript module, transpiled without network access. The 24 mathematical checks passed; all four reproductions confirmed the defects. The application was not modified or deployed, and the new engine has not been tested on live plants.')
table(['Check group','Result'],[
['Air demand','30 C/40% RH -> 2.545839 kPa; 22 C/75% -> 0.660983 kPa; 100% RH -> zero; RH zero -> saturation vapour pressure.'],
['Original ET fixture','Latitude -34, J=15 -> Ra=43.335488 MJ/m2/day; Hargreaves=5.888418 mm/day for 18-30 C. Computed daylight=14.023463 h.'],
['Published PM example','FAO rounded Example 17 inputs -> 5.713380 mm/day, within rounding of published 5.7.'],
['Units and atmosphere','2 m/s=7.2 km/h; 5 m/s=18 km/h; 500 W/m2 for one hour=1.8 MJ/m2; 1013 hPa=101.3 kPa; P(1700m)=82.754383 kPa.'],
['Wind-height conversion','5 m/s at 10 m -> approximately 3.74 m/s at 2 m under the specified reference conversion. Not a shelter correction.'],
['Ground arithmetic','TAW=60 mm; depletion=30 mm for the illustrative soil; daily balance fixture gives 17 mm.'],
['Rain geometry / storage','10 mm on a 20 cm circular opening -> 314.159 mL incident water; no retention assumption.'],
['Pot mass','Simple interval loss=350 g; flux/biomass-corrected interval=620 g.'],
['Edge and aggregation','Polar daylight/night limits, rain interval sum, VPD-hour integration and basic interval arithmetic verified.']
],[0.28,0.72])
h('Reproduced parser findings')
table(['ID','Synthetic input','Actual current result'],[
['CODE-01','Current rain.1h=3; daily rain=38.','rainfall=3 under a date key, without rate/window metadata.'],
['CODE-02','asOf 10:00Z; same-date future 20:00Z RH=93%.','nightHumidity=93 on today with forecasted=false.'],
['CODE-03','sunrise=03:00Z; timezone_offset=7200.','Stored sunrise is 05:00Z rather than the original instant.'],
['CODE-04','Only daily[0] with rain=38; no current.','forecasted=false, rainfall=38.']
],[0.16,0.42,0.42])
p('These reproductions establish specific local normalization behaviours. They do not measure how often users encounter them or prove the deployed version has the same code. The numerical checks verify formula implementation and dimensional examples; they do not validate any ENG threshold or crop prediction.')
p('The following 64 V40 cases are the normative minimum acceptance suite for implementation. The v3.1 registry of 168 specified scenarios remains a migration checklist, with changed expectations reconciled to this spec. Neither registry is a report of executed app tests; do not advertise their counts as passing tests.')

def cases(title, rows, offset):
    page(title,'NORMATIVE IMPLEMENTATION FIXTURES - NOT EXECUTED BY THIS DOCUMENT REVIEW')
    table(['ID','Fixture','Required semantic assertion'],[[f'V40-{i+offset:02}',a,b] for i,(a,b) in enumerate(rows)],[0.13,0.40,0.47])
    p('Freeze asOf and ruleset versions. Assert semantic fields, source intervals, units, reasons, action and suppression; avoid brittle prose equality. Test exactly at thresholds and on both sides of each boundary.')

cases('25  Acceptance cases: weather and time',[
('Current rain rate plus daily forecast amount.','Different typed fields/intervals; neither is a complete-day observation.'),
('daily[0] present without current.','Forecast nature retained; no observed rain flag.'),
('Future hourly humidity on current local day.','Forecast night feature only; no actual-exposure counter.'),
('Sunrise 03:00Z in UTC+2.','Stored instant stays 03:00Z; display 05:00 local.'),
('RH at night and Tmax at noon.','No precise paired VPD; correct missing-pair reason.'),
('RH=101, NaN temperature or mismatched arrays.','Reject affected values; valid independent fields survive.'),
('UV absent, valid concurrent T/RH.','Current VPD remains eligible; no all-weather rejection.'),
('Missing rain interval versus explicit zero.','Missingness distinct; no invented complete total.'),
('Complete daily total and overlapping hours.','Choose one canonical estimate; never sum both.'),
('Today partial total compared to daily ET bands.','No full-day class without a complete comparable interval.'),
('DST spring/fall local days.','Correct 23/25-hour coverage denominators and chronology.'),
('Device zone differs from plant zone.','Plant IANA zone controls local windows; UTC instants unchanged.'),
('Snapshot fetched recently but valid time old.','Stale current context; historical interval remains historical.'),
('Cached forecast date now in past.','Still forecast; no automatic history promotion.'),
('Yesterday requested through current endpoint only.','History remains missing; explicit retrospective fetch required.'),
('Provider returns snow or frozen-ground context.','No immediate liquid rain/retained-water credit.')
],1)

cases('26  Acceptance cases: plant and roots',[
('ageKnown=false with ageDays=120.','Age unknown; recorded flowering stage not overwritten.'),
('ageDays=30 with verified 10-day-old anchor.','Reconstructed age=40; unverified anchor yields recorded-age context only.'),
('Growing start date means acquisition.','Do not infer germination date or rooted duration.'),
('21-day rooted clone versus seedling.','Different establishment context; no fixed equal consumption.'),
('Current height cm versus legacy unit unknown.','Use verified units only; dated height does not equal leaf area.'),
('Seedling in 20 L pot.','Developing roots; no full-pot accessible reserve or 10x dose.'),
('plantedIn=ground with stale potSize.','Ground branch; ignore container modifier.'),
('soilType=store or raised.','No fixed retention, texture or sealed-container assumption.'),
('soilMoisture=80% without method/calibration.','No confirmed wet state or automatic dose.'),
('Surface dry and active deeper zone moist.','Preserve gradient; no surface-only watering instruction.'),
('Comparable simultaneous dry/wet readings.','conflict with targeted recheck; no averaged state.'),
('Older wet then credible later dry at same scope.','Later relevant evidence governs; no permanent wet veto.'),
('Fresh moist after normal watering.','No root-rot diagnosis or persistent-waterlogging claim.'),
('Repeated saturated active-root checks and pooling.','Drainage/aeration concern; no pathogen diagnosis.'),
('Repot, medium or sensor move after observation.','Currentness/calibration re-evaluated; source history preserved.'),
('Pot moved at known time with prior root check.','Carry water/history; segment old/new weather exposure.')
],17)

cases('27  Acceptance cases: decisions and rain',[
('No root checks, no logs, no weather.','unknown/inspect_first and initial check; no assumed elapsed-days value.'),
('No GPS but fresh relevant dry root observation.','Conditional water action survives; weather unavailable only.'),
('Fresh wet roots with high demand/heat.','No weather-driven irrigation; separate heat/drainage context.'),
('Dry roots now, 90% rain tomorrow.','Do not suppress current conditional action or credit rain.'),
('Regional 25 mm, shelter/retention unknown.','Post-rain check context; no saturation assertion or timer reset.'),
('Sheltered and exposed plants share a garden.','Shared weather fetch, individual reception and root decisions.'),
('Watering log says runoff/poor wetting.','Applied event retained; rehydration unconfirmed.'),
('Same-day water log followed by new dry check.','UI does not force needsWater=false/high confidence.'),
('Feeding includes linked carrier water.','Count one irrigation volume; nutrient concentration is not added water.'),
('Duplicate mutation and two real same-day events.','Deduplicate logical retry only; retain genuine separate events.'),
('Date-only watering observed next day at 07:00.','Elapsed interval 7-31 h in the 24-hour-day fixture.'),
('Vulnerable setup with elevated demand today.','Check within four hours or earlier due time; never wait two hot days.'),
('Refresh an unresolved check repeatedly.','Deadline never drifts later merely because now advanced.'),
('Fresh moist check expires after pilot validity.','Retain dated history; no ongoing checked_ok guarantee.'),
('Forecast probability changes with unchanged amount.','No stored-water change; no false confidence-percentage claim.'),
('Inactive/harvested/deleting or non-outdoor.','Suppress/route engine; no queued outdoor care alert.')
],33)

cases('28  Acceptance cases: scouting and learning',[
('High reported rain during mildew screen.','No automatic mildew increase; source support and biology separated.'),
('Station wind strong; sheltered canopy unknown.','No automatic disease protection or pot-transpiration multiplier.'),
('Flowering humid event and no internal measurement.','Flower scout; no fixed flower-RH offset or infection probability.'),
('Yesterday no_symptoms then new favourable exposure.','Negative check scoped to its time; later scout may remain.'),
('Dew point exceeds air temperature materially.','Quality warning, not abs() condensation shortcut.'),
('Missing interval between qualifying humid nights.','No known consecutive run across the gap.'),
('Watering follows an app alert without a check.','Action is not a true-positive dry label.'),
('Rain or irrigation between moist/dry checks.','Do not use a simple monotone dry-time likelihood without episode handling.'),
('Backdated event entered after replay asOf.','Exclude until its availability time; use revision known then.'),
('Random train/test split repeats the same plant.','Reject as evidence of generalization; plant/time-held-out evaluation.'),
('Pot mass changed by pruning or unmeasured rain.','Exclude/qualify interval; no exact transpiration result.'),
('Ground root depth increases into unknown layer.','New storage unknown; no free-water creation.'),
('Provider/method changed mid-episode.','Method-change flag; compatible features or fallback.'),
('Snoozed alert and newly recorded dry state.','Decision updates immediately; delivery respects settings/cooldown exceptions.'),
('Old Boolean adapter sees an unknown finding.','Explicit unknown presentation; never Watering on track from false.'),
('Backup/offline/edit/delete/shared authorization.','New contracts round-trip; revisions invalidate caches and permissions hold.')
],49)

page('29  Validation and release contract', 'PRECISION IS EARNED THROUGH OBSERVATIONS AND PROSPECTIVE TESTS')
h('Targets and comparison baselines - CAL')
p('Separate three tasks: identifying useful check windows, predicting measured system water loss, and scouting environmental exposure. Define outcomes before fitting. A watered-after-alert event is neither a dry label nor proof the alert prevented harm.')
bullets(['For check timing, compare user routine; elapsed time since relevant moist observation; elapsed time since application; and the deterministic v4 ruleset. Evaluate whether weather, age, stage and measured size add value beyond these baselines.', 'Use independent scheduled/randomly timed checks as well as prompted observations, with opt-in and burden limits. Capture missed/unsure checks and their reasons. Avoid learning exclusively from checks selected by the model.', 'Use chronological splits, held-out plants/owners and geographic/seasonal holdouts where feasible. Account for repeated observations and plant clustering in uncertainty estimates.', 'Report useful-check precision/recall, missed verified dry periods, false notifications per plant-week, observation completion, abstention coverage, and contradictions with credible wet findings. Report by stage, pot/ground, size, medium and region.', 'For measured pot loss, report MAE/bias in grams and prediction-interval coverage by supported domain. For forecasts, preserve issue time and lead time; do not backtest tomorrow advice using later reanalysis. [R20]', 'A comparative probability model needs calibration curves and Brier/log-loss evaluation only when meaningful probabilities are actually produced. Evidence support tiers are not probability outputs.'])
h('Release gates')
table(['Gate','Required evidence'],[
['A - corrected data foundation','Four parser defects fixed with fixtures; time/unit/provenance/availability correctness; legacy mixed records cannot masquerade as observations.'],
['B - qualitative release','Normative semantic fixtures implemented and passing; zero logic paths for weather-only definite watering or forecast storage credit; UI/notification/backup/authorization integration verified.'],
['C - weather/scouting pilot','Provider/method and ENG screen values disclosed; quality/coverage gates and local benchmark plan in place; no pathogen odds or diagnosis.'],
['D - personalized timing','Prospective comparisons show useful improvement and acceptable misses/burden across target groups. Register numeric promotion targets after pilot variance and baseline rates are measured.'],
['E - numerical advice','Measured storage/target and retained-input eligibility, independent error and interval-coverage validation; model fails closed outside its supported setup/domain.']
],[0.26,0.74])
p('Before broad deployment, choose pilot duration/sample size and outcome tolerances from observed baseline rates, with an agronomy/product review. This document does not invent a universal 90% accuracy target. Report sample counts, missing labels, confidence intervals, important subgroup failures and user intervention effects; training-set fit is insufficient.')

page('30  Final implementation decisions', 'WHAT IS FINAL, WHAT NEEDS DATA AND WHAT STILL NEEDS VERIFICATION')
table(['Decision','v4.0 disposition'],[
['Baseline','A check policy plus a future observation-derived distribution. Remove fixed outdoor watering-day assumptions.'],
['Age and size','Use dated, meaningful developmental/context features; no equal-age consumption assumption or height-to-leaf-area shortcut.'],
['Soil and ground','Separate soil provenance from hydraulic properties. Distinct container/ground/raised-bed pathways; unknown properties remain unknown.'],
['Weather','Fix normalization first; retain hourly provenance. Prefer regionally benchmarked complete reference ET, paired VPD fallback, experimental Hargreaves only with its limits.'],
['Rain','Separate reported, received, infiltrated and retained. Forecast rain never becomes present storage or a retrospective observation by ageing.'],
['Disease','Independent scouting with explicit exposure support; no borrowed greenhouse thresholds, fake infection odds or circular root-rot scoring.'],
['Numerical water','Supported only for eligible, measured and validated setups. A larger pot or a research Kc is not enough.'],
['User interface','Explain what was checked, when and what is missing. Distinguish unknown, reminder, weather planning and observation-based action.'],
['Accuracy claim','Mathematics and selected code behaviours verified; real predictive performance pending implementation and prospective measurement.']
],[0.25,0.75])
h('Remaining verification tasks')
bullets(['Confirm deployment commit, actual field fill rates, legacy height origin, ageRecordedAt semantics, and whether any real sensor integration populates root measurements.', 'Verify deployed weather subscription/entitlements, API terms, cost cap and practical historical-data access. Decide whether to keep 3.0 initially or migrate explicitly to 4.0.', 'Select weather demand provider/complete-weather benchmark for actual launch regions, including South African coast/interior/highland examples. Measure spatial/time bias and forecast skill.', 'Confirm notification execution guarantees, quiet-hours handling and which UI surfaces still consume needsWater/thresholdDays. Audit every consumer before switching on the engine.', 'Confirm backup/security/index/query costs for proposed observations and time-series weather. Preserve source deletion/corrections and cross-owner isolation.', 'Select the pilot operational thresholds and evaluation targets with measured alert burden; do not call ENG defaults biologically proven.'])
callout('Ready to implement as an evidence-based inspection and weather-scouting engine. Not yet validated as an exact irrigation-dose predictor. The next accuracy gain comes from correct weather provenance and representative root observations, followed by prospective comparisons against simple baselines.')

for start,end in [(1,8),(8,15),(15,22)]:
    page(f'Evidence ledger: R{start:02}-R{end-1:02}',f'PRIMARY SOURCES REVIEWED THROUGH 29 OCTOBER 2026')
    for k in range(start,end):
        key=f'R{k:02}'; title,url,note=refs[key]
        h(f'[{key}] {title}')
        p(note)
        blocks.append(('link',(url,'Open primary source')))
    if start==15:
        h('Application/source evidence')
        p('User-supplied WeedGrow_Outdoor_Algorithm_FINAL_v3.1.pdf, all 33 pages, including the existing field crosswalk and scenario registries. The original source was preserved. Relevant repository files were read in the current workspace; no credentials or production records were accessed.')
        p('The final design separates sourced mechanisms from engineering proposals. Literature on industrial hemp, general nursery crops and controlled environments has limited transferability to an arbitrary outdoor drug-type cannabis plant. It supports the stated relationships and uncertainty boundaries, not WeedGrow-specific predictive accuracy.')

# Render one shared content model to an editable Markdown spec and a linked PDF.
for font,file in [('WG','segoeui.ttf'),('WG-Bold','segoeuib.ttf'),('WG-Italic','segoeuii.ttf'),('WG-Code','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(font,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('WG',normal='WG',bold='WG-Bold',italic='WG-Italic',boldItalic='WG-Bold')
INK=colors.HexColor('#1F2F33'); GREEN=colors.HexColor('#164F46'); MUTE=colors.HexColor('#5A6B6A'); PALE=colors.HexColor('#EFF5F1'); LINE=colors.HexColor('#D3DED7')
styles={
 'body':ParagraphStyle('Body',fontName='WG',fontSize=9.1,leading=12.3,textColor=INK,spaceAfter=7.2),
 'table':ParagraphStyle('TableBody',fontName='WG',fontSize=8.0,leading=10.6,textColor=INK,spaceAfter=0),
 'th':ParagraphStyle('TableHead',fontName='WG-Bold',fontSize=8.1,leading=10.8,textColor=colors.white),
 'h':ParagraphStyle('Subhead',fontName='WG-Bold',fontSize=10.5,leading=14,textColor=GREEN,spaceBefore=10,spaceAfter=5,keepWithNext=True),
 'title':ParagraphStyle('PageTitle',fontName='WG-Bold',fontSize=19,leading=24,textColor=GREEN,spaceAfter=10,keepWithNext=True),
 'cover':ParagraphStyle('CoverTitle',fontName='WG-Bold',fontSize=31,leading=38,textColor=GREEN,spaceBefore=40,spaceAfter=20,keepWithNext=True),
 'strap':ParagraphStyle('Strap',fontName='WG-Bold',fontSize=8,leading=11,textColor=MUTE,spaceAfter=14,keepWithNext=True),
 'bullet':ParagraphStyle('Bullet',fontName='WG',fontSize=9.1,leading=12.3,textColor=INK,spaceAfter=6,leftIndent=12,firstLineIndent=-9),
 'code':ParagraphStyle('Code',fontName='WG-Code',fontSize=7.4,leading=10,textColor=INK,spaceAfter=0),
 'call':ParagraphStyle('Call',fontName='WG-Bold',fontSize=9.5,leading=13.5,textColor=GREEN,spaceAfter=0),
 'link':ParagraphStyle('SourceLink',fontName='WG',fontSize=8.7,leading=12,textColor=GREEN,spaceAfter=7),
}
def rich(t):
    t=html.escape(str(t)).replace('\n','<br/>')
    return re.sub(r'\[(R\d{2})\]',lambda m:f'<link href="{html.escape(refs[m[1]][1],quote=True)}" color="#164F46">[{m[1]}]</link>',t)
def para(t,style='body'): return Paragraph(rich(t),styles[style])
def mdref(t): return re.sub(r'\[(R\d{2})\]',lambda m:f'[{m[1]}]({refs[m[1]][1]})',t)
def mdcell(t): return mdref(str(t)).replace('|','\\|').replace('\n','<br>')

md=[]
for typ,b in blocks:
    if typ=='title': md+=['# '+b.replace('\n',' - '),'']
    elif typ=='strap': md+=[b,'']
    elif typ in ('p','callout'): md+=[mdref(b),'']
    elif typ=='h': md+=['## '+mdref(b),'']
    elif typ=='bullets': md += ['- '+mdref(x) for x in b]+['']
    elif typ=='code': md += [chr(96)*3,b,chr(96)*3,'']
    elif typ=='break': md += ['<!-- page break -->','']
    elif typ=='link': md += [f'[{b[1]}]({b[0]})','']
    elif typ=='table':
        heads,rows,widths=b
        md+=['| '+' | '.join(mdcell(x) for x in heads)+' |','| '+' | '.join('---' for x in heads)+' |']
        md+=['| '+' | '.join(mdcell(x) for x in row)+' |' for row in rows]+['']
SRC.joinpath('WeedGrow_Outdoor_Algorithm_FINAL_v4.0.md').write_text('\n'.join(md),encoding='utf-8')

from reportlab.platypus.tableofcontents import TableOfContents
class SpecDoc(SimpleDocTemplate):
    def beforeDocument(self): self.headingNo=0
    def afterFlowable(self,flowable):
        if isinstance(flowable,Paragraph) and flowable.style.name=='PageTitle' and flowable.getPlainText()!='Contents':
            title=flowable.getPlainText(); self.headingNo+=1; key=f'section-{self.headingNo}'
            self.canv.bookmarkPage(key); self.canv.addOutlineEntry(title,key,level=0)
            self.notify('TOCEntry',(0,title,self.page,key))

pdf=OUT/'WeedGrow_Outdoor_Algorithm_FINAL_v4.0.pdf'
doc=SpecDoc(str(pdf),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=48,bottomMargin=43,
    title='WeedGrow Outdoor Algorithm - Final Specification v4.0',author='WeedGrow | Research and design review',subject='Weather, evidence and root-zone decision specification')
width=A4[0]-86
story=[]; first=True; insertedContents=False
for typ,b in blocks:
    if typ=='break':
        story.append(PageBreak())
        if not insertedContents:
            story.append(Paragraph('Contents',styles['title']))
            story.append(para('Implementation contract, research audit, validation and evidence ledger. PDF section titles and source references are clickable.'))
            toc=TableOfContents(); toc.levelStyles=[ParagraphStyle('TOC',fontName='WG',fontSize=8.8,leading=17,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0)]
            toc.tableStyle=TableStyle([('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),('LEFTPADDING',(0,0),(-1,-1),0)])
            story.append(toc); story.append(PageBreak()); insertedContents=True
    elif typ=='title':
        story.append(para(b,'cover' if first else 'title')); first=False
    elif typ=='strap': story.append(para(b,'strap'))
    elif typ=='p': story.append(para(b))
    elif typ=='h': story.append(para(b,'h'))
    elif typ=='bullets':
        for x in b: story.append(para('- '+x,'bullet'))
    elif typ=='code':
        box=Table([[Preformatted(b,styles['code'])]],colWidths=[width])
        box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.4,LINE),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
        story+=[box,Spacer(1,8)]
    elif typ=='callout':
        box=Table([[para(b,'call')]],colWidths=[width])
        box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('LINEBEFORE',(0,0),(0,-1),3,GREEN),('LEFTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
        story+=[box,Spacer(1,11)]
    elif typ=='link': story.append(Paragraph(f'<link href="{html.escape(b[0],quote=True)}" color="#164F46">{html.escape(b[1])}</link>',styles['link']))
    elif typ=='table':
        headers,rows,widths=b
        ws=[width*x for x in widths] if widths else [width/len(headers)]*len(headers)
        grid=[[para(x,'th') for x in headers]]+[[para(x,'table') for x in row] for row in rows]
        t=Table(grid,colWidths=ws,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),('GRID',(0,0),(-1,-1),0.35,LINE),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story += [t,Spacer(1,8)]

def pagechrome(c,d):
    c.saveState(); w,h=A4
    if d.page>1:
        c.setFont('WG',7.2); c.setFillColor(MUTE)
        c.drawString(43,h-27,'WEEDGROW  /  OUTDOOR DECISION ENGINE')
        c.drawRightString(w-43,h-27,'FINAL SPECIFICATION  v4.0')
        c.setStrokeColor(LINE); c.setLineWidth(.4); c.line(43,h-34,w-43,h-34)
    c.setFont('WG',7); c.setFillColor(MUTE)
    c.drawString(43,24,'29 OCT 2026  |  SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING')
    c.drawRightString(w-43,24,str(d.page)); c.restoreState()
doc.multiBuild(story,onFirstPage=pagechrome,onLaterPages=pagechrome)
from pypdf import PdfReader
reader=PdfReader(pdf)
print(json.dumps({'pdf':str(pdf),'markdown':str(SRC/'WeedGrow_Outdoor_Algorithm_FINAL_v4.0.md'),'pages':len(reader.pages),'source_words':len(' '.join(md).split()),'references':len(refs),'v4_acceptance_cases':64},indent=2))
