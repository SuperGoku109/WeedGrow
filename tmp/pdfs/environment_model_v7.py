"""WeedGrow v7.0: environmental feature and research-sandbox reference.

No disease probabilities, cultivation optimization or synthetic biological labels.
The separate warning core retains v6.0's explicitly uncalibrated operating priors.
"""
from math import exp, isfinite, sqrt
from copy import deepcopy
from pathlib import Path
import importlib.util

VERSION='7.0'
CONFIG={
 'version':VERSION,'productionEnabled':False,
 'svp':{'a':.6108,'b':17.27,'c':237.3,'source':'S11','class':'PUB','unit':'kPa at temperature C'},
 'featurePolicy':{'heatReferenceC':30,'heatReferenceClass':'ENG diagnostic origin; not an injury threshold',
  'completeDayCoverage':1.,'unknownLeafTemperature':'no fixed air-to-leaf offset',
  'vpdMeaning':'air demand descriptor; not actual transpiration or a universal cannabis optimum'},
 'sheldon':{'source':'S19','sourceClass':'PUB','chamberAirC':32,'vpdRangeKpa':[.5,3.5],
  'status':'research comparator; repeated plant measurements, not independent field validation',
  'bpRows':[
   ['Finola',60.97,-78.95,2.6,[2.03,3.16]],['Canda',41.77,-109.5,2.5,[2.15,2.78]],
   ['Felina',67.97,None,None,None],['Joey',80.46,None,None,None],
   ['Delores',59.96,-85.17,2.1,[1.94,2.85]],['CFX-1',41.26,18.17,2.0,[.22,3.77]],
   ['CFX-2',57.04,None,None,None],['Kurd',94.21,21.86,2.1,[1.45,2.74]],
   ['Carolina',31.07,None,None,None],['Cherry T',25.99,None,None,None],
   ['T1 T',52.66,1.38,1.6,[1.19,1.91]],['T1 NT',105.4,4.98,1.2,[1.02,1.36]]],
  'ftswRows':[
   ['Finola',5.7,.44,[.34,.54]],['Canda',5.7,.16,[.10,.21]],['Felina',5.7,.62,[.40,.85]],
   ['Joey',5.7,.36,[.24,.48]],['Delores',5.7,.81,[.71,.90]],['CFX-2',5.7,.68,[.58,.78]],
   ['Kurd',5.7,.65,[.56,.73]],['Carolina',5.7,.32,[.27,.37]],['T1 T',5.7,.46,[.40,.50]],
   ['T1 NT',5.7,.34,[.30,.36]],['Cherry T',5.7,.28,[.25,.29]],['Ha3ze',5.7,.55,[.38,.68]],
   ['Ha3ze',15,.56,[.50,.62]],['Cherry NT',15,.44,[.37,.52]]],
  'ftswMeaning':'mass-based fraction of experimental transpirable water; endpoint NTR<=0.1; not VWC or FAO depletion',
  'sourceDiscrepancy':'Abstract says four limited-TR cultivars; body says seven and four linear; Table 2 contains seven segmented and five linear rows. Preserve rows; do not infer prevalence.'},
 'pangle25':{'source':'S28','sourceClass':'PUB','leafTemperatureC':25,'alpha':.24,'theta':.85,
  'GammaStar':42.7497,'Km':710.3131,'pressureKpa':100,
  'profiles':{'BX_lateVeg':{'Vcmax':143.2,'Jmax':325.9},'BX_earlyFlower':{'Vcmax':138.2,'Jmax':336.3},
   'BX_lateFlower':{'Vcmax':91.7,'Jmax':155.3},'CW_lateVeg':{'Vcmax':136.2,'Jmax':323.4},
   'CW_earlyFlower':{'Vcmax':135.2,'Jmax':338.7},'CW_lateFlower':{'Vcmax':95.4,'Jmax':161.1}},
  'scope':'Partial two-limitation biochemical sandbox at 25 C; not a reproduction of the full fitted leaf model',
  'notImplemented':['respiration','TPU limitation','mesophyll conductance','stomatal closure','leaf energy balance','water limitation','whole canopy scaling'],
  'tpuPolicy':'Published TPU estimates are not automatically temperature-corrected by fitaci; no TPU25 value is invented.',
  'temperaturePolicy':'Vcmax/Jmax normalized to25; do not apply generic tree default temperature response to cannabis.'},
 'simulationPolicy':'Synthetic input scenarios test model logic and sensitivity only. They are not measured outcomes or training labels.'
}

