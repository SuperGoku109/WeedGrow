from pathlib import Path
import json,math,re,html,runpy,shutil,hashlib
from datetime import datetime,timezone
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Preformatted
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path('C:/Users/Zane/dev/WeedGrow');SRC=ROOT/'output/spec';OUT=ROOT/'output/pdf'
BASE='WeedGrow_Practical_App_Spec_v7.1'
M=runpy.run_path(str(ROOT/'tmp/pdfs/practical_contract_v71.py'));checks=M['run_checks']()
prior=json.loads((SRC/'WeedGrow_Environmental_Evidence_v7.0.json').read_text(encoding='utf-8'))
refs={k:(v['title'],v['url'],v['scope']) for k,v in prior['sources'].items() if k in ['S04','S05','S11','S12','S19','S27','S28']}
audit_files=['firestoreModels.ts','lib/weather/fetchWeather.ts','lib/weather/weatherResponse.ts','lib/weather/weatherMeasurements.ts',
 'features/plants/form/plantSectionForm.ts','lib/suggestions/adviceInputs.ts','lib/suggestions/wateringEngine.ts','features/plants/plantCare.ts']
audit=[{'path':f,'sha256':hashlib.sha256((ROOT/f).read_bytes()).hexdigest()} for f in audit_files]
warnings=[
 ['W01','Heat','Weather preparation','Air temperature and covered duration, current/forecast separated. No leaf-temperature input.'],
 ['W02','Cold/frost/freezing','Weather preparation','Air minimum and source products; possible frost is a weather screen, not measured tissue ice.'],
 ['W03','Wind','Weather preparation','Wind/gust and optional source products; stage/pot affects practical wording.'],
 ['W04','Heavy rain','Weather preparation','Rate/complete amount; reception affects direct effects and retained-water estimate.'],
 ['W05','Hail/severe','Source-only, adapter needed','Explicit mapped source event. Current fetch excludes alerts; descriptions are not a validated alert adapter.'],
 ['W06','Watering','Estimated care decision','Validated setup/profile water-state estimate using logs and weather. Model/initialization still required.'],
 ['W07','Excess root water','Optional problem review','No automated root-saturation/rot claim from ordinary weather and watering logs.'],
 ['W08','Container heat','Merge with heat card','Conditional container advice; no root-overheating score or measured pot-wall temperature.'],
 ['W09','Dew/dampness','Merge as humidity context','Near-saturated night/weather context; no exact dew or leaf-wetness prediction.'],
 ['W10','Powdery mildew','Ambient conditions card','Paired air T/RH/duration and reported foliage stage. No daily leaf checks, density or cultivar assay required.'],
 ['W11','Bud rot','Ambient conditions card','Reported flowering plus paired air T/RH/duration. No internal-bud measurement or actual wet-hours equation.'],
 ['W12','Wet-leaf disease','Shared wet-weather context','Rain reaching canopy and humid weather can support context; no pathogen/Septoria detector.'],
 ['W13','Wet establishment','Optional problem review','Establishment context only when known; no weather-only damping-off prediction.'],
 ['W14','Root/wilt problem','Optional problem review','User-initiated problem path when a problem occurs; no weather-only root-rot diagnosis.']]
capabilities={'version':'7.1','supersedes':'v7.0 production-input and feature scope; advanced research models are out of the base product',
 'routineUserAction':'log watering; amount optional','dailyMeasurementRequirements':[],
 'acceptedProfileFields':M['USER_FIELDS'],'acceptedRoutineLogFields':M['ROUTINE_LOG_FIELDS'],
 'weatherCapabilities':M['WEATHER_CAPABILITIES'],'excludedResearchInputs':M['EXCLUDED'],
 'excludedBaseModels':['leaf-temperature estimation','leaf VPD','biochemical photosynthesis','measured-PAR/DLI-dependent decisions',
  'native cultivar stomatal response lookup','grape actual-wetness equations','weather-only root oxygen/rot prediction'],
 'warnings':[{'id':r[0],'name':r[1],'productDisposition':r[2],'realisticBasis':r[3]} for r in warnings],
 'weightPolicy':'Base disease conditions use supported ambient exposure only. v6 80/20 context budgets are not used with fabricated or renormalized missing user facts. No new calibrated risk probability.',
 'wateringPolicy':'Estimated yes/no only from supported validated scenarios. Otherwise uncertain; no daily check requirement and no timer presented as measured moisture.',
 'appAudit':audit,'sources':prior['sources']}
