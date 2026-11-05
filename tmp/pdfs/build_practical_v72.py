from pathlib import Path
import json, math, re, html, runpy, shutil, hashlib
from datetime import datetime, timezone
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path('C:/Users/Zane/dev/WeedGrow'); SRC=ROOT/'output/spec'; OUT=ROOT/'output/pdf'
BASE='WeedGrow_Low_Input_Evidence_Algorithm_v7.2'
old=json.loads((SRC/'WeedGrow_Practical_Input_Contract_v7.1.json').read_text(encoding='utf-8'))
sources=dict(old['sources'])
new_sources={
 'S34':dict(title='Angelaki et al. (2026). Integrating Hydraulic Properties into Irrigation Management of Industrial Hemp (Felina 32) Under Mediterranean Conditions',url='https://www.mdpi.com/2073-4395/16/6/649',scope='Full 23-page primary PDF reviewed; methods p3, Table1 p6 and threshold calculation. Two mineral soils; three plants/pot; final four pot replicates/cell; 2022 Greece experiment published 19 March 2026. Not potting-mix or individual-plant validation.',access='full_primary_pdf',localResearchPDF='tmp/research_v72/hydraulic_2026.pdf'),
 'S35':dict(title='Duong et al. (2023). Variation in Hydric Response of Two Industrial Hemp Varieties to Induced Water Stress',url='https://www.mdpi.com/2311-7524/9/4/431',scope='Full 13-page primary PDF reviewed; methods p3-4, Table1 p8, Figure4 p9. Cherry and Wife; 11-L peat/perlite containers; four plants per variety/treatment. Water use normalized by leaf area is not a ground-depth irrigation dose.',access='full_primary_pdf',localResearchPDF='tmp/research_v72/hydric_2023.pdf'),
 'S36':dict(title='Collado, Hwang and Hernandez (2024). Supplemental greenhouse lighting increased water use efficiency, crop growth and cutting production in Cannabis sativa',url='https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2024.1371702/full',scope='Full 15-page primary PDF reviewed; methods and Table3 p6. Suver Haze vegetative greenhouse crop; four light treatments, three plot replicates/treatment; 21-day crop totals. Improved WUE does not imply lower absolute water use.',access='full_primary_pdf',localResearchPDF='tmp/research_v72/water_use_light_2024.pdf'),
 'S37':dict(title='Crispim Massuela et al. (2026). Less water, same buds: moderate drought as a water-saving strategy for indoor cannabis',url='https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2026.1930650/full',scope='Full 15-page primary PDF reviewed; methods p3-5 and outcome tables. Published 3 September 2026; two high-CBD genotypes, 88 plants, 4.5-L peat pots, three table replicates with harvest/treatment allocations. Indoor flowering deficit experiment, not an outdoor default schedule.',access='full_primary_pdf',localResearchPDF='tmp/research_v72/drought_2026.pdf'),
 'S38':dict(title='Akinrinlola and Hansen (2023). Efficacy of Organic Fungicides Against Hemp Powdery Mildew Caused by Golovinomyces ambrosiae in a Greenhouse in Tennessee',url='https://apsjournals.apsnet.org/doi/10.1094/PDIS-09-22-2094-RE',scope='Primary publisher-indexed methods/results reviewed; direct full-page request returned 403. Bibliography cross-checked in PubMed PMID36471461. Treatment trial with susceptible cultivars and inoculum; mean RH51/48%, temperatures17-26/20-27C. Not a controlled humidity dose-response.',access='primary_indexed_methods_results_direct_full_page_403')}
sources.update(new_sources)
for sid,src in new_sources.items():
 if 'localResearchPDF' in src:
  src['sha256']=hashlib.sha256((ROOT/src['localResearchPDF']).read_bytes()).hexdigest()
refs={sid:(src['title'],src['url'],src['scope']) for sid,src in sources.items()}
M=runpy.run_path(str(ROOT/'tmp/pdfs/practical_model_v72.py')); checks=M['run_checks']()
caps=runpy.run_path(str(ROOT/'tmp/pdfs/practical_contract_v71.py')); capchecks=caps['run_checks']()

def param(pid,name,value,units,origin,sids,use,limit):
 return dict(id=pid,name=name,value=value,units=units,origin=origin,sources=sids,appUse=use,limit=limit)
parameters=[
 param('P01','Air VPD relation constants',[.6108,17.27,237.3],'kPa and Celsius','PUB_PHYSICAL',['S11'],'compute_air_only','Paired air values. Not leaf VPD or actual transpiration.'),
 param('P02','South African stage Kc',[.70,.75,.77,.66],'dimensionless','PUB_SITE_ESTIMATES',['S02'],'research_prior_matching_ground','Initial/development/mid/mature; site-scale ET includes soil/background. Not pot L/day or universal stage mapping.'),
 param('P03','CL/SCL field capacity',[.320,.260],'m3/m3','PUB_MEASURED',['S34'],'research_profile_example_only','Two particular mineral soils, not every clay/sandy soil or commercial mix.'),
 param('P04','CL/SCL permanent wilting point',[.120,.100],'m3/m3','PUB_MEASURED',['S34'],'research_profile_example_only','Laboratory/soil-specific quantities; users are not asked for them.'),
 param('P05','Study maximum allowable depletion',.6,'fraction of available water','PUB_AUTHOR_SELECTED',['S34'],'not_production_default','Chosen by authors from hydraulic properties, not an estimated universal cannabis stress threshold.'),
 param('P06','Study CL/SCL critical water content',[.200,.164],'m3/m3','DER_FROM_P03_P04_P05',['S34'],'reproducibility_example','Matches paper; soil-specific design thresholds, not app sensor inputs.'),
 param('P07','Derived CL/SCL 10-L available storage',[2,1.6],'L','DER',['S34'],'illustration_only','Uses actual filled10L, not20L nominal container. Assumes full stated volume root-accessible for calculation.'),
 param('P08','Derived CL/SCL depletion allowance and remaining action reserve',{'depletion':[1.2,.96],'remaining_action_reserve':[.8,.64]},'L','DER',['S34'],'illustration_only','Depletion=C*p; remaining action reserve=C*(1-p). Not a watering dose per plant; three plants shared each study pot.'),
 param('P09','Greenhouse light-treatment crop ET totals',[39.8,70.6],'L/m2 per21days','PUB_MEASURED',['S36'],'direction_and_validation_constraint','Higher light increased total water loss while improving WUE; not outdoor sun-category multipliers.'),
 param('P10','Native PM trial mean RH',[51,48],'%','PUB_REPORTED_MEANS',['S38'],'remove_high_mean_RH_necessary_gate','Means do not describe hourly extremes or establish a causal RH curve.'),
 param('P11','Native PM trial temperature ranges',[[17,26],[20,27]],'C','PUB_REPORTED_TRIAL_CONDITIONS',['S38'],'evidence_context_only','Not measured minimum/optimum/maximum infection temperatures.'),
 param('P12','Native PM inoculation protocol',[23,80,48],'C; %RH; hours','PUB_PROTOCOL',['S04'],'evidence_context_only','23C80%RH48h protocol followed by70%RH; not a necessary threshold or48h risk model.'),
 param('P13','Indoor control water status range',[60,80],'%container_capacity','PUB_PROTOCOL',['S37'],'exclude_outdoor_default','Sensor/gravimetric controlled indoor peat experiment. Not VWC60-80%.'),
 param('P14','Water conversion',1,'L per(mm*m2)','DER_DIMENSIONAL',[],'compute_volume_when_geometry_supported','Effective catchment and delivered fraction still uncertain.'),
 param('P15','Initial heat screen',32,'C air','ENG_LEGACY',['S03'],'pilot_weather_attention_only','Not measured leaf injury onset or optimum; no injury probability.'),
 param('P16','Initial cold/possible frost/freezing screens',[5,2,0],'C air','ENG_LEGACY',[],'pilot_weather_attention_only','Context screens, no frost guarantee or measured plant tissue temperature.'),
 param('P17','Initial wind screens',[15,10],'m/s gust; mean','ENG_LEGACY',[],'pilot_weather_attention_only','No measured cannabis breakage threshold; source alerts can operate independently.'),
 param('P18','Initial heavy-rain screens',[10,25],'mm/h; mm per complete24h','ENG_LEGACY',[],'pilot_weather_attention_only','No universal pot saturation/flooding threshold.'),
 param('P19','Hourly update cadence',1,'hour','ENG_DESIGN',[],'scheduler_candidate','Recompute sooner on new event/source alert; not care accuracy evidence.'),
 param('P20','Container/ground profile loss, storage, refill and action parameters',None,'profile-dependent','CAL_REQUIRED',['S11','S19','S34','S35'],'release_blocker_per_domain','Do not initialize them from a strain label, pot volume alone, or the engineering screens.'),
 param('P21','Disease response coefficients and alert cutoffs',None,'model-dependent','CAL_REQUIRED',['S04','S05','S38'],'release_blocker_for_predictive_push','Ambient feature extraction works without coefficients; disease prediction does not.')]

