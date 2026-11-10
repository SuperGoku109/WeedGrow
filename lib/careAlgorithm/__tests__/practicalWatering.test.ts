import { practicalWatering } from '../practicalWatering';
import { plantSetup } from '../appAdapter';
import { automaticCareProfile } from '../automaticProfile';
import { defaultLocalCareSettings, evaluateLocalCare } from '../localCare';
import { openMeteoWeatherResponse } from '@/lib/weather/openMeteo';
import { meteoFixture } from '@/lib/weather/__tests__/meteoFixture';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import type { WaterEvent, LiveWaterEvent } from '../events';
import { waterExplanation } from '../waterExplanation';
const now = Date.parse('2026-11-09T12:20:00Z') / 1000;
const plant = makePlantSummary({ potSize: '10 L', locationTimeZone: 'UTC', rainReception: { soil: 'unknown', canopy: 'unknown' } });
const setup = plantSetup(plant);
const event = (hours = 2, litres: number | null = 1): LiveWaterEvent => ({ id: 'water', revision: 1, startUtc: now - hours * 3600, endUtc: now - hours * 3600, appliedL: litres });
function weather() {
  const raw = meteoFixture(now), extra = 48, first = raw.hourly.time[0];
  for (const [key, values] of Object.entries(raw.hourly)) raw.hourly[key] = key === 'time'
    ? [...Array.from({ length: extra }, (_, i) => first - (extra - i) * 3600), ...values] : [...Array(extra).fill(values[0]), ...values];
  raw.hourly.temperature_2m = raw.hourly.time.map(t => t % 86400 >= 10 * 3600 && t % 86400 < 16 * 3600 ? 32 : 18);
  raw.hourly.et0_fao_evapotranspiration = raw.hourly.time.map(() => .1);
  return raw;
}
function input() { return { setup, events: [] as WaterEvent[], raw: weather(), nowUtc: now, retrievedUtc: now, anchorUtc: now - 7 * 86400 }; }
const evaluate = (changes: Partial<ReturnType<typeof input>> = {}) => practicalWatering({ ...input(), ...changes });

