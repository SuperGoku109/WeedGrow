import { defaultLocalCareSettings, evaluateLocalCare, localCarePreset, localCareSettingsError } from '../localCare';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import type { PlantLog } from '@/firestoreModels';
import { waterExplanation } from '../waterExplanation';
import { evaluationValidAt } from '../evaluationValidity';

const now = Date.parse('2026-11-09T12:00:00Z') / 1000;
const plant = makePlantSummary({ potSize: '10 L', locationTimeZone: 'Africa/Johannesburg', rainReception: { soil: 'yes', canopy: 'yes' } });
const dry = () => localCarePreset('dry', now);
const log = (waterMl?: number, id = 'water-1'): PlantLog => ({ id, type: 'watering', timestamp: makeTimestamp(new Date(now * 1000)),
  occurrencePrecision: 'time', waterMl } as unknown as PlantLog);
const reserve = (result: ReturnType<typeof evaluateLocalCare>) => result.water.evidence!.scenarios[0].reserveL;

test('disabled inputs explain the action needed; dry and rainy presets run without a server release', () => {
  const disabled = evaluateLocalCare(plant, [], defaultLocalCareSettings(now), now);
  expect(disabled.water.needsWater).toBeNull(); expect(waterExplanation(disabled.water)).toMatch(/Choose Use Open-Meteo weather/);
  const dryResult = evaluateLocalCare(plant, [], dry(), now);
  expect(dryResult.water.needsWater).toBe(true); expect(reserve(dryResult)[0]).toBeCloseTo(0);
  const rainy = evaluateLocalCare(plant, [], localCarePreset('rainy', now), now);
  // Hourly gain = .1 L rain - .025 L demand. The cap is applied before each loss;
  // after reaching capacity, each subsequent hour ends at 2 - .025 = 1.975 L.
  expect(rainy.water.needsWater).toBe(false); expect(reserve(rainy)[0]).toBeCloseTo(1.975, 2);
  expect(dryResult.execution).toBe('local-experimental'); expect(dryResult.waterRelease).toBeUndefined();
  expect(evaluationValidAt(dryResult, now)).toBe(true); expect(evaluationValidAt(dryResult, now + 300)).toBe(false);
});
test('known watering, corrected quantities, deletion and simulated watering change the actual model result', () => {
  expect(evaluateLocalCare(plant, [log(2000)], dry(), now).water.needsWater).toBe(false);
  expect(evaluateLocalCare(plant, [log(100)], dry(), now).water.needsWater).toBe(true);
  expect(evaluateLocalCare(plant, [], dry(), now).water.needsWater).toBe(true);
  const extra = evaluateLocalCare(plant, [], { ...dry(), extraWaterL: 2 }, now);
  expect(extra.water.needsWater).toBe(false); expect(reserve(extra)).toEqual([1.6, 1.6]);
  expect(evaluateLocalCare(plant, [log(2000)], { ...dry(), includeJournal: false }, now).water.needsWater).toBe(true);
});
test('unknown quantity stays bounded, zero is zero, future watering is excluded', () => {
  const unknown = evaluateLocalCare(plant, [log()], dry(), now);
  expect(unknown.water.needsWater).toBeNull(); expect(reserve(unknown)).toEqual([0, 2]);
  expect(evaluateLocalCare(plant, [log(0)], dry(), now).water.needsWater).toBe(true);
  const future = { ...log(2000), timestamp: makeTimestamp(new Date((now + 1) * 1000)) };
  expect(evaluateLocalCare(plant, [future], dry(), now).water.needsWater).toBe(true);
});
test('document identity deduplicates the same entry but retains equal amounts in separate entries', () => {
  const one = log(600);
  expect(evaluateLocalCare(plant, [one, one], dry(), now).water.needsWater).toBe(true);
  expect(evaluateLocalCare(plant, [one, log(600, 'water-2')], dry(), now).water.needsWater).toBe(false);
});
test.each([
  ['negative ET0', { et0MmPerDay: -1 }], ['NaN rain', { rainMmPerDay: NaN }], ['infinite capacity', { capacityL: Infinity }],
  ['reserve exceeds capacity', { initialReserveL: 3 }], ['invalid retention', { retainedFraction: 1.1 }],
])('%s cannot generate a definite watering result', (_name, change) => {
  const settings = { ...dry(), ...change };
  expect(localCareSettingsError(settings)).not.toBeNull();
  expect(evaluateLocalCare(plant, [], settings, now).water.needsWater).toBeNull();
});
test('future start, excessive replay and failed journal acquisition explain uncertainty', () => {
  expect(evaluateLocalCare(plant, [], { ...dry(), anchorUtc: now + 1 }, now).water.reasonCodes).toContain('local_test_anchor_future');
  expect(evaluateLocalCare(plant, [], { ...dry(), anchorUtc: now - 15 * 86400 }, now).water.reasonCodes).toContain('local_test_window_too_long');
  const failed = evaluateLocalCare(plant, [], dry(), now, undefined, undefined, ['local_journal_read_failed']);
  expect(failed.water.needsWater).toBeNull(); expect(failed.warnings.find(w => w.id === 'W06')?.state).toBe('unknown');
});
test('rain reception affects refill; recent moves use the explicitly stated current-setup test assumption', () => {
  const settings = localCarePreset('rainy', now);
  expect(evaluateLocalCare({ ...plant, rainReception: { soil: 'no', canopy: 'no' } }, [], settings, now).water.needsWater).toBe(true);
  expect(evaluateLocalCare({ ...plant, rainReception: { soil: 'unknown', canopy: 'unknown' } }, [], settings, now).water.needsWater).toBeNull();
  expect(evaluateLocalCare({ ...plant, locationChangedAt: makeTimestamp(new Date(now * 1000)) }, [], dry(), now).water.needsWater).toBe(true);
  expect(evaluateLocalCare({ ...plant, potSize: undefined }, [], dry(), now).water.reasonCodes).toContain('unsupported_volume_domain');
});
test('partial-hour test forcing works; ET0/rain inputs never become weather warnings', () => {
  const result = evaluateLocalCare(plant, [], { ...dry(), anchorUtc: now - 1800, initialReserveL: 1 }, now);
  expect(result.water.needsWater).toBe(false); expect(reserve(result)[0]).toBeCloseTo(1 - 8 * .2 / 48);
  expect(result.stormConditions).toEqual([]);
  expect(result.warnings.filter(w => w.state === 'triggered')).toEqual([]);
});
test.each([
  { status: 'archived' as const }, { deleting: true }, { environment: 'indoor' as const }, { environment: 'greenhouse' as const },
])('unsupported/inactive setup stays unavailable: %j', change => {
  expect(evaluateLocalCare({ ...plant, ...change }, [], dry(), now).water.needsWater).toBeNull();
});
test('moderate wind is not a thunderstorm; fresh provider thunderstorm IDs are required', () => {
  const raw = { current: { dt: now, temp: 20, humidity: 54, wind_speed: 5, wind_gust: 8, weather: [{ id: 800 }] }, hourly: [] };
  expect(evaluateLocalCare(plant, [], dry(), now, raw, now).stormConditions).toEqual([]);
  const storm = { ...raw, current: { ...raw.current, weather: [{ id: 211 }] } };
  expect(evaluateLocalCare(plant, [], dry(), now, storm, now).stormConditions).toHaveLength(1);
  expect(evaluateLocalCare(plant, [], dry(), now, storm, now - 1800).stormConditions).toEqual([]);
  expect(evaluateLocalCare(plant, [], dry(), now, storm, now + 1).stormConditions).toEqual([]);
});
