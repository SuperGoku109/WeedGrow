"""WeedGrow v7.0 warning core (retained v6.0 research mathematics): weighted exposure, never disease odds.

Normalized interval weather and supported water-model states are inputs. This is
not the deployed app, a pathogen diagnosis, or a calibrated accuracy claim.
All ENG constants below are explicit policy priors, not fitted crop coefficients.
"""
from copy import deepcopy
from math import exp, log, isfinite, sqrt, floor

CONFIG={
 "version":"7.0", "productionEnabled":False,
 "scoreMeaning":"0-100 attention/exposure index; not infection probability or percent damage",
 "sourceClasses":{"PUB":"published numeric parameter","DER":"derived from published grouped means","ENG":"proposed operating prior","CAL":"requires target-domain calibration"},
 "weatherWeights":{"W01":{"intensity":.65,"dose":.35},"W02":{"minimum":.70,"dose":.30},
  "W03":{"gust":.80,"sustained":.20},"W04":{"rate":.50,"complete24hAmount":.50},
  "W05":{"explicitSourceEvent":1.0},"W08":{"parentHeat":1.0},"W09":{"dampnessEpisode":1.0}},
 "diseaseWeights":{"core":.80,"context":.20,"sensitivityCoreWeights":[.70,.80,.90]},
 "contextWeights":{"W10":{"crowdingOrPoorAirflow":.50,"localHistory":.30,"verifiedSusceptibility":.20},
  "W11":{"denseFlowersOrSlowDrying":.40,"freshDamage":.30,"localHistory":.30},
  "W12":{"splashOrDebris":.50,"poorLocalDrying":.30,"localHistory":.20}},
 "rootWeights":{"excessMagnitude":.70,"persistence":.30},
 "thresholds":{"heatAirC":32,"coldAirC":5,"possibleFrostAirC":2,"airFreezingC":0,
  "gustMps":15,"sustainedMps":10,"rainRateMmH":10,"rain24hMm":25,
  "diseaseCoreFloor":25,"watch":35,"elevated":65,"strongExposure":80,
  "minimumCoverage":.80,"currentGapMaxHours":1.5},
 "delivery":{"hysteresisOffScore":25,"repeatCooldownHours":48,"pushRequiresRobustElevated":True,
  "sameEpisodeNoRepeat":True,"historicalStartupNoDiseasePush":True},
 "exposure":{"historyHours":72,"forecastHours":24,"recencyHalfLifeHours":48,
  "pmEquivalentHours":12,"botrytisHumidEquivalentHours":8,"dampEquivalentHours":6,
  "pmTemperatureKnots":[8,18,26,35],"pmRhFloorAt50":.50,"pmRhRamp":[50,90],
  "botrytisTemperatureKnots":[5,15,25,35],"botrytisRhRamp":[65,95],
  "pmIndependentlySupportedWetFactorRange":[.5,1.0],
  "rhWetProxyThreshold":90,"proxyWetHourStressDelta":3,
  "scaleSensitivity":[.75,1.0,1.25],"flowerExposureHistoryDays":35},
 "broome":{"intercept":-2.647866,"wetHours":-.374927,"wetHoursTemp":.061601,"wetHoursTempSquared":-.001511,
  "temperatureDomainC":[12,30],"wetHoursDomain":[4,20],"sourceClass":"PUB","source":"S01",
  "nativeOutcome":"logit of infected mature grape-berry proportion","targetStatus":"cross-crop proxy only"},
 "nairFlower":{"maximumIndex":95.6,"timeScaleHours":1.3,"optimumC":23.7,"temperatureScaleC":10.5,
  "temperatureDomainC":[5,30],"wetHoursDomain":[1,24],"sourceClass":"PUB","source":"S01",
  "nativeOutcome":"grape flower infection response; cross-crop comparator only"},
 "wetEventPortfolio":{"sourceClass":"ENG","rule":"envelope of Broome berry and Nair-Allen flower curves within their joint tested domain; not a confidence interval"},
 "kcGround":{"initial":.70,"development":.75,"midSeason":.77,"mature":.66,
  "source":"S02","sourceClass":"PUB","domain":"matching field profile only; not pot litres or a universal plant dose"},
 "rootLab":{"source":"S08","sourceClass":"DER","cultivar":"Ferimon 12","durationDomainDays":[3,6],
  "late3Intercept":.29395604395604397,"perExtraDay":.08974358974358974,"earlyVegetativeOffset":.09340659340659341,
  "nativeOutcome":"relative final aboveground dry-biomass loss in Experiment 2; not root rot probability",
  "controlBiomassG":91,"means":[[3,1,58],[6,1,29],[3,0,62],[6,0,42]],
  "domain":"controlled inundation 2.5 cm above substrate; early=6 true leaf pairs, late=flower initiation"},
 "parameterPolicy":"Weights, kernels, thresholds, history length and sensitivity spans without PUB/DER labels are ENG and require CAL. No score is a measured probability."
}

def number(x,minimum=None,maximum=None):
 return type(x) in (int,float) and isfinite(x) and (minimum is None or x>=minimum) and (maximum is None or x<=maximum)
def clip(x,a=0.,b=1.): return min(b,max(a,x))
def ramp(x,a,b): return clip((x-a)/(b-a))
def trapezoid(x,a,b,c,d):
 return 0. if x<=a or x>=d else (x-a)/(b-a) if x<b else 1. if x<=c else (d-x)/(d-c)
def sat(hours,scale): return 100*(1-exp(-max(0,hours)/scale))
def feature_band(value):
 if type(value) is bool: return (float(value),float(value))
 if number(value,0,1): return (value,value)
 return (0.,1.)
def weighted(parts,weights):
 assert abs(sum(weights.values())-1)<1e-9
 return tuple(sum(weights[k]*parts[k][j] for k in weights) for j in (0,1))
def context_band(wid,ctx,cfg=CONFIG):
 return tuple(100*x for x in weighted({k:feature_band(ctx.get(k)) for k in cfg['contextWeights'][wid]},cfg['contextWeights'][wid]))

