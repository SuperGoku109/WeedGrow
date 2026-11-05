const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const memo = new Map();
function load(rel) {
  const file = path.join(root, rel.endsWith('.ts') ? rel : rel + '.ts');
  if (memo.has(file)) return memo.get(file).exports;
  const module = { exports: {} }; memo.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', js)(id => {
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), id)));
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const { parseWeatherMeasurements } = load('lib/weather/weatherMeasurements.ts');
const unix = iso => Date.parse(iso) / 1000;
const base = { dt: unix('2026-10-29T10:00:00Z'), temp: 27, humidity: 45, wind_speed: 4, uvi: 6, rain: {'1h': 3}, sunrise: unix('2026-10-29T03:00:00Z'), sunset: unix('2026-10-29T16:30:00Z') };
const daily = { ...base, rain: 38, temp: { min: 17, max: 33, day: 30, night: 19 }, humidity: 68, pop: 0.9 };
const payload = { _weedgrowFetchedAt: Date.parse('2026-10-29T10:00:00Z'), timezone: 'Africa/Johannesburg', timezone_offset: 7200, current: base, daily: [daily], hourly: [{dt: unix('2026-10-29T20:00:00Z'), temp: 21, humidity: 93, rain: {'1h': 2}}] };
const today = parseWeatherMeasurements(payload)['2026-10-29'];
const noCurrent = parseWeatherMeasurements({...payload, current: undefined})['2026-10-29'];
const findings = [
  {id:'CODE-01', observation:'One-hour rain is stored under a daily key', actual:today.rainfall, actualUnit:'provider mm/h', asserted:today.rainfall===3},
  {id:'CODE-02', observation:'Forecast night humidity is attached to today marked non-forecast', actual:{forecasted:today.forecasted, nightHumidity:today.nightHumidity}, asserted:today.forecasted===false && today.nightHumidity===93},
  {id:'CODE-03', observation:'Sunrise instant is shifted by offset and serialized with Z', actual:today.sunrise, expectedUtc:'2026-10-29T03:00:00.000Z', asserted:today.sunrise==='2026-10-29T05:00:00.000Z'},
  {id:'CODE-04', observation:'daily[0] alone is marked observed', actual:{forecasted:noCurrent.forecasted,rainfall:noCurrent.rainfall}, asserted:noCurrent.forecasted===false && noCurrent.rainfall===38}
];
if(findings.some(x=>!x.asserted)) throw new Error('A documented parser reproduction no longer holds.');
fs.writeFileSync(path.join(__dirname,'weather_reproduction.json'), JSON.stringify({scope:'Synthetic local-code reproduction; no network, secrets or production records accessed', checkedAt:'2026-10-29',findings},null,2));
console.log(JSON.stringify(findings,null,2));