def num(x,lo=None,hi=None):
 return type(x) in (int,float) and isfinite(x) and (lo is None or x>=lo) and (hi is None or x<=hi)

def svp(t):
 if not num(t,-60,60):return None
 p=CONFIG['svp'];return p['a']*exp(p['b']*t/(t+p['c']))

def vpd(t,rh):
 s=svp(t)
 return None if s is None or not num(rh,0,100) else s*(1-rh/100)

def leaf_gradient(tair,rh,leaf_bounds,evidence=None):
 """Signed vapour-pressure gradient; no inference of observed condensation."""
 if not num(tair,-60,60) or not num(rh,0,100):return None
 if evidence not in ('sensor','validated_model','scenario'):return None
 if not isinstance(leaf_bounds,(list,tuple)) or len(leaf_bounds)!=2:return None
 lo,hi=leaf_bounds
 if not(num(lo,-60,60) and num(hi,-60,60)) or lo>hi:return None
 ea=svp(tair)*rh/100
 return {'bandKpa':[svp(lo)-ea,svp(hi)-ea],'sourceClass':'DER physics',
  'leafTemperatureEvidence':evidence,'condensationObserved':False}

def validate(rows,mode,window):
 if mode not in ('occurred','forecast'):raise ValueError('invalid source nature')
 if not num(window,1,168):raise ValueError('invalid window')
 low,high=(-window,0) if mode=='occurred' else (0,window)
 prior=low;out=[]
 for row in rows:
  a,b=row.get('start'),row.get('end')
  if not(num(a) and num(b)) or a<prior or b<=a or a<low or b>high:raise ValueError('invalid/overlapping/unsorted interval')
  if row.get('nature')!=mode:raise ValueError('mixed source nature')
  out.append(row);prior=b
 return out

def environmental_features(rows,mode='occurred',window=24):
 rows=validate(rows,mode,window)
 cov={k:0. for k in ['vpd','ppfd','shortwave','heatVpd','heatLight','et0','dayVpd','nightVpd']}
 totals={k:0. for k in cov};daily_vpd=[];leaf=[]
 for r in rows:
  if r.get('valid') is not True:continue
  dt=r['end']-r['start'];t,rh=r.get('T'),r.get('RH');d=vpd(t,rh)
  q=r.get('ppfd') if r.get('ppfdSupport') in ('measurement','validated_transform','scenario') else None
  radiation=r.get('shortwaveWm2')
  if d is not None:
   cov['vpd']+=dt;totals['vpd']+=d*dt;daily_vpd.append(d)
   if type(r.get('isDay')) is bool:
    k='dayVpd' if r['isDay'] else 'nightVpd';cov[k]+=dt;totals[k]+=d*dt
   cov['heatVpd']+=dt;totals['heatVpd']+=max(0,t-CONFIG['featurePolicy']['heatReferenceC'])*d*dt
  if num(q,0,4000):
   cov['ppfd']+=dt;totals['ppfd']+=q*3600*dt/1e6
   if num(t,-60,60):
    cov['heatLight']+=dt;totals['heatLight']+=q*3600*dt/1e6*max(0,t-CONFIG['featurePolicy']['heatReferenceC'])
  if num(radiation,0,1600):cov['shortwave']+=dt;totals['shortwave']+=radiation*3600*dt/1e6
  et=r.get('et0Mm')
  if r.get('et0Supported') is True and num(et,0,10):cov['et0']+=dt;totals['et0']+=et
  lv=leaf_gradient(t,rh,r.get('leafTemperatureBoundsC'),r.get('leafTemperatureEvidence'))
  if lv:leaf.append({'start':r['start'],'end':r['end'],**lv})
 complete=lambda k:abs(cov[k]-window)<1e-9
 return {'version':VERSION,'mode':mode,'windowHours':window,'coverage':{k:v/window for k,v in cov.items()},
  'knownVpdIntegralKpaH':totals['vpd'],'meanAirVpdKpa':totals['vpd']/cov['vpd'] if complete('vpd') else None,
  'vpdRangeKpa':[min(daily_vpd),max(daily_vpd)] if daily_vpd else None,
  'knownDayMeanVpdKpa':totals['dayVpd']/cov['dayVpd'] if cov['dayVpd'] else None,
  'knownNightMeanVpdKpa':totals['nightVpd']/cov['nightVpd'] if cov['nightVpd'] else None,
  'knownParMolM2':totals['ppfd'],'dliMolM2':totals['ppfd'] if complete('ppfd') else None,
  'knownShortwaveMjM2':totals['shortwave'],'shortwaveMjM2':totals['shortwave'] if complete('shortwave') else None,
  'knownEt0Mm':totals['et0'],'et0Mm':totals['et0'] if complete('et0') else None,
  'heatVpdIntegralCkpaH':totals['heatVpd'] if complete('heatVpd') else None,
  'photonHeatIntegralMolCM2':totals['heatLight'] if complete('heatLight') else None,
  'leafGradients':leaf,'damageProbability':None,'wateringDecisionFromFeaturesAlone':None,
  'notes':['Full-day values require complete appropriate intervals; partial sums are labelled known only.',
   'PPFD and broadband shortwave are separate. No UV-index, cloud-cover or sunlight-category conversion.',
   'Overlap integrals are diagnostic features with ENG reference origin, not fitted damage functions.']}

