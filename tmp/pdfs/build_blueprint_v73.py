from pathlib import Path
import json, math, re, html, hashlib, importlib.util, sys
from datetime import datetime, timezone
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path('C:/Users/Zane/dev/WeedGrow');SRC=ROOT/'output/spec';OUT=ROOT/'output/pdf'
BASE='WeedGrow_Algorithm_Blueprint_v7.3'
prior=json.loads((SRC/'WeedGrow_Low_Input_Model_Contract_v7.2.json').read_text(encoding='utf-8'))
verification=json.loads((SRC/'WeedGrow_Algorithm_Verification_v7.3.json').read_text(encoding='utf-8'))
assert verification['scenarioTestsRun']==verification['scenarioTestsPassed'] and not verification['errors'] and not verification['failures']
refs={k:(v['title'],v['url'],v['scope']) for k,v in prior['sources'].items()}
spec=importlib.util.spec_from_file_location('v73_reference',SRC/'WeedGrow_Algorithm_Emulator_v7.3.py');E=importlib.util.module_from_spec(spec);sys.modules[spec.name]=E;spec.loader.exec_module(E)

# This registry states a rule for each factor, including legitimate no-effect
# and unsupported paths. It does not invent numeric biological weights.
factor_rows=[
 ('F01','Location / timezone','Select weather scope and local-day conversion. Location revision mismatch rejects old forcing/state; IANA day bounds may be23/25h.','all','adapter + canonical_weather'),
 ('F02','Outdoor / greenhouse / indoor','Outdoor weather can prepare for external hazards. It cannot supply internal humidity or the indoor watering model.','W01-W06; health scope','check_profile + evaluate'),
 ('F03','Plant lifecycle','Archived, harvested, dead or deleting: no active care cards or notifications.','all','evaluate'),
 ('F04','Pot versus ground','Match separate supported model domains. Never convert pot litres into a ground root-zone profile.','W06; W08/action context','check_profile'),
 ('F05','Pot size and units','Explicit litres or explicit converted units. Match profile/storage ranges; no unitless litre assumption or catchment from volume.','W06','raw adapter + check_profile'),
 ('F06','Medium family','Select supported retention, delivery and loss profiles. Unknown needs a separately validated aggregate profile.','W06','check_profile / resolve_profile'),
 ('F07','Soil provenance / layout','Native, raised or store-bought alone does not establish texture, FC or PWP. No hydraulic coefficient from this label.','no direct numeric effect','input contract'),
 ('F08','Reported growth stage','Match growth profile; flowering gates W11; establishment contextualizes optional review. Stage changes need dated transition handling.','W06/W10/W11/W13','check_profile + evaluate_health'),
 ('F09','Dated age and origin','Compute effective age only when known/datable; seed and clone origins must match the profile. No exact roots or flowering from age.','W06 profile selection','check_profile / resolve_profile'),
 ('F10','Dated height','Use only within profile freshness/domain; otherwise explicit aggregate fallback. It is not measured leaf area or plant consumption.','W06 profile selection','check_profile / resolve_profile'),
 ('F11','Sun category','Select validated exposure profile. Full/partial/shade is not a measured radiation fraction or a fixed extra drying bonus.','W06; action wording','check_profile'),
 ('F12','Soil rain reception','No: zero direct rain. Yes: supported catchment/delivery. Unknown: bracket zero/full; partial: supported bounds.','W06','replay_water'),
 ('F13','Canopy rain reception','Direct rain forecast adds wet-canopy/flower preparation only if reachable. Shelter does not remove ambient humidity.','W11/W12','evaluate_health'),
 ('F14','Watering occurrence time','Replay in occurrence order, including known events at evaluation time; never use edit time as the watering time.','W06','canonical_logs + replay_water'),
 ('F15','Watering amount','Known amount times supported delivery/retention; omitted amount uses supported scenario ranges or abstains. Zero stays zero.','W06','replay_water'),
 ('F16','Log time precision','Date-only event becomes earliest/latest UTC bounds capped by recorded time; branch timing, rather than invent noon.','W06','raw date adapter + canonical_logs'),
 ('F17','Edits / retries / deletions','Canonical event identity/version; duplicate retry adds no water, separate real events both count, deletion removes prior input.','W06','canonical_logs'),
 ('F18','Repot / move / medium or stage change','Do not reuse a pre-change anchor. Carry or rebuild state only through a supported transition; prototype abstains.','W06; location-scoped flags','replay_water'),
 ('F19','Air temperature','Heat/cold screen and paired-air features. ET0 already contains its weather contribution; no second heat multiplier.','W01/W02; W09-W12 context','weather_flag + ambient_features'),
 ('F20','Air relative humidity','Pair with same-interval temperature for air VPD/context. No high-RH necessary PM gate, soil-moisture estimate or leaf VPD.','W09-W12; W06 through ET0','ambient_features'),
 ('F21','Reference ET0','Use correct interval sum; multiply by fitted effective coefficients with explicit units. Missing history ET0 blocks this water route.','W06','replay_water'),
 ('F22','Solar radiation / cloud','Backend ET0 forcing or validated exposure profile. No UV-to-PAR replacement, extra cloud bonus or duplicate evaporation term.','W06 indirectly','provider adapter / profile'),
 ('F23','Mean wind','Mechanical weather screen; ET0 already accounts for wind in its own forcing model. Not canopy ventilation measurement.','W03; W06 indirectly','evaluate_wind'),
 ('F24','Wind gust','Separate mechanical exposure signal; preserve m/s and source definition. Not an extra water-loss multiplier.','W03','evaluate_wind'),
 ('F25','Rain rate','Integrate only over its known interval for water amount; mean hourly rate cannot reveal peak minute intensity.','W04; W06 via amount','raw adapter + evaluate_rain'),
 ('F26','Rain amount / liquid phase','Non-overlapping liquid-rain amount enters retained-water model. Snow/frozen precipitation needs a separate melt pathway.','W04/W06/W11/W12','adapter + replay_water'),
 ('F27','Rain probability','Planning uncertainty only. Do not multiply rain amount by probability without provider semantics; never pre-credit current storage.','forecast planning','project_thresholds'),
 ('F28','Dew point','Optional paired ambient derivation/context with provenance; not leaf condensation or measured wetness. Prototype uses paired T/RH.','W09 context','adapter; prototype uses ambient_features'),
 ('F29','Daylight / solar night','Use local solar intervals for context. ET0/energy already reflects duration; no independent daylight water bonus.','W09; W06 indirectly','adapter / profile'),
 ('F30','UV index','May inform a separately scoped exposure message; not energy, water use, PAR or an automatic cannabis injury probability.','no extra water score','input contract'),
 ('F31','Data age / gaps / overlap','Per-path variable coverage. Missing data is unknown, not zero. Positive supported hazard evidence may survive other gaps.','all','canonical_weather + coverage'),
 ('F32','Source hazard products','Typed verified mapping, location/validity and latest update/cancellation. No source coverage is not an all-clear.','W01-W05','active_alerts'),
 ('F33','Profile validation / version','Scope, state range, climate/source domain and approved release registry are prerequisites. No production profiles are bundled.','W06; future disease models','resolve_profile + release gate'),
 ('F34','Optional problem report','Route only the requested topic. A root/wilt review is not disease detection or an automatic instruction to water.','W07/W13/W14','evaluate_health'),
 ('F35','No-symptoms observation','A dated optional observation; not proof of no latent infection and not a daily requirement.','no automatic disease clearing','input contract'),
 ('F36','Optional observations / lab inputs','Moisture/pH/photos require a separate validated observation/problem path; no blind bank reset or nutrient diagnosis. Leaf/root temperatures, PAR and lab physiology remain excluded.','no required base dependency','input contract / future observation adapter'),
 ('F37','Cultivar / strain name','Display/research metadata; not a verified stomatal response or disease-resistance assay.','no resistance multiplier','input contract'),
 ('F38','API soil grids','Regional soil temperature/moisture is not the water state of this pot or local rooting zone.','no measured moisture claim','input contract'),
 ('F39','UI waterLevel / sensorProfileId','A UI gauge is not measured water; a profile ID is not proof of working sensors.','no moisture reset','input contract'),
 ('F40','Missing watering logs','Absence of a log is not proof no water was applied. Validate real log adherence and uncertainty; do not learn dryness from compliance.','W06 validity','profile study / release gate'),
 ('F41','Scheduler / cache / delivery state','Invalidate on all real dependencies; reevaluate automatically. Cooldown is a delivery rule, never a biological reset.','all','application adapter + notification_plan'),
 ('F42','Forecast versus occurred nature','Separate present replay and conditional projection. Past forecasts remain forecast estimates, not observed rain/history.','all','canonical_weather + replay_water')]
