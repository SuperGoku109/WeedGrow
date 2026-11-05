"""WeedGrow 5.2 reference combination evaluator, not a production care engine.

Inputs are already scoped, quality-checked features. The module tests logical
combinations and uncertainty, not plant biology or provider normalization.
Disease weather screens are off by default. No causal percentage weights exist.
"""
from copy import deepcopy
import math

def ref(name): return {"ref": name}
def ALL(*args): return {"all": list(args)}
def ANY(*args): return {"any": list(args)}
def GE(name, value): return {"compare": [name, ">=", value]}
def LE(name, value): return {"compare": [name, "<=", value]}
def Q(name, expr): return {"quality":name,"when":expr}

COMMON=ALL(ref("access.allowed"),ref("plant.active"),ref("plant.notDeleting"),ref("plant.outdoor"))
POLICIES={"pmWeather":False,"flowerWeather":False,"leafWeather":False}
RULES={}

def branch(key, expr, meaning, policy=None):
    return dict(id=key,when=expr,meaning=meaning,policy=policy)

def rule(wid,gate,branches,formula,primary,secondary,context,interaction,related):
    RULES[wid]=dict(id=wid,relevance=gate,branches=branches,formula=formula,
        primary=primary,secondary=secondary,context=context,interaction=interaction,related=related)

rule("W01",True,[
    branch("official_heat",ref("official.heat"),"Attributed official heat context; preserve whether human-oriented."),
    branch("air_heat",Q("valid.air",GE("air.C",32)),"Air-temperature attention screen; label its actual/forecast window.")],
    "C AND (officialHeat OR AIR(Tair >= 32 C))",
    "Applicable official event OR actual air-temperature screen; covered duration describes exposure.",
    "Verified direct solar exposure, acclimation and establishment affect preparation relevance.",
    "Pot/ground and reserve affect actions; neither is a substitute heat trigger.",
    "Heat can raise demand, but only a supported reserve model/observation establishes current watering need.",
    "W08 adds container context to this card; W06 remains a separate water-state decision.")
rule("W02",True,[
    branch("official_cold",ref("official.cold"),"Preserve authority's cold/frost/freeze subtype."),
    branch("air_freezing",Q("valid.air",LE("air.C",0)),"Air at or below zero; not measured tissue ice."),
    branch("possible_frost",Q("valid.air",LE("air.C",2)),"Possible surface-frost context; not confirmed frost."),
    branch("cold_attention",Q("valid.air",LE("air.C",5)),"Cold attention context.")],
    "C AND (officialCold OR AIR(Tair <= 5 C))\nSubtype: <=0 air freezing; else <=2 possible frost; else cold.",
    "Applicable official event OR actual air minimum/temperature, with source and window.",
    "Cloud, local sky view, wind, acclimation and establishment change context, not the air-freezing predicate.",
    "Pot size/cover help choose protection; human wind chill contributes zero to this predicate.",
    "Clear/calm conditions may support radiational cooling; advective freezing does not require them.",
    "W09 dampness may share air/dew evidence. Neither warning proves frost on a surface.")
rule("W03",True,[
    branch("official_wind",ref("official.wind"),"Source-attributed wind event."),
    branch("gust",Q("valid.gust",GE("wind.gustMps",15)),"Gust screen; not sustained wind."),
    branch("sustained",Q("valid.wind",GE("wind.meanMps",10)),"Sustained-wind screen.")],
    "C AND (officialWind OR GUST(gust >= 15 m/s)\n       OR WIND(meanWind >= 10 m/s))",
    "Applicable wind event OR separate gust/sustained-wind screens.",
    "Verified local shelter, unsupported stature or instability change protection relevance.",
    "Pot volume/height alone cannot predict tipping; unknown supports do not block regional exposure.",
    "Wind can affect drying and dispersal; no universal disease-protection or ET multiplier.",
    "W05 may group the same storm; W10-W12 remain independent condition watches.")
