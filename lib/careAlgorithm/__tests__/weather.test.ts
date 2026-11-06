import { normalizeMeteo, normalizeOpenWeather } from '../adapters';
import { exposure, integralPath, pairedAirFallback, validSample } from '../weather';
import meteoForecast from './fixtures/openmeteo_forecast_payload.json';
import meteoArchive from './fixtures/openmeteo_archive_payload.json';
import owCurrent from './fixtures/openweather_current_payload.json';
import owHistory from './fixtures/openweather_history_payload.json';
import { sample } from './helpers';
const acquisition = { retrievedUtc: 2000000000, firstAvailableUtc: 2000000000, locationRevision: 1, sourceRevision: 'frozen-fixture', modelSelection: 'provider_best_match_unpinned' };
test.each([['forecast', meteoForecast], ['archive', meteoArchive]] as const)('captured Open-Meteo %s has valid independent samples', (product, fixture) => {
  const out = normalizeMeteo(fixture, product, acquisition);
  expect(out.samples).toHaveLength(fixture.hourly.time.length * 8);
  expect(out.samples.every(validSample)).toBe(true);
  const gust = out.samples.find(s => s.variable === 'wind_gust_ms')!;
  expect(gust.time_support).toBe(product === 'forecast' ? 'interval_maximum' : 'point');
  expect(out.samples.find(s => s.variable === 'wind_speed_ms')!.time_support).toBe('point');
  const rain = out.samples.find(s => s.variable === 'liquid_rain_mm')!;
  expect(rain.value).toBe(fixture.hourly.rain[0] + (product === 'forecast' ? meteoForecast.hourly.showers[0] : 0));
  expect(out.samples.every(s => s.kind === (product === 'forecast' ? 'forecast' : 'occurred_estimate'))).toBe(true);
});
test.each([['onecall_metric', owCurrent], ['timemachine_metric', owHistory]] as const)('captured OpenWeather %s preserves point/rate semantics', (product, fixture) => {
  const out = normalizeOpenWeather(fixture, product, acquisition);
  expect(out.samples.length).toBeGreaterThan(0); expect(out.samples.every(validSample)).toBe(true);
  expect(out.samples.every(s => s.valid_start_utc === s.valid_end_utc)).toBe(true);
  expect(out.samples.filter(s => s.variable === 'rain_rate_mm_h').every(s => s.time_support === 'rate')).toBe(true);
});
test('bad RH preserves wind; invalid rain component cannot be offset by positive showers', () => {
  const fixture = { ...meteoForecast, hourly: { ...meteoForecast.hourly, relative_humidity_2m: meteoForecast.hourly.time.map(() => 101),
    rain: meteoForecast.hourly.time.map(() => -1), showers: meteoForecast.hourly.time.map(() => 10) } };
  const rows = normalizeMeteo(fixture, 'forecast', acquisition).samples;
  expect(rows.find(s => s.variable === 'air_rh_pct')!.quality).toBe('invalid');
  expect(rows.find(s => s.variable === 'liquid_rain_mm')!.value).toBeNull();
  expect(rows.find(s => s.variable === 'wind_speed_ms')!.quality).toBe('ok');
});
test('explicit null rain stays unknown; absent rain only uses complete-point omission contract', () => {
  const current = { dt: 10, temp: 20, humidity: 50, wind_speed: 1 };
  const read = (row: unknown) => normalizeOpenWeather({ current: row }, 'onecall_metric', acquisition).samples.find(s => s.variable === 'rain_rate_mm_h')!;
  expect(read(current).value).toBe(0); expect(read({ ...current, rain: null }).quality).toBe('invalid');
  expect(read({ dt: 10 }).value).toBeNull();
});
test('daily rain stays a separate forecast collection; UTC solar instants never receive a timezone shift', () => {
  const out = normalizeOpenWeather(owCurrent, 'onecall_metric', acquisition);
  expect(out.dailyForecasts.length).toBeGreaterThan(0);
  expect(out.dailyForecasts.every(s => s.kind === 'forecast' && s.time_support === 'interval_sum')).toBe(true);
  expect(out.solar[0].sunriseUtc).toBe(owCurrent.current.sunrise);
  expect(out.solar[0].sunsetUtc).toBe(owCurrent.current.sunset);
  expect(out.samples.every(s => s.time_support === 'point' || s.time_support === 'rate')).toBe(true);
});
test('time axis errors reject response; per-variable array errors stay isolated', () => {
  expect(() => normalizeMeteo({ ...meteoForecast, utc_offset_seconds: 3600 }, 'forecast', acquisition)).toThrow();
  const rows = normalizeMeteo({ ...meteoForecast, hourly: { ...meteoForecast.hourly, relative_humidity_2m: [] } }, 'forecast', acquisition).samples;
  expect(rows.find(s => s.variable === 'air_rh_pct')!.reason_codes).toContain('misaligned_array');
  expect(rows.find(s => s.variable === 'et0_mm')!.quality).toBe('ok');
});
test('integrals reject gaps, duplicates/conflicts, overlaps and partial boundaries', () => {
  const a = sample('et0_mm', 1);
  expect(integralPath([a, a], 0, 3600, 'occurred_estimate').total).toBe(1);
  expect(integralPath([a, { ...a, value: 2 }], 0, 3600, 'occurred_estimate').complete).toBe(false);
  expect(integralPath([a], 0, 7200, 'occurred_estimate').complete).toBe(false);
  expect(integralPath([a], 0, 1800, 'occurred_estimate').complete).toBe(false);
});
test('exposure arithmetic uses only representative bins, gaps break longest run', () => {
  const out = exposure([{ startUtc: 0, endUtc: 3600, value: 34, support: 'representative_bin' }, { startUtc: 3600, endUtc: 10800, value: 36, support: 'representative_bin' }], 32);
  expect(out).toMatchObject({ hours: 3, degreeHours: 10, longestHours: 3 });
  expect(exposure([{ startUtc: 0, endUtc: 0, value: 40, support: 'point' }, { startUtc: 0, endUtc: 3600, value: 40, support: 'interval_maximum' }], 32)).toMatchObject({ crossing: true, hours: 0 });
  expect(exposure([{ startUtc: 0, endUtc: 3600, value: 34, support: 'representative_bin' }, { startUtc: 7200, endUtc: 10800, value: 36, support: 'representative_bin' }], 32).longestHours).toBe(1);
});
test('paired-air fallback fills only missing RH and rejects unrelated time/source or freezing dewpoint', () => {
  const t = sample('air_temperature_c', 25, { time_support: 'point', valid_start_utc: 3600 });
  const rh = sample('air_rh_pct', null, { time_support: 'point', valid_start_utc: 3600 });
  const dew = sample('air_dewpoint_c', 15, { time_support: 'point', valid_start_utc: 3600 });
  // FAO saturation-pressure relation at 25C/15C (also checked by the Python helper).
  expect(pairedAirFallback(t, rh, dew)!.rhPct).toBeCloseTo(53.83415075783599, 10);
  expect(pairedAirFallback(t, { ...rh, quality: 'invalid' }, dew)).toBeNull();
  expect(pairedAirFallback(t, rh, { ...dew, source_revision: 'other' })).toBeNull();
  expect(pairedAirFallback(t, rh, { ...dew, value: -1 })).toBeNull();
});
