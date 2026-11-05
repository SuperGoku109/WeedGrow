from pathlib import Path
import json, re, importlib.util, shutil

ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'tmp/pdfs/build_spec_v51.py').read_text(encoding='utf-8')
source=source.split('for lo,hi in [(1,7),(7,13),(13,19),(19,25)]:',1)[0]
source=source.replace('v5.1','v5.2').replace('"5.1"','"5.2"')
exec(compile(source,'inherited_v52_content','exec'))
inherited=blocks[:]
spec=importlib.util.spec_from_file_location('wg_warning_reference',ROOT/'tmp/pdfs/warning_logic_v52.py')
logic=importlib.util.module_from_spec(spec); spec.loader.exec_module(logic)
checks=logic.fixtures()
refs.update({
 'R25':('Oregon State University Horticulture: Disease Triangle','https://horticulture.oregonstate.edu/nursery/nursery/disease-triangle','Disease requires a susceptible host, suitable pathogen and environment. Unobserved pathogen presence limits weather-only disease claims.'),
 'R26':('UC IPM archived research model: Botrytis Bunch Rot of Grape','https://ipm.ucanr.edu/disease/database/grapebotrytis.html','Example of fitted temperature/wetness interactions and crop/location validation. Archived grape models are not cannabis weights, thresholds or recommendations.')})

# Ordinal roles describe dependency and implementation priority, not effect sizes.
rank_codes={
 'W01':['P1','M2','M2','C3','M2','C3'],
 'W02':['P1','M2','M2','M2','C3','X'],
 'W03':['P1','Q','M2','M2','M2','C3'],
 'W04':['P1','Q','M2','M2','M2','M2','C3'],
 'W05':['P1','Q','M2','M2','C3','X'],
 'W06':['P1','P1','P1','P1','G','M2','Q'],
 'W07':['P1','P1','P1','G','P1','Q','C3'],
 'W08':['G','P1','P1','M2','M2','P1'],
 'W09':['P1','M2','M2','M2','Q','X'],
 'W10':['G','P1','M2','M2','M2','M2','C3'],
 'W11':['G','P1','P1','M2','M2','P1/C3','C3'],
 'W12':['G','P1','P1','M2','M2','P1/C3'],
 'W13':['G','P1','M2','M2','C3','P1'],
 'W14':['P1','P1','C3','Q','C3','X']}
rank_meanings={'G':'Mandatory tissue/setup/model-domain gate; cannot be offset by points.',
 'Q':'Source/quality/reconciliation requirement; failure leaves that branch unassessed.',
 'P1':'Primary trigger route or required component of that route; components may be jointly necessary.',
 'M2':'Secondary local modifier/interaction; cannot create eligibility without a primary path.',
 'C3':'Action/differential/scope context; not an independent event trigger.',
 'X':'Excluded substitute for the stated trigger.',
 'P1/C3':'Current positive symptom report is P1; previous negative inspection/history scope is C3.'}
for w in warnings:
    ranks=rank_codes[w['id']]
    assert len(ranks)==len(w['factors'])
    for f,rank in zip(w['factors'],ranks): f.update(rank=rank,rankMeaning=rank_meanings[rank],numericalCausalWeight=None)
    w['formalLogic']=logic.RULES[w['id']]
    w['predicate']=logic.RULES[w['id']]['formula']
    if w['id']=='W11':
        w['requirements']='Flowers must be recorded or confirmed. The environmental route needs an enabled covered humid episode or supported persistent flower wetness. A current flower-problem report has a separate cause-unknown route. Brief wetting alone is insufficient; no universal persistence default is supplied.'
        w['missingBehavior']+=' The direct wetness route is unassessed without supported persistence evidence/rule.'

def strip_break(items):
    items=items[:]
    while items and items[-1][0]=='break': items.pop()
    return items

first_warning=next(i for i,(typ,v) in enumerate(inherited) if typ=='title' and str(v).startswith('W01  '))
blocks=strip_break(inherited[:first_warning])