(SRC/'WeedGrow_Practical_Input_Contract_v7.1.json').write_text(json.dumps(capabilities,indent=2),encoding='utf-8')
shutil.copyfile(ROOT/'tmp/pdfs/practical_contract_v71.py',SRC/'WeedGrow_Practical_Capability_Reference_v7.1.py')
v={'version':'7.1','executedAt':datetime.now(timezone.utc).isoformat(),'capabilityChecksPassed':len(checks),'checks':checks,
 'appChanged':False,'biologicalAccuracyValidated':False,'runtimePredictionEngineImplemented':False,'pdfQA':None}
(SRC/'WeedGrow_Practical_Verification_v7.1.json').write_text(json.dumps(v,indent=2),encoding='utf-8')

blocks=[]
def p(t):blocks.append(('p',t))
def h(t):blocks.append(('h',t))
def page(t,s=''):
 if blocks:blocks.append(('break',None))
 blocks.append(('title',t))
 if s:blocks.append(('strap',s))
def table(head,rows,widths=None):blocks.append(('table',(head,rows,widths)))
def bullets(rows):blocks.append(('bullets',rows))
def code(t):blocks.append(('code',t))
def callout(t):blocks.append(('callout',t))

page('WeedGrow\nPractical app specification','v7.1 | REALISTIC USER INPUTS, AUTOMATIC WEATHER AND CARE ESTIMATES | 29 OCTOBER 2026')
p('This revision corrects the product scope of v7.0. The ordinary app must work with basic setup information, watering logs and automatically collected weather. Research measurements are not user requirements or hidden prerequisites.')
callout('Base product: one-time setup + one-tap watering logs + weather collected by the app. No leaf temperature, root temperature, PAR meter, CO2 measurement or daily soil checks. The app estimates likely watering need and warns about supported weather/ambient disease conditions.')
h('The central correction')
p('Leaf-temperature research helps explain why air weather is an imperfect proxy. It does not justify asking the grower for leaf temperature, inventing it from air temperature, or making a feature depend on it. The same rule applies to leaf wetness, internal CO2, leaf nitrogen, root oxygen and cultivar-specific laboratory parameters.')
p('v7.1 takes precedence over earlier production-scope proposals. The previous physiology emulator and advanced measurement pathways remain research background only and are excluded from this product package. The evidence is retained; the base workflow is simplified.')
p('Deliverables: this practical spec, editable Markdown, a machine-readable input/warning contract and a small capability reference. The reference checks dependencies; it does not predict moisture or disease. No app source files were changed.')

page('01  What the app actually delivers','ESTIMATED CARE AND WEATHER PREPARATION WITH LOW LOGGING BURDEN')
table(['User-facing result','Realistic meaning'],[
['Water / not due','The supported estimate places the plant below/above its watering action threshold. It is an estimated care recommendation, not a measured moisture reading.'],
['Uncertain, when needed','The available history/setup cannot reliably distinguish the two. Explain one actionable reason; do not silently answer not due.'],
['Weather preparation','Heat, cold, wind, rain and supported severe-source events at the plant location, with current versus forecast wording.'],
['Disease-conducive conditions','Regional air/rain conditions can warrant awareness or an occasional scout. The app has not detected infection or measured the plant microclimate.'],
['Problem review','An optional user-initiated path when something looks wrong. It is not a recurring mandatory inspection.']
],[.29,.71])
p('Normal use must not depend on a moisture observation, plant photo, measured watering volume or repeated height entry. More optional information can narrow a future estimate, but it must not become a disguised daily requirement.')
p('Scope here is outdoor plants. Outdoor weather may support external preparation for a greenhouse, but it cannot represent greenhouse air, humidity or root conditions. A sensorProfileId field is not proof that working sensors exist.')