rule("W04",True,[
    branch("official_rain",ref("official.rain"),"Source-attributed rain/flood context, retaining subtype."),
    branch("rain_rate",Q("valid.rainRate",GE("rain.rateMmH",10)),"Rate screen, not complete-day amount."),
    branch("rain_amount",Q("valid.rain24h",GE("rain.rolling24hMm",25)),"Complete rolling-day amount screen.")],
    "C AND (officialRain OR RATE(rate >= 10 mm/h)\n       OR COMPLETE24H(amount >= 25 mm))",
    "Applicable event OR valid intensity OR complete rolling-day accumulation; these are alternatives.",
    "Received root input, drainage/run-on and canopy reception determine separate action paths.",
    "Rain chance qualifies a forecast; it is not retained volume or a cause-weight multiplier.",
    "Rain + soil reception can feed the water model; rain + canopy exposure can feed a wet-weather pathway. Neither follows from the other.",
    "W05 may group the storm. W06/W07 require state/root evidence; W11/W12 need tissue-specific paths.")
rule("W05",True,[
    branch("explicit_hail",ref("official.hail"),"Hail-specific source-supported event."),
    branch("explicit_severe",ref("official.severe"),"Only the severe hazards actually supported by the source.")],
    "C AND (applicableExplicitHail OR applicableSevereProduct)\nHail wording ONLY IF applicableExplicitHail is true.",
    "Explicit applicable authoritative severe/hail product. Ordinary rain/RH are not substitutes.",
    "Verified protection and portability affect preparation; source onset/expiry controls timing.",
    "Stage, size and pot/ground route actions; they do not establish hail occurrence.",
    "Do not add wind + rain + clouds to manufacture a hail trigger.",
    "Group W03/W04 only when the source/event supports those subtypes; preserve each reason.")
rule("W06",True,[
    branch("observed_dry",ALL(ref("root.dryRelevant"),Q("root.reconciled",True)),"Qualified current dry evidence, reconciled with conflicts."),
    branch("model_water_now",Q("model.supported",Q("model.reconciled",ref("model.waterNow"))),"Current supported water-state recommendation."),
    branch("model_drying_soon",Q("model.supported",Q("model.reconciled",ALL(ref("model.notDue"),ref("model.crossesWithin6h")))),"Conditional future need; not current drought.")],
    "C AND ((credibleDryNow AND RECONCILED(true))\n OR MODEL(waterNow OR (notDue AND crossingWithin6h)))",
    "Qualified root evidence OR supported reserve/action-threshold comparison; future crossing is a different branch.",
    "Retained watering, occurred rain, accessible storage and actual loss are model terms, not warning points.",
    "Age/size/medium define the model domain; heat, last-watered age and forecast rain alone cannot replace state.",
    "Storage minus loss plus retained input is an accounting model. A dry input/initial state cannot be inferred merely from user watering behaviour.",
    "Main watering card absorbs this detector. W01/W11 can coexist; credible wet-root conflicts require reconciliation.")
rule("W07",True,[
    branch("abnormal_site",ref("root.abnormalPoolingOrFailedDrainage"),"Current qualified abnormal root-zone drainage evidence."),
    branch("persistent_model_excess",Q("model.excessSupported",ALL(ref("model.excessAboveBound"),ref("model.pastNormalDrainWindow"))),"Supported abnormal excess persisting beyond its profile drain window.")],
    "C AND (abnormalRootPoolingOrFailedDrainage\n OR EXCESS(excessAboveBound AND pastNormalDrainWindow))",
    "Qualified abnormal site evidence OR the complete excess-plus-persistence model combination.",
    "Input, drainage, loss and root access alter that state within an assessed profile.",
    "Regional humidity/rain and normal moist medium do not supply the missing root finding.",
    "Excess AND persistence belong together; a normal wet period immediately after watering is not enough.",
    "W14 inherits this environmental route; W13 adds vulnerable establishment. One root-environment card.")
rule("W08",ref("plant.pot"),[
    branch("root_sensor_heat",ALL(ref("sensor.rootTempAvailable"),Q("sensor.rootTempSupported",ref("sensor.rootTempScreenCrossed"))),"Scoped root-temperature measurement and supported screen."),
    branch("exposed_pot_heat",ALL(ref("context.heat"),ANY(ref("setup.potSolarExposed"),ref("setup.hotContact"))),"Heat context plus explicit local container exposure.")],
    "C AND isPot AND (supportedRootTempScreen\n OR (W01_heat AND (potInSun OR hotContact)))",
    "Pot is mandatory. Supported sensor route OR heat plus explicit pot/contact exposure.",
    "Material, colour, insulation and geometry modify relevance; none proves a root temperature.",
    "Plant Full Sun and nominal pot litres cannot stand in for pot-wall exposure.",
    "A hot air value plus an unknown/shaded pot wall cannot trigger the exposed-pot branch. A supported local sensor is an independent alternative.",
    "Fold into W01 heat family, with the sensor/exposure reason labelled.")