gaps=[
 ['G01','Initial reserve and unknown watering amounts','Instrumented reference pots; replay with log times only versus optional volumes. Report loss of useful decision coverage.','Blocks binary water decisions when robust states disagree.'],
 ['G02','Effective storage/accessible roots per setup','Measure representative filled volumes, rooting stages and medium retention in research cohort; infer ranges using base app inputs only.','Separate pot/ground and establishment domains.'],
 ['G03','Actual plant loss versus weather ET0','Lysimeter/weighing reference; fit setup-stage-size response and substrate evaporation separately; test outdoors.','No universal Kc*pot-volume formula.'],
 ['G04','Rain delivery and drainage','Co-located rain gauges and pot mass for exposed/sheltered setups, canopy stages and rain patterns.','Rain reception is needed; partial is not50%.'],
 ['G05','Age/height/medium usefulness','Ablate dated optional fields on held-out plants; check whether they reduce threshold-time error.','Do not require them unless benefit and burden justify it.'],
 ['G06','Weather spatial error and missing history','Compare API with reference stations/gauges across target regions; monitor provider-specific latency and revisions.','Never fill unavailable rain/history with zeros.'],
 ['G07','PM native response and specificity','Prospective weather-only cohort with independent disease confirmation and negative follow-up; compare a simple seasonal/scouting baseline.','No reliable humidity-only gate or weather-only infection probability yet.'],
 ['G08','Bud-rot stage and ambient-to-bud transfer','Flower-stage cohort with separately measured microclimate and verified outcomes; score using app-feasible inputs only.','No fixed internal bud RH offset or borrowed grape thresholds.'],
 ['G09','Warning thresholds and notification burden','Pilot ENG weather screens and factual conditions cards; measure actionable events, misses and repeated alerts.','Keep predictive disease push disabled pending validation.'],
 ['G10','Supported soil and climate coverage','Leave-medium, leave-region, leave-grower and future-season evaluation, including South African storm/wind regimes.','Declare profile coverage; abstain outside it.'],
 ['G11','Water need versus recommended dose','Separate retained-water estimation and drainage evaluation; log-only dose-free route must be tested.','Do not convert a water-needed flag into unvalidated litres.'],
 ['G12','Advice effectiveness and disease prevention','Prospective intervention evaluation with comparable controls and independent outcomes.','Warning accuracy alone does not demonstrate prevention.']]
contract={
 'version':'7.2','asOf':'2026-10-30','researchCheckedThrough':'2026-10-29','currentProductScope':'outdoor; basic setup + watering logs + automatic weather',
 'supersedes':'v7.1 for algorithm design; v7.1 low-input constraints retained',
 'routineUserAction':old['routineUserAction'],'dailyMeasurementRequirements':[],
 'acceptedProfileFields':old['acceptedProfileFields'],'acceptedRoutineLogFields':old['acceptedRoutineLogFields'],
 'excludedResearchInputs':old['excludedResearchInputs'],'excludedBaseModels':old['excludedBaseModels'],
 'weatherCapabilities':old['weatherCapabilities']+['typedReferenceET0IfAvailable','radiationIfAvailable'],
 'sources':sources,'newSources':list(new_sources),'parameters':parameters,
 'waterDecision':{'method':'supported correlated scenario trajectories; unanimity against profile-specific action reserve',
 'states':['water','not_due','uncertain'],'probabilityOutput':False,'measuredMoistureOutput':False,
 'requires':['validated_domain_profile','supported_initialization_or_state_range','time_ordered_supported_history'],
 'noVolumeDefaultFullRefill':False,'forecastRainCreditedBeforeOccurrence':False},
 'diseasePolicy':{'output':'ambient conditions and preparation, not pathogen detection',
 'temperatureHumidityPaired':True,'pathogenAssumedObserved':False,'predictivePushReleased':False,
 'highRHRequiredForPM':False,'weatherOnlyRootRotPrediction':False,'autoLeafTemperatureOrWetness':False,
 'legacyContextWeightsRenormalized':False},
 'gaps':[dict(id=x[0],uncertainty=x[1],investigation=x[2],consequence=x[3]) for x in gaps],
 'appAudit':old['appAudit'],'warnings':old['warnings'],'productionModelImplemented':False,
 'referencePurpose':'offline math and dependency contract only; all trajectory parameters supplied explicitly; no calibrated profiles bundled'}
for w in contract['warnings']:
 if w['id']=='W10':w['realisticBasis']='Ambient paired T/RH history; no required high average RH or leaf wetness gate. No calibrated risk curve; predictive push unreleased.'
 if w['id']=='W11':w['realisticBasis']='Reported flowering plus ambient history/direct rain context. No internal bud offset, actual wet-hours equation or calibrated probability.'
 if w['id']=='W06':w['realisticBasis']='Validated low-input profile and supported initial/input/history ranges; robust trajectory decision else uncertain.'