page('12G  Ranked roles, not interchangeable points','IMPLEMENTATION HIERARCHY - NO UNMEASURED CAUSAL PERCENTAGES')
p('The v5.1 factor list did not make hierarchy and combinations explicit enough. v5.2 adds ordinal roles, formal AND/OR paths, joint-exposure arithmetic and executable reference fixtures. Existing factors and missing-data limits remain. Ranking here means decision dependency and action relevance, not a measured percentage contribution to disease.')
table(['Rank / role','How the algorithm uses it','Can it trigger alone?'],[
 ['G - mandatory gate','Check relevant tissue/setup: flowers, foliage, pot or vulnerable establishment. Unknown stays unknown.','No. Passing a gate permits evaluation; it is not evidence of an event.'],
 ['Q - valid support','Check time, location, source, units and relevant model/sensor support. Failed quality yields unknown for that branch.','No. Good data alone is not a hazard.'],
 ['P1 - primary route/component','Evaluate the explicit primary combination. Alternatives use OR; required components use AND.','Only when the complete named path is satisfied.'],
 ['M2 - secondary modifier','Refine local relevance or feasible preparation. Report the effect direction/interaction.','No. Many modifiers cannot replace a missing P1 or gate.'],
 ['C3 - context','Choose wording/actions, reconcile conflicts or scope prior observations.','No; a new positive symptom is its own P1 route where specified.'],
 ['X - excluded inference','Do not use human feels-like as plant temperature, or rain chance as hail evidence.','No. Excluded from that predicate.']
],[.20,.53,.27])
h('What this ranking does and does not say')
p('Within P1, factors may be jointly required and have no defensible independent order. Temperature, RH and duration in an exposure screen are one interaction, not three weighted votes. G/Q are hard constraints, not very large coefficients. P1/C3 means the original grouped factor contains a positive-report trigger and time-scoped negative/history context.')
p('Evidence reliability is a separate axis: a correctly scoped measurement directly supports the measured quantity; a regional proxy supports a qualified environmental claim; a symptom report supports a reported problem. None automatically identifies a pathogen. A source-attributed official event is retained with its own hazard and geographic scope.')
p('Formula notation: C is the common authorization/active/outdoor gate. AIR, GUST, WIND, RATE and COMPLETE24H evaluate their condition only with valid scoped data; otherwise their result is unknown. MODEL additionally requires a supported, reconciled water model; EXCESS needs its assessed drainage profile. RECONCILED(true) is unknown while a material conflict is unresolved. These wrappers are source-support tests, not factor weights.')
callout('Do not assign humidity 40%, temperature 30% and canopy 30%. Those numbers would have no measured meaning here. The implementable first version is a rule/physics system with explicit interactions; numerical disease-effect weights require representative outcomes and validation.')

for start,end in [(0,7),(7,14)]:
    page(f'12H  Primary-driver ranking {start+1:02}-{end:02}','P1 IS THE COMPLETE TRIGGER PATH; M2/C3 CANNOT REPLACE IT')
    table(['Warning','P1 / mandatory scope','M2 / C3 and limitation'],[
      [w['id']+' '+w['title'],logic.RULES[w['id']]['primary'],logic.RULES[w['id']]['secondary']+' '+logic.RULES[w['id']]['context']]
      for w in warnings[start:end]],[.23,.40,.37])
    p('This is an ordinal engineering hierarchy supported by the mechanisms and data limits, not an empirical ranking of causal effect sizes. The individual contracts give formal combinations. Numeric weather values are the v5.1 ENG attention screens, not cannabis injury thresholds; disease weather-screen policies remain off by default.')

page('12I  Warning relationships and shared pathways','14 DETECTORS DO NOT MEAN 14 INDEPENDENT SCORES OR PUSHES')
table(['Shared mechanism / evidence','Permitted combination','Required separation'],[
 ['Heat -> demand -> reserve','Heat can drive assessed loss; storage/input/loss then determine W06. Exposed container context can add W08.','W01 is not proof of W06; W08 folds into heat.'],
 ['Rain -> two reception paths','Soil reception feeds root accounting. Canopy reception feeds wet-weather context.','Neither route implies the other. Regional rain alone is not saturated roots or measured wet flowers.'],
 ['Reserve -> drainage -> root context','W07 needs abnormal excess/persistence or qualified site evidence. W14 reuses W07; W13 adds vulnerability.','One root-environment card, not three independent causes or severity points.'],
 ['T + RH + time','Evaluate matched intervals to form one exposure feature. Dew/VPD can share the same underlying air data.','Do not add RH, dew and VPD as three independent disease votes.'],
 ['Dampness + relevant tissue','W09 may supply an overlapping proxy pathway; W11 requires flowers, W12 foliage and its declared joint episode.','Dew/rain hours are not measured tissue-wetness hours; powdery mildew does not require free water.'],
 ['Wind -> mechanical / drying / dispersal','W03 screens regional wind. Local flow may affect drying and dispersal in different directions.','No universal protective wind credit for W10-W12.'],
 ['One storm -> several explicit hazards','W05 may group actual source-supported W03/W04/hail subtypes and retain child reasons.','Do not invent absent hail/flood subtypes from the generic storm.'],
 ['Symptoms -> reported-problem review','A current report can bypass the weather-screen branch, while keeping required tissue context.','A symptom route cannot claim that qualifying weather occurred or that a pathogen is confirmed.']
],[.27,.40,.33])
p('Suggested delivery groups are watering, heat/container heat, cold/frost, storm/wind/rain, foliage/flower scouting, and root/establishment context. These are UI groups, not collapsed biological models. Preserve all actionable distinct hazards; grouping must not hide an urgent event or turn several reasons into a probability.')
p('Evaluate dependencies in order: common/tissue/source gates -> W01 and W07 -> W08 using W01, W13/W14 using W07 -> other independent detectors -> reconcile actions -> group delivery. The reference evaluator derives dependency values; it does not accept a user-supplied W07=true as evidence.')