factors=[dict(id=r[0],factor=r[1],rule=r[2],affectedOutputs=r[3],implementation=r[4]) for r in factor_rows]
flags=E.evaluate(E.demo_payload())['flags']
function_map={
 'W01':'weather_flag(heat)','W02':'weather_flag(cold) + frost/freezing contexts','W03':'evaluate_wind',
 'W04':'evaluate_rain','W05':'active_alerts','W06':'replay_water + release gate',
 'W07':'evaluate_health(problem topic)','W08':'evaluate_health(heat merge)','W09':'ambient_features + evaluate_health',
 'W10':'evaluate_health; predictive route disabled','W11':'evaluate_health(flowering + ambient/direct rain)',
 'W12':'evaluate_health(canopy rain)','W13':'evaluate_health(establishment review)','W14':'evaluate_health(root/wilt review)'}
registry=dict(version='7.3',evidenceBaseline='7.2',sources=prior['sources'],parameters=prior['parameters'],
              implementationChoices=dict(attentionScreens={'values':E.SCREEN,'origin':'ENG_candidates_not_biological_thresholds'},
                                        ambientHistoryHours={'value':72,'origin':'ENG_summary_window_not_infection_memory'},
                                        forecastHours={'value':24,'origin':'ENG_demonstration_horizon'},
                                        numericalTolerance={'value':E.EPS,'origin':'ENG_floating_point_tolerance_not_care_hysteresis'}),
              factors=factors,warnings=[dict(id=f['id'],code=f['code'],function=function_map[f['id']]) for f in flags],
              warningStates=['triggered','not_triggered','unknown','not_applicable','disabled','context_only','review_requested'],
              waterDecision=['water','not_due','uncertain'],needsWaterMapping={'water':True,'not_due':False,'uncertain':None},
              dailyMeasurementRequirements=[],productionProfilesBundled=0,predictiveDiseaseModelsReleased=False,
              prototypeLimitations=['normalized UTC input only; raw providers/calendar adapters not integrated',
              'constant-profile near-threshold water bank; no layered soil/oxygen/melt simulation',
              'hourly forcing/order ranges are engineering model bounds, not statistical prediction intervals',
              'forecast scenarios do not exhaust weather/precipitation uncertainty',
              'age/height only select explicitly supplied supported profiles; no measured leaf/root inference',
              'no biological accuracy, calibration, prevention or notification effectiveness validation'],
              appSourceChanged=False)
(SRC/'WeedGrow_Factor_Flag_Registry_v7.3.json').write_text(json.dumps(registry,indent=2,ensure_ascii=False),encoding='utf-8')