def broome_index(temp,wet_hours,cfg=CONFIG):
 """Published logit, preserved only within the actual chamber experiment domain."""
 p=cfg['broome']
 if not(number(temp,*p['temperatureDomainC']) and number(wet_hours,*p['wetHoursDomain'])): return None
 return p['intercept']+p['wetHours']*wet_hours+p['wetHoursTemp']*wet_hours*temp+p['wetHoursTempSquared']*wet_hours*temp*temp
def broome_exposure(temp,wet_hours,cfg=CONFIG):
 value=broome_index(temp,wet_hours,cfg)
 return None if value is None else 100/(1+exp(-value))

def nair_flower_exposure(temp,wet_hours,cfg=CONFIG):
 """Published grape-flower curve; never cannabis disease odds."""
 p=cfg['nairFlower']
 if not(number(temp,*p['temperatureDomainC']) and number(wet_hours,*p['wetHoursDomain'])): return None
 q=exp(-((temp-p['optimumC'])/p['temperatureScaleC'])**2)
 return p['maximumIndex']*(1-exp(-(q*wet_hours/p['timeScaleHours'])**2))

def root_lab_loss(days,early,matching_domain=False,cfg=CONFIG):
 if not matching_domain or type(early) is not bool or not number(days,*cfg['rootLab']['durationDomainDays']): return None
 p=cfg['rootLab']
 return clip(p['late3Intercept']+p['perExtraDay']*(days-3)+p['earlyVegetativeOffset']*early)

def validate_rows(rows,mode='occurred',window=72):
 """Intervals are relative to asOf in hours; no interpolation or API decoding here."""
 lo,hi=(-window,0) if mode=='occurred' else (0,window)
 prior=lo; clean=[]
 for row in sorted(rows,key=lambda r:r['start']):
  a,b=row.get('start'),row.get('end')
  if not(number(a) and number(b)) or a<prior or b<=a or a<lo or b>hi: raise ValueError('overlap/outside window/invalid interval')
  if row.get('nature')!=mode: raise ValueError('forecast/history source mixing')
  prior=b; clean.append(row)
 return clean

def recency_integral(a,b,mode,cfg=CONFIG):
 if mode=='forecast': return b-a
 k=log(2)/cfg['exposure']['recencyHalfLifeHours']
 return (exp(k*b)-exp(k*a))/k

def exposure_kernel(temp,rh,kind,cfg=CONFIG):
 if not number(temp,-90,65) or not number(rh,0,100): return None
 if kind=='pm':
  e=cfg['exposure']; humidity=clip(rh/50)*(e['pmRhFloorAt50']+(1-e['pmRhFloorAt50'])*ramp(rh,*e['pmRhRamp']))
  return trapezoid(temp,*e['pmTemperatureKnots'])*humidity
 e=cfg['exposure']; return trapezoid(temp,*e['botrytisTemperatureKnots'])*ramp(rh,*e['botrytisRhRamp'])

def duration_core(rows,kind,mode='occurred',window=72,cfg=CONFIG):
 rows=validate_rows(rows,mode,window)
 a,b=(-window,0) if mode=='occurred' else (0,window)
 total=recency_integral(a,b,mode,cfg); known_weight=0.; favourable=0.; favourable_low=0.;coverage=0.
 for r in rows:
  if r.get('valid') is not True: continue
  kernel=exposure_kernel(r.get('T'),r.get('RH'),kind,cfg)
  if kernel is None: continue
  weight=recency_integral(r['start'],r['end'],mode,cfg); known_weight+=weight; favourable+=weight*kernel;coverage+=r['end']-r['start']
  wet_factor=cfg['exposure']['pmIndependentlySupportedWetFactorRange'][0] if kind=='pm' and r.get('leafWetSupported') is True and r.get('leafWet') is True else 1.
  favourable_low+=weight*kernel*wet_factor
 scale=cfg['exposure']['pmEquivalentHours' if kind=='pm' else 'botrytisHumidEquivalentHours']
 values=[]
 for multiplier in cfg['exposure']['scaleSensitivity']:
  values.extend([sat(favourable_low,scale*multiplier),sat(favourable+max(0,total-known_weight),scale*multiplier)])
 return dict(band=(min(values),max(values)),central=sat(favourable,scale),coverage=coverage/window,
   knownEquivalentHours=favourable,knownEquivalentHoursLow=favourable_low,unknownEquivalentHours=max(0,total-known_weight),model='ENG kernel with cannabis compatibility evidence')

def event_band(event,cfg=CONFIG):
 """Unknown event quality never becomes a zero. A known lack of a wet event may be zero."""
 if event.get('valid') is not True: return None
 t,w=event.get('meanWetT'),event.get('wetHours')
 if event.get('wetnessEvidence') not in ('sensor','reported','model'): return None
 if event['wetnessEvidence']=='model':
  delta=cfg['exposure']['proxyWetHourStressDelta']
  # Stress scenarios, not a confidence interval derived from MAE.
  durations=[w-delta,w,w+delta] if number(w) else []
 else: durations=[w]
 # Structural transfer sensitivity: grape flower and mature-berry responses differ.
 # Require the joint tested domain; never let one curve silently extrapolate the other.
 vals=[]
 for d in durations:
  berry=broome_exposure(t,d,cfg); flower=nair_flower_exposure(t,d,cfg)
  vals.extend([berry,flower] if berry is not None and flower is not None else [None])
 # Unknown outside the tested domain widens the range, rather than clamping to safety.
 if not vals or all(x is None for x in vals): return None
 valid=[x for x in vals if x is not None]
 return (0.,100.) if any(x is None for x in vals) else (min(valid),max(valid))