rules={
 'W01':('Supported local air temperature/duration OR explicit applicable source event','Air/source evidence first; stage/pot only changes preparation wording','No leaf temperature, injury probability or optimum inferred','ENG screen pilot; source adapter required for source route'),
 'W02':('Supported local minimum/duration OR applicable source frost/freeze event','Air/source evidence first; known vulnerable stage affects advice','No tissue-temperature or no-frost guarantee','ENG screens pilot; source route separately validated'),
 'W03':('Supported gust/mean wind OR applicable source event','Intensity provides trigger; plant/pot context affects stabilization advice','No fixed breakage odds or disease ventilation discount','ENG screens pilot; source route separately validated'),
 'W04':('Supported rain rate/complete amount OR applicable source event','Amount/rate plus direct reception; retained volume enters only through water model','No saturation/root-rot inference or rate-total substitution','ENG screens pilot; source route separately validated'),
 'W05':('Explicit mapped hazard with source, location and validity','Source event is prerequisite; severity retained from issuer','No hail from cloud text/UV; absent coverage is not all-clear','Requires tested source adapter'),
 'W06':('Certified profile + supported state/history + coherent trajectories','Remaining reserve versus profile action threshold; delivery and losses in physical units','No omitted-volume full refill, forecast-rain current credit or timer as moisture','Per-domain validation required before binary decision'),
 'W07':('Optional user-initiated problem evidence','Reported evidence leads; rain/watering may contextualize review','No weather-only root saturation or infection','No automatic weather-only route'),
 'W08':('Pot context + eligible heat preparation','Conditional action merged into heat card','No root/pot-wall temperature score','Merged context only'),
 'W09':('Supported paired air/dew context and solar night','Covered humidity exposure provides descriptive context','No measured condensation or leaf-wet-hours','Merged context only'),
 'W10':('Foliage relevance + supported paired ambient data','Concurrent T/RH and duration; no mandatory high-RH/rain gate','No spores, susceptibility, infection or universal temperature bounds inferred','Predictive push disabled pending prospective validation'),
 'W11':('Reported flowering + supported ambient data','Tissue gate first; concurrent exposure/history; canopy rain adds preparation context','No exact flower week from age, fixed bud offset or actual wet-hours','Predictive push disabled; factual preparation context allowed'),
 'W12':('Supported canopy-rain/humidity context','Shared preparation plus direct-exposure relevance','No specific leaf-spot pathogen detection','Merged generic context only'),
 'W13':('Known establishment context + optional problem evidence','Reported problem drives review; stage contextualizes','No weather-only damping-off prediction','No automatic weather-only route'),
 'W14':('Optional symptom/problem report','Reported evidence drives differential problem review','No weather-only root-rot diagnosis or automatic watering from wilt','No automatic weather-only route')}
for w in contract['warnings']:
 gate,combination,excluded,delivery=rules[w['id']]
 w.update(eligibility=gate,factorCombinationAndPriority=combination,excludedInferences=excluded,deliveryStatus=delivery)
(SRC/'WeedGrow_Low_Input_Model_Contract_v7.2.json').write_text(json.dumps(contract,indent=2,ensure_ascii=False),encoding='utf-8')
shutil.copyfile(ROOT/'tmp/pdfs/practical_model_v72.py',SRC/'WeedGrow_Low_Input_Math_Reference_v7.2.py')
shutil.copyfile(ROOT/'tmp/pdfs/practical_contract_v71.py',SRC/'WeedGrow_Low_Input_Capability_Reference_v7.2.py')
verification=dict(version='7.2',executedAt=datetime.now(timezone.utc).isoformat(),mathematicalChecksPassed=len(checks),mathematicalChecks=checks,capabilityChecksPassed=len(capchecks),capabilityChecks=capchecks,biologicalAccuracyValidated=False,productionModelImplemented=False,appSourceChanged=False,pdfQA=None)
(SRC/'WeedGrow_Low_Input_Verification_v7.2.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')

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

page('WeedGrow\nLow-input evidence & algorithm','v7.2 | PRACTICAL OUTDOOR WATERING AND WARNING SPEC | 30 OCTOBER 2026')
p('This revision re-examines cannabis and hemp research using the inputs the ordinary app can actually obtain: simple setup, watering events and automatic weather. It adds numerical provenance, factor interactions, a buildable water-balance contract and an explicit investigation plan.')
callout('Product promise: estimate whether watering is due when the available evidence supports it, and prepare the user for damaging weather or disease-conducive conditions. No daily soil checks, leaf temperatures, sensors or detailed plant measurements are required.')
h('What is ready, and what remains unproven')
p('Physical calculations, weather normalization and condition summaries can be specified now. Accurate watering decisions still need validated setup profiles and initialization. Disease-specific predictive alerts still need prospective outcomes. The companion reference executes mathematics and dependency checks; it is not a field-validated care engine.')
p('v7.2 supersedes v7.1 algorithm-design detail while preserving its low-input scope. Earlier physiology simulators, guessed leaf temperatures and grape wetness equations remain excluded from the base app. Existing application source files were not changed.')
p('Reading order: sections02-03 define inputs; 04-10 define numerical use and watering; 11-16 define warnings; 17-20 define calibration, verification and implementation. The machine contract preserves all38 sources and every parameter status.')

page('01  What the extra research changes','FOUR NEW FULL PRIMARY PAPERS; ONE ADDITIONAL PRIMARY METHODS/RESULTS RECORD')
table(['Finding','Consequence for WeedGrow'],[
 ['Hydraulic properties matter [S34]','A measured medium profile changes storage and irrigation timing. Pot litres alone cannot identify available water.'],
 ['Cultivar and architecture alter hydric response [S35]','Height, stage and age can narrow a profile; they cannot identify exact leaf area, rooting or water use. Strain names are not calibrated physiological profiles.'],
 ['More light increased crop ET while improving WUE [S36]','Do not interpret efficient growth as lower absolute consumption. Separate atmospheric demand, plant size and surface evaporation.'],
 ['Recent indoor drought evidence is context-specific [S37]','Do not import container-capacity percentages or deliberate stress schedules into an outdoor beginner algorithm.'],
 ['PM developed during trials averaging48-51%RH [S38]','High average RH cannot be necessary for a mildew warning. Neither this nor a high-RH inoculation protocol defines a weather-to-infection curve.']
],[.40,.60])
p('Four downloadable primary PDFs were read for methods, units, results and experimental limits; their key numerical pages were rendered and checked. S38 was available through primary publisher-indexed methods/results, with bibliographic confirmation; direct full-page access returned403. No inaccessible article is described as fully reviewed.')
h('Evidence hierarchy')
p('Use measured quantities within their original domain; derive only dimensionally valid consequences. Keep author-selected experimental settings distinct from fitted biological thresholds. A coefficient can be published and still be unsuitable as an app default. Primary-source details and limitations appear in the ledger.')

page('02  The realistic client contract','ORDINARY USE: ONE-TAP WATERING LOGS; AMOUNT OPTIONAL')
table(['Input','How obtained and how it affects the model'],[
 ['Location and outdoor environment','Once. Coordinates/timezone select weather and location uncertainty. Outdoor API values do not describe greenhouse or indoor air.'],
 ['Pot or ground; approximate pot size with units','Once. Select separate profiles. Nominal container litres are an approximate bound on filled volume, not a measurement of rooting or rain-catching area. Unknown size stays unknown.'],
 ['Current stage, including not sure','At setup and meaningful transitions. Controls tissue eligibility and candidate growth profile. Do not derive flowering or flowering-day numbers solely from chronological age.'],
 ['Sun category','Existing full/partial/mostly shade/not sure. A broad exposure profile, not measured PAR, exact shade hours or a fixed radiation fraction.'],
 ['Rain reception','One understandable choice: leaves and soil / leaves only / soil only / neither / not sure. Represent canopy and soil separately. Partial or uncertain reception stays a range.'],
 ['Medium, if known','Optional potting mix / garden soil / coco / other or not sure. Select only a validated broad profile. Existing soil provenance is not hydraulic texture.'],
 ['Age and dated height already provided','Optional. Keep the meaning of age (seed versus clone) and date. Use as uncertain profile information; no repeated measurement requirement.'],
 ['Watering event time; optional amount','Routine log. Respect backdating, date-only precision and duplicate retries. Omitted volume does not mean full refill. Missing log does not prove no watering.']
],[.36,.64])
p('Do not request leaf/root temperatures, measured roots, canopy area, leaf count, internal humidity, airflow measurements, leaf wetness or daily moisture observations. Photos and occasional problem reports remain user-initiated. Repotting, moves or a changed medium invalidate affected state/history and trigger a new uncertainty assessment.')