PIPELINE='''evaluatePlant(input):
  authorizePlantRead(input.user, input.plant)
  if inactiveOrDeleting(plant): return noActiveCare()
  facts = normalizeSimpleSetupAndDatedOptionalFacts(plant)
  weather = canonicalizeTypedWeather(rawWeather, facts.location)
  logs = canonicalizeWaterEvents(rawLogs)
  profile = resolveSupportedProfile(facts, modelRegistry)

  current = replayOccurredWaterBalance(profile, weather, logs)
  decision = releaseGate(robustDecision(current), profile)
  projection = projectConditionalForecast(current, weather)
  // projection NEVER replaces current stored water/decision

  ambient = pairedAirFeatures(weather, history, forecast)
  flags = evaluateAll14WarningsIndependently(
    facts, weather, sourceAlerts, decision, ambient, problemReport)
  cards = mergeSharedContextAndSourceEpisodes(flags)
  delivery = applyNotificationPolicy(cards, priorDeliveryState)
  return { needsWater: toNullableBoolean(decision),
           decision, flags, cards, reasons, coverage,
           profileVersion, computedAt, reevaluateAt }'''
PROFILE='''resolveSupportedProfile(facts, registry):
  reject unsupported environment or inactive plant
  require pot/ground + stage + medium + sun scope match
  if profile uses pot size: require explicit valid litres
  if profile uses age:
    require known age, meaning and valid recorded date
    ageNow = recordedAge + elapsedDays(recordedDate, now)
    require supported seed/clone origin and age range
  if profile uses height:
    require dated height within tested freshness/range
  if optional fact unusable:
    follow explicitly supported aggregate fallback only
  require correct location, forcing source and state anchor
  return coherent parameter/state scenarios
  // no leaf area, root depth or moisture from height/age'''
REPLAY='''replayOccurredWaterBalance(profile, weather, logs):
  require valid anchor before evaluation time
  require complete ET0 history for selected source
  require complete rain history unless soil receives no rain
  reject unresolved duplicate/version conflicts
  reject an unhandled repot/move/medium/stage transition

  for scenario in supportedCorrelatedScenarios:
    for eventTiming in [earliest, latest]:
      for withinBinOrder in [inputsFirst, lossFirst]:
        R = scenario.initialReserve
        for interval in occurredHistoryInTimeOrder:
          rainL = amountMm * effectiveCatchmentM2 * delivery
          waterL = appliedLOrBoundedScenario * retention
          lossL = ET0mm * fittedEffectiveLossM2
          R = applyInputsAndLossWithCapacityCap(R, ...)
          record conservation, excess and unmet potential
        apply known watering events exactly at now
        keep R and scenario.actionReserve
  return trajectories, input/loss ledger, coverage'''
DECISION='''robustDecision(trajectories):
  if no supported states or unsupported history: UNCERTAIN
  due[j] = reserve[j] <= actionReserve[j] + numericTolerance
  if all(due): WATER
  else if none(due): NOT_DUE
  else: UNCERTAIN

releaseGate(candidate, profile):
  if profile/version absent from approved registry: UNCERTAIN
  if scenario/state coverage not validated: UNCERTAIN
  else: candidate

needsWater = true if WATER, false if NOT_DUE, null otherwise
// Never: Boolean(undefined), unknown -> false, majority vote,
//        mean reserve, or wateredToday -> notDue/highConfidence'''
FUTURE='''projectConditionalForecast(currentStates, forecast):
  if forecast ET0/rain coverage missing: projection unavailable
  for each current trajectory:
    run no-rain and provided-rain scenarios separately
    preserve soil reception, capacity and input/loss ordering
    record first action-threshold crossing interval
    retain trajectories with no crossing inside horizon
  return conditional interval + horizon-censoring information
  // Not an exact ETA, probability or prediction interval.
  // Forecast rain never enters current reserve.
  // Water already due now is not delayed by a wet forecast.'''
NOTIFY='''planNotification(card, priorEpisode, policy):
  require active plant, supported claim and enabled policy
  require actual delivery consent/subscription in app adapter
  block predictive disease pushes without validated model
  if new valid source episode: plan new notification
  else if source severity escalated: bypass repeat cooldown
  else if repeat cooldown expired: plan eligible repeat
  else: suppress repeat
  // Model evaluation and delivery planning remain separate.
  // Emulator plans only: it sends zero notifications.'''
(SRC/'WeedGrow_Pseudocode_v7.3.txt').write_text('\n\n'.join([PIPELINE,PROFILE,REPLAY,DECISION,FUTURE,NOTIFY]),encoding='utf-8')

# A static scientific plot illustrates algebraic behavior, not plant accuracy.
sys.path.insert(0,str(ROOT/'tmp/research_v6/plotdeps'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
figdir=SRC/'WeedGrow_v7.3_figures';figdir.mkdir(exist_ok=True)
paths=[]
for name,soil,occurred in [('No occurred rain','yes',False),('Occurred rain, exposed soil','yes',True),('Same rain, sheltered soil','no',True)]:
    payload=E.demo_payload();payload['plant']['soil_rain']=soil
    if occurred:payload['weather'][60]['rain_mm']=10
    result=E.evaluate(payload);trace=result['water']['branches'][0]['trace']
    paths.append((name,[0]+[(r['end']-payload['profile']['anchor_utc'])/3600 for r in trace],
                  [payload['profile']['scenarios'][0]['initial_l']]+[r['reserve_l'] for r in trace]))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10})
fig,ax=plt.subplots(figsize=(8.2,3.8),layout='constrained')
for i,(label,x,y) in enumerate(paths):ax.plot(x,y,label=label,linewidth=2.2,linestyle=['-','-','--'][i],color=['#245b53','#b16f21','#6589a6'][i])
ax.axhline(.8,color='#9c3d3d',linestyle=':',label='Synthetic action reserve0.8L')
ax.set(xlabel='Hours since synthetic state anchor',ylabel='Modeled available-water bank (L)',xlim=(0,24),ylim=(0,2.05))
ax.set_title('Synthetic logic demonstration - not field validation',loc='left',fontweight='bold')
ax.grid(alpha=.2);ax.legend(loc='upper right',fontsize=8)
fig.savefig(figdir/'synthetic_water_balance.png',dpi=180);plt.close(fig)

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

