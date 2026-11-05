from pathlib import Path
import json,math,re,html,importlib.util,sys
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Preformatted
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path('C:/Users/Zane/dev/WeedGrow');SRC=ROOT/'output/spec';OUT=ROOT/'output/pdf';BASE='WeedGrow_Math_Logic_Audit_v7.4'
def load(v):
 s=importlib.util.spec_from_file_location('audit_'+v.replace('.',''),SRC/f'WeedGrow_Algorithm_Emulator_v{v}.py');m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m);return m
old,new=load('7.3'),load('7.4')
def result_case(module,kind):
 p=module.demo_payload();now=p['now']
 if kind=='missing_canopy_rain':
  for r in p['weather']:r['rain_mm']=None
 if kind=='recent_flower_rain':p['weather'][70]['rain_mm']=2
 if kind=='log_conflict_resolved':
  a=dict(event_id='a',revision=1,kind='watering',earliest=now,latest=now,recorded_at=now,amount_l=.1)
  p['logs']=[a,dict(a,amount_l=2),dict(a,revision=2,amount_l=1)]
 if kind=='censored_forecast':
  p['logs']=[dict(event_id='a',revision=1,kind='watering',earliest=now,latest=now,recorded_at=now,amount_l=.7)]
  for r in p['weather']:
   if r['kind']=='forecast':r['rain_mm']=1.5
 out=module.evaluate(p)
 if kind=='missing_canopy_rain':return next(f['state'] for f in out['flags'] if f['id']=='W12')
 if kind=='recent_flower_rain':return next(f['state'] for f in out['flags'] if f['id']=='W11')
 if kind=='log_conflict_resolved':return out['water']['reason']
 return out['debug_threshold_projection']['first_crossing_interval_utc']
repros=[dict(case=k,before=result_case(old,k),after=result_case(new,k)) for k in ['missing_canopy_rain','recent_flower_rain','log_conflict_resolved','censored_forecast']]
(SRC/'WeedGrow_Audit_Reproductions_v7.4.json').write_text(json.dumps(repros,indent=2),encoding='utf-8')
v=json.loads((SRC/'WeedGrow_Algorithm_Verification_v7.4.json').read_text());assert not v['errors'] and not v['failures']
prior=json.loads((SRC/'WeedGrow_Low_Input_Model_Contract_v7.2.json').read_text())
refs={k:(s['title'],s['url'],s['scope']) for k,s in prior['sources'].items()}
blocks=[]
def p(t):blocks.append(('p',t))
def h(t):blocks.append(('h',t))
def page(t,s=''):
 if blocks:blocks.append(('break',None))
 blocks.append(('title',t))
 if s:blocks.append(('strap',s))
def table(head,rows,widths=None):blocks.append(('table',(head,rows,widths)))
def code(t):blocks.append(('code',t))
def callout(t):blocks.append(('callout',t))

page('WeedGrow\nMath & logic audit','v7.4 | CORRECTIONS AND EXPLICIT FLAG CALCULATIONS | 30 OCTOBER 2026')
p('This addendum audits the executable v7.3 reference and refines the calculations that produce flags. It takes precedence where it corrects v7.3; the42-factor input contract, full blueprint and low-burden workflow remain the baseline.')
callout('Real fixes were needed: missing rain could clear a canopy-context flag; recent rain was ignored by flower context; resolved log conflicts could still block replay; and a forecast projection could imply a finite upper wait despite horizon-censored trajectories.')
p(f'The corrected reference passes {v["scenarioTestsPassed"]} scenario tests plus1,000 seeded water-bank trials. Four before/after reproductions are supplied. No biological accuracy, disease-detection rate or prevention claim follows from those checks.')
p('Routine client input remains basic setup and watering events, amount optional. No daily moisture checks, leaf temperatures, measured roots, PAR, internal-bud humidity or repeated height measurements are introduced. The profile release registry stays empty; synthetic decisions remain debug-only.')

