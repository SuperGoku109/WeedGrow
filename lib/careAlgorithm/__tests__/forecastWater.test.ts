import { forecastWater, type ForecastWaterInput } from '../forecastWater';
import { initialize } from '../waterBank';
import { runWaterModel } from '../waterModel';
import { scenario, setup, profile, source, sample } from './helpers';
const future = (): ForecastWaterInput => ({ setup, profile: { ...profile, domain: { ...profile.domain, sourceKeys: [...profile.domain.sourceKeys, 'test/forecast/test'] } },
  states: [initialize(scenario, 7200, profile.rootZoneKey, true)], evaluationUtc: 7200, horizonUtc: 10800,
  et0Source: { ...source, product: 'forecast' }, rainSource: { ...source, product: 'forecast' }, weather: [
    sample('et0_mm', 2, { product: 'forecast', kind: 'forecast', valid_start_utc: 7200, valid_end_utc: 10800 }),
    sample('liquid_rain_mm', 30, { product: 'forecast', kind: 'forecast', valid_start_utc: 7200, valid_end_utc: 10800 })] });
test('canonical forecast integrals produce conditional crossing windows, not an exact hour or finite censored upper wait', () => {
  const out = forecastWater(future());
  expect(out).toMatchObject({ available: true, earliestUtc: 7200, latestUtc: null, censored: true, conditional: true });
  expect(out.crossings[0]).toMatchObject({ earliestUtc: 7200, latestUtc: 10800 });
});
test('shelter does not require forecast rain and cannot receive it', () => {
  const input = future(); input.setup = { ...setup, soilRain: 'no' }; input.weather = input.weather.filter(s => s.variable !== 'liquid_rain_mm');
  expect(forecastWater(input)).toMatchObject({ available: true, latestUtc: 10800, censored: false });
});
test('missing/late/overlapping forecast coverage remains unavailable without modifying current states', () => {
  const input = future(); const before = JSON.stringify(input.states);
  expect(forecastWater({ ...input, weather: input.weather.filter(s => s.variable !== 'et0_mm') }).available).toBe(false);
  expect(forecastWater({ ...input, weather: input.weather.map(s => ({ ...s, available_at_utc: 7300 })) }).available).toBe(false);
  expect(forecastWater({ ...input, weather: [...input.weather, { ...input.weather[0], source_revision: 'r1', valid_start_utc: 7300 }] }).available).toBe(false);
  expect(JSON.stringify(input.states)).toBe(before);
});
test('loss-first detects a crossing before rain refills the bank within the same bin', () => {
  const input = future(); const s = { ...scenario, order: 'loss_first' as const };
  input.profile = { ...input.profile, scenarios: [s] }; input.states = [initialize(s, 7200, profile.rootZoneKey, true)];
  expect(forecastWater(input)).toMatchObject({ available: true, earliestUtc: 7200, latestUtc: 10800, censored: false });
});
test('the assembled water model never credits a wet forecast to its current due result', () => {
  const f = future();
  const out = runWaterModel({ setup, profile: f.profile, anchorUtc: 3600, evaluationUtc: 7200, anchored: true,
    et0Source: source, rainSource: source, events: [], weather: [sample('et0_mm', 1.5, { valid_start_utc: 3600, valid_end_utc: 7200 }), sample('liquid_rain_mm', 0, { valid_start_utc: 3600, valid_end_utc: 7200 })],
    forecast: { weather: f.weather, et0Source: f.et0Source, rainSource: f.rainSource, horizonUtc: 10800 } });
  expect(out.candidate).toBe('water'); expect(out.states[0].reserveL[0]).toBeCloseTo(.7);
  expect(out.projection).toMatchObject({ earliestUtc: 7200, latestUtc: 7200, censored: false });
});