page('02  The small user-input contract','MOST FACTS ALREADY EXIST; ASK ONLY SIMPLE SETUP QUESTIONS')
table(['Setup fact','How to obtain it','Burden / unknown behavior'],[
['Location','Garden pin, device location with consent, or selected town/area.','Once; retain approximate-location uncertainty.'],
['Pot or ground; approximate pot size','Existing plantedIn/potSize. Label units clearly.','Once; pot size optional if unknown; never assume unitless text means litres.'],
['Current stage','Existing growthStage, with clear examples and an unknown option.','At setup and meaningful stage changes; do not infer exact flowering from age alone.'],
['Sun exposure','Existing Full Sun / Partial Sun / Mostly Shade / Not Sure.','Once; category changes broad profile/action context, not measured photons.'],
['Rain reception','One simple setup question covering leaves and soil.','Proposed field; both / leaves only / soil only / neither / not sure. Partial exposure remains uncertain.'],
['Medium, if known','Optional simple choice: potting mix, garden soil, coco, other/not sure.','Proposed clearer field; no texture, conductivity or water-holding test required.']
],[.28,.39,.33])
h('Reuse optional facts already supplied')
p('Use age with its date/meaning, current stage, and dated height when present. These can choose validated setup/profile ranges; they do not establish root depth, leaf area or exact consumption. Unknown age/height/medium must not block ordinary weather preparation or force additional logging.')
p('The existing soilType choices native/raised/store/custom describe provenance or layout. They cannot directly select hydraulic texture. Existing strain labels and sativa/indica/hybrid categories do not identify a measured stomatal or disease-resistance profile.')

page('03  What routine logging requires','ONE WATERING EVENT; VOLUME REMAINS OPTIONAL')
code('Routine action: Log watering\nDefault event time: now; allow backdating\nOptional: amount in mL/L\nNo required moisture %, soil probe, leaf temperature,\nphoto, leaf count, canopy dimensions or daily height')
p('Use occurrence time rather than edit time. A date-only entry has an elapsed-time interval, not an invented exact timestamp. Genuine separate watering events remain separate; duplicate retries do not create extra water.')
p('A watering event is useful evidence that an action happened. It does not prove the entire root zone was rewetted or identify the retained amount. If volume is omitted, use a validated range for the relevant profile or keep the added-water uncertainty explicit. Do not reset every plant to full storage.')
p('Routine intervals can help seed a reminder or weak behavioral prior. They cannot establish that the user watered at the correct time, that soil was dry, or that the app has learned actual moisture from compliance.')
h('Occasional changes')
p('Support stage updates, repot/move/medium changes and an optional problem report when relevant. Do not prompt for these every day. If a missing fact repeatedly prevents a useful estimate, fix the model/profile or offer one targeted setup/calibration step instead of turning the product into a daily inspection checklist.')