def tomcast_dsv(temp,wet_hours):
 """Published tomato lookup structure; cross-crop leaf-exposure comparator only."""
 if not(number(temp) and number(wet_hours,0,24)): return None
 temp=floor(temp+.5); wet_hours=floor(wet_hours+1e-9)
 if temp<13 or temp>29: return None
 cuts=[6,15,20,24] if temp<18 else [3,8,15,22] if temp<21 else [2,5,12,20] if temp<=25 else [3,8,15,22]
 # At 13-17 C the source table has no 4-DSV category within a 24-hour day.
 return min(3 if temp<18 else 4,sum(wet_hours>x for x in cuts))

def wetness_features(rows,plant,mode='occurred',cfg=CONFIG):
 """A disclosed RH90/rain comparator, NOT an implementation of Kim's fuzzy model.

    Uses the most recent/next 24 hours. Missing rain is not zero. +/-3 wet hours
    is an ENG stress span, not a prediction interval or a conversion from MAE.
    """
 lo,hi=(-24,0) if mode=='occurred' else (0,24)
 covered=0.; wet=0.; uncertain=0.; weighted_temp=0.; wet_t_hours=0.
 for r in rows:
  a,b=max(lo,r['start']),min(hi,r['end'])
  if b<=a or r.get('valid') is not True: continue
  dt=b-a; rh=r.get('RH'); temp=r.get('T'); rain=r.get('rainMm')
  if not number(rh,0,100) or not number(temp,-90,65): continue
  direct=r.get('leafWet') if r.get('leafWetSupported') is True else None
  if type(direct) is bool: wet_state=direct
  elif rh>=cfg['exposure']['rhWetProxyThreshold']: wet_state=True
  elif number(rain,0) and rain==0: wet_state=False
  elif number(rain,0) and rain>0 and plant.get('canopyRainReception') is True: wet_state=True
  elif number(rain,0) and rain>0 and plant.get('canopyRainReception') is False: wet_state=False
  else: wet_state=None
  if wet_state is None: uncertain+=dt;continue
  covered+=dt
  if wet_state: wet+=dt;weighted_temp+=temp*dt;wet_t_hours+=dt
 uncertain+=max(0,24-covered-uncertain)
 if covered/24<cfg['thresholds']['minimumCoverage']:
  return {'supported':False,'nature':mode,'reason':'insufficient scoped wet-weather inputs','wetHourBand':[wet,min(24,wet+uncertain)]}
 temp=weighted_temp/wet_t_hours if wet_t_hours else None
 if wet==0 and uncertain==0:
  return {'supported':True,'nature':mode,'dsvBand':[0,0],'wetHourBand':[0,0],'method':'RH90/rain reference-surface comparator; no measured dry-leaf claim'}
 delta=cfg['exposure']['proxyWetHourStressDelta']; low=max(0,wet-delta);high=min(24,wet+uncertain+delta)
 values=[tomcast_dsv(temp,h) for h in (low,wet,high)] if temp is not None else []
 # Unknown temperatures during unassessed wet time prevent a falsely narrow DSV range.
 dsv=[0,4] if not values or any(x is None for x in values) or uncertain>0 else [min(values),max(values)]
 return {'supported':True,'nature':mode,'dsvBand':dsv,'wetHourBand':[low,high],'meanWetT':temp,
  'method':'RH90/rain reference-surface comparator; not actual cannabis flower wetness','stressSpanNotConfidenceInterval':True}

def solve3(matrix,rhs):
 a=[list(row)+[value] for row,value in zip(matrix,rhs)]
 for col in range(3):
  pivot=max(range(col,3),key=lambda r:abs(a[r][col]));a[col],a[pivot]=a[pivot],a[col]
  if abs(a[col][col])<1e-12: raise ValueError('singular design')
  scale=a[col][col];a[col]=[x/scale for x in a[col]]
  for row in range(3):
   if row!=col:
    scale=a[row][col];a[row]=[x-scale*y for x,y in zip(a[row],a[col])]
 return [row[-1] for row in a]

def fit_lab_rows(rows):
 x=[[1.,d-3,float(early)] for d,early,g in rows]
 y=[1-g/CONFIG['rootLab']['controlBiomassG'] for d,early,g in rows]
 return solve3([[sum(row[i]*row[j] for row in x) for j in range(3)] for i in range(3)],
  [sum(row[i]*value for row,value in zip(x,y)) for i in range(3)])

def lab_fit_report():
 rows=CONFIG['rootLab']['means'];coef=fit_lab_rows(rows);train=[];held=[]
 for i,(d,early,g) in enumerate(rows):
  y=1-g/CONFIG['rootLab']['controlBiomassG'];train.append((sum(a*b for a,b in zip(coef,[1,d-3,early]))-y)**2)
  loo=fit_lab_rows(rows[:i]+rows[i+1:]);held.append((sum(a*b for a,b in zip(loo,[1,d-3,early]))-y)**2)
 return {'coefficients':coef,'inSampleRMSEFraction':sqrt(sum(train)/4),'leaveOneGroupMeanOutRMSEFraction':sqrt(sum(held)/4),
  'groupMeans':4,'individualDataAvailable':False,'warningAccuracyEstimate':False,'fitSource':'S08 Table 2, rounded grouped biomass means'}

def disease_result(wid,core,context,scope=True,report=False,cfg=CONFIG):
 if scope is False: return {'id':wid,'state':'not_relevant','score':None}
 if scope is not True: return {'id':wid,'state':'insufficient_data','score':None,'reason':'unknown_required_tissue'}
 if report is True: return {'id':wid,'state':'reported_problem','score':None,'claim':'reported symptoms; cause unconfirmed','weatherEvidence':core}
 if core.get('coverage',0)<cfg['thresholds']['minimumCoverage']:
  return {'id':wid,'state':'insufficient_data','score':core.get('band'),'reason':'insufficient_required_exposure_coverage'}
 cb=context_band(wid,context,cfg); candidates=[]
 for w in cfg['diseaseWeights']['sensitivityCoreWeights']:
  candidates.extend([w*core['band'][0]+(1-w)*cb[0],w*core['band'][1]+(1-w)*cb[1]])
 band=(min(candidates),max(candidates)); t=cfg['thresholds']
 robust=core['band'][0]>=t['diseaseCoreFloor'] and band[0]>=t['watch']
 possible=core['band'][1]>=t['diseaseCoreFloor'] and band[1]>=t['watch']
 state='conditions_watch' if robust else 'conditional_watch' if possible else 'not_triggered'
 level='strong_exposure' if robust and band[0]>=t['strongExposure'] else 'elevated_exposure' if robust and band[0]>=t['elevated'] else 'attention' if possible else 'none_under_this_policy'
 return {'id':wid,'state':state,'score':band,'level':level,'core':core,'context':cb,'scoreUnits':'attention points; not percent disease',
   'basis':'research prototype; thresholds/outer weights uncalibrated','symptomsUnassessed':True}