page('WeedGrow\nAlgorithm blueprint & emulator','v7.3 | FACTOR RULES, PSEUDOCODE AND ALL WARNING CALLS | 30 OCTOBER 2026')
p('This implementation-design revision turns the v7.2 evidence contract into named functions, factor rules, warning calls, state transitions and a runnable offline reference. It preserves simple setup, optional watering amount and no daily measurement burden.')
callout('The reference runs end to end on synthetic inputs. It is deliberately prevented from releasing a watering recommendation through an unvalidated profile. Candidate water decisions and forecast projections remain debug outputs; disease probabilities remain unassigned.')
h('Deliverables and verified scope')
p(f'The package includes this blueprint, editable Markdown, standalone pseudocode, a42-factor/14-warning registry, executable emulator, synthetic input/output and {verification["scenarioTestsRun"]} passing scenario tests plus1,000 seeded bank trials. These verify logic, not agronomic accuracy, disease detection or prevention.')
p('The source studies and parameter restrictions remain in v7.2 and the carried-forward machine ledger. v7.3 adds executable behavior and identified implementation gaps. Application code, accounts, subscriptions and notification delivery were not changed.')
p('Read sections01-04 for architecture/contracts; 05-08 for every factor; 09-14 for water calculations; 15-19 for warning calls/delivery; 20-22 for verification, limits and handoff. All synthetic capacities, loss coefficients and refill amounts are test values, not proposed cannabis calibration.')

page('01  End-to-end algorithm','EACH PATH FAILS INDEPENDENTLY; A WATER GAP DOES NOT HIDE A SOURCE HAZARD')
code(PIPELINE)
p('Backend/application adapters authorize access, fetch data, normalize raw provider semantics and persist state. The offline reference starts after those adapters with explicit UTC intervals. Its evaluate function dispatches all14 warning IDs exactly once, even when a model is disabled or data is missing.')
p('The production release registry in the emulator is empty. Adding approved:true to a JSON profile cannot enable it. An actual release requires validation, an approved version and application integration; ordinary users do not supply model coefficients or research measurements.')

page('02  Three kinds of output','A MEASUREMENT FACT, A CARE DECISION AND A WARNING ARE DIFFERENT OBJECTS')
table(['Layer','Examples','Required semantics'],[
 ['Input/feature fact','Paired air VPD; rain amount; source alert; covered hours.','A scoped estimate with interval, source, units and missingness. No hidden disease interpretation.'],
 ['Water decision','water / not_due / uncertain.','needsWater:true /false /null. Unknown must survive every app consumer and persistence layer.'],
 ['Warning result','W01 heat, W06 water, W11 flower weather.','Explicit state, reasons, evidence, phase and release/delivery eligibility. No automatic probability.'],
 ['Card / notification','Merged heat/container card or wet-weather preparation.','Presentation and delivery rules; they do not change modeled moisture, disease state or source severity.']
],[.24,.34,.42])
code('FlagResult = {\n  id: W01..W14, code: stableSemanticName,\n  state: triggered | not_triggered | unknown |\n         not_applicable | disabled | context_only | review_requested,\n  reasons: ReasonCode[], evidence: ScopedEvidence,\n  probability: null, pushEligible: falseUntilSupported\n}')
p('not_triggered means the stated screen was not met in a supported, declared window. It never means no disease or no weather harm. disabled means the model/route is intentionally unavailable; unknown means the necessary state/data cannot determine the answer. context_only reports conditions without claiming detection.')

page('03  Normalized input and real app mapping','RAW RECORDS MUST BE ADAPTED BEFORE THEY ENTER THE REFERENCE')
table(['Existing/proposed record','Normalized emulator field','Rule'],[
 ['Plant.environment / plantedIn','environment / planted_in','Outdoor scope; explicit pot/ground.'],
 ['potSize / mediumChoice / sunlightExposure','pot_l / medium / sun','Parse labelled units; known category mapping; not sure -> unknown. No unitless litre default.'],
 ['growthStage / ageKnown / ageRecordedAt','stage / age_known / age_asof','Retain seed-versus-clone meaning and dates. Do not substitute app creation time.'],
 ['height or dated height log','height_cm / height_asof','Use actual dated measurement if available; no inferred daily growth.'],
 ['Proposed rain reception answer','soil_rain / canopy_rain','yes/no/partial/unknown independently. One beginner-friendly setup choice can populate both.'],
 ['PlantLog timestamp/precision/waterMl','earliest / latest / amount_l','mL toL explicitly; date-only UTC bounds from local calendar; zero is not omitted.'],
 ['Raw weather products','start/end/kind/source/issued_at','Interval amount versus point/rate, correct UTC/location revision, per-variable nulls.'],
 ['Profile registry / state estimate','profile + anchor + coherent scenarios','Backend quantities with provenance. Not extra client setup fields.']
],[.32,.29,.39])
p('Current app weather summaries are not enough to reconstruct hourly histories. Preserve raw paired intervals, actual occurred-estimate provenance and per-variable coverage. The existing boolean needsWater interface and same-day override require an eventual consumer migration; no migration is delivered here.')