page('04  What data the current app really has','LOCAL SOURCE AUDIT; FIELD PRESENCE IS NOT MODEL READINESS')
table(['Current records / code','Available','Limit'],[
['Plant / setup form','Location, environment, pot/ground, pot text, stage, age, height, sunlight and soilType.','No explicit rain reception or meaningful hydraulic medium profile. Optional values can be missing or stale.'],
['PlantLog','Watering events; optional waterMl; dates/precision; optional measurements/photos.','Measurements are not assumed to be routinely supplied. careCheck/no_symptoms is not a general positive diagnostic record.'],
['WeatherCacheEntry','T/RH/wind/rain fields; extrema, peak/rain-hour summary, night RH, dew point, cloud, UV, gust, solar times.','Mixed summaries are insufficient for time-aligned exposure histories or complete rain accounting.'],
['Weather fetch','One Call3.0 includes hourly/daily/current data in the raw response.','Request excludes alerts. Hourly forecasts are not observed history.'],
['Weather normalization','Produces daily cache entries and summaries.','Drops paired raw intervals; mixes interval semantics; current/daily nature and solar-time handling need correction.'],
['Advice invalidation signature','Includes stage, potSize and sunlight among other fields.','Age, height, soilType and plantedIn are not currently all included; adding future dependencies requires invalidation updates.']
],[.29,.34,.37])
p('Audit sources: firestoreModels.ts; features/plants/form/plantSectionForm.ts; lib/weather/fetchWeather.ts; weatherResponse.ts; weatherMeasurements.ts; lib/suggestions/adviceInputs.ts; wateringEngine.ts; features/plants/plantCare.ts. The machine ledger records file hashes. This was a local source review, not a deployed-build or live-data test.')

page('05  What the app can collect automatically','BACKEND WORK IS DIFFERENT FROM ASKING THE USER FOR MORE')
table(['Weather capability','Feasible path','Requirement before use'],[
['Current/forecast air T, RH, wind/gust','Existing provider response.','Keep paired values, valid time, coordinates, units and source nature.'],
['Hourly forecast exposure','Retain the already fetched raw hourly series.','Label forecast; align simultaneous factors and preserve gaps.'],
['Past weather / last rain','Retain qualified current/history observations or retrieve a supported retrospective product.','Never promote an old forecast into observed history. A sparse snapshot archive is not complete rain history.'],
['Rain rate and amount','Use provider interval fields.','Keep mm/hour rate separate from interval mm/complete-day amount; avoid overlap/double counting.'],
['Source severe alerts','Stop excluding alerts; add typed mapping/storage/validity.','Feed/source support must be independent of numeric weather. Do not infer hail from a description alone.'],
['Air VPD','Calculate from concurrent air T/RH.','Call it atmospheric demand context; no leaf-VPD or actual transpiration claim.'],
['Reference ET0 / radiation','Optional later provider capability.','Do not make base care depend on a new feed until integrated and benchmarked; ET0 is not pot water use.']
],[.27,.38,.35])
p('The provider documents separate current, forecast and historical products and interval meanings [S12]. Entitlements, cost caps and background collection need implementation review. No extra subscription or provider migration is assumed here, and no account was changed.')
p('Fix these current parser behaviors first: current rain rate stored in a generic rainfall field; forecast-derived summaries attached to today; daily[0] treated as observed without current; UTC solar instants shifted before serialization. Preserve missing intervals instead of treating every absent amount as a complete zero-rain period.')

page('06  Inputs and models removed from the base app','NO REPLACEMENT WITH UNVALIDATED WEATHER ESTIMATES')
table(['Excluded dependency','Product decision'],[
['Leaf temperature / leaf VPD','No user field and no inferred fixed air-to-leaf offset. Use air T/RH demand context only.'],
['Internal bud temperature/RH / actual leaf wetness','No required measurement and no claim it can be recovered exactly from regional weather.'],
['Measured PPFD/PAR and exact DLI','No PAR meter or photon input required. Sun category/cloud/weather radiation are distinct proxies.'],
['Internal CO2, leaf N, stomatal conductance','Remove biochemical-photosynthesis model from the care path.'],
['Leaf age distribution / leaf area / measured roots','No daily size or leaf logging. Use dated plant facts as broad, validated profile context.'],
['Root temperature / oxygen / sensor calibration','No assumed sensor dependency or thermal/oxygen diagnosis.'],
['Verified cultivar resistance / canopy-density rating','No mandatory genotype assay, airflow rating or detailed flower inspection.'],
['Daily moisture checks or waterlogging assessment','Not required to run normal care. Optional one-off information cannot become a recurring daily gate.']
],[.38,.62])
p('Studies can explain why these unobserved factors create uncertainty. They cannot supply the individual plant measurements [S19] [S27] [S28]. The v7 physiology sandbox, leaf-gradient examples, native cultivar lookups and actual-wetness curve portfolio are not shipped as base-app runtime requirements.')

