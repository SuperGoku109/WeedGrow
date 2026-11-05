"""v7.1 input/capability contract. Not a soil or disease prediction engine."""
from copy import deepcopy

VERSION='7.1'
USER_FIELDS=['environment','plantedIn','potSize','growthStage','sunlightExposure','soilType',
 'mediumChoice','soilRainReception','canopyRainReception','ageDays','ageKnown','ageRecordedAt','height']
ROUTINE_LOG_FIELDS=['type','timestamp','occurrencePrecision','calendarDay','timeZone','waterMl']
WEATHER_CAPABILITIES=['scopedAirTemperature','scopedWind','scopedRainRate','completeRainAmount',
 'pairedHourlyAir','occurredHourlyHistory','sourceHazardProduct','nearSaturatedNight']
EXCLUDED=['leafTemperature','rootTemperature','leafVPD','PPFD','internalCO2','stomatalConductance',
 'leafNitrogen','leafAgeDistribution','leafWetnessSensor','soilOxygen','measuredRootDepth','verifiedDiseaseResistance']

def base_fixture():
 return {'authorized':True,'active':True,'notDeleting':True,'plant':{'environment':'outdoor','plantedIn':'pot',
  'potSize':'10 L','growthStage':'vegetative','sunlightExposure':'Partial Sun','soilRainReception':'yes','canopyRainReception':'yes'},
  'logs':[{'type':'watering','timestamp':'2026-10-28T07:00:00Z'}],
  'weather':{k:True for k in WEATHER_CAPABILITIES},'optionalProblemReport':None}

def capability_plan(bundle):
 """Read only realistic profile/log facts and separately qualified weather capabilities.
 Positive capability means the data route exists, never that a warning has triggered.
 """
 p={k:v for k,v in bundle.get('plant',{}).items() if k in USER_FIELDS}
 w={k:bundle.get('weather',{}).get(k) is True for k in WEATHER_CAPABILITIES}
 if any(bundle.get(k) is not True for k in ('authorized','active','notDeleting')):
  return {'version':VERSION,'status':'out_of_scope','warnings':{},'requiresDailyMoistureCheck':False}
 if p.get('environment')!='outdoor':
  return {'version':VERSION,'status':'external_weather_context_only','warnings':{},'requiresDailyMoistureCheck':False}
 foliage=p.get('growthStage') in ('seedling','vegetative','flowering')
 flowering=p.get('growthStage')=='flowering'
 complete_exposure=w['pairedHourlyAir'] and w['occurredHourlyHistory']
 root_report=bundle.get('optionalProblemReport') in ('root','establishment','wilting')
 available=lambda ok:'eligible_data_route' if ok else 'unavailable_data_route'
 result={
  'W01':available(w['scopedAirTemperature'] or w['sourceHazardProduct']),
  'W02':available(w['scopedAirTemperature'] or w['sourceHazardProduct']),
  'W03':available(w['scopedWind'] or w['sourceHazardProduct']),
  'W04':available(w['scopedRainRate'] or w['completeRainAmount'] or w['sourceHazardProduct']),
  'W05':available(w['sourceHazardProduct']),
  'W06':'estimate_model_required',
  'W07':'optional_report_review' if root_report else 'no_automatic_root_state_claim',
  'W08':'heat_card_container_context' if p.get('plantedIn')=='pot' else 'not_relevant',
  'W09':'humidity_context_only' if w['nearSaturatedNight'] else 'unavailable_data_route',
  'W10':'ambient_conditions_route' if foliage and complete_exposure else 'tissue_or_exposure_unassessed',
  'W11':'ambient_conditions_route' if flowering and complete_exposure else 'not_relevant' if p.get('growthStage') in ('seedling','vegetative') else 'tissue_or_exposure_unassessed',
  'W12':'shared_wet_weather_context' if foliage and complete_exposure else 'tissue_or_exposure_unassessed',
  'W13':'optional_report_review' if root_report else 'no_automatic_root_state_claim',
  'W14':'optional_report_review' if root_report else 'no_automatic_root_state_claim'}
 return {'version':VERSION,'status':'outdoor_scope','warnings':result,
  'dailyUserMeasurementsRequired':[],'requiresDailyMoistureCheck':False,
  'soilMoistureEstimate':None,'diseaseDiagnosis':None,'leafTemperatureEstimate':None,
  'wateringDecision':'not_evaluated_by_capability_contract',
  'note':'Eligibility is a capability, not a positive hazard, moisture estimate or diagnosis.'}