page('04  Canonical events and time','FIX DUPLICATES, REVISIONS AND AMBIGUOUS TIME BEFORE WATER ACCOUNTING')
code('canonicalWaterEvent(event):\n  key = stable eventId or retry-safe mutation identity\n  keep latest authoritative revision\n  if deleted: remove its contribution and replay\n  if conflicting same revision: water path UNKNOWN\n  if exact occurrence: earliest = latest = occurrenceUTC\n  if date-only:\n    [earliest, dayEnd] = calendarBounds(day, IANAzone)\n    latest = min(dayEnd, recordedAt, evaluationTime)\n  reject negative amount or future/impossible occurrence\n  // Two genuine equal-looking events stay separate.')
p('Do not assume a local date lasts24hours. Timezone/DST conversion belongs to the real calendar adapter; the emulator accepts precomputed bounds and does not claim to test raw calendar parsing. A date-only event straddling the state anchor needs reconciliation, rather than half-counting or silently discarding it.')
code('canonicalWeather(rows):\n  keep latest issue for exact source/interval/nature key\n  preserve occurred_estimate versus forecast versus point\n  reject location mismatch and future values marked occurred\n  invalid field -> null + quality reason (not field value0)\n  overlapping/conflicting integrals -> unsupported replay\n  // Point temperature can show a crossing, not wet-hours.')
p('A historical forecast remains a forecast estimate. Current rain rate is not a daily amount; hourly interval mean rain intensity is not the peak minute rate. Distinct sources/models must not be summed as independent rainfall. A production adapter needs an explicit source-selection/reconciliation policy. [S12]')

for k,(start,end,title) in enumerate([(0,11,'Setup, age, size and baseline'),(11,21,'Water inputs and atmospheric demand'),(21,32,'Weather factors and data quality'),(32,42,'Model scope and legitimate no-effect factors')]):
 page(f'{5+k:02}  Factor rules: {title}','ALL FACTORS HAVE A RULE; NOT EVERY FIELD DESERVES A NUMERIC WEIGHT')
 table(['Factor','Algorithmic effect','Affected path'],[[r[0]+' '+r[1],r[2],r[3]] for r in factor_rows[start:end]],[.27,.51,.22])
 p('Exact function ownership and stable factor IDs are in WeedGrow_Factor_Flag_Registry_v7.3.json. A validated aggregate fallback is preferable to inventing optional facts or repeatedly prompting the grower. The input contract still requires no daily moisture, height, temperature or canopy observations.')

page('09  Selecting a baseline profile','FITTED BACKEND PROFILES REPLACE UNIVERSAL DAYS-BETWEEN-WATERING MODIFIERS')
code(PROFILE)
p('A profile contains supported ranges for effective storage, initial reserve, action threshold, effective loss, rain catchment/delivery and unknown refill. These are coherent scenarios, not independent worst-case numbers chosen at random. Origin, training/validation domain, source products and profile version travel with them.')
p('Effective loss coefficients have area units because ET0(mm)*m2 gives litres. They are fitted aggregate coefficients, not measured leaf area or automatically equal to pot opening. The prototype uses a constant coefficient over its short replay window; a real model must validate its climate/growth/soil-water operating range. [S33]')
p('If age or height is unavailable/stale, the resolver follows only an explicit supported fallback. A seven-day height freshness rule used by a test is a synthetic test condition, not a recommendation to measure weekly or a calibrated universal cutoff.')

page('10  Water balance and ordering','SIMPLE, AUDITABLE ACCOUNTING AROUND THE WATERING ACTION THRESHOLD')
code(REPLAY)
p('For inputs-first: excess=max(0,R+input-C); stored=min(C,R+input); extracted=min(stored,potentialLoss); nextR=stored-extracted. For loss-first, apply the capped extraction first, then add water/cap storage. Both conserve modeled water. C is an available-water bank, not total soil water.')
p('The two orders bracket unknown within-bin timing for this simplified fixed-loss/capacity bank. They are not a prediction interval for real moisture. The reference does not simulate hydraulic redistribution, root oxygen, frost/melt, a surface dry layer or physiological regulation. Excess is an accounting term, not root saturation.')
p('A fitted total-loss route must not add evaporation twice. If separate transpiration/evaporation responses are used, stress should not automatically reduce them identically. FAO makes this distinction; the prototype does not pretend its constant synthetic coefficients implement the full crop process. [S11]')

page('11  Calling the watering flag','COMPARE REMAINING RESERVE WITH REMAINING ACTION RESERVE')
code(DECISION)
code('If depletion fraction p is actually supported:\n  capacity C = available water above lower reference\n  allowed depletion RAW = p*C\n  action remaining reserve A = C-RAW = (1-p)*C\n  // Comparing remaining R against RAW is a different rule.')
p('Example only: C2L and p0.6 imply allowable depletion1.2L and remaining action reserve0.8L. The p0.6 selected in a hemp hydraulic experiment is not a universal care target. The emulator fixture uses explicit synthetic values; it does not deploy that paper as a calibrated app profile. [S34]')
p('Never average away disagreement, count scenario agreement as a percentage confidence, or infer that a small/unquantified watering makes the plant safe for the rest of the day. Re-evaluate automatically as new evidence arrives; show one actionable uncertainty reason if a reliable binary answer is unavailable.')

page('12  Growth, transitions and state initialization','MORE CAPACITY DOES NOT CREATE WATER')
table(['Change','Required transition'],[
 ['Plant gets older/taller','Change demand/profile only through a validated dated growth model. Existing bank water does not increase merely because the plant is larger.'],
 ['Root access expands','New accessible soil can contain unknown water. Add only a supported bounded contribution; never rescale old reserve by a new capacity fraction.'],
 ['Repot or medium change','Re-establish storage, delivery and initial-state ranges from a supported transition/anchor. Prototype returns unknown after an unhandled transition.'],
 ['Stage changes during history','Use dated parameter segments. Do not apply today\'s flowering demand retrospectively to an entirely vegetative history. Prototype requires a fresh supported anchor/transition.'],
 ['Plant moves / location revision changes','Invalidate location-scoped forcing. Retain/rebuild water state only with a declared transition, separating old and new environments.'],
 ['New plant with missing prior history','Use broad initial-state ranges or one optional startup aid. No first-watering full reset unless the anchor is independently supported.']
],[.30,.70])
p('The reference deliberately does not invent a growth/repot transition function. This is an explicit deferred model component, not a hidden user measurement requirement. Research-cohort reference pots can establish transition/state ranges while normal growers continue to log watering only.')