page('01  Errors found and corrected','REPRODUCIBLE CHANGES, NOT A CLAIM THAT EVERY POSSIBLE BUG IS ELIMINATED')
table(['Finding','Why it mattered','v7.4 correction'],[
 ['W12 false negative on missing rain','With known canopy access but no rain values, v7.3 returned not_triggered.','Unknown unless supported coverage can establish the screen was absent. Shelter means direct-rain path not_applicable, not no disease.'],
 ['W11 ignored recent rain','A dry forecast hid the fact that canopy rain occurred recently.','Recent24h and forecast24h rain evidence are separate; either can provide flower-weather context.'],
 ['Log conflict remained sticky','A later authoritative revision did not clear an older same-revision conflict reason.','Evaluate conflicts at the final selected revision. Keep genuinely unresolved latest conflicts blocked.'],
 ['Finite upper wait with censoring','Some forecast trajectories never crossed within24h, yet the displayed envelope had a finite upper endpoint.','Upper endpoint is null when any trajectory is horizon-censored. Preserve finite subset only as debug evidence.'],
 ['Bank input validation gaps','Unknown order labels silently became inputs-first; invalid starting reserves could be normalized away.','Reject invalid order and initial reserve explicitly.'],
 ['Forecast freshness unconfigured','An old issued forecast could still trigger from future-valid values.','Optional backend per-source TTL now rejects stale forecasts. Production must configure/test that policy; no universal freshness cutoff is invented.']
],[.26,.35,.39])
p('Also added: separate recent/forecast screen states, threshold exposure calculations, and an explicit ban on treating an hourly maximum gust as a sustained hour of wind. These changes affect interpretation and explainability, not fitted crop injury probabilities.')

page('02  Water calculations: units and threshold','THE AVAILABLE-WATER BANK IS NOT A MEASURED MOISTURE PERCENTAGE')
code('C = V_accessible_L * (theta_FC - theta_lower)    [L]\nRAW = p*C                                      [L depleted]\nA = C - RAW = (1-p)*C                           [L remaining]\n\nRainDelivered = rain_mm * catchment_m2 * deliveryFraction\nIrrigationDelivered = applied_L * retainedFraction\nPotentialLoss = ET0_mm * effectiveLoss_m2\n\nexcess = max(0, R + delivered - C)\nstored = min(C, R + delivered)\nextracted = min(stored, PotentialLoss)\nnextR = stored - extracted\nR + delivered = nextR + excess + extracted')
p('One millimetre over one square metre is one litre. Pot litres are not a rain-catchment area. Accessible volume, retention properties, p, effective loss and refill ranges are backend profile quantities requiring validation; they are not new measurements requested from the user.')
p('For example, C2L and p0.6 give RAW1.2L and A0.8L. Compare remaining water R with A, not RAW. The study-selected p0.6 is not a universal cannabis watering target. [S34]')
p('The equations above show inputs-first. The reference also evaluates loss-first and earliest/latest log timing for the simple fixed-loss bank. Those branches bound modeled ordering, not real-world moisture uncertainty. Evaporation, roots and soil redistribution are not fully simulated.')
p('ET0 already combines weather demand. Do not add a second temperature, humidity, wind, UV or daylength multiplier on top without a separately validated profile. If fitted total loss already includes evaporation, do not add evaporation again. FAO distinguishes soil evaporation from transpiration stress. [S11]')

page('03  Calling W06: due, not due or uncertain','NO UNVALIDATED DEFAULTS OR FORECAST-RAIN OVERRIDES')
code('for coherent scenario j:\n  margin_j = reserve_j - actionReserve_j\n\nif state/history/profile unsupported: UNCERTAIN\nelse if all(margin_j <= numericTolerance): WATER\nelse if all(margin_j > numericTolerance): NOT_DUE\nelse: UNCERTAIN\n\nneedsWater = true / false / null\nproductionResult = approvedProfile ? candidate : UNCERTAIN')
table(['Input condition','Actual effect'],[
 ['Known watering amount','Replay delivered amount, capped by supported retention/storage, at occurrence time.'],
 ['Watering with omitted amount','Use supported refill scenarios or abstain. Never assume full storage.'],
 ['Soil rain access=no','Zero direct rain contribution; other weather still affects loss.'],
 ['Unknown rain access','Keep zero/full delivery alternatives; partial access requires supported bounds.'],
 ['Age/height/sun/medium','Select supported profiles and fallbacks. No universal added litres/day or fixed days modifier.'],
 ['Repot, stage, medium or location change','Supported dated transition or reinitialization; never manufacture water from increased capacity.'],
 ['Forecast rain','Conditional future projection only. It cannot change present reserve or cancel already-supported watering need.']
],[.33,.67])
p('Missing logs remain an unobserved source of uncertainty. The reference cannot discover unlogged watering from weather. Initial reserve, unknown refill amounts and real-world logging adherence are still central calibration gaps. Routine reminders must remain labelled reminders.')