page('03  Improve the backend, not user burden','TYPED INTERVALS, HISTORY AND OPTIONAL REFERENCE ET0')
table(['Automatically obtainable','Correct interpretation'],[
 ['Paired hourly air T/RH, wind/gust and rain','Persist raw normalized intervals, location revision, timezone, provider, issue time and data nature. Pair values from the same time; retain missingness.'],
 ['Occurred weather estimates and forecast','Keep separate timelines. Request true historical/analysis products when needed; archived forecasts are forecasts of the past. Provider history is still a spatial estimate, not a rain gauge beside the plant.'],
 ['Reference ET0 and radiation, if adopted','Open-Meteo documents hourly FAO56 ET0 using T, RH, wind and solar radiation. It assumes well-watered grass, not this plant. A backend feed adds no user measurement burden. [S33]'],
 ['Source severe-weather products','Use explicit supported hazards with validity times/location. Retain issuer severity. Current app request excludes alerts; a tested adapter is needed. [S12]'],
 ['Near-saturated air and solar night','Compute from paired air data and real local sunrise/sunset. It is humidity/dew potential context, not measured leaf or flower wetness.']
],[.38,.62])
p('Store precipitation interval start/end, amount versus rate, and liquid versus snow semantics. Current OpenWeather rain.1h is documented in mm/h; it is not a24-hour total. Never sum overlapping current/hourly/daily products or multiply a rain amount by precipitation probability unless the provider explicitly defines that quantity. [S12]')
p('For an hourly amount representing the preceding hour, credit it to that interval. An hourly mean radiation value is not instantaneous; ET0 hourly sums are not rates to be multiplied again by3600. Use wind at its documented height or a valid conversion when calculating ET0. UV index is not a substitute for solar radiation. [S33]')
callout('Do not treat API soil-moisture or soil-temperature grids as measurements inside a pot, raised bed or local root zone. Better backend data improves the forcing; it does not reveal unobserved plant storage.')

page('04  Values we can actually use','NUMERICAL ORIGIN IS PART OF EVERY PARAMETER')
table(['Status','Meaning and permitted use'],[
 ['PUB physical','A supported physical relation: e.g. saturation vapour pressure. Use with valid inputs and units.'],
 ['PUB measured/site estimate','A measured quantity or fitted site result. Use directly only within a supported transfer domain; otherwise a research prior/example.'],
 ['PUB author-selected','An experimental target chosen by authors. It is evidence of the study design, not an estimated optimum or universal threshold.'],
 ['DER','A calculation from explicitly named quantities. Transfer uncertainty stays attached. Derivation does not create extra field evidence.'],
 ['ENG','An engineering screen, cadence, notification or numerical choice. Pilot/tune it; never call it a measured plant coefficient.'],
 ['CAL required','An unknown profile, effect or cutoff that needs data. Null in configuration; it must not silently become zero or a default.']
],[.32,.68])
h('A useful automatic calculation: air VPD')
code('es(T) = 0.6108 * exp(17.27*T/(T+237.3))  [kPa]\nairVPD = es(Tair) * (1 - RH/100)\nAt30C: RH40% ->2.55kPa; RH80% ->0.85kPa')
p('This combines temperature and humidity without asking for leaf temperature. It describes atmospheric demand at the weather location. It does not establish leaf VPD, prove dry soil or give litres consumed. Cannabis stomatal responses vary; a linear universal VPD-to-consumption multiplier is not supported. [S11, S19, S35]')
p('The companion JSON contains21 parameter records with value, units, source, origin, intended use and restriction. Production profiles and disease coefficients remain null where the evidence does not identify them.')

page('05  Published water numbers: correct domains','CONCRETE VALUES WITH STRICT TRANSFER LIMITS')
table(['Quantity','Source value','What it can support'],[
 ['South African field Kc','0.70 /0.75 /0.77 /0.66','Initial/development/mid/mature stages in that field study. Prior for comparable ground cultivation, not pot dosing. [S02]'],
 ['Two mineral soils: FC','CL0.320; SCL0.260 m3/m3','Measured soil-specific storage properties. A label such as garden soil does not establish these values. [S34]'],
 ['Same soils: PWP','CL0.120; SCL0.100 m3/m3','The lower water reference in that hydraulic model; not app-observed moisture. [S34]'],
 ['Selected allowable depletion p','0.60','Chosen in the hydraulic study, not measured as the universal cannabis stress point. [S34]'],
 ['Derived critical theta','0.200 /0.164 m3/m3','FC -p*(FC-PWP), matching the study; an experimental design threshold, not a beginner input.'],
 ['Derived10-L available storage','2.00 /1.60 L','10*(FC-PWP). The actual filled soil was10L inside nominal20L pots; three plants shared a pot.'],
 ['Derived depletion allowance','1.20 /0.96 L','Storage*p. Remaining action reserves are0.80/0.64L. Neither quantity is a recommended watering dose.']
],[.32,.25,.43])
p('The hydraulic experiment used Felina32, two soils and three irrigation treatments, initially five pot replicates/cell; the analysed balanced dataset used four. It does not identify the properties of peat, coco, compost mixes or every soil with the same texture. These values stay research examples until a suitable app profile is validated. [S34]')
p('Depletion and remaining reserve are different: RAW=p*C is the allowable loss from full available storage; action reserve A=C-RAW=(1-p)*C. A model comparing remaining water against RAW would trigger at the wrong point.')
p('For field ET,1mm equals1L/m2. If ET0 is5mm/day and matching Kc is0.77, the result is3.85mm/day, not3.85L per plant. The ground area and crop/profile transfer would still need support. Never multiply a field Kc by pot litres to manufacture water use. [S02]')

page('06  Baseline, age, size and medium','EACH FACTOR CHANGES A PHYSICAL COMPONENT OR UNCERTAINTY')
table(['Factor','How it combines with others','What would be wrong'],[
 ['Pot size + medium + stage','Filled, root-accessible medium volume and retention determine available storage. An established plant and a new seedling in the same pot may access different regions.','A fixed number of days per pot litre, or fully rooted storage from nominal volume.'],
 ['Size/height + stage + sun','Select a validated range for plant demand and its development. Sun influences energy and growth; height is an imperfect architecture proxy.','Exact leaf area from height, or a universal taller-plant percentage.'],
 ['Age + known origin + stage','Age is a growth prior, dated and uncertain. Actual stage takes precedence for flower eligibility. Clones and seedlings can have different histories.','Exact rooting/flowering from days since creation; leaf age from plant age.'],
 ['Medium + rainfall/watering','Retention, infiltration, delivery and drainage determine what stays available. Use medium families with measured variation.','Potting mix equals native soil, or all delivered water is retained.'],
 ['Weather + exposure + available water','ET0 combines energy and atmosphere; profile changes translate it to losses. Soil limitation can reduce transpiration before tissue wilts.','ET0 plus separate unvalidated heat/RH/wind multipliers, or lower loss means the plant is safe.']
],[.24,.42,.34])
p('A useful model does not need a numeric weight for every stored field. Optional height or age should only change a profile if held-out evaluation demonstrates benefit. If unknown, integrate over the validated profile range rather than demand a new measurement. Ground storage/rooting and capillary supply require a separate model from pots. [S11, S19, S34, S35]')