test('two hot dry days and no watering recommends water without proving the reserve', () => {
  const result = evaluate()!;
  expect(result.needsWater).toBe(true);
  expect(waterExplanation(result)).toContain('last 2 days');
  expect(waterExplanation(result)).toContain('no watering is logged');
  expect(waterExplanation(result)).not.toContain('all supported scenarios');
});
test.each([null, 'no', 'yes', 'partial', 'unknown'] as const)('dry weather works with rain reception %s', reception => {
  expect(evaluate({ setup: { ...setup, soilRain: reception ?? 'unknown' } })?.needsWater).toBe(true);
});
test.each([null, 1])('recent normal watering pauses the recommendation even with quantity %s', litres => {
  expect(evaluate({ events: [event(2, litres)] })?.needsWater).toBe(false);
});
test('zero water does not reset the dry spell, and a tiny splash does not establish wet soil', () => {
  expect(evaluate({ events: [event(2, 0)] })?.needsWater).toBe(true);
  expect(evaluate({ events: [event(2, .001)] })).toBeNull();
});
test('watering during the hot spell interrupts the no-watering rule', () => {
  expect(evaluate({ events: [event(30)] })).toBeNull();
  expect(evaluate({ events: [event(60)] })?.needsWater).toBe(true);
});
test('uncertain dated watering interrupts the hot spell without claiming it was recent', () => {
  expect(evaluate({ events: [{ ...event(), startUtc: now - 20 * 3600, endUtc: now }] })).toBeNull();
});
test('a deleted or future watering event does not count as a past refill', () => {
  expect(evaluate({ events: [{ id: 'gone', revision: 2, deleted: true }, event(-2)] })?.needsWater).toBe(true);
});
test('meaningful past rain prevents the hot/dry shortcut, even if reception is unknown', () => {
  const raw = weather(); raw.hourly.rain[raw.hourly.time.indexOf(Math.floor(now / 3600) * 3600) - 10] = 3;
  expect(evaluate({ raw })).toBeNull();
  expect(evaluate({ raw, setup: { ...setup, soilRain: 'no' } })?.needsWater).toBe(true);
});
test('trace rain is not treated as a soaking', () => {
  const raw = weather(); raw.hourly.rain[0] = 8;
  const i = raw.hourly.time.indexOf(Math.floor(now / 3600) * 3600);
  raw.hourly.rain[i - 5] = .2;
  expect(evaluate({ raw })?.needsWater).toBe(true);
});
test('recent soaking rain with low drying demand pauses watering only when rain reaches the soil', () => {
  const raw = weather(), i = raw.hourly.time.indexOf(Math.floor(now / 3600) * 3600);
  raw.hourly.rain[i - 3] = 6;
  expect(evaluate({ raw, setup: { ...setup, soilRain: 'yes' } })?.needsWater).toBe(false);
  expect(evaluate({ raw })).toBeNull();
  raw.hourly.et0_fao_evapotranspiration.fill(.5);
  expect(evaluate({ raw, setup: { ...setup, soilRain: 'yes' } })).toBeNull();
});
test('forecast heat/rain and unfinished hours do not replace past weather', () => {
  const raw = weather();
  raw.hourly.temperature_2m = raw.hourly.time.map(t => t > now ? 40 : 20);
  expect(evaluate({ raw })).toBeNull();
  const hot = weather();
  hot.hourly.rain = hot.hourly.time.map(t => t > now ? 20 : 0);
  expect(evaluate({ raw: hot })?.needsWater).toBe(true);
});
test('a single hot day or brief temperature spikes do not establish a hot spell', () => {
  const raw = weather();
  raw.hourly.temperature_2m = raw.hourly.time.map(t => t > now - 86400 ? 32 : 20);
  expect(evaluate({ raw })).toBeNull();
  raw.hourly.temperature_2m = raw.hourly.time.map(t => t % 86400 === 12 * 3600 ? 35 : 20);
  expect(evaluate({ raw })).toBeNull();
});
test('strong ET0 can identify drying even without temperature, while moderate wind alone does not', () => {
  const raw = weather(); raw.hourly.temperature_2m.fill(null);
  raw.hourly.et0_fao_evapotranspiration.fill(.2);
  expect(evaluate({ raw })?.needsWater).toBe(true);
  raw.hourly.et0_fao_evapotranspiration.fill(.1); raw.hourly.wind_speed_10m.fill(5);
  expect(evaluate({ raw })).toBeNull();
});
test('missing ET0 does not block a clear heat signal, but missing rain does not become dry weather', () => {
  const raw = weather(); raw.hourly.et0_fao_evapotranspiration.fill(null);
  expect(evaluate({ raw })?.needsWater).toBe(true);
  raw.hourly.rain.fill(null); raw.hourly.precipitation.fill(null);
  expect(evaluate({ raw })).toBeNull();
});
test('shade and large pots require three days; unknown pot size does not block practical advice', () => {
  const raw = weather();
  raw.hourly.temperature_2m = raw.hourly.time.map(t => t > now - 48 * 3600 ? 32 : 20);
  expect(evaluate({ raw, setup: { ...setup, sun: 'Mostly Shade' } })).toBeNull();
  expect(evaluate({ raw, setup: { ...setup, potVolumeL: 60 } })).toBeNull();
  expect(evaluate({ setup: { ...setup, sun: 'Mostly Shade' } })?.needsWater).toBe(true);
  expect(evaluate({ setup: { ...setup, potVolumeL: null } })?.needsWater).toBe(true);
});
test.each([{ retrievedUtc: now - 3600 }, { retrievedUtc: now + 1 }, { anchorUtc: now - 86400 },
  { setup: { ...setup, status: 'archived' } }, { setup: { ...setup, environment: 'indoor' } },
  { setup: { ...setup, environment: 'greenhouse' } }])('stale, moved and unsupported cases cannot trigger rules: %j', changes => {
  expect(evaluate(changes)).toBeNull();
});
test('missing hourly rows cannot be treated as a hot dry day', () => {
  const raw = weather(); raw.hourly.time.splice(raw.hourly.time.indexOf(Math.floor(now / 3600) * 3600) - 20, 1);
  expect(evaluate({ raw })).toBeNull();
});
test.each([{ plantedIn: 'ground' as const, potSize: null }, { potSize: null }])('automatic integration gives practical advice for %j', changes => {
  const p = { ...plant, ...changes }, automatic = automaticCareProfile(p, defaultLocalCareSettings(now), now);
  const result = evaluateLocalCare(p, [], automatic.settings, now, openMeteoWeatherResponse(weather(), now * 1000), now, automatic.reasonCodes, automatic);
  expect(result.water.needsWater).toBeNull(); expect(result.outdoor?.checkStatus).toBe('CHECK_NOW');
  const log = { type: 'watering' as const, occurrencePrecision: 'time' as const, waterMl: 1000, timestamp: makeTimestamp(new Date(now * 1000)), updatedBy: 'demoUser' };
  expect(evaluateLocalCare(p, [log], automatic.settings, now, openMeteoWeatherResponse(weather(), now * 1000), now, automatic.reasonCodes, automatic).water.needsWater).toBeNull();
  expect(evaluateLocalCare(p, [], automatic.settings, now, openMeteoWeatherResponse(weather(), now * 1000), now, [...automatic.reasonCodes, 'local_journal_read_failed'], automatic).water.needsWater).toBeNull();
});