def weighted_weather(wid,signals,cfg=CONFIG):
 p=cfg['weatherWeights'][wid]; parts={}; t=cfg['thresholds']
 if wid=='W01':
  peak=signals.get('peakT'); dose=signals.get('heatDegreeHours')
  parts={'intensity':(ramp(peak,30,40),)*2 if number(peak,-90,65) else (0,1),
   'dose':(sat(dose,24)/100,)*2 if number(dose,0) else (0,1)}
  triggered=number(peak,-90,65) and peak>=t['heatAirC']
 elif wid=='W02':
  low=signals.get('minT'); dose=signals.get('coldDegreeHours')
  parts={'minimum':(ramp(5-low,0,10),)*2 if number(low,-90,65) else (0,1),
   'dose':(sat(dose,48)/100,)*2 if number(dose,0) else (0,1)}
  triggered=number(low,-90,65) and low<=t['coldAirC']
 elif wid=='W03':
  gust=signals.get('gustMps'); mean=signals.get('windMps')
  parts={'gust':(ramp(gust,10,25),)*2 if number(gust,0,100) else (0,1),
   'sustained':(ramp(mean,6,16),)*2 if number(mean,0,100) else (0,1)}
  triggered=(number(gust,0,100) and gust>=t['gustMps']) or (number(mean,0,100) and mean>=t['sustainedMps'])
 else:
  rate=signals.get('rainRate'); amount=signals.get('rain24h') if signals.get('rain24hComplete') is True else None
  parts={'rate':(ramp(rate,2,20),)*2 if number(rate,0,500) else (0,1),
   'complete24hAmount':(ramp(amount,10,50),)*2 if number(amount,0,2000) else (0,1)}
  triggered=(number(rate,0,500) and rate>=t['rainRateMmH']) or (number(amount,0,2000) and amount>=t['rain24hMm'])
 valid=sum(1 for band in parts.values() if band[0]==band[1]); band=tuple(100*x for x in weighted(parts,p))
 official=signals.get('official'+wid) is True
 return {'id':wid,'state':'official_event' if official else 'weather_attention' if triggered else 'not_triggered' if valid==len(parts) else 'insufficient_data',
   'score':None if official else band,'parts':parts,'basis':'ENG intensity/dose index, not tissue damage',
   'subtype':('air_freezing' if signals.get('minT',99)<=0 else 'possible_frost' if signals.get('minT',99)<=2 else 'cold') if wid=='W02' and number(signals.get('minT')) else None}

def water_result(state,cfg=CONFIG):
 if state.get('supported') is not True or state.get('reconciled') is not True:
  return {'id':'W06','state':'insufficient_data','score':None,'reason':'supported reconciled reserve model unavailable'}
 margins=state.get('margins')
 if not margins or any(not number(x) for x in margins): return {'id':'W06','state':'insufficient_data','score':None}
 if max(margins)<0: decision='water_now'
 elif min(margins)>0: decision='not_due'
 else: decision='uncertain'
 # A 0 margin is an explicit overlap/boundary until the model supplies its calibrated rule.
 return {'id':'W06','state':decision,'score':None,'reason':'joint reserve-minus-action-threshold margins','dailyMoistureCheckRequired':False}

def root_result(state,cfg=CONFIG):
 if state.get('symptom') is True: report=True
 else: report=False
 observed=state.get('abnormalPooling') is True
 model=state.get('supported') is True and state.get('excessAboveBound') is True and state.get('pastNormalDrainWindow') is True
 magnitude=state.get('excessFraction'); persistence=state.get('persistenceFraction')
 parts={'excessMagnitude':feature_band(magnitude),'persistence':feature_band(persistence)}
 score=tuple(100*x for x in weighted(parts,cfg['rootWeights']))
 if observed: score=(max(60,score[0]),max(60,score[1]))
 known_negative=state.get('supported') is True and (state.get('excessAboveBound') is False or (state.get('excessAboveBound') is True and state.get('pastNormalDrainWindow') is False))
 state_='root_environment_attention' if observed or model else 'reported_problem' if report else 'not_triggered' if known_negative else 'insufficient_data'
 return {'id':'W07','state':state_,'score':score if observed or model else None,'basis':'abnormal active-root evidence, not normal moisture or humidity',
  'labComparison':root_lab_loss(state.get('inundationDays'),state.get('earlyVegetative'),state.get('matchesLabDomain') is True,cfg)}