page('13  Forecasting the next action window','CONDITIONAL PROJECTIONS NEVER REWRITE PRESENT MOISTURE')
code(FUTURE)
p('The offline projection uses24hours as an engineering demonstration horizon, with no-rain versus provided-rain branches and two input/loss orderings. A weather ensemble/amount-error model would be needed to represent forecast uncertainty more fully. Precipitation probability is not automatically a volume multiplier.')
p('Return the range of first crossing intervals plus the count of trajectories not crossing within the horizon. If some never cross, the upper waiting time is unresolved; do not display the largest finite crossing as a guaranteed deadline. A missing forecast blocks projection only; it must not erase a supported current decision.')
p('In production, profile support, forecast validation and notification burden determine whether to show a qualified action window or simply schedule another automatic evaluation. An exact time such as water in6.2hours would overstate this prototype.')

page('14  What the emulator demonstrates','ALL LITRES AND COEFFICIENTS HERE ARE SYNTHETIC TEST INPUTS')
blocks.append(('figure',str(figdir/'synthetic_water_balance.png')))
table(['Scenario','Candidate calculation','Production output here'],[
 ['Initial1.2L; modeled daily loss0.72L; no input','Reserve0.48L, below synthetic action0.8L: water.','uncertain: no approved profile.'],
 ['Same day with10mm occurred rain, soil exposed','Catchment0.07m2 can deliver0.70L before cap/loss; candidate changes.','Same release block. Not field evidence.'],
 ['Same rain, soil sheltered','Zero direct rain credit; demand still applies.','Same release block.'],
 ['Rain only in tomorrow\'s forecast','Current water result is unchanged; future scenarios/preparation can differ.','No pre-credit or automatic rain delay.'],
 ['Unquantified small/large refill alternatives','If candidate decisions disagree: uncertain.','Never majority vote or full refill.']
],[.37,.35,.28])
p('The plot shows one explicit input/loss ordering to make the accounting readable. The executable reference retains both orderings and earliest/latest log timing. It has not measured any plant or supplied accuracy statistics.')

page('15  Warning calls: weather and water','EACH FUNCTION RETURNS STATE + REASONS + EVIDENCE')
table(['ID / function call','Trigger and interaction','Unknown / claim boundary'],[
 ['W01 weather_flag(heat)','Air32C ENG crossing OR applicable source heat event. Evaluate recent and forecast phases separately.','No tissue injury probability or leaf temperature. Partial data below cutoff -> unknown.'],
 ['W02 weather_flag(cold)','Air5C ENG screen; nested2C possible-frost and0C air-freezing contexts; applicable source cold event.','Air screen is not tissue freezing. Preserve distinctions and source claim.'],
 ['W03 evaluate_wind','Gust15m/s OR mean10m/s ENG screen OR source wind event. Pot/plant affects advice.','Missing gust is not zero; station wind is not canopy ventilation.'],
 ['W04 evaluate_rain','Interval-mean10mm/h OR known24h amount at least25mm OR applicable source rain/flood event.','ENG screens, not saturation. A partial known sum can establish a lower-bound crossing; it cannot establish a below-threshold full total.'],
 ['W05 active_alerts','Explicit mapped source hazard, valid location/time, latest noncancelled update.','No source coverage -> unknown. Preserve source type/issuer severity; do not manufacture hail from text/cloud.'],
 ['W06 replay_water','All supported trajectories relative to action reserve, then approved-profile release gate.','true/false/null. No today-watered override; no automatic dose in litres.']
],[.25,.41,.34])
p('All listed numerical weather screens are retained engineering candidates from v7.2. They are not newly inferred cannabis injury thresholds. Source alerts can operate independently of those screens; a source event is not automatically classified as destructive severity.')

page('16  Warning calls: plant-health context','UNOBSERVED DISEASE PRESENCE NEVER BECOMES A WEATHER FACT')
table(['ID / call','Eligibility and behavior','Blocked inference'],[
 ['W07 evaluate_health','Optional excess_root_water report opens review.','No rain/log-only saturation or root-rot prediction.'],
 ['W08 evaluate_health','Pot context copies heat-preparation relevance and merges with W01.','No root/pot-wall temperature score.'],
 ['W09 ambient_features','Paired-air near-saturation context;90%RH is a descriptive ENG band.','No measured dew/leaf-wet duration or pathogen risk threshold.'],
 ['W10 evaluate_health','Foliage relevance; predictive PM route disabled pending calibrated response/outcomes. Ambient history remains available.','No high-RH/rain necessary gate, spore detection, cultivar assay or infection probability.'],
 ['W11 evaluate_health','Reported flowering + direct canopy rain forecast or supported humid-air context produces preparation context. Unknown stage -> unknown.','No exact flower week from age, internal-bud correction or measured wet flowers.'],
 ['W12 evaluate_health','Reachable canopy rain forecast adds shared wet-weather context.','No specific Septoria/leaf-spot detector.'],
 ['W13 evaluate_health','Known establishment stage + optional establishment problem report.','No weather-only damping-off.'],
 ['W14 evaluate_health','Optional root_wilt topic opens a separate review.','Wilt alone does not diagnose root rot or automatically request water.']
],[.24,.42,.34])
p('Powdery mildew trials at moderate average RH reinforce the absence of a high-average-humidity required gate; they do not calibrate a weather-response surface. Keeping a predictive route disabled is a concrete output, not a false low-risk answer. [S38]')