page('12J  How combinations become an exposure episode','JOINT, TIME-ALIGNED CONDITIONS - NOT SEPARATE DAILY VOTES')
code('''For each supported, non-overlapping interval i:
  PM_i = (15 <= T_i <= 28) AND (RH_i >= 85)
  Flower_i = (10 <= T_i <= 28) AND (RH_i >= 90)
  Leaf_i = (15 <= T_i <= 30) AND (RH_i >= 85)
           AND supportedWetWeatherRoute_i
  known qualifying hours = SUM(dt_i where joint predicate is true)
  possible qualifying hours = known + unresolved/gap hours
  coverage = time with valid paired T/RH / expected window time''')
p('These are unchanged ENG candidate screens, production-disabled until pilot review. Over a declared 24-hour window, the candidate threshold is four accumulated qualifying hours, not necessarily consecutive. A claim of consecutive hours would need a separate run/reset rule. Each retrospective or forecast episode has one source nature, location epoch and valid window; future hours never complete an occurred episode.')
table(['Combination','Screen outcome / reason'],[
 ['12 h warm/dry; different 12 h cool/humid','No qualifying PM hours. Warm duration plus humid duration does not equal simultaneous exposure.'],
 ['4 h jointly suitable; 20 h known unsuitable','Candidate qualifies with full coverage. These are conditions, not infection odds.'],
 ['3 h suitable; 20 h unsuitable; 1 h missing','Lower=3, upper=4; insufficient_data because the missing hour changes the answer.'],
 ['4 h suitable but only 19/24 h paired data','Insufficient_data under the pilot 80% coverage gate; do not present 19 h as a complete day.'],
 ['Warm/humid period and wet-weather route at separate times','No joint leaf episode from those disconnected totals. Wetness persistence requires its own evidence/model.']
],[.44,.56])
p('A wet-weather route is explicitly typed: scoped local wetness report/sensor, received canopy-rain context, or a time-aligned qualified dew/fog proxy. Unknown canopy rain reception can only support labelled regional/conditional rain context; confirmed no reception blocks that rain route, not independent dew or a direct wetness report. Do not extend a wet route through later hours with an invented drying time.')
p('Known false conjunction components remain false even if another component is unknown. Missing/invalid components otherwise widen the bounds. Missing data never means zero exposure. A numeric branch with invalid source quality is unassessed; an absent optional symptom report merely leaves that report branch inactive.')
p('The disease triangle requires suitable host, pathogen and environment. Most pathogen/susceptibility data are unobserved here, so environmental screens cannot be infection probabilities. [R25] A grape Botrytis model demonstrates fitted T-by-wetness interactions, but its coefficients and crop/location validation do not transfer to cannabis. [R26]')

# Revise existing warning pages in place, keeping all original factor effects.
tail=inherited[first_warning:]
blocks.append(('break',None))
current=None; next_rule=False; expect_table=False
for typ,value in tail:
    if typ=='title' and re.match(r'W\d{2}  ',str(value)):
        current=str(value)[:3]
    elif typ=='title': current=None
    if current:
        if current=='W11' and typ=='p' and str(value).startswith('Flowering tissue is recorded'):
            blocks.append(('p',next(w['requirements'] for w in warnings if w['id']=='W11'))); continue
        if typ=='h' and value=='Decision rule':
            blocks.append(('h','Exact trigger combinations')); next_rule=True; continue
        if next_rule and typ=='p':
            blocks.append(('code',logic.RULES[current]['formula'])); next_rule=False; continue
        if typ=='table' and value[0]==['Factor / role','How it changes the warning','When missing']:
            heads,rows,widths=value; ranked=[]
            for rank,row in zip(rank_codes[current],rows): ranked.append([rank+' - '+row[0],row[1],row[2]])
            blocks.append(('table',(['Rank / factor','How it changes the warning','When missing'],ranked,widths))); continue
        if typ=='p' and str(value).startswith('Regression checks: '):
            r=logic.RULES[current]
            blocks.append(('p','Interactions: '+r['interaction']+' Related warnings: '+r['related'])); continue
    blocks.append((typ,value))