page('07  The watering model to build','TIME-ORDERED WATER BALANCE WITH SUPPORTED SCENARIO RANGES')
code('For each supported correlated scenario j:\n  Cj = available-water capacity [L]\n  Rj = current available-water reserve [L]\n  Aj = action reserve threshold [L]\n  delivered = rain delivered + irrigation delivered\n  excess = max(0, Rj + delivered - Cj)\n  stored = min(Cj, Rj + delivered)\n  extracted = min(stored, potential_loss)\n  next_Rj = stored - extracted\n\n  balance: old_R + delivered = next_R + excess + extracted')
p('C, R and A are profile/state quantities estimated by the backend, not requested from growers. Available water is a modeled bank above a lower extraction reference. It is not the total water in the soil and is not a directly observed moisture percentage. The simplified reference checks accounting near the action threshold; it is not a full surface-drying, drainage or waterlogging model.')
h('Model plant loss and surface evaporation separately')
p('Prefer transpiration + medium-surface evaporation, driven by supported weather/exposure and setup profiles. A reference-ET route may use a validated effective-area coefficient for each component; keep dimensions in L/mm or m2 explicit. Effective plant area is not automatically pot-opening area. If a single total coefficient is fitted instead, do not add evaporation again.')
p('FAO separates stress effects on transpiration from soil evaporation. This matters for open pots and sparse plants. Do not apply one drought reduction to both components without testing it. [S11] The greenhouse light trial also measured substantial pot evaporation; it cannot supply the outdoor fraction. [S36]')
h('Scenario trajectories, not fabricated precision')
p('Keep coherent profile combinations and their correlated history: stage, accessible volume, demand, rain delivery and refill ranges. Independent min/max substitution can create impossible plants. Scenario agreement is a robustness test, not a probability, statistical confidence interval or proof the set covers reality. Validate range coverage first.')

page('08  Rain and logged water are different evidence','RECEPTION, TIMING AND RETENTION MUST ALL BE CORRECT')
table(['Event','Water-balance treatment'],[
 ['Rain can reach soil','Delivered litres = rain depth(mm)*supported effective catchment(m2)*delivery fraction. Rainfall can be intercepted or redistributed by canopy. Pot volume does not identify catchment.'],
 ['Rain cannot reach soil','Direct rainfall contribution is zero. Leaf exposure can still support wet-weather context. Ambient humidity can still matter even when neither surface receives direct rain.'],
 ['Partial/not-sure reception','Use a supported range including plausible shelter. Never silently choose50%. Uncertainty may prevent a binary water decision.'],
 ['Forecast rain','Use future trajectories for preparation. Do not add it to current stored water or postpone an already-supported urgent watering decision merely because rain is forecast.'],
 ['Watering with volume','Volume is applied water, not necessarily retained/root-accessible water. Treat runoff, bypass and drainage with a validated profile range.'],
 ['Watering without volume','Record the action/time. Use a validated refill distribution/range for that supported setup, or retain an unknown increment. Never reset to capacity by default.'],
 ['Large input','Cap the modeled available bank and account for excess. Overflow does not establish actual root saturation, oxygen deprivation or root-rot infection.']
],[.31,.69])
p('Illustration:10mm rain across a supported effective catchment of0.07m2 gives0.70L before delivery/storage losses. Even visible rain may not refill a large deficit. Conversely, direct rain over a ground root zone has different geometry and storage. This arithmetic is exact; the catchment/delivery estimate may not be. [S11]')
p('Replay watering, rain and losses in occurrence order. When date-only logs leave order uncertain, branch timing scenarios. Reconcile retries and backdated entries idempotently, then replay affected state. The same water must not appear once in a current rate and again in a daily aggregate.')

page('09  Initialization and the binary answer','A YES/NO REQUIREMENT DOES NOT MAKE UNOBSERVED MOISTURE IDENTIFIABLE')
table(['State of evidence','Required result'],[
 ['All supported trajectories at/below their action reserve','Watering is estimated due. Return water with the main reason and estimate label.'],
 ['All supported trajectories above their action reserve','Not due at the current evaluation time. Recompute automatically with new weather/logs; do not promise a full day of safety.'],
 ['Supported trajectories disagree','Uncertain. Say whether the problem is recent rain, unknown refill, setup change or missing history. Do not convert this into not due.'],
 ['No validated profile, poor initialization or uncovered history','Uncertain even if a narrow invented set would agree. Profile certification and state-range coverage are prerequisites.'],
 ['Today was watered','Update using the event. It does not force not due/high confidence if the event was small, unquantified or followed by substantial demand.']
],[.44,.56])
h('Start and recover without daily checking')
p('Backfill available occurred weather and replay known logs, with a broad initial reserve range. A recent watering action alone does not establish a full root zone. A genuinely supported refill anchor may narrow the state; the model must not create that anchor from user compliance.')
p('Offer a single optional startup aid if it materially improves the estimate: backdate a known watering, record a known amount, or make one occasional check. None becomes a daily requirement. If the log-only profile remains unreliable, keep uncertainty or a clearly labelled routine reminder; do not claim the studies solve missing state.')
p('The action threshold must be selected for the care objective and validated before stress, rather than treating survival, lower yield, wilting or a laboratory transpiration endpoint as an ideal watering point. Germination, unrooted clones and newly transplanted/local wetting zones require separately validated establishment profiles.')

page('10  Worked combinations and attribution','ILLUSTRATIVE STATE REPLAY; THESE ARE NOT FIELD ACCURACY RESULTS')
table(['Example with supplied scenario values','Result and meaning'],[
 ['Capacity2.0L; reserve1.0L; action0.8L; add0.4L; loss0.2L','Next reserve1.2L. Above the supplied action threshold, so this one trajectory is not due.'],
 ['Same state; add3.0L; loss0.5L','Excess2.0L; final1.5L. Large logged input cannot create storage above capacity. Excess is not a root-rot score.'],
 ['Same state; no input; potential loss3.0L','The bank stops at0L; unmet potential demand2.0L. Do not report negative moisture or guarantee actual transpiration stayed3L.'],
 ['Two supported trajectories: reserves0.7/0.8L, actions0.8/0.8L','Both at/below action: estimated water.'],
 ['Reserves1.0/0.5L, actions0.8/0.8L','Disagreement: uncertain. A midpoint or majority vote does not justify a confident answer.'],
 ['Warm dry hour, followed by cool humid hour','Do not combine the warm temperature from one hour with humidity from the other into a fictitious simultaneous disease exposure.']
],[.52,.48])
h('How to explain which factors mattered most')
p('For each decision, expose an internal balance ledger: starting reserve range, logged-water contribution, rain contribution, transpiration/evaporation loss, excess and current distance to action. This ranks contributions in actual units for this event rather than assigning universal percentages.')
p('For fitted profiles, test sensitivity by changing one supported input or parameter within its uncertainty and recording the change in predicted threshold time. Rank those changes for the current plant. A sensitivity ranking depends on weather and state; it is not an experimentally established causal ranking for all cannabis.')
p('A hot week can make atmospheric demand dominant; a sheltered pot after an unquantified watering may instead be dominated by refill uncertainty. Both are legitimate reasons for the app to behave differently even when the latest air temperature is identical.')

