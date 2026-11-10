// Read-only comparison. No provider/account/app settings changed; no API keys used.
const fs = require('node:fs');
const cli = 'C:/Users/Zane/AppData/Roaming/npm/node_modules/firebase-tools/lib/';
(async () => {
  const account = require(cli+'auth').getProjectDefaultAccount(process.cwd());
  await require(cli+'requireAuth').requireAuth({...account,cwd:process.cwd(),project:'weed-grow',projectId:'weed-grow',nonInteractive:true});
  const response = await require(cli+'gcp/firestore').getDocuments('weed-grow',['plants/CyNhA2fUB0kE0gCYQA4b']);
  const point=response.documents[0].fields.location.mapValue.fields;
  const lat=Number(point.lat.doubleValue??point.lat.integerValue),lon=Number(point.lng.doubleValue??point.lng.integerValue);
  const checks=[{name:'saved-plant-pin',lat,lon},{name:'Somerset-West-centre',lat:-34.0759,lon:18.8433},
    ...['ecmwf_ifs025','gfs_seamless','icon_seamless'].map(model=>({name:model,lat,lon,model}))];
  const results=[];
  for(let i=0;i<checks.length;i+=2){
    const rows=await Promise.all(checks.slice(i,i+2).map(async c=>{
      const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({latitude:c.lat,longitude:c.lon,timezone:'Africa/Johannesburg',forecast_days:'1',
        current:'temperature_2m,relative_humidity_2m,wind_speed_10m',hourly:'temperature_2m',daily:'temperature_2m_max,temperature_2m_min',...(c.model?{models:c.model}:{})});
      const r=await fetch(u,{signal:AbortSignal.timeout(20000)});const d=await r.json();
      return {name:c.name,status:r.status,reason:d.reason,grid:{latitude:d.latitude,longitude:d.longitude,elevation:d.elevation},current:d.current,daily:d.daily};
    }));results.push(...rows);
  }
  const distance=(a,b)=>{const p=Math.PI/180,x=(b.lat-a.lat)*p,y=(b.lon-a.lon)*p;const h=Math.sin(x/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(y/2)**2;return 6371*2*Math.asin(Math.sqrt(h));};
  const output={checkedAt:new Date().toISOString(),plantToTownCentreKm:distance({lat,lon},{lat:-34.0759,lon:18.8433}),results};
  fs.writeFileSync('tmp/weather-accuracy-comparison-results.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error('Comparison failed:',e.code||e.name);process.exitCode=1;});