def evaluate(bundle,cfg=CONFIG):
 """All 14 detector IDs, grouped into care families. Protected scope must be resolved first."""
 plant=bundle.get('plant',{})
 if any(plant.get(k) is False for k in ('authorized','active','notDeleting','outdoor')):
  return {f'W{i:02}':{'id':f'W{i:02}','state':'not_relevant','score':None} for i in range(1,15)}
 if any(plant.get(k) is not True for k in ('authorized','active','notDeleting','outdoor')):
  return {f'W{i:02}':{'id':f'W{i:02}','state':'insufficient_data','score':None} for i in range(1,15)}
 mode=bundle.get('mode','occurred'); window=cfg['exposure']['historyHours'] if mode=='occurred' else cfg['exposure']['forecastHours']
 if mode not in ('occurred','forecast'): raise ValueError('invalid source nature')
 rows=bundle.get('hours',[]); validate_rows(rows,mode,window)
 raw_weather=bundle.get('weather',{})
 hazard_keys={'officialW01','officialW02','officialW03','officialW04','explicitHail','explicitSevere','hazardFeedAssessed'}
 weather={k:v for k,v in raw_weather.items() if k not in hazard_keys} if bundle.get('weatherSupport') is True else {}
 # Regional source products have their own support envelope, independent of numeric weather.
 if bundle.get('hazardSupport') is True:
  weather.update({k:v for k,v in raw_weather.items() if k in hazard_keys})
 result={wid:weighted_weather(wid,weather,cfg) for wid in ('W01','W02','W03','W04')}
 hail=weather.get('explicitHail') is True; severe=weather.get('explicitSevere') is True
 result['W05']={'id':'W05','state':'official_event' if hail or severe else 'not_triggered' if weather.get('hazardFeedAssessed') is True else 'insufficient_data',
  'score':None,'subtype':'explicit_hail' if hail else 'source_severe_event' if severe else None}
 result['W06']=water_result(bundle.get('water',{}),cfg)
 root=root_result(bundle.get('root',{}),cfg); result['W07']=root
 if bundle.get('root',{}).get('abnormalPooling') is True and result['W06']['state']=='water_now':
  result['W06']={'id':'W06','state':'uncertain','score':None,'reason':'reconcile qualified current active-root pooling against modeled low reserve'}
 heat=result['W01']['state'] in ('weather_attention','official_event')
 solar=True if plant.get('potSolarExposed') is True or plant.get('hotContact') is True else False if plant.get('potSolarExposed') is False and plant.get('hotContact') is False else None
 sensor=bundle.get('rootTemp',{}); sensor_heat=sensor.get('supported') is True and sensor.get('crossedSupportedThreshold') is True
 pot=plant.get('pot')
 s8='not_relevant' if pot is False else 'insufficient_data' if pot is not True else 'container_heat_context' if (heat and solar is True) or sensor_heat else 'insufficient_data' if heat and solar is None else 'not_triggered'
 result['W08']={'id':'W08','state':s8,'score':result['W01']['score'] if s8=='container_heat_context' and heat else None,'family':'heat','dedupeWith':'W01'}
 # Dew proxy producer must use paired data/night, never a daily RH scalar.
 dew=bundle.get('dampness',{}); fog=dew.get('explicitFog') is True
 result['W09']={'id':'W09','state':'dampness_context' if fog or dew.get('supportedNightEpisode') is True else 'not_triggered' if dew.get('assessed') is True else 'insufficient_data',
  'score':None,'basis':'proxy/direct fog; no measured leaf-wetness claim or root-water credit'}
 pm=duration_core(rows,'pm',mode,window,cfg) if bundle.get('weatherSupport') is True else {'band':(0,100),'coverage':0}
 bh=duration_core(rows,'botrytis',mode,window,cfg) if bundle.get('weatherSupport') is True else {'band':(0,100),'coverage':0}
 # Wet-event and humid-air routes are alternatives, not independent infection votes.
 eligible_events=[x for x in bundle.get('wetEvents',[]) if x.get('nature')==mode and x.get('valid') is True and x.get('coverage')==1 and event_band(x,cfg) is not None]
 events=[event_band(x,cfg) for x in eligible_events]
 if events:
  bh=deepcopy(bh); bh['band']=(max(bh['band'][0],max(x[0] for x in events)),max(bh['band'][1],max(x[1] for x in events)))
  bh['wetEventProxyUsed']=True
  # A complete independently qualified wet event can support its own route without 72-hour RH data.
  if eligible_events: bh['coverage']=max(bh['coverage'],1.)
 ctx=bundle.get('context',{}); symptoms=bundle.get('symptoms',{})
 result['W10']=disease_result('W10',pm,ctx.get('W10',{}),plant.get('foliage'),symptoms.get('powderyGrowth') is True,cfg)
 result['W11']=disease_result('W11',bh,ctx.get('W11',{}),plant.get('flowers'),symptoms.get('flowerProblem') is True,cfg)
 leaf=bundle.get('leafEpisode')
 if leaf is None: leaf=wetness_features(rows,plant,mode,cfg) if bundle.get('weatherSupport') is True else {}
 lb=leaf.get('dsvBand')
 if lb is not None and len(lb)==2 and all(number(x,0,4) for x in lb) and lb[0]<=lb[1] and leaf.get('nature')==mode:
  leafcore={'band':(25*lb[0],25*lb[1]),'coverage':1. if leaf.get('supported') is True else 0,'model':'tomato DSV translated to wet-leaf attention comparator'}
 else: leafcore={'band':(0,100),'coverage':0}
 result['W12']=disease_result('W12',leafcore,ctx.get('W12',{}),plant.get('foliage'),symptoms.get('leafSpots') is True,cfg)
 root_present=root['state']=='root_environment_attention'; vulnerable=plant.get('vulnerableEstablishment')
 result['W13']={'id':'W13','state':'not_relevant' if vulnerable is False else 'insufficient_data' if vulnerable is not True else 'wet_establishment_context' if root_present else 'reported_problem' if symptoms.get('establishmentProblem') is True else root['state'],
  'score':root['score'] if vulnerable is True and root_present else None,'dedupeWith':'W07'}
 result['W14']={'id':'W14','state':'root_environment_context' if root_present else 'reported_problem' if symptoms.get('rootOrWilt') is True else root['state'],
  'score':root['score'] if root_present else None,'dedupeWith':'W07','cause':'unconfirmed'}
 for item in result.values():
  item.update(mode='occurred' if item['id'] in ('W06','W07','W13','W14') else mode,modelVersion=cfg['version'],productionEnabled=False)
  item['candidatePushEligible']=item['state']=='official_event' or item.get('level') in ('elevated_exposure','strong_exposure')
  item['deliveryRequiresEpisodeDeduplication']=True
 return result

def example_hours(T=23,RH=70,window=72,mode='occurred'):
 start=-window if mode=='occurred' else 0
 return [dict(start=start+i,end=start+i+1,T=T,RH=RH,valid=True,nature=mode) for i in range(window)]

