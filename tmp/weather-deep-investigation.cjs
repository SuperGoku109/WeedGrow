// Read-only diagnostics, bounded to a small comparison matrix. No app writes.
const fs = require('node:fs');
const key = require('dotenv').config({quiet:true}).parsed.OPENWEATHERMAP_API_KEY;
const cases = [
  {name:'onecall-somerset-metric',path:'3.0/onecall',lat:-34.05,lon:18.78,extra:{units:'metric'}},
  {name:'onecall-berlin-metric',path:'3.0/onecall',lat:52.52,lon:13.405,extra:{units:'metric'}},
  {name:'onecall-somerset-standard',path:'3.0/onecall',lat:-34.05,lon:18.78,extra:{units:'standard'}},
  {name:'onecall-missing-key',path:'3.0/onecall',lat:-34.05,lon:18.78,auth:'none',extra:{units:'metric'}},
  {name:'onecall-invalid-key',path:'3.0/onecall',lat:-34.05,lon:18.78,auth:'invalid',extra:{units:'metric'}},
  {name:'forecast-explicit-40',path:'2.5/forecast',lat:-34.05,lon:18.78,extra:{units:'metric',cnt:'40'}},
  {name:'forecast-berlin',path:'2.5/forecast',lat:52.52,lon:13.405,extra:{units:'metric',cnt:'40'}},
];
const regional = [
  {name:'cape-town',lat:-33.9249,lon:18.4241},
  {name:'brackenfell',lat:-33.875,lon:18.698},
  {name:'somerset-west-town',lat:-34.075,lon:18.85},
  {name:'johannesburg',lat:-26.2041,lon:28.0473},
  {name:'sydney',lat:-33.8688,lon:151.2093},
].map(c=>({...c,path:'3.0/onecall',extra:{units:'metric'}}));
async function owm(c) {
  const url = new URL('https://api.openweathermap.org/data/'+c.path);
  for (const [k,v] of Object.entries({lat:c.lat,lon:c.lon,...c.extra})) url.searchParams.set(k,v);
  if (c.auth !== 'none') url.searchParams.set('appid',c.auth === 'invalid' ? 'invalid-key-diagnostic' : key);
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}); const raw=await r.json();
  return {name:c.name,status:r.status,cod:raw.cod,message:typeof raw.message === 'string' ? raw.message.replaceAll(key,'[REDACTED]').slice(0,160):undefined,
    dailyCount:raw.daily?.length,hourlyCount:raw.hourly?.length,listCount:raw.list?.length,current:raw.current && {dt:raw.current.dt,temp:raw.current.temp},
    daily:raw.daily?.[0] && {dt:raw.daily[0].dt,temp:raw.daily[0].temp},timezone:raw.timezone,fields:Object.keys(raw)};
}
async function meteo() {
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  const params={latitude:'-34.05',longitude:'18.78',timezone:'UTC',timeformat:'unixtime',forecast_days:'3',past_days:'3',wind_speed_unit:'ms',
    current:'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    hourly:'temperature_2m,relative_humidity_2m,dew_point_2m,rain,showers,et0_fao_evapotranspiration,wind_speed_10m,wind_gusts_10m,shortwave_radiation,weather_code',
    daily:'temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset'};
  url.search=new URLSearchParams(params);
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const raw=await r.json();
  fs.writeFileSync('tmp/open-meteo-investigation-response.json',JSON.stringify(raw,null,2));
  const hours=raw.hourly?.time??[];const lastCompleted=Math.floor(Date.now()/3600000)*3600;
  return {name:'open-meteo-forecast',status:r.status,reason:raw.reason,current:raw.current,daily:raw.daily,
    returnedGrid:{latitude:raw.latitude,longitude:raw.longitude,elevation:raw.elevation},hourCount:hours.length,
    firstHour:hours[0],lastHour:hours.at(-1),hourlyUnits:raw.hourly_units,
    missingPastEt0:hours.filter((t,i)=>t<=lastCompleted && raw.hourly.et0_fao_evapotranspiration[i]==null).length,
    missingPastRain:hours.filter((t,i)=>t<=lastCompleted && (raw.hourly.rain[i]==null || raw.hourly.showers[i]==null)).length};
}
(async()=>{
  if(!key)throw new Error('Missing configured key');const results=[];
  const selected=process.argv.includes('--regional')?regional:cases;
  for(let i=0;i<selected.length;i+=2){const rows=await Promise.allSettled(selected.slice(i,i+2).map(owm));for(const row of rows)results.push(row.status==='fulfilled'?row.value:{error:row.reason.name});}
  if(!process.argv.includes('--regional'))try{results.push(await meteo());}catch(error){results.push({name:'open-meteo',error:error.name});}
  fs.writeFileSync(process.argv.includes('--regional')?'tmp/weather-regional-investigation-results.json':'tmp/weather-deep-investigation-results.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
  console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error('Investigation failed:',error.name);process.exitCode=1;});
