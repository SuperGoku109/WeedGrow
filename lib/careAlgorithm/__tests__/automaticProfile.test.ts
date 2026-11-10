import { automaticCareProfile } from '../automaticProfile';
import { defaultLocalCareSettings, evaluateLocalCare } from '../localCare';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import { meteoFixture } from '@/lib/weather/__tests__/meteoFixture';
import { openMeteoWeatherResponse } from '@/lib/weather/openMeteo';
const now = Date.parse('2026-11-09T12:20:00Z') / 1000;
const plant = makePlantSummary({ potSize: '10 L', careMedium: 'soil', sunlightExposure: 'Full Sun', locationTimeZone: 'UTC', rainReception: { soil: 'yes', canopy: 'yes' } });
const profile = (changes = {}) => automaticCareProfile({ ...plant, ...changes }, defaultLocalCareSettings(now), now);
test('automatic parameters use explicit pot volume with units and coherent scenario ranges', () => {
  const p = profile(), large = profile({ potSize: '20 L' });
  expect(p.reasonCodes).toEqual([]); expect(p.profile.scenarios).toHaveLength(32);
  expect(large.settings.capacityL).toBeCloseTo(p.settings.capacityL * 2);
  expect(large.settings.catchmentM2 / p.settings.catchmentM2).toBeCloseTo(2 ** (2 / 3));
  expect(p.settings.includeJournal).toBe(true); expect(p.settings.extraWaterL).toBe(0);
  expect(p.profile.scenarios.every(s => s.initialReserveL[0] === 0 && s.initialReserveL[1] === s.capacityL)).toBe(true);
});
test('stage, medium and sun facts affect parameters; missing facts widen the family', () => {
  const veg = profile(), seedling = profile({ growthStage: 'seedling' }), shade = profile({ sunlightExposure: 'Mostly Shade' });
  expect(seedling.settings.effectiveLossM2).toBeLessThan(veg.settings.effectiveLossM2);
  expect(shade.settings.effectiveLossM2).toBeLessThan(veg.settings.effectiveLossM2);
  expect(profile({ careMedium: 'coco' }).settings.capacityL).toBeGreaterThan(veg.settings.capacityL);
  const unknown = profile({ careMedium: null, sunlightExposure: null, growthStage: 'unknown' });
  expect(Math.max(...unknown.profile.scenarios.map(s => s.capacityL))).toBeGreaterThan(Math.max(...veg.profile.scenarios.map(s => s.capacityL)));
});
test('missing pot units and unknown ground root zones cannot create fabricated storage', () => {
  expect(profile({ potSize: '10' }).reasonCodes).toContain('automatic_pot_volume_required');
  expect(profile({ plantedIn: 'ground', potSize: null }).reasonCodes).toContain('automatic_root_zone_unknown');
});
test('automatic replay starts at local midnight; moved plants do not reuse old-location weather', () => {
  expect(profile().settings.anchorUtc).toBe(Date.parse('2026-11-02T00:00:00Z') / 1000);
  const moved = now - 7200;
  expect(profile({ locationChangedAt: { seconds: moved, nanoseconds: 0 } }).settings.anchorUtc).toBe(moved);
});
function weather(et0: number) {
  const raw = meteoFixture(now); const extra = 6 * 24;
  const first = raw.hourly.time[0];
  for (const [key, values] of Object.entries(raw.hourly)) raw.hourly[key] = key === 'time'
    ? [...Array.from({ length: extra }, (_, i) => first - (extra - i) * 3600), ...values] : [...Array(extra).fill(values[0]), ...values];
  raw.hourly.et0_fao_evapotranspiration = raw.hourly.time.map(() => et0);
  raw.hourly.temperature_2m = raw.hourly.time.map(() => 20);
  return openMeteoWeatherResponse(raw, now * 1000);
}
test('automatic advice does not expose an inferred water reserve', () => {
  const p = profile(); const evaluation = evaluateLocalCare(plant, [], p.settings, now, weather(0), now, p.reasonCodes, p);
  expect(evaluation.water.needsWater).toBeNull();
  expect(evaluation.water.evidence).toBeUndefined();
  expect(evaluation.outdoor?.checkStatus).toBeDefined();
  expect(evaluation.localInputs?.profileMode).toBe('automatic');
});
test('ET0 depletion and logged watering cannot establish current moisture', () => {
  const p = profile(); const raw = weather(1);
  const evaluate = (logs: any[]) => evaluateLocalCare(plant, logs, p.settings, now, raw, now, p.reasonCodes, p);
  expect(evaluate([]).water.needsWater).toBeNull();
  // Mathematical overflow/clamping case, not a recommended watering amount.
  expect(evaluate([{ type: 'watering', occurrencePrecision: 'time', timestamp: makeTimestamp(new Date(now * 1000)), waterMl: 10000 }]).water.needsWater).toBeNull();
});