page('07  Realistic environmental combinations','EACH COMBINATION USES SIMPLE SETUP, LOGS OR WEATHER')
table(['Combination','Useful output','Claim boundary'],[
['Air temperature + RH + duration','Atmospheric drying-demand/exposure pattern.','Not leaf temperature, actual uptake or proof roots are dry.'],
['Weather + last watering + pot/ground + medium/profile + stage','Estimated watering state or due window, once the profile/state model is validated.','No unique exact moisture follows from these facts alone.'],
['Rain history + soil reception + hydraulic profile','Uncertain retained-rain input to water accounting.','Regional rain amount is not retained root water or saturation.'],
['Temperature + humidity history + reported flowering','Bud-rot conducive ambient conditions card.','No internal-bud humidity, infection probability or diagnosis.'],
['Temperature + humidity history + foliage stage','PM-conducive ambient conditions card.','Rain and RH85% are not necessary conditions; no actual infection detection. [S04]'],
['Rain reaching foliage + humid periods','Wet-weather/scouting context where useful.','No exact leaf-wetness hours or named leaf-disease diagnosis.'],
['Wind/gust + pot/ground + stage','Preparation relevant to exposed containers or vulnerable plants.','No measured local canopy airflow or disease-protection multiplier.']
],[.37,.35,.28])
p('Use hourly paired factors where a duration is claimed. Daily peak temperature and mean RH are a coarse fallback, not a reconstructed joint exposure. If raw hourly support is missing, the app can still show valid weather preparation; it cannot silently manufacture a precise disease-exposure calculation.')

page('08  Warning scope: weather and watering','DETECTOR IDS ARE RETAINED; PRODUCT CLAIMS ARE NARROWER')
table(['ID / warning','Disposition','Realistic basis'],[[r[0]+' '+r[1],r[2],r[3]] for r in warnings[:6]],[.23,.25,.52])
p('W01-W04 can use supported numeric weather even when optional plant facts are missing. An official/source route needs a real applicable event. Unknown source coverage is not absence of hazards. W05 is unavailable in the current request path until alert ingestion/mapping is added.')
p('W06 is the principal care estimate. It must eventually produce likely water / not due under supported conditions without routine moisture checks. It is not already implemented by a capability flag, a watering-day timer or the research emulator.')

page('09  Warning scope: disease and root claims','FEWER INDEPENDENT CARDS; NO LABORATORY INPUTS')
table(['ID / warning','Disposition','Realistic basis'],[[r[0]+' '+r[1],r[2],r[3]] for r in warnings[6:]],[.24,.25,.51])
p('Merge W08 into the heat card and W09/W12 into appropriate ambient wet/humid conditions context. W07/W13/W14 do not run as weather-only biological detectors. A user can report a problem when it occurs; that is an optional pathway, not a daily requirement.')
p('Suggested language: "Warm, humid conditions have favoured mildew" or "Recent humid weather during flowering warrants awareness of bud rot." Avoid "mildew detected", "roots are saturated" or "your root temperature is too high" from these inputs. [S04] [S05]')