rule("W09",True,[
    branch("explicit_fog",ref("siteOrProduct.fog"),"Typed documented fog product or credible local report."),
    branch("dew_proxy",ref("exposure.dewEpisode"),"Covered paired nighttime spread in [0,2 C] for two accumulated covered hours.")],
    "C AND (explicitFog OR coveredNightDewProxy)\nDew proxy: 0 <= Tair-Tdew <= 2 C for >=2 covered hours.",
    "Explicit fog OR supported paired dew-proxy episode. These are different mechanisms/routes.",
    "Sky view, cloud and wind frame radiational context; they are not gates for explicit fog.",
    "No rain is needed; soil reception does not describe leaf surfaces or replenish roots.",
    "Pair T/dew concurrently; do not use abs() to hide an invalid pair. Freezing context changes wording, not proof of ice.",
    "W11/W12 may reuse an eligible overlapping dampness proxy; do not count it as another independent disease vote.")
rule("W10",ref("plant.foliage"),[
    branch("powdery_report",ref("symptom.powderyGrowth"),"Reported powdery growth; cause unconfirmed."),
    branch("pm_weather",ref("exposure.pmEpisode"),"Informational simultaneous T/RH exposure screen.","pmWeather")],
    "C AND hasFoliage AND (currentPowderyGrowthReport\n OR (PMpilotEnabled AND pairedPMepisode))",
    "Foliage is mandatory. A current report is a symptom route; weather needs its own enabled paired episode.",
    "Verified local crowding, shade/airflow and relevant history refine scouting relevance.",
    "Pot size, soil class and strain labels are not independent infection triggers.",
    "Temperature AND RH AND covered duration form one weather feature. Rain is not required; wind/rain effects are not monotonic disease weights.",
    "Shares leaf-scout delivery with W12 when useful. W09 does not add independent mildew points.")
rule("W11",ref("plant.flowers"),[
    branch("flower_report",ref("symptom.flowerProblem"),"Reported flower problem; do not identify Botrytis."),
    branch("flower_wetting",ALL(ref("site.flowerDamp"),Q("site.flowerDampRuleSupported",ref("site.flowerDampPersistence"))),"Supported persistent flower dampness; a single wet instant is insufficient."),
    branch("flower_weather",ref("exposure.flowerEpisode"),"Informational simultaneous T/RH exposure screen.","flowerWeather")],
    "C AND hasFlowers AND (currentFlowerProblemReport\n OR supportedPersistentFlowerDampness\n OR (flowerPilotEnabled AND pairedFlowerEpisode))",
    "Flowers are mandatory. Supported persistent dampness or paired humid exposure is the environmental driver; reported symptoms use separate copy.",
    "Verified density, slow local drying and fresh wounds strengthen inspection relevance.",
    "Pot volume, soil RH assumptions and age cannot bypass flower presence or supply infection odds.",
    "T and humidity must overlap in time. Brief wetting alone does not pass the direct dampness route; persistence needs an accepted rule, with no universal default here. Wounds/density alone do not trigger.",
    "Group shared W09/W12 evidence; keep W06 root irrigation independent of flower-wetting precautions.")
rule("W12",ref("plant.foliage"),[
    branch("leaf_spot_report",ref("symptom.leafSpots"),"Reported spots; cause unconfirmed, including on a dry day."),
    branch("leaf_weather",ref("exposure.leafWetWeatherEpisode"),"Paired T/RH plus temporally overlapping supported wet-weather route.","leafWeather")],
    "C AND hasFoliage AND (currentLeafSpotReport\n OR (leafPilotEnabled AND jointTempRHwetWeatherEpisode))",
    "Foliage plus current spots OR an enabled joint temperature/humidity/wetting-context episode.",
    "Reported splash/debris/history and slow local drying can refine an inspection.",
    "A roof/soil/strain label alone cannot establish inoculum, wetness or Septoria.",
    "Count the INTERSECTION of T, RH and supported wet-weather route, not three totals from separate times. Label proxy versus measured leaf wetness.",
    "Shares leaf/flower scout context with W10/W11; distinct pathogens and routes remain distinct.")