def run_checks():
 checks=[]
 def ck(name,value):
  assert value,name
  checks.append({'id':f'APP71-{len(checks)+1:02}','name':name,'passed':True})
 b=base_fixture();out=capability_plan(b)
 ck('All14 IDs have explicit product dispositions',set(out['warnings'])=={f'W{i:02}' for i in range(1,15)})
 ck('Routine user has no daily measurement dependency',out['dailyUserMeasurementsRequired']==[])
 ck('No mandatory daily moisture check',out['requiresDailyMoistureCheck'] is False)
 for key in EXCLUDED:
  c=deepcopy(b);c['plant'][key]=12345;c[key]=-999
  ck('Excluded '+key+' cannot change base capability',capability_plan(c)==out)
 c=deepcopy(b);c['plant']['growthStage']='flowering'
 ck('Reported flowering enables flower ambient route',capability_plan(c)['warnings']['W11']=='ambient_conditions_route')
 ck('Vegetative plant does not get flower disease route',out['warnings']['W11']=='not_relevant')
 c=deepcopy(b);c['weather']['pairedHourlyAir']=False
 ck('Summary-only cache cannot claim paired exposure',capability_plan(c)['warnings']['W10']=='tissue_or_exposure_unassessed')
 c=deepcopy(b);c['weather']['occurredHourlyHistory']=False
 ck('Forecast hours do not supply occurred exposure',capability_plan(c)['warnings']['W10']=='tissue_or_exposure_unassessed')
 ck('No automatic root-saturation inference',out['warnings']['W07']=='no_automatic_root_state_claim')
 ck('Unknown root state does not become a root-rot diagnosis',out['diseaseDiagnosis'] is None)
 c=deepcopy(b);c['optionalProblemReport']='root';c['weather']={}
 ck('Optional current problem review independent of weather',capability_plan(c)['warnings']['W07']=='optional_report_review')
 c=deepcopy(b);c['weather']['sourceHazardProduct']=False
 ck('Excluded alert feed cannot provide hail route',capability_plan(c)['warnings']['W05']=='unavailable_data_route')
 c=deepcopy(b);c['weather']={'sourceHazardProduct':True}
 ck('Independent supported source survives numeric gaps',capability_plan(c)['warnings']['W05']=='eligible_data_route')
 c=deepcopy(b);c['plant']['environment']='greenhouse'
 ck('Outdoor API does not measure greenhouse interior',capability_plan(c)['status']=='external_weather_context_only')
 c=deepcopy(b);c['authorized']=False
 ck('Permission gate precedes capability output',capability_plan(c)['warnings']=={})
 c=deepcopy(b);c['plant'].pop('soilType',None);c['plant'].pop('height',None);c['plant'].pop('ageDays',None)
 ck('Missing optional age/height/soil provenance does not block hazards',capability_plan(c)['warnings']['W01']=='eligible_data_route')
 c=deepcopy(b);c['logs'][0]['waterMl']=500
 ck('A water amount does not prove full root wetting',capability_plan(c)['soilMoistureEstimate'] is None)
 ck('No guessed binary water result from a capability check',out['wateringDecision']=='not_evaluated_by_capability_contract')
 ck('Current paired-air dependency is not leaf VPD','leafVPD' not in WEATHER_CAPABILITIES)
 return checks

if __name__=='__main__':
 import json
 checks=run_checks();print(json.dumps({'version':VERSION,'capabilityChecksPassed':len(checks),
  'biologicalAccuracyValidated':False,'appChanged':False},indent=2))