page('11  How warning factors combine','ELIGIBILITY FIRST; CONCURRENT EXPOSURE SECOND; CLAIM AND ACTION LAST')
code('1. Validate location, interval, source and data nature.\n2. Gate tissue/exposure relevance using obtainable setup.\n3. Combine factors that occur in the same interval.\n4. Integrate covered exposure over time; retain gaps.\n5. Select a supported claim and useful preparation action.\n6. Apply notification priority/deduplication separately.')
table(['Combination','What the interaction means'],[
 ['Heat + dry air + energy + available water','Raises potential demand in a coupled weather/loss model. Water shortage and heat preparation are related but independent outputs.'],
 ['Rain + soil reception + geometry + storage deficit','Determines delivered/retained water. Neither rain presence nor24h amount alone proves the root zone is wet.'],
 ['Flowering + canopy rain + humid ambient history','Makes flower wet-weather preparation relevant. Does not establish spores, actual internal wetness or infection.'],
 ['PM host foliage + suitable ambient conditions + inoculum','A disease mechanism; inoculum and susceptibility are not observed by the API. High RH and rain are not mandatory PM gates.'],
 ['Wind + pot/plant context','Supports moving/stabilizing advice. Station wind does not measure canopy ventilation or protect against mildew by a fixed percentage.']
],[.38,.62])
p('Remove legacy80/20 disease-context budgets from the base model when their context inputs are unavailable. Do not fabricate density, damage or cultivar-resistance values, or renormalize and claim unchanged calibration. Existing65/35 or similar hazard attention weights are engineering choices, not measured injury coefficients.')
p('Actual numeric combination weights belong in the physical balance or in a fitted, independently validated response model. Separate that from product priority: an official destructive-weather alert can outrank a low-confidence care estimate without being a biological coefficient.')

page('12  Powdery mildew: revise the assumptions','CAN DESCRIBE CONDITIONS; CANNOT YET ESTIMATE INFECTION ODDS')
table(['Evidence','Safe inference and limit'],[
 ['S38: trials averaged51% and48%RH; temperatures17-26C and20-27C','High average RH cannot be necessary. Hourly high-RH episodes may still have occurred; averages do not establish a lower humidity boundary or a dose-response.'],
 ['S04: inoculation protocol at23C,80%RH for48h, then70%RH','Shows an experimental infection protocol, not a universal80% threshold,48h exposure requirement, or probability for an outdoor forecast.'],
 ['Genotype/resistance differences in cannabis research','Host susceptibility matters but is not known from a generic strain label. Exclude a resistance bonus in the base model.']
],[.47,.53])
h('Obtainable inputs and eligibility')
p('Use the reported plant stage/foliage relevance and paired ambient T/RH history or forecasts. Outdoor shelter from direct rain does not eliminate PM relevance. No rain, leaf-wetness, RH85% or measured leaf-temperature gate is allowed. Missing/unknown stage is an eligibility uncertainty, not evidence of low risk.')
h('Output now versus predictive model later')
p('The base app can show factual ambient conditions and practical mildew awareness. It must not convert ordinary warm weather into repeated disease pushes. PM-specific predictive push remains disabled until a low-input model demonstrates useful discrimination and acceptable burden versus a simple awareness baseline.')
p('Candidate future predictors include concurrent T/RH response, duration/recency and season, with prospective verified outcomes. Allow non-monotone humidity effects if supported; do not force a high-RH-only shape. Weather alone may have inadequate specificity. If it does, retain awareness/optional scouting rather than claim a disease detector.')
callout('No retrieved cannabis experiment here identifies a transferable set of T-by-RH coefficients for predicting outdoor PM incidence from regional weather alone. The missing coefficients are a real evidence gap, not a reason to invent weights.')

page('13  Flower rot and other damp-weather context','REPORTED FLOWERING IS A STRONG PRACTICAL ELIGIBILITY GATE')
p('For the bud-rot-specific card, require reported flowering/inflorescence presence. Unknown stage gets generic wet-weather preparation rather than automatic assignment to flowering. Do not infer a precise flower susceptibility week from plant age or a calendar prediction. [S05]')
table(['Factor','Role in the base app'],[
 ['Paired air temperature and RH over time','Concurrently observed/forecast ambient exposure. Keep contiguous episodes, cumulative covered hours and missing hours separate. A daily mean cannot reproduce a joint hourly response.'],
 ['Rain reaching canopy','Supports direct wet-weather preparation. Soil-only rain does not establish wet flowers; a rain shelter does not eliminate humidity/condensation-related risk.'],
 ['Duration and previous conditions','Retain prior episodes and forecast preparation separately. A dry afternoon does not demonstrate absence of latent infection. Exact risk memory/decay remains uncalibrated.'],
 ['Inside-flower microclimate','Unobserved. A greenhouse study measured differences from ambient; do not add a fixed15.4 RH points or2.5C to every outdoor flower.'],
 ['Local wind, wounds, litter, cultivar resistance','Mechanistically relevant but not routine client observations. No guessed modifiers. Station gusts cannot substitute for a fan experiment.']
],[.35,.65])
p('S05 supports flower-stage and delayed-symptom relevance, but was reviewed through limited primary accessible content. Its inoculation timing and internal measurements do not supply a complete outdoor ambient-risk function. Grape Botrytis or TOMCAST equations requiring measured wetness remain research comparisons, not base-app cannabis models.')
h('Preventive behavior supported by the data')
p('Before direct rain, offer suitable rain protection for movable plants while preserving ventilation, and avoid unnecessarily wetting flowers during watering. Merge shared damp-weather context with the same preparation card. An occasional scout after a meaningful episode can be optional; do not demand daily inspections. These actions reduce avoidable exposure; this release has not demonstrated disease prevention.')
p('Do not create weather-only Septoria, damping-off, root-rot or nutrient-deficiency diagnoses. A user-initiated symptom report can open a separate problem review, with its own evidence limitations.')

page('14  Weather warnings with explicit numeric status','SOURCE HAZARDS AND PILOT ATTENTION SCREENS ARE SEPARATE')
table(['Warning','Candidate screen / strongest available evidence','Important limits'],[
 ['Heat','Legacy air32C screen; retain peak and covered duration. Source heat alerts may apply independently.','ENG attention threshold, not cannabis injury onset or an optimal temperature claim. No leaf-temperature estimate.'],
 ['Cold / frost / freezing','Legacy5C cold,2C possible frost,0C air-freezing screens; official frost/freeze product where supplied.','ENG screens. Frost can occur at plant surfaces without air reaching0C; warm API air is not proof of no surface frost.'],
 ['Wind','Legacy gust15m/s or mean10m/s; explicit severe wind source product.','ENG practical attention screen, not measured stem/pot failure threshold. Units and gust/mean cannot be mixed.'],
 ['Heavy rain','Legacy10mm/h or25mm per complete24h; explicit rainfall/flood source products.','ENG screen; rate is not daily amount. Rain reception controls direct exposure. No root saturation inference.'],
 ['Hail / destructive source hazard','Explicit recognized source event, valid for the location/time.','Source-only. Description text/cloud/UV cannot manufacture a hail prediction. Coverage absence is not all-clear.']
],[.19,.43,.38])
p('These numerical screens are preserved as transparent pilot candidates, not newly supported biological values. They must be evaluated in the target climates and notification workflow. Prefer actionable issuer information when available; retain the factual trigger and source timing. Duration/intensity should be reported, not hidden inside an unvalidated probability.')
p('For heat, cold and wind, pot/stage/exposure can change practical advice. Do not use unknown physiology as a numeric protection factor. Merge container-heat context into heat preparation; neither pot color nor root temperature is required to receive useful weather preparation.')