def demo_bundle():
 return {'plant':{'authorized':True,'active':True,'notDeleting':True,'outdoor':True,'pot':True,'foliage':True,'flowers':True,'vulnerableEstablishment':False,'potSolarExposed':True},
  'mode':'occurred','weatherSupport':True,'hazardSupport':True,'hours':example_hours(23,92),'weather':{'peakT':29,'minT':18,'heatDegreeHours':0,'coldDegreeHours':0,'gustMps':8,'windMps':3,'rainRate':4,'rain24h':12,'rain24hComplete':True,'hazardFeedAssessed':True},
  'water':{'supported':True,'reconciled':True,'margins':[.4,.9]},'root':{'supported':True,'excessAboveBound':False,'pastNormalDrainWindow':False},
  'wetEvents':[{'valid':True,'coverage':1,'meanWetT':20,'wetHours':12,'wetnessEvidence':'sensor','nature':'occurred'}],
  'context':{'W10':{'crowdingOrPoorAirflow':True,'localHistory':False,'verifiedSusceptibility':None},'W11':{'denseFlowersOrSlowDrying':True,'freshDamage':False,'localHistory':False}},
  'dampness':{'assessed':True,'supportedNightEpisode':True},'leafEpisode':{'supported':True,'dsvBand':[2,3],'nature':'occurred'}}

def delivery_preview(result,previous,now_h,episode_key,initial_load=False,cfg=CONFIG):
 """Pure simulation: returns state, never sends a notification."""
 previous=deepcopy(previous or {});out={};state=deepcopy(previous)
 for wid,item in result.items():
  old=previous.get(wid,{})
  band=item.get('score');active=item['state'] in ('conditions_watch','conditional_watch','weather_attention','official_event','root_environment_attention','container_heat_context','dampness_context')
  if not active and band is not None and band[1]>=cfg['delivery']['hysteresisOffScore'] and old.get('active'):
   active=True
  if item['state']=='insufficient_data': active=bool(old.get('active'))
  same_episode=old.get('episode')==episode_key
  last=old.get('lastPushH');cooldown=number(last) and now_h-last<cfg['delivery']['repeatCooldownHours']
  disease=wid in ('W10','W11','W12')
  candidate=bool(item.get('candidatePushEligible')) and not same_episode and not cooldown
  if initial_load and disease: candidate=False
  if item.get('dedupeWith'): candidate=False
  memory=old.get('flowerExposureHistory',[])
  memory=[x for x in memory if 0<=now_h-x['atH']<=cfg['exposure']['flowerExposureHistoryDays']*24]
  if wid=='W11' and item.get('mode')=='occurred' and item['state'] in ('conditions_watch','conditional_watch'):
   if not any(x.get('episode')==episode_key for x in memory): memory.append({'atH':now_h,'episode':episode_key,'claim':'conducive exposure, not infection'})
  state[wid]={'active':active,'episode':episode_key,'lastPushH':now_h if candidate else last if number(last) else None,
   'flowerExposureHistory':memory,'currentAssessment':item['state']}
  out[wid]={'activeCard':active,'candidatePush':candidate,'productionPush':candidate and cfg['productionEnabled'],
   'reason':'research-only delivery simulation','pastFlowerExposureCount':len(memory)}
 return out,state