page('17  Pairing environmental factors correctly','DURATION AND COINCIDENCE MUST COME FROM THE SAME SUPPORTED INTERVALS')
code('pairedAirFeatures(weather):\n  historyWindow = explicit72h summary (ENG, not infection memory)\n  forecastWindow = explicit24h summary (ENG)\n  keep each valid same-interval [Tair, RH, time, nature]\n  airVPD = es(Tair) * (1 - RH/100)\n  retain missing/overlapping hours as unknown\n  report covered joint exposure; do not join daily extrema\n  return raw paired sequence + descriptive air features\n  leafWetHours = null; infectionProbability = null')
p('A hot/dry daytime observation and a cool/humid night do not create a hot/humid exposure. A current point can establish a weather-screen crossing but cannot fill an hour of humid conditions. A gap cannot be normalized away by scaling known exposure to100% coverage.')
h('Future disease model interface')
code('predictDisease(features, hostContext, approvedModel):\n  if no validated model for this low-input domain:\n    return disabled(CAL_REQUIRED), not LOW_RISK\n  require supported phase/horizon and feature coverage\n  evaluate fitted joint T/RH/time response + stage/exposure\n  apply independently validated calibration/cutoff\n  keep prediction separate from confirmed diagnosis')
p('The prototype has no such predictive model and no manufactured weights. It does not borrow grape wet-hour equations, fit a fan experiment to station wind, or assign a20% bonus from unobserved density/damage. Ambient context cards can still support preparation.')

page('18  Calling flags without losing uncertainty','DEPENDENCY FAILURE IS LOCAL TO THE AFFECTED PATH')
table(['Available / missing','Expected behavior'],[
 ['ET0 history missing; explicit hail alert valid','W06 unknown; W05 triggered from source.'],
 ['RH missing; complete ET0 and required rain present','Water path can still run; humidity feature coverage is incomplete.'],
 ['Rain missing; soil receives no direct rain','Water path need not require rain input for direct delivery. Rainfall warnings may remain unknown.'],
 ['Recent data complete; forecast incomplete','Current water estimate can survive; projection unavailable. Weather windows report their own coverage.'],
 ['A known partial24h rain sum already exceeds threshold','Weather screen can trigger on a supported lower bound. Do not call it a complete daily total.'],
 ['Bad humidity but valid gust in the same record','Reject RH only; supported wind warning survives.'],
 ['All source products absent','Unknown source coverage, not safe/no hail.'],
 ['Recent optional no-symptoms report','Do not reset latent disease history or inferred moisture.']
],[.43,.57])
p('This is why the orchestrator calls every warning evaluator even if watering fails. It should not wrap all advice in one Boolean success flag. Record a reason such as water_history_incomplete_or_conflicted or profile_transition_requires_reinitialization and retain unaffected evidence.')

page('19  Cards, priority and notification state','USER EXPERIENCE PRIORITY IS NOT A BIOLOGICAL WEIGHT')
code(NOTIFY)
p('Merge W01/W08 heat, W09/W11/W12 wet-weather context and topic-specific problem reviews. A source event satisfying a specific weather flag and W05 should not create duplicate cards/notifications. Preserve distinct source events and let an escalating issuer event bypass a repeat cooldown.')
p('Prioritize explicit severe source events and time-sensitive supported care according to product policy. Do not call a notification tier a disease probability. A dismissal, snooze, cooldown or watering action does not change weather, stored water or disease evidence.')
p('In the emulator, all push_eligible values remain false and notifications_sent is0. The pure notification_plan helper tests episode/cooldown behavior without sending anything. Actual authorization, subscriptions, permission, quiet hours, delivery receipts and retries remain application adapters.')

page('20  Verification and reproducible use','SCENARIO TESTS CHECK LOGIC; FIELD VALIDATION CHECKS THE CARE CLAIM')
p(f'Executed {verification["scenarioTestsRun"]} scenario/invariant tests with no failures, plus1,000 seeded random bank trials. The trials check reserve bounds, mass conservation, input/loss monotonicity and within-bin ordering for the simplified bank. They are not1,000 plant trials.')
table(['Test family','Covered behavior'],[
 ['State and replay','Known/unknown/zero refill, current-time watering, timing intervals, duplicate/edit/delete/conflict, repot/anchor changes.'],
 ['Weather and scope','Forecast rain separation, shelter, paired-variable independence, overlap/revisions, current points, location/environment, pot/ground and fallback profiles.'],
 ['Warnings and delivery','All14 IDs, missing data, source validity/cancellation/conflict, heat/container and source-card merging, cooldown/escalation.'],
 ['Claims and release','No deployed profile, no probability claim, no hidden laboratory inputs, no notification sends, false/null preserved.']
],[.29,.71])
code('python WeedGrow_Algorithm_Scenarios_v7.3.py\n\npython WeedGrow_Algorithm_Emulator_v7.3.py \\\n  --input WeedGrow_Synthetic_Input_v7.3.json \\\n  --output local_result.json')
p('The test runner writes its verification JSON and synthetic example files beside the scripts. Python3.10+ and the standard library are sufficient for the emulator/tests. Plot/PDF generation dependencies are not required to run the delivered reference. No API credentials or production plant records are used.')