rule("W13",ref("plant.vulnerableEstablishment"),[
    branch("establishment_report",ref("symptom.establishmentProblem"),"Failed emergence/young-seedling problem reported; cause unknown."),
    branch("wet_establishment",ref("context.rootExcess"),"W07 root-excess route in a vulnerable establishment context.")],
    "C AND vulnerableEstablishment\n AND (currentEstablishmentProblemReport OR W07_rootExcess)",
    "Vulnerable establishment is mandatory. W07 abnormal excess or a relevant current report supplies the trigger.",
    "Actual substrate T, rooting facts and current sanitation history frame the review.",
    "Air T, broad soil origin and clone/age labels do not prove damping-off or rooting status.",
    "Young stage without abnormal wetness is not wet-establishment risk; abnormal wetness in a mature plant is W07, not a seedling diagnosis.",
    "Add establishment context to the W07/W14 root family, without another independent severity vote.")
rule("W14",True,[
    branch("root_symptom_report",ref("symptom.rootOrWilt"),"Reported symptoms; explicitly cause unknown."),
    branch("root_environment",ref("context.rootExcess"),"Alias of W07 environmental evidence.")],
    "C AND (currentRootOrWiltReport OR W07_rootExcess)\nEnvironmental route is W07, never a second weather score.",
    "W07 evidence OR a current qualified symptom report, with different claims.",
    "Scoped root temperature/EC/pH and actual injury can support differential review.",
    "Prior needsWater=false, regional RH and weather cannot supply a root diagnosis.",
    "Wilt can have different causes. A symptom route does not establish excess water; a root-excess route does not identify a pathogen.",
    "One W07/W14 card with retained child reasons; W13 is tissue-specific context.")

def eval_expr(expr, values):
    if isinstance(expr,bool): return expr
    if "quality" in expr:
        return eval_expr(expr["when"],values) if values.get(expr["quality"]) is True else None
    if "ref" in expr:
        value=values.get(expr["ref"])
        return value if type(value) is bool else None
    if "compare" in expr:
        key,op,bound=expr["compare"]; value=values.get(key)
        if type(value) not in (int,float) or not math.isfinite(value): return None
        return value>=bound if op==">=" else value<=bound
    key="all" if "all" in expr else "any"
    parts=[eval_expr(x,values) for x in expr[key]]
    if key=="all": return False if False in parts else (None if None in parts else True)
    return True if True in parts else (None if None in parts else False)

def evaluate(wid, values, policies=None):
    """Branch isolation: unknown OR true triggers; false AND unknown is false."""
    policies=POLICIES if policies is None else policies
    common=eval_expr(COMMON,values)
    if common is not True:
        return dict(state="not_relevant" if common is False else "insufficient_data",commonGate=common,branches=[])
    rule_=RULES[wid]; relevance=eval_expr(rule_["relevance"],values)
    if relevance is not True:
        return dict(state="not_relevant" if relevance is False else "insufficient_data",relevance=relevance,branches=[])
    if wid=="W06" and values.get("model.waterNow") is True and values.get("model.notDue") is True:
        return dict(state="insufficient_data",reason="contradictory_model_state",branches=[])
    trace=[]
    for b in rule_["branches"]:
        enabled=not b["policy"] or policies.get(b["policy"],False)
        trace.append(dict(id=b["id"],result=eval_expr(b["when"],values) if enabled else "disabled_policy",meaning=b["meaning"]))
    results=[x["result"] for x in trace]
    state=("triggered" if True in results else "insufficient_data" if None in results
        else "disabled_policy" if "disabled_policy" in results else "not_triggered")
    return dict(state=state,branches=trace,matchedBranches=[x["id"] for x in trace if x["result"] is True])

def evaluate_all(values,policies=None):
    """Derived context is recomputed in dependency order; user cannot set it."""
    values=deepcopy(values); result={}
    for wid in RULES:
        result[wid]=evaluate(wid,values,policies)
        if wid in ("W01","W07"):
            state=result[wid]["state"]
            derived=True if state=="triggered" else False if state in ("not_triggered","not_relevant") else None
            values["context.heat" if wid=="W01" else "context.rootExcess"]=derived
    return result

