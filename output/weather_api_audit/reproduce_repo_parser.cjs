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

const {parseWeatherMeasurements}=load('lib/weather/weatherMeasurements.ts');
const {decodeWeatherResponse}=load('lib/weather/weatherResponse.ts');
const folder=path.join(root,'output/weather_api_audit');
const raw=JSON.parse(fs.readFileSync(path.join(folder,'openweather_current_payload.json'),'utf8'));
const history=JSON.parse(fs.readFileSync(path.join(folder,'openweather_history_payload.json'),'utf8'));
const normalized=parseWeatherMeasurements(raw);
const day=new Date((raw.current.dt+raw.timezone_offset)*1000).toISOString().slice(0,10);
const today=normalized[day];
const decoded=decodeWeatherResponse(raw);
const historyNormalized=parseWeatherMeasurements(history);
const alertFixture=structuredClone(raw);alertFixture.alerts=[{sender_name:'SYNTHETIC_SCHEMA_ONLY',event:'Hail',start:raw.current.dt,end:raw.current.dt+3600,description:'Synthetic adapter check'}];
const rainFixture=structuredClone(raw);rainFixture.current.rain={'1h':2};rainFixture.daily[0].rain=25;
const rainNormalized=parseWeatherMeasurements(rainFixture)[day];
const report={realPayloadChecks:{currentDecoded:!!decoded.current,hourlyKeptInRawCache:decoded.hourly.length,dailyNormalizedCount:Object.keys(normalized).length,historicalRawRows:history.data.length,historicalParsedDates:Object.keys(historyNormalized),sunriseRawUtc:new Date(raw.current.sunrise*1000).toISOString(),sunriseNormalized:today.sunrise,sunriseShiftSeconds:(Date.parse(today.sunrise)-raw.current.sunrise*1000)/1000,currentEntryForecasted:today.forecasted,futureNightHumidityAttachedToCurrent:today.nightHumidity??null},controlledSchemaChecks:{alertsSurviveDecoder:'alerts' in decodeWeatherResponse(alertFixture),rainRateStoredAsDailyGenericRainfall:rainNormalized.rainfall,fixtureDailyAmount:25,fixtureCurrentRate:2},scope:'Captured live payloads plus explicitly identified perturbed/schema fixtures. No production records written.'};
if(report.realPayloadChecks.historicalParsedDates.length!==0)throw new Error('Historical parsing finding changed');
if(report.realPayloadChecks.sunriseShiftSeconds!==raw.timezone_offset)throw new Error('Solar-time reproduction changed');
if(report.controlledSchemaChecks.alertsSurviveDecoder!==false || rainNormalized.rainfall!==2)throw new Error('Schema fixture finding changed');
fs.writeFileSync(path.join(folder,'actual_parser_audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