# Add worked combinations and measured-weight requirements before unsupported claims.
continuation=blocks[:]
at=next(i for i,(typ,v) in enumerate(continuation) if typ=='title' and str(v).startswith('14  Predictions'))
prefix=strip_break(continuation[:at]); after=continuation[at:]
blocks=prefix

page('13E  Worked combinations and action priority','EXPLICIT PATHS REPLACE AN ADDITIVE RISK SCORE')
table(['Example combination','Required result'],[
 ['Flowers absent + humid episode + dense canopy + wounds','W11 not_relevant. Modifiers cannot overcome the missing flower gate.'],
 ['Flowers known + enabled paired humid episode + no density/history info','W11 conditions watch. Unknown optional modifiers do not block the primary episode.'],
 ['Flowers known + density/wounds only + no dampness/episode/report','No W11 trigger on those modifiers alone. Missing primary evidence is unassessed, not low disease risk.'],
 ['Flowers known + current flower problem + weather pilot disabled','Reported flower-health problem, cause unconfirmed. The report route remains active.'],
 ['Flowers briefly wet + no humid episode/report','Brief wetting alone does not qualify W11. Its direct dampness route needs supported persistence evidence.'],
 ['Heat + supported sufficient reserves','W01 exposure can be active; no current drought/extra-water instruction.'],
 ['Abnormal excess + elapsed past profile drain window','W07 qualifies if model support is valid. Either term alone is not the model trigger.'],
 ['Current abnormal pooling + young vulnerable establishment','W07 root environment plus W13 context; W14 inherits, with one grouped card.'],
 ['Unknown gust + valid sustained wind above its screen','W03 can qualify through sustained wind. Unknown OR true is true.']
],[.48,.52])
h('Delivery priority is not a ranking of causal factors - ENG')
table(['Order','Deterministic routing decision'],[
 ['1 - immediate applicable event','Preserve official event urgency and current valid window. Follow source/local safety guidance; do not direct outdoor action during dangerous conditions.'],
 ['2 - current supported care issue','A reconciled current watering need or qualified root/drainage problem receives timely care wording. Resolve contradictory evidence first.'],
 ['3 - preparation / inspection watch','Upcoming weather, predicted need window or condition scout is scheduled while useful, respecting settings.'],
 ['4 - contextual child reason','Container/establishment/shared dampness detail enriches its parent card without another repetitive push.']
],[.28,.72])
p('Keep all matched branches in the explanation. For cold, the most specific supported numeric subtype is air freezing, otherwise possible frost, otherwise cold; retain an official subtype separately. For disease cards, a current symptom report leads with reported-problem wording and can also retain a separately supported conditions watch. Do not sum matched branches into severity.')

