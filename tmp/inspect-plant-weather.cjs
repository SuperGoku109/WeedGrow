// Read-only: print weather measurements and approximate pin only; never credentials/keys.
const cli = 'C:/Users/Zane/AppData/Roaming/npm/node_modules/firebase-tools/lib/';
(async () => {
  const account = require(cli + 'auth').getProjectDefaultAccount(process.cwd());
  await require(cli + 'requireAuth').requireAuth({ ...account, cwd: process.cwd(), project: 'weed-grow', projectId: 'weed-grow', nonInteractive: true });
  const paths = ['plants/CyNhA2fUB0kE0gCYQA4b', 'plants/CyNhA2fUB0kE0gCYQA4b/weatherCache/2026-11-09'];
  const response = await require(cli + 'gcp/firestore').getDocuments('weed-grow', paths);
  const decode = value => value?.mapValue ? Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)])) : value?.doubleValue ?? value?.integerValue ?? value?.stringValue ?? value?.timestampValue ?? value?.booleanValue ?? null;
  const plant = response.documents.find(d => d.name.endsWith('/CyNhA2fUB0kE0gCYQA4b'));
  const p = Object.fromEntries(Object.entries(plant.fields).map(([k,v]) => [k,decode(v)]));
  const wdoc = response.documents.find(d => d.name.endsWith('/2026-11-09'));
  const w = wdoc ? Object.fromEntries(Object.entries(wdoc.fields).map(([k,v]) => [k,decode(v)])) : null;
  console.log(JSON.stringify({ pin: { lat: Math.round(p.location.lat*100)/100, lng: Math.round(p.location.lng*100)/100 }, zone:p.locationTimeZone, weather:w && {date:w.date,fetchedAt:w.fetchedAt,temperature:w.temperature,detailedTemps:w.detailedTemps,source:w.source,forecasted:w.forecasted} },null,2));
  const env = require('dotenv').config({quiet:true}).parsed;
  const key = env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY || env.OPENWEATHERMAP_API_KEY;
  if (!key) throw new Error('No weather key configured');
  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  for (const [k,v] of Object.entries({lat:p.location.lat,lon:p.location.lng,exclude:'minutely,alerts',units:'metric',appid:key})) url.searchParams.set(k,v);
  const api = await fetch(url); const raw = await api.json();
  console.log(JSON.stringify({status:api.status,zone:raw.timezone,offset:raw.timezone_offset,current:raw.current && {dt:raw.current.dt,temp:raw.current.temp}, daily:raw.daily?.slice(0,2).map(d => ({dt:d.dt,temp:d.temp})),hourly:raw.hourly?.slice(0,2).map(d => ({dt:d.dt,temp:d.temp}))},null,2));
  for (const endpoint of ['weather', 'forecast']) {
    const check = new URL('https://api.openweathermap.org/data/2.5/' + endpoint);
    for (const [k,v] of Object.entries({lat:p.location.lat,lon:p.location.lng,units:'metric',appid:key})) check.searchParams.set(k,v);
    const response = await fetch(check); const data = await response.json();
    console.log(JSON.stringify({endpoint,status:response.status,date:response.headers.get('date'),dt:data.dt,main:data.main,count:data.list?.length,
      first:data.list?.slice(0,3).map(d => ({dt:d.dt,main:d.main})),last:data.list?.slice(-1).map(d => ({dt:d.dt,main:d.main}))},null,2));
  }
})().catch(error => { console.error('Weather inspection failed:',error.status ?? error.statusCode ?? error.name); process.exitCode=1; });