def native_stomatal_reference(d,cultivar):
 if not num(d,*CONFIG['sheldon']['vpdRangeKpa']):return None
 rows=[r for r in CONFIG['sheldon']['bpRows'] if r[0]==cultivar]
 if not rows:return None
 name,s1,s2,bp,ci=rows[0]
 return {'cultivar':name,'vpdKpa':d,'breakpointKpa':bp,'breakpointCI':ci,
  'marginalSlopeRatioVsLowVpd':s2/s1 if bp is not None and d>bp else 1.,
  'responseClass':'segmented' if bp is not None else 'linear_in_tested_range',
  'actualTranspiration':None,'waterDose':None,'researchOnly':True,
  'reason':'Slope ratio describes marginal response, not total transpiration. Intercepts and field transfer not established.'}

def native_soil_reference(ftsw,method):
 if method!='matched_experimental_FTSW' or not num(ftsw,0,1):return None
 rows=CONFIG['sheldon']['ftswRows']
 return {'ftsw':ftsw,'nativePointThresholdSpan':[min(r[2] for r in rows),max(r[2] for r in rows)],
  'profilesBelowPointThreshold':[r[0]+':'+str(r[1])+'L' for r in rows if ftsw<r[2]],
  'plantWateringDecision':None,'damageProbability':None,'researchOnly':True,
  'reason':'Stomatal-response breakpoints are not irrigation triggers; FTSW is not VWC or soil percent wet.'}

def biochemical25(ppfd,ci,profile,leaf_temperature=25):
 """Partial pre-respiration min(Ac,Aj); native capacities, explicit scenario Ci.
 Not a full FvCB implementation or a net/growth/yield/damage predictor.
 """
 p=CONFIG['pangle25'];pars=p['profiles'].get(profile)
 if not pars or not num(ppfd,0,2000) or not num(ci,p['GammaStar']+1e-6,999.999):return None
 if not num(leaf_temperature) or abs(leaf_temperature-25)>1e-9:return None
 q=p['alpha']*ppfd;jm=pars['Jmax'];theta=p['theta']
 # Numerically stable form of the non-rectangular hyperbola.
 j=0. if q==0 else 2*q*jm/(q+jm+sqrt((q+jm)**2-4*theta*q*jm))
 ac=pars['Vcmax']*(ci-p['GammaStar'])/(ci+p['Km'])
 aj=j*(ci-p['GammaStar'])/(4*(ci+2*p['GammaStar']))
 return {'profile':profile,'leafTemperatureC':25,'CiScenarioPpm':ci,'J':j,'Ac':ac,'Aj':aj,
  'preRespirationMinAcAj':min(ac,aj),'netPhotosynthesis':None,'waterUse':None,
  'source':'S28 native capacities + S31/S32 model structure','researchOnly':True,
  'notIncluded':p['notImplemented']}

def rows24(T=25,RH=50,Q=500):
 return [{'start':i-24,'end':i-23,'nature':'occurred','valid':True,'T':T,'RH':RH,
  'isDay':6<=i<18,'ppfd':Q if 6<=i<18 else 0,'ppfdSupport':'scenario'} for i in range(24)]