page('15  Complete warning registry: weather & water','ALL FOURTEEN IDS PRESERVED; DISPLAY CARDS CAN BE MERGED')
table(['ID / warning','Eligibility and determining data','Relative role / effect'],[
 ['W01 Heat','Supported local air T and duration or source event; current/future separated.','Weather supplies trigger; pot/stage affects action wording. No leaf-heat diagnosis.'],
 ['W02 Cold/frost','Supported local minimum/duration or source frost/freeze event.','Air/source evidence leads; vulnerability changes advice, not a proven tissue-freeze probability.'],
 ['W03 Wind','Supported mean/gust or source wind event.','Intensity is trigger; plant/pot context changes stabilization advice. No canopy-airflow disease discount.'],
 ['W04 Heavy rain','Correct rate/complete amount or source event, with reception.','Rain trigger plus exposure gate; storage/soil delivery only enters watering through the water model.'],
 ['W05 Hail/severe','Explicit mapped source hazard with location/time validity.','Source prerequisite dominates. No source coverage means unknown, not hazard absent.'],
 ['W06 Watering due','Validated profile, supported state/history and time-ordered input/loss ranges.','Available reserve versus action threshold determines result. Rain, weather, medium, stage and size act through physical components.'],
 ['W07 Excess root water','Optional user-initiated problem evidence.','No automatic weather-only saturation/rot route. Wet weather is context, not diagnosis.']
],[.22,.43,.35])
p('An input has no scientific weight simply because it is stored. A relevance gate can be decisive without a numeric coefficient. Missing eligibility/data must be returned as unknown or unsupported, separately from a supported condition-not-met result.')
h('Delivery and conflict handling')
p('A severe weather alert is independent of a watering recommendation. Merge overlapping heat/container or dampness/flower cards, and retain one explanation with the relevant actions. Cooldowns govern repeated notifications, not biological state. Do not let deduplication erase an escalating source hazard or let a watering log clear a weather alert.')

page('16  Complete warning registry: plant health','AMBIENT CONTEXT, TISSUE RELEVANCE AND OPTIONAL PROBLEM REVIEW')
table(['ID / warning','Eligibility and determining data','Relative role / effect'],[
 ['W08 Container heat','Pot context plus W01 heat preparation.','Merged advice. No pot-wall/root-temperature risk score.'],
 ['W09 Dew/dampness','Supported paired air/dew context and night interval.','Merged humidity context; not measured condensation or actual wet-hours.'],
 ['W10 Powdery mildew','Foliage relevance plus ambient history/forecast; no mandatory rain/high-RH gate.','Weather describes conditions. Pathogen/host susceptibility unobserved; predictive push awaits validation.'],
 ['W11 Bud-rot conditions','Reported flowering plus paired ambient history; canopy rain adds preparation context.','Flower tissue is gate; ambient combinations describe exposure. No internal-bud correction or infection probability.'],
 ['W12 Wet-leaf disease context','Canopy rain/humidity supports shared preparation.','Merged generic context; no pathogen-specific leaf-spot/Septoria prediction.'],
 ['W13 Wet establishment','Known establishment stage can contextualize a user-initiated problem.','No weather-only damping-off prediction or daily root check requirement.'],
 ['W14 Root/wilt problem','Optional symptom/problem report.','Wilt has multiple causes. No automatic root-rot diagnosis or automatic watering merely because of wilt.']
],[.24,.41,.35])
p('No card promises that a disease is present, absent or prevented. The useful base behavior is timely preparation plus occasional optional problem review. A source-supported current weather event can be definite as a weather estimate while its effect on this plant remains uncertain.')
h('Common dangerous combinations to reject')
bullets(['Rain + frequent watering does not prove oxygen deficiency; unknown substrate and drainage still matter.',
 'High API wind does not prove dry flowers or adequate internal ventilation.',
 'A cool humid night and a hot dry day are different exposures; do not fuse their extrema.',
 'Dry air, a recent no-symptoms report or today\'s watering is not an all-clear for previously initiated disease.'])

page('17  How to learn weights without new daily inputs','RESEARCH MEASUREMENTS BELONG IN A SEPARATE OPT-IN VALIDATION COHORT')
table(['Model component','Data to fit or validate','At ordinary inference'],[
 ['Storage/refill profiles','Reference pot mass, retention and drainage, representative plants/media, logged events; known irrigation amount in research.','Use only simple setup and normal log fields; omitted volume remains possible.'],
 ['Water-loss response','Independent water loss/ET across weather, growth and exposure. Test separate soil evaporation.','Automatic weather + supported setup profile; no PAR meter or leaf-temperature entry.'],
 ['Water action threshold','Operational care endpoint before harmful stress; reference moisture/plant response and blinded care review.','A backend profile threshold, not a user moisture question.'],
 ['Disease coefficients','Prospective confirmed positive and followed negative outcomes, onset intervals, treatment/confounding records and ambient history.','Paired API weather, stage and reception. Do not use research-only sensors as deployed predictors.']
],[.28,.43,.29])
h('Candidate fitted structure')
code('Water loss: f(ET0, setup, stage, dated optional size, history)\n  + explicit supported surface evaporation if not already in f\n\nFuture disease model, only after outcome data:\n  logit(P(Y within stated horizon)) = intercept\n    + joint_response(Tair, RH, duration, recency)\n    + supported stage/exposure terms\n  Coefficients, horizon and cutoff: CAL required')
p('Use regularized smooth interactions or a similarly constrained model; compare against simpler alternatives. Do not translate p-values, partial eta-squared, a fan treatment effect, inoculation protocol or yield change from unrelated designs into probability coefficients. Studies supply candidate structure and priors; a pooled parameter is defensible only with compatible endpoints, treatments and raw data.')
p('If probabilities are eventually released, calibrate and test them for the stated future horizon, location and deployment population. Absence of a user report is not a negative disease label. Team-managed reference measurements must remain isolated from ordinary product requirements.')

page('18  Remaining gaps and how to close them','THESE ARE CONCRETE INVESTIGATIONS, NOT EXTRA REQUIRED CLIENT FIELDS')
table(['Gap','Investigation / product consequence'],[
 [x[0]+' '+x[1],x[2]+' '+x[3]] for x in gaps[:6]
],[.35,.65])
h('What cannot be safely estimated yet')
p('Exact moisture from pot volume, recent weather and watering time is not identifiable when initial state, retained volume, rooting and losses remain unknown. Knowing the full weather history cannot remove those ambiguities. The relevant objective is accurate watering action with useful coverage, not a fictitious soil-moisture percentage.')
p('Alternatives: validate broad log-only profiles; offer one optional startup/refill aid; use voluntary volume when available; or give an explicit reminder/uncertain result for unsupported cases. Sensors are an optional future product, not a hidden requirement of this algorithm.')