def run_checks():
 checks=[]
 def check(name,value):
  assert value,name
  checks.append({'id':f'V6-{len(checks)+1:03}','name':name,'passed':True})
 near=lambda a,b:abs(a-b)<1e-8
 check('Broome exact published-coefficient arithmetic',near(broome_index(20,4),-1.637094))
 check('Broome preserves T by W interaction',broome_index(20,12)>broome_index(20,4))
 check('Broome tested domain enforced',broome_index(10,12) is None and broome_index(20,2) is None)
 check('Broome is not extrapolated at invalid numbers',broome_index(float('nan'),12) is None and broome_index(True,12) is None)
 check('Transferred model responds non-monotonically to temperature',broome_exposure(20,12)>broome_exposure(30,12))
 check('Published grape-flower optimum arithmetic',near(nair_flower_exposure(23.7,1.3),95.6*(1-exp(-1))))
 check('Grape-flower native tested domain enforced',nair_flower_exposure(4,4) is None and nair_flower_exposure(20,25) is None)
 check('Grape-flower curve retains time response',nair_flower_exposure(20,4)>nair_flower_exposure(20,1))
 portfolio=event_band({'valid':True,'meanWetT':20,'wetHours':4,'wetnessEvidence':'sensor'})
 check('Structural transfer disagreement widens wet-event index',near(portfolio[0],broome_exposure(20,4)) and near(portfolio[1],nair_flower_exposure(20,4)))
 check('Portfolio does not borrow flower-only domain as a validated berry response',event_band({'valid':True,'meanWetT':20,'wetHours':2,'wetnessEvidence':'sensor'}) is None)
 for stage,k in [('initial',.70),('development',.75),('midSeason',.77),('mature',.66)]: check('Published ground Kc '+stage,near(CONFIG['kcGround'][stage],k))
 native_protocol=example_hours(23,80)
 for r in native_protocol[-24:]:r['RH']=70
 pm=duration_core(native_protocol,'pm'); old_hours=sum(r['end']-r['start'] for r in native_protocol if 15<=r['T']<=28 and r['RH']>=85)
 check('Cannabis PM 80-percent initiation / 70-percent maintenance compatibility',old_hours==0 and pm['band'][0]>35)
 check('PM root watering/rain not required',evaluate(demo_bundle())['W10']['state']!='not_triggered')
 wet=duration_core(example_hours(23,95),'pm'); dry=duration_core(example_hours(23,30),'pm')
 check('Humidity response continuous and nonzero at supported lower RH',wet['central']>pm['central']>dry['central']>0)
 check('Botrytis humidity kernel does not require rain',duration_core(example_hours(20,95),'botrytis')['central']>60)
 rows=example_hours(23,92)
 check('Missing hours widen score without renormalizing',duration_core(rows[:-1],'pm')['band'][1]>=duration_core(rows[:-1],'pm')['band'][0])
 for n in (0,1,12,24,48,60,72):
  c=duration_core(rows[:n],'pm'); check(f'Coverage exact for {n} hours',near(c['coverage'],n/72))
 try: validate_rows([rows[0],rows[0]]); passed=False
 except ValueError: passed=True
 check('Overlapping intervals rejected',passed)
 try: validate_rows(example_hours(23,92,24,'forecast'),'occurred',72); passed=False
 except ValueError: passed=True
 check('Forecast cannot age into occurred weather',passed)
 full=evaluate(demo_bundle()); check('All 14 warning IDs returned',set(full)=={f'W{i:02}' for i in range(1,15)})
 for wid in full:
  b=demo_bundle();b['plant']['active']=False
  check(wid+' common inactive gate',evaluate(b)[wid]['state']=='not_relevant')
 for wid,field in [('W08','pot'),('W10','foliage'),('W11','flowers'),('W12','foliage'),('W13','vulnerableEstablishment')]:
  b=demo_bundle();b['plant'][field]=False;check(wid+' required false scope',evaluate(b)[wid]['state']=='not_relevant')
  b['plant'][field]=None;check(wid+' unknown scope',evaluate(b)[wid]['state']=='insufficient_data')
 for wid,key in [('W10','powderyGrowth'),('W11','flowerProblem'),('W12','leafSpots')]:
  b=demo_bundle();b['weatherSupport']=False;b['symptoms']={key:True}
  check(wid+' symptom route independent of weather',evaluate(b)[wid]['state']=='reported_problem')
 empty={'band':(0,0),'coverage':1}; unknown={'band':(0,100),'coverage':0}
 check('Context cannot replace primary exposure',disease_result('W11',empty,{'denseFlowersOrSlowDrying':True,'freshDamage':True,'localHistory':True})['state']=='not_triggered')
 check('Missing primary coverage not low risk',disease_result('W11',unknown,{})['state']=='insufficient_data')
 check('Unknown context not silently protective',context_band('W11',{})==(0,100))
 check('Known no-context narrower than unknown',context_band('W11',dict.fromkeys(CONFIG['contextWeights']['W11'],False))==(0,0))
 check('Unknown optional context does not block strong primary route',disease_result('W11',{'band':(80,80),'coverage':1},{})['state']=='conditions_watch')
 check('Wind route survives missing gust',weighted_weather('W03',{'windMps':12})['state']=='weather_attention')
 check('Incomplete rain amount cannot trigger',weighted_weather('W04',{'rain24h':80,'rain24hComplete':False,'rainRate':0})['state']=='insufficient_data')
 check('Heat does not imply watering',evaluate({**demo_bundle(),'weather':{'peakT':40,'heatDegreeHours':50}})['W06']['state']=='not_due')
 for m,expected in [([-1,-.2],'water_now'),([.1,.5],'not_due'),([-.1,.2],'uncertain'),([0,.2],'uncertain')]:
  check('Joint water margins '+str(m),water_result({'supported':True,'reconciled':True,'margins':m})['state']==expected)
 check('Unsupported water state does not become no watering',water_result({})['state']=='insufficient_data')
 check('Normal post-water moisture not excess',root_result({'supported':True,'excessAboveBound':False})['state']=='not_triggered')
 check('Unknown root excess does not become normal',root_result({'supported':True})['state']=='insufficient_data')
 check('Root model needs excess AND persistence',root_result({'supported':True,'excessAboveBound':True,'pastNormalDrainWindow':False})['state']=='not_triggered')
 check('Abnormal pooling prompts attention before lab day 3',root_result({'abnormalPooling':True,'inundationDays':.25})['state']=='root_environment_attention')
 check('Lab curve unavailable outside cultivar/protocol scope',root_lab_loss(4,True,False) is None)
 check('Lab curve never defines a safe waiting period',root_lab_loss(1,True,True) is None)
 check('Lab duration response positive in supported range',root_lab_loss(6,True,True)>root_lab_loss(3,True,True))
 check('Lab stage main effect retained',root_lab_loss(4,True,True)>root_lab_loss(4,False,True))
 for temp in [13,17,18,20,21,25,26,29]:
  scores=[tomcast_dsv(temp,h) for h in range(25)]
  check('TOMCAST monotonic wet-hours at '+str(temp),scores==sorted(scores))
 check('TOMCAST outside crop-model domain is not zero',tomcast_dsv(10,8) is None)
 check('Proxy wet-hours uncertainty crossing domain widens',event_band({'valid':True,'meanWetT':20,'wetHours':4,'wetnessEvidence':'model'})==(0,100))
 b=demo_bundle();b['root']={'abnormalPooling':True};b['plant']['vulnerableEstablishment']=True
 r=evaluate(b);check('Root alias deduplicates',r['W13']['dedupeWith']==r['W14']['dedupeWith']=='W07')
 # External grouped-mean reconstruction is not held-out outcome validation.
 errors=[]
 for days,early,grams in CONFIG['rootLab']['means']:
  observed=1-grams/CONFIG['rootLab']['controlBiomassG']; predicted=root_lab_loss(days,bool(early),True);errors.append((predicted-observed)**2)
 check('Derived native-lab fit arithmetic',near(sqrt(sum(errors)/4),.0247252747252747))
 fit=lab_fit_report()
 for a,b in zip(fit['coefficients'],[CONFIG['rootLab']['late3Intercept'],CONFIG['rootLab']['perExtraDay'],CONFIG['rootLab']['earlyVegetativeOffset']]):check('Derived native-lab coefficient reproducible',near(a,b))
 check('Grouped-mean held-out error reported separately',fit['leaveOneGroupMeanOutRMSEFraction']>fit['inSampleRMSEFraction'])
 b=demo_bundle();b['water']['margins']=[-.3,-.1];b['root']={'abnormalPooling':True}
 check('Current qualified pooling conflicts with model waterNow',evaluate(b)['W06']['state']=='uncertain')
 b=demo_bundle();b['mode']='forecast';b['hours']=example_hours(23,92,24,'forecast')
 check('Forecast lane does not change present watering state',evaluate(b)['W06']['state']=='not_due' and evaluate(b)['W06']['mode']=='occurred')
 b=demo_bundle();b['hours']=example_hours(23,92)[:12];b['wetEvents']=[{'valid':True,'coverage':1,'meanWetT':8,'wetHours':8,'wetnessEvidence':'sensor','nature':'occurred'}]
 check('Out-of-domain wet event cannot fake full humidity coverage',evaluate(b)['W11']['state']=='insufficient_data')
 dry_rows=example_hours(23,70)
 check('Missing rain not silently zero in wetness comparator',wetness_features(dry_rows,{'canopyRainReception':True})['supported'] is False)
 for r in dry_rows:r['rainMm']=0
 check('Complete assessed dry comparator returns zero DSV only for comparator',wetness_features(dry_rows,{'canopyRainReception':True})['dsvBand']==[0,0])
 check('Rain reaching foliage can supply alternate wet route',wetness_features([{**r,'rainMm':1} for r in dry_rows],{'canopyRainReception':True})['dsvBand'][1]>0)
 check('Sheltered foliage excludes direct rain route only',wetness_features([{**r,'rainMm':1} for r in dry_rows],{'canopyRainReception':False})['dsvBand']==[0,0])
 check('Directly sheltered rain does not veto high-RH comparator',wetness_features([{**r,'RH':95,'rainMm':1} for r in dry_rows],{'canopyRainReception':False})['dsvBand'][1]>0)
 for wid in ('W10','W11','W12'):
  for weight in (.7,.8,.9):
   cfg=deepcopy(CONFIG);cfg['diseaseWeights']['sensitivityCoreWeights']=[weight]
   check(wid+f' bounded modifiers cannot bypass core at {weight}',disease_result(wid,empty,dict.fromkeys(cfg['contextWeights'][wid],True),cfg=cfg)['state']=='not_triggered')
 measured_wet=[{**r,'leafWetSupported':True,'leafWet':True} for r in example_hours(23,92)]
 check('Supported free-water suppression explored without mildew immunity',0<duration_core(measured_wet,'pm')['band'][0]<duration_core(example_hours(23,92),'pm')['band'][0])
 check('Rain probability cannot supply a protective mildew multiplier',duration_core([{**r,'rainChance':1} for r in example_hours(23,92)],'pm')==duration_core(example_hours(23,92),'pm'))
 result=evaluate(demo_bundle());delivered,previous=delivery_preview(result,{},0,'episode-a')
 again,_=delivery_preview(result,previous,1,'episode-a')
 check('Identical disease episode cannot send repeated push',again['W11']['candidatePush'] is False)
 check('Research mode never sends production pushes',all(x['productionPush'] is False for x in delivered.values()))
 startup,_=delivery_preview(result,{},0,'episode-a',initial_load=True)
 check('First historical load does not create disease push',startup['W11']['candidatePush'] is False)
 tomorrow=deepcopy(result);tomorrow['W11']={'id':'W11','state':'not_triggered','score':(0,0),'mode':'occurred'}
 later,_=delivery_preview(tomorrow,previous,24,'episode-b')
 check('Dry day does not erase past flower exposure record',later['W11']['pastFlowerExposureCount']==1)
 forecast=deepcopy(result);forecast['W11']['mode']='forecast';_,fstate=delivery_preview(forecast,{},0,'future-a')
 check('Forecast exposure not recorded as occurred infection history',fstate['W11']['flowerExposureHistory']==[])
 bad=deepcopy(result);bad['W11']={'id':'W11','state':'insufficient_data','score':None,'mode':'occurred'}
 missing,_=delivery_preview(bad,previous,24,'episode-c')
 check('Unknown assessment does not assert current healthy clearance',missing['W11']['activeCard'] is True)
 for temp in (5,15,23,30,40):
  for rh in (30,65,80,95):
   c=duration_core(example_hours(temp,rh),'pm')
   check(f'Finite bounded exposure grid T={temp} RH={rh}',0<=c['band'][0]<=c['band'][1]<=100)
 b=demo_bundle();b['weather']['peakT']=38;b['plant'].pop('potSolarExposed')
 check('Unknown pot exposure is not a protective false',evaluate(b)['W08']['state']=='insufficient_data')
 b['plant']['potSolarExposed']=True
 check('Exposed hot pot adds parent heat context',evaluate(b)['W08']['state']=='container_heat_context')
 b=demo_bundle();b['weather']={'explicitHail':True,'hazardFeedAssessed':True}
 check('Explicit hail independent of plant dimensions',evaluate(b)['W05']['subtype']=='explicit_hail')
 b['weather']={'rainRate':40,'gustMps':30,'hazardFeedAssessed':True}
 check('Rain plus gust cannot create hail',evaluate(b)['W05']['state']=='not_triggered')
 b=demo_bundle();b['weatherSupport']=False;b['weather']={'officialW01':True,'explicitHail':True,'hazardFeedAssessed':True}
 check('Independent source heat survives missing numeric weather',evaluate(b)['W01']['state']=='official_event')
 check('Independent explicit hail survives missing numeric weather',evaluate(b)['W05']['state']=='official_event')
 b['hazardSupport']=False
 check('Unsupported hazard feed is not assessed absence',evaluate(b)['W05']['state']=='insufficient_data')
 import json
 check('Output state and configuration use valid finite JSON',bool(json.dumps([CONFIG,result,previous],allow_nan=False)))
 return checks

if __name__=='__main__':
 import json
 checks=run_checks()
 print(json.dumps({'checks':len(checks),'allPassed':True,'biologicalAccuracyValidated':False,'productionAppTests':False,
  'demo':evaluate(demo_bundle())},indent=2))
