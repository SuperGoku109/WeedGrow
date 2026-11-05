"""Bounded, read-only API probes. Credentials stay in memory and never logs."""
from pathlib import Path
from datetime import datetime,timezone
import os,json,re,urllib.request,urllib.parse,urllib.error,concurrent.futures

ROOT=Path('C:/Users/Zane/dev/WeedGrow');OUT=ROOT/'output/weather_api_audit';OUT.mkdir(parents=True,exist_ok=True)
key=os.environ.get('OPENWEATHERMAP_API_KEY','')
if not key:
 for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
  match=re.match(r'^\s*(?:export\s+)?OPENWEATHERMAP_API_KEY\s*=\s*(.*?)\s*$',line)
  if match:key=match[1].strip().strip('\"').strip("'");break

def redact(value):
 if isinstance(value,str):return value.replace(key,'[REDACTED]') if key else value
 if isinstance(value,list):return [redact(v) for v in value]
 if isinstance(value,dict):return {k:redact(v) for k,v in value.items()}
 return value

def get(name,host,path,params):
 started=datetime.now(timezone.utc).isoformat()
 try:
  url=host+path+'?'+urllib.parse.urlencode(params)
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'WeedGrow-contract-evaluation/1.0'}),timeout=35) as response:
   status=response.status;data=json.loads(response.read())
 except urllib.error.HTTPError as e:
  status=e.code
  try:data=json.loads(e.read())
  except Exception:data={'error':'non_json_http_error'}
 except Exception as e:
  return {'probe':name,'retrieved_at_utc':started,'status':None,'error_type':type(e).__name__}
 data=redact(data)
 (OUT/(name+'_payload.json')).write_text(json.dumps(data,indent=2,allow_nan=False),encoding='utf-8')
 summary={'probe':name,'retrieved_at_utc':started,'status':status,'top_level_keys':list(data),'payload_file':name+'_payload.json'}
 if status!=200:summary['provider_error']=data
 else:
  for k in ('hourly','daily','data'):
   if isinstance(data.get(k),list):summary[k+'_count']=len(data[k]);summary[k+'_first_keys']=list(data[k][0]) if data[k] else []
   elif isinstance(data.get(k),dict):summary[k+'_keys']=list(data[k]);summary[k+'_lengths']={j:len(v) for j,v in data[k].items() if isinstance(v,list)}
  if isinstance(data.get('current'),dict):summary['current_keys']=list(data['current'])
 return summary

pin={'lat':-26.2041,'lon':28.0473};ompin={'latitude':pin['lat'],'longitude':pin['lon']}
tasks=[]
if key:
 tasks += [('openweather_current','https://api.openweathermap.org','/data/3.0/onecall',dict(pin,exclude='minutely,alerts',units='metric',appid=key)),
           ('openweather_history','https://api.openweathermap.org','/data/3.0/onecall/timemachine',dict(pin,dt=int(datetime(2026,10,20,12,tzinfo=timezone.utc).timestamp()),units='metric',appid=key))]
hourly='temperature_2m,relative_humidity_2m,dew_point_2m,rain,showers,precipitation,wind_speed_10m,wind_gusts_10m,shortwave_radiation,et0_fao_evapotranspiration'
tasks += [('openmeteo_forecast','https://api.open-meteo.com','/v1/forecast',dict(ompin,hourly=hourly,current='temperature_2m,relative_humidity_2m,dew_point_2m,rain,wind_speed_10m',wind_speed_unit='ms',timeformat='unixtime',timezone='UTC',past_days=2,forecast_days=2)),
          ('openmeteo_archive','https://archive-api.open-meteo.com','/v1/archive',dict(ompin,hourly=hourly.replace('showers,',''),wind_speed_unit='ms',timeformat='unixtime',timezone='UTC',start_date='2026-10-20',end_date='2026-10-22'))]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda t:get(*t),tasks))
report=dict(test_coordinates=pin,location_scope='Public Johannesburg city-centre test coordinate; not a user plant location',configured_key_used=bool(key),account_changes=False,app_changes=False,probes=results)
(OUT/'live_probe_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
for r in results:print(json.dumps(r))
