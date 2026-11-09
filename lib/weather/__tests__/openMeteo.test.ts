import { decodeOpenMeteo, meteoLiquidRain, openMeteoWeatherResponse } from '../openMeteo';
import { parseWeatherMeasurements } from '../weatherMeasurements';
import { meteoFixture } from './meteoFixture';
const now = Date.parse('2026-11-09T12:20:00Z') / 1000;
const day = '2026-11-09';
const parsed = (raw = meteoFixture(now)) => parseWeatherMeasurements(openMeteoWeatherResponse(raw, now * 1000));
test('current, daily extrema, local-hour segments and native care history stay distinct', () => {
  const raw = meteoFixture(now); const dto = openMeteoWeatherResponse(raw, now * 1000); const today = parsed(raw)[day];
  expect(today.source).toBe('Open-Meteo'); expect(today.temperatureBasis).toBe('model');
  expect(today.temperature).toBe(25); expect(today.detailedTemps).toMatchObject({ min: 13, max: 29, morn: 21, day: 29, eve: 21, night: expect.any(Number) });
  expect(today.rainIntervalSeconds).toBe(900); expect(today.uvIndex).toBe(6);
  expect(dto._weedgrowMeteo?.hourly.time).toHaveLength(120);
  expect(today.sunrise).toBe('2026-11-09T06:00:00.000Z');
});
test('nonzero offsets do not shift Unix instants twice; segments use the named local timezone', () => {
  const raw = meteoFixture(now); raw.timezone = 'Africa/Johannesburg'; raw.utc_offset_seconds = 7200;
  // Provider daily Unix midnight is the actual UTC instant for local midnight.
  raw.daily!.time = raw.daily!.time.map(t => t - 7200);
  const today = parsed(raw)[day];
  expect(today.detailedTemps?.morn).toBeCloseTo(17); // 06:00 local = 04:00 UTC.
  expect(today.observationUtc).toBe(Math.floor(now / 900) * 900);
});
test('missing independent fields stay unknown; usable daily highs and lows survive', () => {
  const raw = meteoFixture(now); raw.current!.wind_gusts_10m = null;
  delete raw.hourly.uv_index; delete raw.hourly.relative_humidity_2m;
  raw.hourly.temperature_2m[raw.hourly.time.indexOf(Date.parse('2026-11-09T12:00:00Z') / 1000)] = null;
  const today = parsed(raw)[day];
  expect(today.windGust).toBeUndefined(); expect(today.uvIndex).toBeUndefined();
  expect(today.temperature).toBe(25); expect(today.detailedTemps).toMatchObject({ max: 29, min: 13, day: null });
  expect(today.qualityNotes?.length).toBeGreaterThan(0);
});
test('missing current rain cannot become zero or the daily forecast rain amount', () => {
  const raw = meteoFixture(now); raw.current!.rain = null; raw.daily!.rain_sum = raw.daily!.time.map(() => 25);
  expect(parsed(raw)[day].rainfall).toBeUndefined();
});
test('liquid precipitation fallback needs explicit zero snow; missing snow is not zero', () => {
  const raw = decodeOpenMeteo(meteoFixture(now)); delete raw.hourly.showers; raw.hourly.precipitation[0] = 10;
  expect(meteoLiquidRain(raw.hourly, 0)).toBe(10);
  raw.hourly.snowfall[0] = 1; expect(meteoLiquidRain(raw.hourly, 0)).toBeUndefined();
  delete raw.hourly.snowfall; expect(meteoLiquidRain(raw.hourly, 0)).toBeUndefined();
});
test.each(['wind_speed_10m', 'rain', 'et0_fao_evapotranspiration'])('wrong units for %s quarantine that variable', field => {
  const raw = meteoFixture(now); raw.hourly_units[field] = 'wrong';
  expect(decodeOpenMeteo(raw).hourly[field].every(v => v === null)).toBe(true);
});
test('misaligned arrays are not zipped to the wrong hours, and invalid time axes fail', () => {
  const raw = meteoFixture(now); raw.hourly.rain.pop();
  expect(decodeOpenMeteo(raw).hourly.rain).toBeUndefined();
  raw.hourly.time[2] += 5; expect(() => decodeOpenMeteo(raw)).toThrow('time axis');
});