def paired_duration(rows,window_hours,temp_min,temp_max,rh_min,required_hours,wet_required=False,source_nature="occurred"):
    """Synthetic canonical nonoverlapping intervals only; not a weather adapter.

    Duration is accumulated, not necessarily consecutive. Unknown gaps widen the
    upper bound. Coverage is simultaneous valid T/RH time, not infection odds.
    A wet-weather route can be a qualified proxy; it is not measured leaf wetness.
    """
    if not math.isfinite(window_hours) or window_hours<=0: raise ValueError("invalid window")
    lower=0.; upper=window_hours; coverage=0.; end=0.
    def valid_number(x): return type(x) in (float,int) and math.isfinite(x)
    for row in sorted(rows,key=lambda x:x["start"]):
        a,b=row["start"],row["end"]
        if not(valid_number(a) and valid_number(b)) or a<end or a<0 or b<=a or b>window_hours:
            raise ValueError("overlap or invalid interval")
        if row.get("nature")!=source_nature: raise ValueError("mixed/incorrect source nature")
        end=b; dt=b-a; t=row.get("T"); rh=row.get("RH")
        valid_t=valid_number(t) and -90<=t<=65
        valid_rh=valid_number(rh) and 0<=rh<=100
        if valid_t and valid_rh: coverage+=dt
        temp_ok=(temp_min<=t<=temp_max) if valid_t else None
        rh_ok=(rh>=rh_min) if valid_rh else None
        wet=row.get("wetRoute") if wet_required else True
        wet=wet if type(wet) is bool else None
        parts=[temp_ok,rh_ok,wet]
        match=False if False in parts else None if None in parts else True
        if match is True: lower+=dt
        elif match is False: upper-=dt
    result=None if coverage/window_hours<.8 else True if lower>=required_hours else False if upper<required_hours else None
    return dict(result=result,lowerHours=round(lower,6),upperHours=round(upper,6),pairedCoverage=round(coverage/window_hours,6),accumulated=True)