page('04  Exposure calculations behind weather flags','DESCRIPTIVE METRICS, NOT CALIBRATED INJURY SCORES')
code('For supported interval i of dt_i hours:\n  crossing_i = x_i >= threshold       // reverse for cold\n  H = sum(dt_i * crossing_i)          [modeled hours]\n  D = sum(dt_i * max(x_i-threshold,0)) [units * hours]\n  L = longest contiguous crossing episode\n\nA gap, unknown value or non-crossing bin breaks the episode.\nOverlap/conflict -> integral unavailable, never double-count.\nPoint crossing can trigger; it supplies zero duration.\nInterval maxima do not establish sustained exposure hours.')
p('At a32C screen,34C for1h followed by36C for2h gives H3h, L3h and D10C-hours. If a missing hour separates two1h crossing bins, known H2h but longest known episode1h. At exactly32C the screen is met while exceedance dose is0; these are different quantities.')
p('Temperature/RH values must have a time-support definition. Hourly representative values give a modeled bin approximation; a point is not a measured full hour. v7.4 labels this assumption. A gust maximum cannot supply sustained duration. Separate24h historical exposure from the recent1h/current crossing and forecast window: yesterday\'s heat is not automatically a current warning.')
table(['Flag','Boolean screen / source path','What exposure adds'],[
 ['W01 heat','Any supported air T>=32C OR applicable source heat event.','Separate recent/forecast peak/crossings, H/L/D where time support permits.'],
 ['W02 cold','T<=5C; nested possible-frost context<=2C; air-freezing context<=0C; or source event.','Cold D=sum(max(5-T,0)*dt). Air context is not tissue freezing.'],
 ['W03 wind','Gust>=15m/s OR mean wind>=10m/s OR source wind event.','Preserve gust maxima separately. Mean-wind bin exposure is descriptive only.']
],[.19,.47,.34])
p('These thresholds remain ENG attention screens. Duration/exceedance describes severity of the weather departure; no retrieved evidence justifies converting them into cannabis damage probability or assigning a universal65/35 damage weighting.')

page('05  Rain and severe-weather calculations','RATE, AMOUNT, WINDOW AND DATA NATURE MUST REMAIN DISTINCT')
code('meanRate_mm_per_hour = amount_mm * 3600 / intervalSeconds\nknownWindowRain = sum(nonoverlapping known liquid amounts)\n\nW04 = recognized rain/flood source event\n   OR known interval mean rate >=10mm/h\n   OR known rain in declared24h window >=25mm\n\nBelow all screens + complete relevant windows -> NOT_TRIGGERED\nBelow all screens + gaps/conflict -> UNKNOWN\nKnown lower bound already above screen -> TRIGGERED')
p('For6mm in30minutes, mean intensity is12mm/h. For25mm over24hours, the amount screen can trigger without a10mm/h interval. A supported current point rate can also trigger W04; it supplies no retained-water amount without a known integration interval. Liquid rain cannot automatically include snowmelt.')
p('Recent and forecast windows are evaluated separately and labelled. A partial known sum over the24h window can establish at least25mm; it cannot establish a complete total or prove the whole window stayed below25mm. Rolling windows cutting across provider bins need a validated interval adapter; uniform rainfall prorating is not assumed by the reference.')
code('W05 = latest verified mapped source hazard\n       AND matching location\n       AND valid current/upcoming interval\n       AND not cancelled/conflicted\n\nNo source coverage -> UNKNOWN, not no hail/severe weather.')
p('Source phase is now retained as current or forecast. Source issuer severity is preserved; a source event is not automatically destructive. Freshness is a backend service policy, independently versioned and tested, not something the grower logs.')

page('06  Ambient context and disease-related flags','COMPUTABLE EXPOSURE MUST NOT BE MISLABELLED AS INFECTION')
code('es(T) = 0.6108 * exp(17.27*T/(T+237.3))      [kPa]\nairVPD = es(Tair) * (1-RH/100)\nH90 = sum(dt where paired representative RH>=90%)\n\nW09 context = known H90>0\nW11 context = reported flowering AND (\n    known recent/forecast rain reaching canopy OR H90>0)\nW12 context = known recent/forecast rain reaching canopy\n\nMissing rain with canopy access=yes -> UNKNOWN\nCanopy access=no -> direct-rain path NOT_APPLICABLE\nUnknown/partial access never silently becomes dry.')
p('At30C, RH40% gives about2.55kPa air VPD; RH80% gives0.85kPa. This combines obtainable air conditions without estimating leaf temperature. VPD is atmospheric context, not measured soil moisture or plant water consumption. [S11]')
p('RH90% and the72h history/24h forecast windows are ENG descriptive choices. H90 is not leaf-wet hours, a biological infection threshold or a statement that lower humidity is safe. The code labels interval-duration assumptions and keeps concurrent air pairs rather than joining daytime maximum temperature with nighttime humidity.')
code('W10 predictive mildew model:\n  if no validated native low-input response model:\n    DISABLED + ambient context, never LOW_RISK\n\nW07/W13/W14:\n  optional topic-specific problem review only\n  never weather/log-only root rot or damping-off prediction')
p('PM can occur in studies with moderate average RH; that evidence does not identify a portable weather-to-incidence function. Neither air VPD, H90 nor a temperature band can safely be assigned disease-probability weights from these designs. [S38]')