page('21  Limits and additional gaps made explicit','THE BLUEPRINT DOES NOT HIDE UNIMPLEMENTED ADAPTERS OR MODEL COMPONENTS')
table(['Component','Status / next evidence'],[
 ['Raw provider and calendar adapters','Specified, not integrated. Test real payloads, omitted-variable semantics, units, UTC/IANA/DST, rate/amount and source alert mapping.'],
 ['Water state/profile calibration','No released profiles bundled. Establish storage/anchor/refill/loss/action ranges and actual scenario coverage with independent references.'],
 ['Growth / repot / root-zone transition','Prototype abstains. Develop dated transition model; new capacity cannot generate water.'],
 ['Loss physiology and surface drying','Simple fitted-coefficient bank only. Validate near-threshold performance; add complexity only if outcome/error analysis warrants it.'],
 ['Ground supply and frozen precipitation','Separate domain: root-zone geometry, redistribution/capillary supply and melt are not inferred by the pot fixture.'],
 ['Forecast projection uncertainty','No-rain/provided-rain examples are conditional, not a full error envelope. Need forecast/source validation or ensembles and horizon-specific evaluation.'],
 ['Disease calibration and benefit','Predictive models remain disabled. Need independent positives/followed negatives, specificity, lead time and prospective intervention outcomes.'],
 ['App consumers and notification integration','Migrate Boolean unknown handling, replay invalidation and episode state. Test full application paths before enabling care outputs.']
],[.33,.67])
p('The v7.2 twelve-part investigation plan still applies. This version adds executable checks for several failure modes and identifies where an implementation would otherwise smuggle in assumptions. A comprehensive specification cannot substitute for measured outcomes in the intended low-input deployment.')

page('22  Engineering handoff and acceptance','BUILD THE DATA/REPLAY FOUNDATION FIRST; ENABLE CLAIMS ONLY WITH SUPPORT')
bullets(['Keep the delivered emulator/reference under design or research tooling until production adapters, domain validation and approved model versions exist.',
 'Map existing/proposed fields explicitly; add rain reception and meaningful medium choice with unknown options. Do not introduce repeated measurements.',
 'Replace timer/rain-day shortcuts with typed events and supported reserve estimates. Preserve true/false/null across advice, caches, cards and notifications.',
 'Invalidate/replay on corrected weather/logs, deletion, location, rain reception, medium, pot/ground, stage, used age/height, profile version and anchor changes.',
 'Test raw provider contracts and consumer migration separately from the offline arithmetic. Retain source/location/time provenance for every explanation.',
 'Release only tested domains. Evaluate missed/needless watering, useful decision coverage, abstention, warning precision/lead time and notification burden against simple baselines.'])
h('Acceptance examples that must survive the port')
p('Rain forecast cannot refill today\'s reserve. A small watering cannot force not due. Unknown canopy shelter cannot become50%. A new pot cannot create moisture. A heat/source alert survives missing ET0. Missing data does not become no disease. An old optional height can fall back without demanding a new measurement.')
callout('The result is an implementable design with an executable logic reference, not a claim of validated horticultural accuracy. The remaining uncertainty is named, represented in outputs and prevented from silently becoming a confident recommendation.')

page('Evidence and design provenance','V7.2 PARAMETER LEDGER RETAINED; CURRENT PRIMARY DOCUMENTATION RECHECKED')
for sid,note in [('S11','FAO56 water balance and separate transpiration/evaporation stress effects inform the accounting interface, not a complete implemented cannabis physiology model.'),
 ('S33','Official hourly ET0/radiation definitions checked30October2026. Reference ET0 assumes well-watered grass and is an interval sum; it is not actual pot consumption.'),
 ('S12','Official current/forecast/history and precipitation semantics remain adapter requirements. No subscription, provider change or live account call occurred.'),
 ('S34','Soil-specific hydraulic quantities and a selected depletion setting remain research examples. They are not universal production profile defaults.'),
 ('S38','Primary PM treatment-trial conditions support avoiding a high-average-RH required gate, not assigning outdoor disease probabilities.')]:
 h(f'[{sid}] {refs[sid][0]}');p(note);blocks.append(('link',(refs[sid][1],'Open primary source')))
p('All38 retained source records and21 parameter records are copied into the factor/flag registry for traceability. This turn focused on executable design and logic verification; it did not claim another full re-review of all retained studies. Synthetic fixture parameters are marked separately and carry no biological calibration.')

def normalize_refs(value):
 if isinstance(value,str):return re.sub(r'\[(S\d{2}(?:,\s*S\d{2})+)\]',lambda m:', '.join('['+x.strip()+']' for x in m[1].split(',')),value)
 if isinstance(value,tuple):return tuple(normalize_refs(x) for x in value)
 if isinstance(value,list):return [normalize_refs(x) for x in value]
 return value
blocks=normalize_refs(blocks)
renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('WeedGrow_Outdoor_Algorithm_FINAL_v4.0',BASE).replace('R\\d{2}','S\\d{2}')
renderer=renderer.replace('WeedGrow Outdoor Algorithm - Final Specification v4.0','WeedGrow Algorithm Blueprint and Emulator v7.3')
renderer=renderer.replace('FINAL SPECIFICATION  v4.0','ALGORITHM BLUEPRINT  v7.3').replace('29 OCT 2026','30 OCT 2026')
renderer=renderer.replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','EXECUTABLE DESIGN; FIELD VALIDATION PENDING')
renderer=renderer.replace("'v4_acceptance_cases':64","'scenario_tests':verification['scenarioTestsRun'],'synthetic_bank_trials':1000")
renderer=renderer.replace("elif typ=='break': md += ['<!-- page break -->','']","elif typ=='figure': md += ['![Synthetic logic demonstration](WeedGrow_v7.3_figures/'+Path(b).name+')','']\n    elif typ=='break': md += ['<!-- page break -->','']")
renderer=renderer.replace("    elif typ=='link': story.append", "    elif typ=='figure':\n        im=Image(b);iw,ih=im.imageWidth,im.imageHeight;im.drawWidth=width;im.drawHeight=width*ih/iw\n        story += [im,Spacer(1,10)]\n    elif typ=='link': story.append")
exec(renderer,globals())