page('10  Watering: feasible estimate and honest limits','NO DAILY MEASUREMENT DEPENDENCY, NO PROMISE OF EXACT MOISTURE')
code('Inputs: recent watering events + qualified weather/rain\n      + setup/profile + reported stage/available size\nState: reserve/depletion range and its uncertainty\nUpdate: uncertain retained inputs minus modeled loss/drainage\nDecision: water / not due only when supported scenarios agree\nOtherwise: uncertain with the specific missing reason')
p('The physical balance remains relevant [S11], but the necessary setup profiles and initialization must be built and validated. Pot size, weather and age do not reveal initial wetness, how much a volume-free watering retained, root occupancy or access to deep ground water. This is a real information limit, not something to replace with a leaf-temperature estimate.')
table(['Case','Feasible behavior'],[
['Supported initialized profile; uncertainty stays on one side of action threshold','Give the estimated binary care result and its next update time. No daily check.'],
['New plant with no reliable starting state','Broad prior plus log history; offer one optional initialization step if needed. No confident moisture claim on day one.'],
['Unknown water volume','Use a validated broad event/retention distribution if available; otherwise preserve uncertainty.'],
['Ambiguous result after unusual rain, missed logs or repotting','Explain the event and offer one targeted check/update; do not repeat a daily inspection requirement.'],
['No validated numerical model for this setup yet','A labelled routine reminder may remain available. Do not sell its timer as a weather-accurate moisture prediction.']
],[.44,.56])
p('Ordinary users should not supply the research calibration data. Use an opt-in study cohort, reference pots or instrumented validation to learn setup profiles, then evaluate how useful the app remains with only watering logs. If a profile frequently needs checks, it fails the low-burden release target.')

page('11  Weights aligned to obtainable inputs','REMOVE HIDDEN DEPENDENCIES BEFORE TUNING NUMBERS')
table(['Earlier component','v7.1 base-product decision'],[
['Weather intensity/duration weights','May remain explicit ENG attention-index candidates on supported weather. They are not injury probabilities.'],
['80% disease exposure +20% local context','Not the default app formula when density, damage, local airflow and verified susceptibility are absent.'],
['Ambient disease conditions index','Use the supported paired-air exposure component and stage relevance, labelled environmental exposure. Re-evaluate thresholds/burden for this different index before release.'],
['Missing20% context','Do not fill with guessed values or rescale the available factors and claim unchanged calibration.'],
['Bud wet-hours / leaf-wetness crop models','Research comparison only. No sensor-dependent equation or fabricated actual wet-hour duration in the base care path.'],
['Root excess/persistence weights','Inactive for automatic weather-only prediction; retain only for a future separately validated evidence pathway.'],
['Age/height/medium coefficients','Use only where a validated profile supports them. No arbitrary equal weights or forced numeric effect for every stored field.']
],[.36,.64])
p('This revision changes product eligibility and dependencies. It does not assert that stripping unavailable inputs preserves v6/v7 score calibration or accuracy. The earlier ambient kernels and numerical thresholds remain research candidates until tested with the actual low-input workflow.')
p('Do not generate default disease pushes simply because a research exposure index is high. Begin with conditions cards and a measured alert-burden pilot. Destructive weather products and estimated watering decisions have separate relevance and delivery rules.')

page('12  What we estimate, and what we do not','A SHORT ESTIMATION LEDGER FOR ENGINEERS AND PRODUCT')
table(['Quantity','Policy'],[
['Elapsed time since logged watering','Compute from recorded event time/precision; missing log is not proof no watering occurred.'],
['Air VPD / covered humidity duration','Compute from paired API air values with provenance. No plant measurement claimed.'],
['Regional actual/forecast weather','Use provider estimate at the plant location; keep source, interval and spatial uncertainty.'],
['Rain reaching the plant','Use simple user reception choice. Partial/unknown does not become a fixed50% fraction.'],
['Retained input / reserve / drying time','Estimate with validated profile ranges and event uncertainty; no unsupported precise percentage.'],
['Canopy/leaf/root temperature, oxygen, exact wetness','Not estimated in the base product. They remain unobserved mechanisms.'],
['Leaf area, root depth, nutrient deficiency, cultivar response','No exact inference from height, strain label, weather, photo or soil provenance.'],
['Disease presence','Not inferred from weather. Optional problem review does not by itself confirm the organism.']
],[.39,.61])
p('A simple sun/medium/stage answer can improve a broad empirical profile if validated. It must not be advertised as a precise physical measurement. Retain the useful research relationships as directions and model constraints; discard product claims that require unobserved states.')