page('07  Remaining warning calls and practical inputs','ALL FOURTEEN IDS RETAINED; NO NEW DAILY CLIENT OBLIGATIONS')
table(['Flag','Calculation / route','Boundary'],[
 ['W07 excess root water','Review only when user requests excess-root-water topic.','Bank overflow is not actual saturation or infection.'],
 ['W08 container heat','Pot context + W01 state; merge into heat card.','No root/pot-wall temperature calculation. Unknown pot/ground remains unknown.'],
 ['W09 damp-air context','H90>0, with phase/coverage and approximation metadata.','No measured dew or leaf wetness.'],
 ['W10 PM','Disabled predictive route until a validated coefficient surface exists.','No obligatory high-RH/rain gate, strain-resistance guess or infection odds.'],
 ['W11 flower context','Flowering AND(reachable recent/forecast rain OR near-saturated-air context).','No fixed internal-bud offset or exact flower day from age.'],
 ['W12 wet-canopy context','Positive reachable liquid rain in declared recent/forecast windows.','Missing values do not clear it; shelter only removes direct rain exposure.'],
 ['W13 establishment','Known establishment stage + requested establishment problem topic.','Unknown stage is unknown; no automatic damping-off detector.'],
 ['W14 root/wilt','Requested root-wilt problem topic opens review.','Wilt does not automatically mean water is needed.']
],[.24,.43,.33])
p('Comfortable client facts remain location, pot/ground and approximate pot size, stage, sun, rain reception and optional known medium/dated size or age. Weather/history/ET0 and source events are backend data. Internal model parameters are learned separately, not shifted to growers as extra questions.')

page('08  Verification and unresolved limits','AN AUDIT CAN REMOVE BUGS WITHOUT PROVING BIOLOGICAL ACCURACY')
p(f'Executed: {v["scenarioTestsPassed"]} scenario tests, including{v["scenarioTestsPassed"]-79} added regression cases, plus1,000 seeded bank trials. The carried-forward79 cases still pass. Four old/new reproductions are saved in JSON. New checks cover missing/recent rain, log conflicts, censored horizons, phase separation, exposure, gap/overlap, gust support, freshness, current rain rate and invalid bank arguments.')
table(['Remaining gap','Required implementation or evidence'],[
 ['Profile/initial/refill calibration','Independent reference data for the actual low-input workflow. No production profiles bundled.'],
 ['Stress and evaporation physics','Fixed-loss bank is incomplete outside its validated operating region. A depleted bank does not mean modeled potential transpiration actually occurred.'],
 ['Weather timing/support','Provider contracts for points, means, maxima, amounts and intervals; boundary-bin handling and IANA/DST tests remain adapter work.'],
 ['Climate/source/freshness domains','Backend per-source TTL and profile applicability must be configured/tested. Optional TTL support in the emulator is not a complete production policy.'],
 ['Growth/root expansion/repot','Dated transition/state ranges; new capacity cannot create water.'],
 ['Prediction uncertainty','No-rain/provided-rain branches do not exhaust forecast error. Censoring remains explicit rather than producing a false deadline.'],
 ['Disease discrimination/prevention','Prospective confirmed/followed outcomes, useful alert burden and intervention evaluation; no inferred coefficients in this revision.']
],[.32,.68])
p('No application source was changed. The bundle includes the prior full blueprint for context and the corrected reference/tests. These repairs should be ported and tested with real adapters and consumers before any product activation.')
for sid in ['S11','S33','S34','S38']:
 h('['+sid+'] '+refs[sid][0]);blocks.append(('link',(refs[sid][1],'Open primary source')))

renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('WeedGrow_Outdoor_Algorithm_FINAL_v4.0',BASE).replace('R\\d{2}','S\\d{2}').replace('WeedGrow Outdoor Algorithm - Final Specification v4.0','WeedGrow Math and Logic Audit v7.4')
renderer=renderer.replace('FINAL SPECIFICATION  v4.0','MATH + FLAG AUDIT  v7.4').replace('29 OCT 2026','30 OCT 2026').replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','AUDITED LOGIC; BIOLOGICAL VALIDATION PENDING')
renderer=renderer.replace("'v4_acceptance_cases':64","'scenario_tests':v['scenarioTestsPassed']")
exec(renderer,globals())