def fixtures():
    """Executed reference-logic fixtures; no measured horticultural labels."""
    values={"access.allowed":True,"plant.active":True,"plant.notDeleting":True,"plant.outdoor":True,
        "plant.pot":True,"plant.foliage":True,"plant.flowers":False,"plant.vulnerableEstablishment":False,
        "official.heat":False,"official.cold":False,"official.wind":False,"official.rain":False,"official.hail":False,"official.severe":False,
        "valid.air":True,"air.C":20,"valid.gust":True,"wind.gustMps":0,"valid.wind":True,"wind.meanMps":0,
        "valid.rainRate":True,"rain.rateMmH":0,"valid.rain24h":True,"rain.rolling24hMm":0,
        "root.dryRelevant":False,"root.reconciled":True,"model.supported":True,"model.reconciled":True,"model.waterNow":False,"model.notDue":True,"model.crossesWithin6h":False,
        "root.abnormalPoolingOrFailedDrainage":False,"model.excessSupported":True,"model.excessAboveBound":False,"model.pastNormalDrainWindow":False,
        "sensor.rootTempAvailable":False,"sensor.rootTempSupported":False,"sensor.rootTempScreenCrossed":False,"context.heat":False,"setup.potSolarExposed":False,"setup.hotContact":False,
        "siteOrProduct.fog":False,"exposure.dewEpisode":False,"symptom.powderyGrowth":False,"exposure.pmEpisode":False,
        "symptom.flowerProblem":False,"site.flowerDamp":False,"site.flowerDampRuleSupported":False,"site.flowerDampPersistence":False,"exposure.flowerEpisode":False,"symptom.leafSpots":False,"exposure.leafWetWeatherEpisode":False,
        "symptom.establishmentProblem":False,"context.rootExcess":False,"symptom.rootOrWilt":False}
    on={k:True for k in POLICIES}; results=[]
    def check(label,condition):
        assert condition,label
        results.append(dict(id=f"COMBO-{len(results)+1:03}",description=label,passed=True))
    def run(wid,update=None,policies=on):
        v=dict(values); v.update(update or {}); return evaluate(wid,v,policies)
    positive={"W01":{"air.C":32},"W02":{"air.C":5},"W03":{"wind.gustMps":15},"W04":{"rain.rateMmH":10},
        "W05":{"official.hail":True},"W06":{"model.waterNow":True,"model.notDue":False},"W07":{"root.abnormalPoolingOrFailedDrainage":True},
        "W08":{"context.heat":True,"setup.potSolarExposed":True},"W09":{"siteOrProduct.fog":True},"W10":{"exposure.pmEpisode":True},
        "W11":{"plant.flowers":True,"exposure.flowerEpisode":True},"W12":{"exposure.leafWetWeatherEpisode":True},
        "W13":{"plant.vulnerableEstablishment":True,"context.rootExcess":True},"W14":{"context.rootExcess":True}}
    for wid in RULES:
        check(wid+" primary positive path",run(wid,positive[wid])["state"]=="triggered")
        relevant={"plant.flowers":True} if wid=="W11" else {"plant.vulnerableEstablishment":True} if wid=="W13" else {}
        check(wid+" complete negative evidence",run(wid,relevant)["state"]=="not_triggered")
        v=dict(positive[wid]); v["plant.active"]=False
        check(wid+" inactive gate cannot be offset",run(wid,v)["state"]=="not_relevant")
    for name,expr,expect in [("AND false plus unknown",ALL(False,ref("missing")),False),("AND true plus unknown",ALL(True,ref("missing")),None),
        ("OR true plus unknown",ANY(True,ref("missing")),True),("OR false plus unknown",ANY(False,ref("missing")),None)]:
        check(name,eval_expr(expr,{}) is expect)
    for wid,field in [("W08","plant.pot"),("W10","plant.foliage"),("W11","plant.flowers"),("W12","plant.foliage"),("W13","plant.vulnerableEstablishment")]:
        for val,state in [(False,"not_relevant"),(None,"insufficient_data")]:
            d=dict(positive[wid]); d[field]=val; d["modifier.density"]=True; d["modifier.history"]=True
            check(f"{wid} required tissue/setup gate {val}",run(wid,d)["state"]==state)
    extra=[
        ("W01","heat lacks actual T; feels-like cannot rescue",{"air.C":None,"human.feelsLike":45},"insufficient_data"),
        ("W02","wind chill does not create air freezing",{"air.C":4,"human.windChill":-4},"triggered"),
        ("W03","sustained route survives unknown gust",{"valid.gust":None,"wind.gustMps":None,"wind.meanMps":10},"triggered"),
        ("W04","amount route survives absent rate",{"valid.rainRate":None,"rain.rateMmH":None,"rain.rolling24hMm":25},"triggered"),
        ("W05","rain/wind modifiers do not manufacture hail",{"rain.rateMmH":30,"wind.gustMps":20,"cloud.percent":100},"not_triggered"),
        ("W06","future need requires current notDue",{"model.notDue":False,"model.crossesWithin6h":True},"not_triggered"),
        ("W06","unreconciled model cannot force current need",{"model.waterNow":True,"model.notDue":False,"model.reconciled":False},"insufficient_data"),
        ("W07","excess without persistence does not pass model path",{"model.excessAboveBound":True,"model.pastNormalDrainWindow":False},"not_triggered"),
        ("W07","persistence without excess does not pass",{"model.excessAboveBound":False,"model.pastNormalDrainWindow":True},"not_triggered"),
        ("W08","full-sun plant is not exposed pot",{"context.heat":True,"plant.fullSun":True},"not_triggered"),
        ("W08","supported sensor is independent of air heat",{"sensor.rootTempAvailable":True,"sensor.rootTempSupported":True,"sensor.rootTempScreenCrossed":True},"triggered"),
        ("W09","explicit daytime fog does not require dew episode",{"siteOrProduct.fog":True,"exposure.dewEpisode":None},"triggered"),
        ("W11","density and wounds alone do not trigger",{"plant.flowers":True,"modifier.density":True,"modifier.wounds":True},"not_triggered"),
        ("W12","spot report does not require wet weather",{"symptom.leafSpots":True},"triggered"),
        ("W13","young stage alone does not trigger",{"plant.vulnerableEstablishment":True},"not_triggered"),
        ("W14","notDue alone does not prove root trouble",{"model.notDue":True},"not_triggered")]
    for wid,label,d,state in extra: check(label,run(wid,d)["state"]==state)
    check("Invalid air quality is unknown, not a confident negative",run("W01",{"valid.air":False,"air.C":20})["state"]=="insufficient_data")
    check("Unsupported water model needs recovery, not a daily-check rule",run("W06",{"model.supported":False})["state"]=="insufficient_data")
    check("Contradictory model state flags are rejected",run("W06",{"model.waterNow":True,"model.notDue":True})["state"]=="insufficient_data")
    check("Brief flower wetness does not independently trigger bud scout",run("W11",{"plant.flowers":True,"site.flowerDamp":True,"site.flowerDampRuleSupported":True,"site.flowerDampPersistence":False})["state"]=="not_triggered")
    check("Supported persistent flower dampness is an independent path",run("W11",{"plant.flowers":True,"site.flowerDamp":True,"site.flowerDampRuleSupported":True,"site.flowerDampPersistence":True})["state"]=="triggered")
    for wid,scope,symptom,exposure in [("W10",{},"symptom.powderyGrowth","exposure.pmEpisode"),("W11",{"plant.flowers":True},"symptom.flowerProblem","exposure.flowerEpisode"),("W12",{},"symptom.leafSpots","exposure.leafWetWeatherEpisode")]:
        check(wid+" disabled weather is unassessed",run(wid,{**scope,exposure:True},POLICIES)["state"]=="disabled_policy")
        check(wid+" symptom survives disabled weather",run(wid,{**scope,symptom:True},POLICIES)["state"]=="triggered")
    rows=lambda t,rh,a=0,b=24,wet=True:[dict(start=a,end=b,T=t,RH=rh,wetRoute=wet,nature="occurred")]
    pm=lambda rr:paired_duration(rr,24,15,28,85,4)
    check("PM exact lower T/RH/duration boundary",pm(rows(15,85,0,4)+rows(10,50,4,24))["result"] is True)
    check("PM just below four hours",pm(rows(20,90,0,3.99)+rows(10,50,3.99,24))["result"] is False)
    check("Separate warm and humid periods do not combine",pm(rows(25,50,0,12)+rows(10,95,12,24))["result"] is False)
    check("Known qualifying duration and adequate coverage",pm(rows(20,90,0,4)+rows(10,50,4,20))["result"] is True)
    check("80-percent coverage gate cannot be bypassed",pm(rows(20,90,0,4)+rows(10,50,4,19))["result"] is None)
    check("Missing hours could complete threshold: unknown",pm(rows(20,90,0,3)+rows(10,50,3,23))["result"] is None)
    check("Nonconsecutive qualifying intervals explicitly accumulate",pm(rows(20,90,0,2)+rows(10,50,2,20)+rows(20,90,20,22)+rows(10,50,22,24))["result"] is True)
    leaf=paired_duration(rows(20,90,0,12,False)+rows(10,50,12,24,True),24,15,30,85,4,wet_required=True)
    check("Leaf T/RH and wet-route totals must overlap",leaf["result"] is False)
    check("Humidity and wet-route episode together qualifies pilot",paired_duration(rows(20,90,0,24,True),24,15,30,85,4,wet_required=True)["result"] is True)
    for label,rr in [("Overlapping weather intervals rejected",rows(20,90,0,14)+rows(20,90,12,24)),("Forecast cannot complete occurred exposure",[dict(start=0,end=24,T=20,RH=90,nature="forecast")])]:
        try: pm(rr); passed=False
        except ValueError: passed=True
        check(label,passed)
    allv=dict(values); allv.update({"air.C":33,"setup.potSolarExposed":True,"root.abnormalPoolingOrFailedDrainage":True,"plant.vulnerableEstablishment":True})
    result=evaluate_all(allv,on)
    check("Dependency replay derives W08 heat context",result["W08"]["state"]=="triggered")
    check("Dependency replay derives W13 and W14 from W07",all(result[w]["state"]=="triggered" for w in ("W13","W14")))
    for wid in RULES:
        original=run(wid,positive[wid]); d={**positive[wid],"modifier.age":1,"modifier.potLitres":500,"modifier.uv":20,"modifier.density":True}
        check(wid+" unrelated modifiers cannot replace or amplify trigger",run(wid,d)==original)
    return results

if __name__=="__main__":
    import json
    result=fixtures()
    print(json.dumps(dict(referenceChecks=len(result),passed=all(x["passed"] for x in result),biologicalAccuracyValidated=False,productionAppTests=False),indent=2))