def scenario_experiments(core=None):
 core=core or load_warning_core()
 same_d=vpd(25,50);rh35=100*(1-same_d/svp(35))
 a=environmental_features(rows24(25,50));b=environmental_features(rows24(35,rh35))
 early=rows24();late=rows24()
 for i in range(24):
  hot=12<=i<18
  early[i]['T']=late[i]['T']=35 if hot else 25
  if 6<=i<18:
   early[i]['ppfd']=400 if hot else 1200
   late[i]['ppfd']=1200 if hot else 400
 e,l=environmental_features(early),environmental_features(late)
 grid=[]
 for t in [15,20,25,30,35,40]:
  for rh in [30,50,70,90]:
   for q in [0,250,750,1500]:
    for reserve in ['adequate','low','excess']:
     # Root state is explicitly supplied, not inferred from the synthetic climate.
     margins=[-.5,-.1] if reserve=='low' else [.2,.5]
     root_input={'supported':True,'excessAboveBound':reserve=='excess','pastNormalDrainWindow':reserve=='excess'}
     grid.append({'airC':t,'rh':rh,'dayPpfd':q,'rootStateScenario':reserve,
      'suppliedReserveMarginScenarios':margins,
      'conditionalCareDecision':core.water_result({'supported':True,'reconciled':True,'margins':margins})['state'],
      'conditionalRootConcern':core.root_result(root_input)['state'],
      'features':environmental_features(rows24(t,rh,q))})
 return {'sameVpdDifferentTemperature':{'rh35':rh35,'cool':a,'hot':b},
  'sameDliDifferentTiming':{'coolerHourPhotons':e,'hotterHourPhotons':l},
  'signedLeafGradient':{'coolLeaf':leaf_gradient(25,90,[22,23],'scenario'),'warmLeaf':leaf_gradient(25,90,[28,30],'scenario')},
  'nativeProfiles25':[biochemical25(q,300,prof) for q in [0,250,750,1500] for prof in ['BX_lateVeg','BX_lateFlower']],
  'grid':grid,'gridCount':len(grid),'biologicalAccuracyValidated':False,'syntheticOutcomesUsed':False}

def load_warning_core(path=None):
 path=Path(path) if path else Path(__file__).with_name('WeedGrow_Warning_Core_v7.0.py')
 if not path.exists():path=Path(__file__).with_name('weighted_warning_v6.py')
 spec=importlib.util.spec_from_file_location('weedgrow_warning_core_v7',path)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def evaluate_with_environment(bundle,core=None):
 core=core or load_warning_core()
 warnings=core.evaluate(bundle)
 plant=bundle.get('plant',{})
 if any(plant.get(k) is not True for k in ('authorized','active','notDeleting','outdoor')):
  return {'warnings':warnings,'environment':None,'plantStressProbability':None,
   'modelVersion':VERSION,'policy':'Protected/common scope not established; derived environment features withheld.'}
 mode=bundle.get('mode','occurred');hours=bundle.get('hours',[])
 # Current v6 history is72h. For this daily feature layer, clip to the last24h;
 # do not force fractional/overlapping intervals or forecast promotion.
 start,end=(-24,0) if mode=='occurred' else (0,24)
 scoped=[]
 for r in hours:
  if num(r.get('start')) and num(r.get('end')) and r['end']>start and r['start']<end:
   scoped.append({**r,'start':max(start,r['start']),'end':min(end,r['end'])})
 support=bundle.get('environmentSupport',bundle.get('weatherSupport'))
 features=environmental_features(scoped,mode) if support is True else environmental_features([],mode)
 return {'warnings':warnings,'environment':features,'plantStressProbability':None,
  'modelVersion':VERSION,'policy':'Features add explanations/research inputs; no new physiological score overrides supported water or symptom routes.'}