page('13  Implementation priorities and acceptance','THE SPEC CHANGES NOW; APP CODE CHANGES ARE SEPARATE WORK')
table(['Priority','Concrete requirement'],[
['1. Practical profile','Add explicit soil/canopy rain reception and optional understandable medium choice. Permit not sure. Reuse existing stage/sun/pot facts.'],
['2. Weather foundation','Retain typed hourly intervals; correct rain/time/nature handling; add source hazards separately; obtain real history or mark coverage missing.'],
['3. Prediction foundation','Create and validate setup profiles and initial-state/volume uncertainty. Ordinary users contribute only their normal watering logs.'],
['4. Warning simplification','Keep weather preparation and ambient PM/flower conditions. Merge context cards; defer weather-only root/thermal/physiology claims.'],
['5. Consumer audit','Include every real input in invalidation; remove same-day-watered logic that forces not-due/high confidence irrespective of new evidence. Distinguish uncertain from false.'],
['6. Low-burden evaluation','Compare outcome accuracy and useful-care coverage with only basic setup + logs + API. Report repeated-check burden, false alerts, misses and abstention.']
],[.26,.74])
h('Executed capability checks')
p(str(len(checks))+' checks passed for the contract reference: all14 dispositions; no effect from adding excluded research measurements; no daily measurement requirement; raw-hour/source gates; stage relevance; independent hazards/reports; permission and greenhouse scope. These are dependency checks, not an executed care predictor, app integration test or biological accuracy result.')
p('Release acceptance examples: no leaf sensor and no volume entry still permit supported weather routes; flowering plus raw paired air data permits an ambient flower route; daily summaries cannot masquerade as hourly history; missing root observations cannot become no-root-problem evidence; uncertainty never silently becomes not due.')
callout('The realistic product is a low-input estimate-and-warning service. Weather and setup should do most of the work. Whenever the proposed model needs a laboratory measurement, remove that product dependency or narrow the claim; do not move the burden to the grower.')

page('Evidence and review notes','RELEVANT PRIMARY SOURCES; FULL RESEARCH LEDGER PRESERVED IN JSON')
for sid in ['S04','S05','S11','S12','S19','S27','S28']:
 title,url,note=refs[sid]
 h(f'[{sid}] {title}')
 short={'S04':'Cannabis mildew evidence supports an ambient conditions interpretation; no85% RH necessary gate or infection diagnosis.',
 'S05':'Cannabis bud-rot exposure and delayed symptoms support history/scout context; no fixed internal-bud correction outdoors.',
 'S11':'Physical water balance requires supported storage, retained inputs and rooting parameters. It does not identify unknown initial moisture.',
 'S12':'Official current/forecast/historical products and field units checked29 October2026. Hourly forecasts do not supply occurred history.',
 'S19':'Native cultivar variation makes universal VPD-to-water-use assumptions unsafe; a strain category cannot supply measured physiology.',
 'S27':'Rooting-stage research is context-specific; it does not make adult leaf/root measurements practical app inputs.',
 'S28':'Measured leaf capacity is valuable research evidence, but this application has neither those measurements nor a validated field physiology model.'}[sid]
 p(short);blocks.append(('link',(url,'Open primary source')))
p('The complete33-source v7 evidence ledger is preserved in the companion JSON for research provenance. Production scope is governed by v7.1. Repository observations are from the current local files listed in the audit manifest; no secrets, production records, accounts or app behavior were changed.')

renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('WeedGrow_Outdoor_Algorithm_FINAL_v4.0',BASE).replace('R\\d{2}','S\\d{2}')
renderer=renderer.replace('WeedGrow Outdoor Algorithm - Final Specification v4.0','WeedGrow Practical App Specification v7.1')
renderer=renderer.replace('FINAL SPECIFICATION  v4.0','PRACTICAL APP SPEC  v7.1').replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','BASIC SETUP + WATERING LOGS + AUTOMATIC WEATHER')
renderer=renderer.replace("'v4_acceptance_cases':64","'executed_capability_checks':len(checks)")
exec(renderer,globals())