page('13F  Reference verification and future weights','LOGICAL CORRECTNESS IS TESTED; BIOLOGICAL EFFECT SIZE IS NOT ESTIMATED')
p(f'The supplied reference evaluator executes {len(checks)} synthetic combination checks. They test every warning positive/negative path and common gate; required tissue/setup gates; three-valued AND/OR; independent alternatives; source-quality failure; disabled disease weather policy versus active symptom report; joint-duration arithmetic; dependency replay; and invariance to unrelated modifiers. All passed. These are real reference-code checks, separate from the 42 previously specified warning scenarios and 48 inherited core cases.')
p('The evaluator accepts scoped, normalized features, not raw weather API payloads. It implements Boolean eligibility and one illustrative duration reducer. It does not implement provider normalization, moisture/storage calibration, symptom interpretation, severity prediction or the app integration. Source/tissue/model feature producers still need implementation and verification. Normal operation still uses watering logs without daily manual moisture checks.')
h('What must happen before numerical disease weights exist')
table(['Requirement','Concrete implementation criterion'],[
 ['Define the outcome','For any future probability, name the pathogen/condition, tissue, prediction horizon and independent outcome standard. A weather episode and confirmed disease are different targets.'],
 ['Collect appropriate observations','Use representative plants, setups, climates and timed symptom/reference observations. Missing checks remain missing; watered-after-alert is not a true disease/dry label.'],
 ['Fit joint responses','Estimate temperature-by-wetness/duration effects and justified local modifiers within the supported domain. Avoid duplicate RH/dew/VPD votes. No copied grape coefficients.'],
 ['Keep gates outside a score','Required tissue, authorization and source validity remain hard rules. A large score cannot compensate for false/unknown required scope.'],
 ['Measure usefulness and calibration','Use prospective chronological/plant/location holdouts; report false alerts, misses, coverage and burden. If probabilities are produced, evaluate calibration and suitable scoring rules.'],
 ['Assess added factors','Compare held-out performance with/without each added feature group and important interactions. Predictive feature importance is not proof of causal percentage contribution.'],
 ['Version and fallback','Store fitted coefficients/functions, domain, references and validation. Outside supported input/domain, retain qualified rules or unassessed status.']
],[.30,.70])
callout('Numerical causal weights: not estimated. Ordinal factor roles: specified for all 89 mappings. Trigger combinations: executable as reference logic for all 14 warning IDs. Disease-weather production policies: still disabled pending validation. No production app warning engine or field accuracy is claimed.')

feature_bindings=[
 ['access.*, plant.active/notDeleting/outdoor','Ownership/share permission, status/deleting and environment.','Existing records; enforce access before reading protected features.'],
 ['plant.pot/foliage/flowers/vulnerableEstablishment','plantedIn, current stage and confirmed tissue/rooting facts.','Pot is direct; stage-to-tissue rules need explicit scope. Unknown rooting or flowers stays unknown.'],
 ['official.*','Applicable mapped alert/severe product with hazard subtype and valid interval.','New adapter/storage required; unavailable feed is not no regional hazard.'],
 ['valid.*, air.C, wind.*, rain.*','Scoped air, gust/mean m/s, rain mm/h or complete rolling-24h mm.','Legacy cache is insufficient for every route. Wrapper quality includes provenance, units, location and coverage.'],
 ['model.*','Supported predictive decision, future crossing, excess and profile drain window.','New model outputs; preserve interval/domain/reconciliation. waterNow and notDue cannot both be true.'],
 ['root.*','Qualified current dry/pooling/drainage evidence and conflict reconciliation.','Optional typed observations; absent report is inactive, not evidence of normal roots. No daily-check gate.'],
 ['exposure.*','Matched normalized intervals -> PM/flower/leaf/dew episode.','Derived features; preserve occurred versus forecast, source and duration bounds. Weather disease policies stay off.'],
 ['sensor.*','Instrument availability, scope, calibration and supported root-temperature screen.','Optional new capability. No sensor means inactive sensor branch; present invalid support remains unassessed.'],
 ['setup.*','Explicit pot solar/hot-contact context, with effective time.','Optional proposed fields; plant Full Sun is not a pot-wall observation.'],
 ['siteOrProduct.fog, site.flowerDamp*','Typed fog product/report; current flower wetting plus supported persistence rule and evidence.','Brief wetting is insufficient for W11; no universal persistence default. A symptom report is a separate route.'],
 ['symptom.*','Current scoped positive/uncertain tissue problem reports.','New typed reports required; current inspectionResult stores only no_symptoms. Do not infer from photo URI.'],
 ['context.heat, context.rootExcess','Derived W01 / W07 result, recomputed before dependants.','Internal only. Triggered -> true, supported nontrigger -> false, insufficient -> unknown.']
]
page('13G  Reference features and data bindings','FEATURE NAMES ARE A CONTRACT, NOT A CLAIM THAT THE APP ALREADY STORES THEM')
table(['Reference input','Producer / meaning','Availability and limitation'],feature_bindings,[.27,.35,.38])
p('Each real feature bundle also carries source nature, valid interval, location/setup epoch, provenance and uncertainty. The scalar reference checks omit these envelopes for compact synthetic testing; their producers must validate them before evaluation. A Boolean report feature means an eligible report exists, not confirmed disease. When facts conflict, reconcile chronology, tissue, depth and method instead of averaging.')
p('A source is not made valid by setting a flag manually. The quality wrapper must be backed by producer checks and fixtures. An absent optional sensor/report is inactive; an invalid available measurement is unknown. No observation route is required for an otherwise supported normal model watering decision.')

blocks.append(('break',None)); blocks.extend(after)

