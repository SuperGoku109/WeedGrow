import { evaluateLocalCare, localCarePreset } from '../localCare';
import { openMeteoWeatherResponse } from '@/lib/weather/openMeteo';
import { meteoFixture } from '@/lib/weather/__tests__/meteoFixture';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
const now = Date.parse('2026-11-09T12:20:00Z') / 1000;
const plant = makePlantSummary({ potSize: '10 L', rainReception: { soil: 'yes', canopy: 'yes' } });
const settings = () => ({ ...localCarePreset('dry', now), weatherMode: 'open-meteo' as const, anchorUtc: now - 86400 });
function run(raw = meteoFixture(now), changes = {}, logs: any[] = []) {
  const dto = openMeteoWeatherResponse(raw, (now - 60) * 1000);
  return evaluateLocalCare(plant, logs, { ...settings(), ...changes }, now, dto, now - 60);
}
test('real hourly model ET0, not the manual dry preset rates, drives watering', () => {
  const result = run();
  expect(result.water.needsWater).toBe(true); expect(result.water.reasonCodes).toContain('open_meteo_model_estimate');
  const wet = meteoFixture(now); wet.hourly.et0_fao_evapotranspiration = wet.hourly.time.map(() => 0);
  expect(run(wet).water.needsWater).toBe(false);
  expect(run(wet, { et0MmPerDay: 50, rainMmPerDay: 1000 }).water.needsWater).toBe(false);
});
test('model rain refills exposed roots; manual simulated watering and journal quantities still work', () => {
  const rain = meteoFixture(now); rain.hourly.rain = rain.hourly.time.map(() => .75);
  expect(run(rain).water.needsWater).toBe(false);
  expect(run(undefined, { extraWaterL: 1 }).water.needsWater).toBe(false);
  expect(run(undefined, {}, [{ type: 'watering', occurrencePrecision: 'time', timestamp: makeTimestamp(new Date(now * 1000)), waterMl: 1000 }]).water.needsWater).toBe(false);
});
test('the unfinished hour uses conditional bounds, not a uniform elapsed fraction', () => {
  const raw = meteoFixture(now); raw.hourly.et0_fao_evapotranspiration = raw.hourly.time.map(() => 0);
  const index = raw.hourly.time.indexOf(Math.ceil(now / 3600) * 3600); raw.hourly.et0_fao_evapotranspiration[index] = 2;
  const result = run(raw, { anchorUtc: Math.floor(now / 3600) * 3600, initialReserveL: 1 });
  expect(result.water.needsWater).toBeNull();
  const reserve = result.water.evidence!.scenarios[0].reserveL;
  expect(reserve[0]).toBeCloseTo(.6); expect(reserve[1]).toBeCloseTo(1);
  expect(result.water.reasonCodes).toContain('partial_hour_conditional_model_bounds');
});
test('later-day forecasts cannot refill the current bank', () => {
  const raw = meteoFixture(now);
  raw.hourly.rain = raw.hourly.time.map(t => t > Math.ceil(now / 3600) * 3600 ? 100 : 0);
  expect(run(raw).water.needsWater).toBe(true);
});
test('missing ET0 or liquid rain stays unknown instead of becoming zero demand or zero rain', () => {
  const raw = meteoFixture(now); delete raw.hourly.et0_fao_evapotranspiration;
  expect(run(raw).water.needsWater).toBeNull();
  const wet = meteoFixture(now); delete wet.hourly.showers; delete wet.hourly.snowfall;
  expect(run(wet).water.needsWater).toBeNull();
});
test('moderate wind does not become a storm, and WMO storm IDs are explicitly mapped', () => {
  expect(run().stormConditions).toEqual([]);
  const raw = meteoFixture(now); raw.current!.weather_code = 95;
  expect(run(raw).stormConditions).toEqual([expect.objectContaining({ provider: 'Open-Meteo', code: 95, phase: 'current' })]);
  raw.current!.weather_code = 3; expect(run(raw).stormConditions).toEqual([]);
});
test('stale input cannot create a fresh weather-driven water decision', () => {
  const dto = openMeteoWeatherResponse(meteoFixture(now), now * 1000);
  expect(evaluateLocalCare(plant, [], settings(), now + 3600, dto, now).water.reasonCodes).toContain('local_meteo_stale');
});