page('19  Disease and release investigations','TEST USEFULNESS, SPECIFICITY AND LOW-BURDEN COVERAGE TOGETHER')
table(['Gap','Investigation / product consequence'],[
 [x[0]+' '+x[1],x[2]+' '+x[3]] for x in gaps[6:]
],[.35,.65])
h('Acceptance must reflect the actual user workflow')
bullets(['Split evaluation by grower/plant, region and future season. Hours from the same plant must not leak into training and test sets.',
 'Watering: report missed due events, unnecessary watering, threshold-time error, useful binary-decision coverage, abstention and calibration burden. Compare with the existing timer and a simple ET baseline.',
 'Disease: report sensitivity, precision, false notifications per plant-week, lead time, coverage and probability calibration if applicable. Use confirmed positives and genuinely followed negatives.',
 'Ablate optional age/height/medium and watering amount. Show whether normal log-only use remains useful. Do not evaluate with sensors and deploy without them.',
 'Pre-register quantitative release targets based on care harm and user tolerance; do not invent a90% accuracy claim or achieve high accuracy by evaluating only easy cases.'])

page('20  Implementation sequence and verification','SPECIFICATION AND OFFLINE REFERENCE; APPLICATION IMPLEMENTATION REMAINS SEPARATE')
table(['Order','Concrete work'],[
 ['1. Data correctness','Persist typed paired intervals and historical coverage; fix rate-versus-total, forecast-versus-history and solar-time handling. Add source-hazard adapter if that route is shipped.'],
 ['2. Small setup changes','Add soil/canopy rain reception and optional meaningful medium choice; preserve unknown options and unit-labelled pot size. Reuse existing stage, age, height and sun.'],
 ['3. Profiles and reference replay','Start with declared domains, preferably established container setups; evaluate ground and establishment separately. Fit state/loss/refill/action ranges in the cohort.'],
 ['4. Consumer corrections','Invalidate on all real dependencies, including plantedIn, medium, age and dated size when used. Replace same-day watered/high-confidence override with the model result.'],
 ['5. Warning rollout','Weather preparation plus factual ambient cards first; merged context, source provenance and uncertainty. No predictive disease pushes or automatic root diagnoses until supported.'],
 ['6. Release review','Evaluate the true low-input workflow against baselines and pre-registered targets. Restrict claims to tested domains.']
],[.28,.72])
p('The current source review found a daily cache that drops paired intervals; current rain-rate versus daily-total ambiguity; future hourly context attached to current/observed entries; potential solar-time double offsets; incomplete advice invalidation; and a same-day watering override. These are implementation findings from the retained source audit, not changes delivered by this document.')
p(f'Executed: {len(checks)} mathematical/reference checks and {len(capchecks)} retained capability checks. They cover dimensions, native arithmetic, reserve bounds, conservation, scenario disagreement, missing history, prohibited probability claims, nonconcurrent air values, forecast separation and overlap rejection. Passing checks establishes code-contract consistency, not plant-care accuracy.')
callout('The next engineering milestone is a correct weather/event ledger and a measured low-input profile pilot. More unsupported weights will not resolve initial-state, retained-water or disease-label gaps.')

page('Evidence A: numerical water evidence','PRIMARY SOURCES AND PRECISE TRANSFER LIMITS')
for sid,note in [
 ('S02','Field Kc stage estimates0.70/0.75/0.77/0.66 were checked against the full study/figure in the retained research. Site-scale ground ET includes background evaporation; not pot consumption or a universal stage calendar.'),
 ('S11','FAO56 provides air vapour-pressure and soil-water accounting relations, including the distinction between transpiration stress and evaporation. Rooting/storage/coefficient inputs still need support.'),
 ('S19','Controlled hemp experiments found substantial cultivar variation in soil-drying and air-VPD response. Native FTSW and VPD breakpoints are physiological endpoints, not universal care thresholds.'),
 ('S34','Full PDF23pages; methods p3/Table1 p6 visually reviewed. Mineral-soil FC/PWP and author-selected p allow reproducible examples. Three plants/pot and nominal-versus-filled volume restrict transfer.'),
 ('S35','Full PDF13pages; methods, Table1 and Figure4 reviewed. Leaf-area-normalized water-use depths are not ground irrigation depths. Two cultivars differed; no universal strain/height multiplier follows.'),
 ('S36','Full PDF15pages; Table3 p6 visually reviewed. Crop ET39.8-70.6L/m2 over21days rose with light, even as WUE improved. Suver Haze greenhouse nursery results are not outdoor per-pot dose constants.')]:
 h(f'[{sid}] {sources[sid]["title"]}');p(note);blocks.append(('link',(sources[sid]['url'],'Open primary source')))

page('Evidence B: disease, newer drought and weather','ACCESS LIMITS ARE PRESERVED; NO HIDDEN RESEARCH INPUTS')
for sid,note in [
 ('S04','Full primary cannabis PM methods in the retained review. An inoculation environment is not a fitted T-by-RH risk surface.'),
 ('S05','Limited primary accessible methods/abstract in retained review. Flower timing, delayed symptoms and greenhouse microclimate are context; no outdoor internal-bud offset or calibrated API warning.'),
 ('S37','Full PDF15pages; methods p3-4 visually reviewed. Indoor two-genotype deficit experiment, published3September2026. Container-capacity fractions are not VWC and are not outdoor beginner defaults.'),
 ('S38','Primary indexed methods/results plus PubMed bibliography. Direct full-page retrieval403. Reported mean RH51/48% supports removing a high-average-humidity necessary gate, not a causal humidity curve.'),
 ('S12','Official documentation rechecked29October2026 for forecast/history distinction, source alerts and rain.1h units. Current app3.0 adapter is not an ET0/history solution by itself.'),
 ('S33','Official forecast/history documentation rechecked29October2026. Hourly ET0 assumes well-watered grass; past-days archived forecasts are not independent observations. Model soil moisture is not a pot measurement.')]:
 h(f'[{sid}] {sources[sid]["title"]}');p(note);blocks.append(('link',(sources[sid]['url'],'Open primary source')))
p('Additional official historical-product detail: https://open-meteo.com/en/docs/historical-weather-api . All38 retained/new source records, five new access records,21 parameter records and12 investigation gaps are in the JSON contract. The earlier33-source ledger remains available for traceability; this revision does not claim every older paper was newly re-reviewed in full.')

def normalize_citations(value):
 if isinstance(value,str):
  return re.sub(r'\[(S\d{2}(?:,\s*S\d{2})+)\]',lambda m:', '.join('['+x.strip()+']' for x in m[1].split(',')),value)
 if isinstance(value,tuple):return tuple(normalize_citations(x) for x in value)
 if isinstance(value,list):return [normalize_citations(x) for x in value]
 return value
blocks=normalize_citations(blocks)
renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('WeedGrow_Outdoor_Algorithm_FINAL_v4.0',BASE).replace('R\\d{2}','S\\d{2}')
renderer=renderer.replace('WeedGrow Outdoor Algorithm - Final Specification v4.0','WeedGrow Low-input Evidence and Algorithm v7.2')
renderer=renderer.replace('FINAL SPECIFICATION  v4.0','LOW-INPUT ALGORITHM  v7.2').replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','LOW-INPUT EVIDENCE; FIELD VALIDATION PENDING')
renderer=renderer.replace('29 OCT 2026','30 OCT 2026')
renderer=renderer.replace("'v4_acceptance_cases':64","'mathematical_checks':len(checks),'capability_checks':len(capchecks)")
exec(renderer,globals())