# Align the earlier prose with formal branch/source logic.
for i,(typ,value) in enumerate(blocks):
    if isinstance(value,str):
        value=value.replace('WARNING ELIGIBILITY AUDITED','RANKED FACTORS AND COMBINATIONS')
        value=value.replace('These review contracts are descriptive rules, not executable code.','The prose contracts have a companion executable eligibility reference; the app and feature producers are not implemented by it.')
        if typ=='p' and value.startswith('This version supersedes the inspection-first product contract'):
            value+=' v5.2 adds ordinal factor priorities, explicit combinations, shared pathways and executed reference checks; numerical causal weights remain unestimated.'
        if typ=='p' and value.startswith('Each W01-W14 contract has prerequisites'):
            value+=' v5.2 adds formal expressions, per-factor ordinal ranks and the reference evaluator; see sections 12G-12J and 13E-13F.'
        blocks[i]=(typ,value)

for lo,hi in [(1,8),(8,15),(15,22),(22,27)]:
    page(f'Evidence ledger: R{lo:02}-R{hi-1:02}','MECHANISMS RECHECKED; NUMERICAL CAUSAL WEIGHTS NOT ESTIMATED  |  29 OCTOBER 2026')
    for k in range(lo,hi):
        key=f'R{k:02}'; title,url,note=refs[key]
        h(f'[{key}] {title}'); p(note); blocks.append(('link',(url,'Open primary source')))

report={'revision':'5.2','warnings':14,'rankedFactorMappings':sum(len(w['factors']) for w in warnings),
 'executedReferenceChecks':len(checks),'allReferenceChecksPassed':all(x['passed'] for x in checks),
 'previousWarningScenariosSpecified':42,'v5CoreScenariosSpecified':48,'appWarningTestsExecuted':False,
 'numericalCausalWeightsEstimated':False,'biologicalPredictionValidated':False}
registry={'contractVersion':'5.2','reviewDate':'2026-10-29','executableEligibilityReference':True,
 'productionAppImplemented':False,'numericCausalWeights':None,'rankMeanings':rank_meanings,
 'defaultDiseaseWeatherPolicies':logic.POLICIES,'commonEligibility':logic.COMMON,
 'qualityOperator':'Quality support false/missing yields unknown for that numeric/model branch, not a confident negative.',
 'inactiveOptionalReport':'No current report leaves that report route inactive; it is not a claim that no symptoms exist.',
 'featureContract':'Already scoped/normalized features only. Preserve sourceNature, valid interval, location epoch, method and uncertainty outside these scalar reference fixtures.',
 'featureBindings':[dict(inputs=row[0],producer=row[1],availability=row[2]) for row in feature_bindings],
 'sources':{key:dict(title=v[0],url=v[1],scope=v[2]) for key,v in refs.items()},
 'attentionScreens':[dict(key=row[0],setting=row[1],scopeAndStatus=row[2]) for row in next(v[1] for typ,v in blocks if typ=='table' and v[0]==['Screen key','Pilot setting','Scope and status'])],
 'warnings':warnings,'verification':report}
assert len(warnings)==14 and report['rankedFactorMappings']==89 and report['allReferenceChecksPassed']
SRC.joinpath('WeedGrow_Warning_Registry_v5.2.json').write_text(json.dumps(registry,indent=2),encoding='utf-8')
SRC.joinpath('WeedGrow_Warning_Combination_Checks_v5.2.json').write_text(json.dumps({'scope':report,'checks':checks},indent=2),encoding='utf-8')
shutil.copyfile(ROOT/'tmp/pdfs/warning_logic_v52.py',SRC/'WeedGrow_Warning_Reference_v5.2.py')
verpath=SRC/'WeedGrow_Outdoor_Algorithm_v5.2_Verification.json'
verification=json.loads(verpath.read_text(encoding='utf-8')); verification['warningCombinationAudit']=report
verpath.write_text(json.dumps(verification,indent=2),encoding='utf-8')

renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('v4.0','v5.2').replace("'v4_acceptance_cases':64",f"'warning_contracts':14,'ranked_factor_mappings':89,'executed_reference_checks':{len(checks)}")
renderer=renderer.replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','RANKED FACTORS AND COMBINATIONS; FIELD VALIDATION PENDING')
renderer=renderer.replace("fontSize=8.8,leading=17,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0","fontSize=7.7,leading=10.6,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0")
exec(compile(renderer,'reviewed_pdf_renderer_v52','exec'))
print(json.dumps(report,indent=2))