def run_checks(core=None):
 checks=[]
 def ck(name,condition):
  assert condition,name
  checks.append({'id':f'ENV7-{len(checks)+1:03}','name':name,'passed':True})
 near=lambda a,b:abs(a-b)<1e-8
 ck('FAO saturation pressure at zero C',near(svp(0),.6108))
 ck('Saturated air has zero air VPD',near(vpd(25,100),0))
 ck('RH zero retains full saturation deficit',near(vpd(25,0),svp(25)))
 ck('Invalid RH is unavailable',vpd(25,101) is None and vpd(25,-1) is None)
 ck('Boolean and NaN are not measurements',vpd(True,50) is None and vpd(float('nan'),50) is None)
 ck('No implicit air-to-leaf temperature offset',leaf_gradient(25,90,[23,25]) is None)
 ck('Supported cool-leaf gradient stays signed',leaf_gradient(25,90,[22,23],'scenario')['bandKpa'][1]<0)
 ck('Warm-leaf gradient is larger at same air humidity',leaf_gradient(25,90,[28,30],'scenario')['bandKpa'][0]>0)
 ck('Reversed leaf bounds rejected',leaf_gradient(25,90,[28,22],'sensor') is None)
 ck('Thermodynamic gradient is not observed condensation',leaf_gradient(25,90,[22,23],'scenario')['condensationObserved'] is False)
 full=environmental_features(rows24());ck('Exact DLI units and integration',near(full['dliMolM2'],21.6))
 ck('Complete paired data preserve mean VPD',near(full['meanAirVpdKpa'],vpd(25,50)))
 missing=environmental_features(rows24()[:-1]);ck('Missing hour prevents a full-day DLI',missing['dliMolM2'] is None and missing['knownParMolM2']>0)
 ck('Missing hour prevents complete mean VPD',missing['meanAirVpdKpa'] is None)
 qbad=rows24();qbad[10]['RH']=101
 res=environmental_features(qbad);ck('Humidity error does not discard valid light',res['dliMolM2'] is not None and res['meanAirVpdKpa'] is None)
 qbad=rows24();qbad[10]['ppfdSupport']=None
 res=environmental_features(qbad);ck('Unqualified PPFD does not contaminate VPD',res['dliMolM2'] is None and res['meanAirVpdKpa'] is not None)
 r=rows24()
 for row in r:row.update(shortwaveWm2=100,et0Mm=.1,et0Supported=True)
 f=environmental_features(r)
 ck('Radiant-energy conversion W to MJ',near(f['shortwaveMjM2'],8.64))
 ck('ET0 interval amounts summed once',near(f['et0Mm'],2.4))
 ck('ET0 is not a pot dose',f['wateringDecisionFromFeaturesAlone'] is None)
 for row in r:row.pop('ppfd');row.pop('ppfdSupport')
 ck('Broadband radiation not silently converted to PPFD',environmental_features(r)['dliMolM2'] is None)
 try:environmental_features([rows24()[0],rows24()[0]]);ok=False
 except ValueError:ok=True
 ck('Overlapping hours rejected',ok)
 try:environmental_features(rows24(),'forecast');ok=False
 except ValueError:ok=True
 ck('Occurred intervals cannot become forecast or vice versa',ok)
 try:environmental_features(rows24()[::-1]);ok=False
 except ValueError:ok=True
 ck('Unsorted intervals not silently reassigned',ok)
 for win in [23,25]:
  rows=[{'start':-win+i,'end':-win+i+1,'nature':'occurred','valid':True,'T':25,'RH':50,'ppfd':100,'ppfdSupport':'scenario'} for i in range(win)]
  ck(f'{win}-hour local-day coverage supported',near(environmental_features(rows,window=win)['dliMolM2'],win*.36))
 s=scenario_experiments();x=s['sameVpdDifferentTemperature']
 ck('Identical VPD need not mean identical heat',near(x['cool']['meanAirVpdKpa'],x['hot']['meanAirVpdKpa']) and x['hot']['heatVpdIntegralCkpaH']>x['cool']['heatVpdIntegralCkpaH'])
 x=s['sameDliDifferentTiming']
 ck('Identical DLI can conceal different heat-light overlap',near(x['coolerHourPhotons']['dliMolM2'],x['hotterHourPhotons']['dliMolM2']) and x['hotterHourPhotons']['photonHeatIntegralMolCM2']>x['coolerHourPhotons']['photonHeatIntegralMolCM2'])
 ck('288 factorial input scenarios generated',s['gridCount']==288)
 ck('Supplied root states change care without climate pretending to measure roots',
  all(g['conditionalCareDecision']==('water_now' if g['rootStateScenario']=='low' else 'not_due')
   and (g['conditionalRootConcern']=='root_environment_attention')==(g['rootStateScenario']=='excess') for g in s['grid']))
 ck('Simulated inputs never become measured outcome labels',s['syntheticOutcomesUsed'] is False and s['biologicalAccuracyValidated'] is False)
 ck('All factorial outputs finite',all(num(g['features']['meanAirVpdKpa']) for g in s['grid']))
 ck('Published table has seven segmented and five linear profiles',sum(r[3] is not None for r in CONFIG['sheldon']['bpRows'])==7 and sum(r[3] is None for r in CONFIG['sheldon']['bpRows'])==5)
 ck('Cultivar-specific low breakpoint retained',near(native_stomatal_reference(2,'T1 NT')['breakpointKpa'],1.2))
 ck('Linear profile not forced into closure threshold',native_stomatal_reference(3,'Joey')['breakpointKpa'] is None)
 ck('Negative post-break marginal response not clipped into fake total water use',native_stomatal_reference(3,'Canda')['marginalSlopeRatioVsLowVpd']<0)
 ck('Cultivar labels are not fuzzy matched',native_stomatal_reference(2,'indica') is None)
 ck('No extrapolation above VPD trial range',native_stomatal_reference(4,'T1 NT') is None)
 ck('Transpiration slope is not a dose',native_stomatal_reference(2,'T1 NT')['waterDose'] is None)
 ck('FTSW source point span reproduced',native_soil_reference(.5,'matched_experimental_FTSW')['nativePointThresholdSpan']==[.16,.81])
 ck('VWC cannot masquerade as experimental FTSW',native_soil_reference(.5,'VWC') is None)
 ck('Native stomatal soil breakpoint not a watering trigger',native_soil_reference(.5,'matched_experimental_FTSW')['plantWateringDecision'] is None)
 ck('All six native biochemical capacity profiles preserved',len(CONFIG['pangle25']['profiles'])==6)
 ck('Zero photons give zero light-dependent pre-respiration limitation',near(biochemical25(0,300,'BX_lateVeg')['preRespirationMinAcAj'],0))
 ck('No generic temperature correction extrapolation',biochemical25(750,300,'BX_lateVeg',35) is None)
 ck('No automatic Ci from outdoor CO2',biochemical25(750,None,'BX_lateVeg') is None)
 ck('Net photosynthesis not invented without respiration etc',biochemical25(750,300,'BX_lateVeg')['netPhotosynthesis'] is None)
 ck('Reported stage capacities affect the partial model',biochemical25(1500,300,'BX_lateVeg')['preRespirationMinAcAj']>biochemical25(1500,300,'BX_lateFlower')['preRespirationMinAcAj'])
 ck('Electron transport bounded by incident excitation and capacity',all(biochemical25(q,300,'BX_lateVeg')['J']<=min(.24*q,325.9)+1e-8 for q in [0,100,500,1500,2000]))
 core=core or load_warning_core()
 for margins,expected in [([.2,.5],'not_due'),([-.5,-.1],'water_now'),([-.1,.2],'uncertain')]:
  b=core.demo_bundle();b['water']['margins']=margins
  ck('Environment layer preserves supported water state '+expected,evaluate_with_environment(b,core)['warnings']['W06']['state']==expected)
 b=core.demo_bundle();b['weatherSupport']=False;b['hazardSupport']=True;b['weather']={'explicitHail':True}
 ck('Missing physiology cannot suppress supported destructive weather',evaluate_with_environment(b,core)['warnings']['W05']['state']=='official_event')
 b=core.demo_bundle();b['plant']['authorized']=False
 # Scope must be checked before exposing the new derived features too.
 ck('Unauthorized derived environment features withheld',evaluate_with_environment(b,core)['environment'] is None)
 b=core.demo_bundle();b['weatherSupport']=False;b['environmentSupport']=True
 ck('Independent qualified environment stream survives numeric API support gap',evaluate_with_environment(b,core)['environment']['meanAirVpdKpa'] is not None)
 import json
 ck('All exported scenarios use finite JSON',bool(json.dumps([s,CONFIG],allow_nan=False)))
 return checks

if __name__=='__main__':
 import json
 core=load_warning_core();tests=run_checks(core)
 print(json.dumps({'version':VERSION,'environmentChecks':len(tests),'warningCoreChecks':len(core.run_checks()),
  'allPassed':True,'biologicalAccuracyValidated':False,'factorialScenarios':scenario_experiments()['gridCount']},indent=2))
