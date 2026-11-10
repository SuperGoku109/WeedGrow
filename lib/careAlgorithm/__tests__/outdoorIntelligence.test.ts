import { evaluateOutdoorCare, recommendationSignature } from '../outdoorIntelligence';
import { careConfiguration, OUTDOOR_POLICY } from '../outdoorContext';
import { planCareNotifications } from '../careNotifications';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import type { PlantLog } from '@/firestoreModels';
import type { WeatherSample } from '../types';
const now = Date.parse('2026-11-09T12:00:00Z') / 1000;
const plant = makePlantSummary({ rainReception: { soil: 'yes', canopy: 'yes' }, sunlightExposure: 'Full sun', locationTimeZone: 'Africa/Johannesburg' });
function observation(state: 'DRY' | 'MOIST' | 'WET', hours = 1, id = String(hours)): PlantLog {
  return { id, type: 'note', category: 'health', timestamp: makeTimestamp(new Date((now - hours * 3600) * 1000)), updatedBy: 'owner',
    moistureState: state, moistureConfiguration: careConfiguration(plant), occurrencePrecision: 'time' } as PlantLog;
}
function sample(variable: WeatherSample['variable'], value: number, hours = 1, forecast = false): WeatherSample {
  const end = now + (forecast ? hours : -hours) * 3600;
  return { schema_version: '8.4', provider: 'test', product: 'model', source_revision: '1', model_selection: 'model', model_selection_basis: 'model', location_revision: 0,
    retrieved_at_utc: now, available_at_utc: now, issued_at_utc: null, variable, value, unit: '', time_support: variable === 'liquid_rain_mm' ? 'interval_sum' : 'point',
    kind: forecast ? 'forecast' : 'occurred_estimate', valid_start_utc: variable === 'liquid_rain_mm' ? end - 3600 : end, valid_end_utc: end, quality: 'ok', reason_codes: [] };
}
function weather(temp = 30, humidity = 40, wind = 7, hours = 72): WeatherSample[] {
  return Array.from({ length: hours }, (_, i) => [sample('air_temperature_c', temp, i + 1), sample('air_rh_pct', humidity, i + 1), sample('wind_speed_ms', wind, i + 1), sample('liquid_rain_mm', 0, i + 1)]).flat();
}
const evaluate = (logs: PlantLog[] = [], samples = weather(), changes: Partial<Parameters<typeof evaluateOutdoorCare>[0]> = {}) => evaluateOutdoorCare({ plantId: plant.id, plant, logs, samples, nowUtc: now, ...changes });
const soilCode = (result: ReturnType<typeof evaluate>) => result.water.reasonCodes[0];
test.each(['DRY', 'MOIST', 'WET'] as const)('recent %s report takes precedence over fast drying', state => {
  const r = evaluate([observation(state)]);
  expect(r.water.needsWater).toBe(state === 'DRY'); expect(soilCode(r)).toBe(`recent_${state.toLowerCase()}_observation`);
  expect(r.water.evidence).toBeUndefined();
});
test('cool weather cannot suppress a dry observation', () => expect(evaluate([observation('DRY')], weather(12, 90, 1)).water.needsWater).toBe(true));
test('hot weather without observations prompts checking, never watering', () => {
  const r = evaluate(); expect(r.checkStatus).toBe('CHECK_NOW'); expect(r.water.needsWater).toBeNull(); expect(soilCode(r)).toBe('no_moisture_observation');
});
test.each(['DRY', 'MOIST', 'WET'] as const)('stale %s is historical only', state => {
  const r = evaluate([observation(state, 48)]); expect(r.water.needsWater).toBeNull(); expect(soilCode(r)).toBe('observation_stale_or_intervening_event');
});
test('recent watering pauses checks without establishing moisture', () => {
  const r = evaluate([{ ...observation('DRY'), moistureState: undefined, type: 'watering' }]);
  expect(r.checkStatus).toBe('CHECK_LATER'); expect(r.water.needsWater).toBeNull(); expect(soilCode(r)).toBe('recent_watering_check_later');
});
test('watering invalidates an earlier dry observation', () => expect(evaluate([observation('DRY', 2), { ...observation('DRY'), moistureState: undefined, type: 'watering' }]).water.needsWater).toBeNull());
test('missing weather retains direct observation guidance', () => {
  expect(evaluate([observation('DRY')], []).water.needsWater).toBe(true);
  expect(evaluate([], []).checkStatus).toBe('INSUFFICIENT_DATA'); expect(soilCode(evaluate([], []))).toBe('weather_information_incomplete');
});
test('future, malformed and contradictory reports do not establish current state', () => {
  expect(evaluate([observation('DRY', -2)]).water.needsWater).toBeNull();
  expect(evaluate([{ ...observation('DRY'), timestamp: {} as never }]).water.needsWater).toBeNull();
  expect(evaluate([observation('DRY', 1, 'a'), observation('WET', 1, 'b'), observation('DRY', 2)]).water.needsWater).toBeNull();
});
test('out of order and duplicate logs normalize deterministically', () => {
  const a = observation('MOIST', 2), b = observation('DRY', 1); expect(evaluate([b, a, b]).water).toEqual(evaluate([a, b]).water);
});
test.each(['yes', 'partial', 'no', 'unknown'] as const)('heavy rainfall preserves exposure %s and does not become watering', exposure => {
  const r = evaluate([], [...weather(), sample('liquid_rain_mm', 24, .5)], { plant: { ...plant, rainReception: { soil: exposure, canopy: exposure } } });
  expect(r.water.needsWater).toBeNull(); expect(r.checkStatus).toBe(['yes', 'partial'].includes(exposure) ? 'CHECK_LATER' : 'CHECK_NOW');
  expect(r.recommendations.find(x => x.category === 'soil-check')?.evidence.rainfallCategory).toBe('HEAVY');
});
test('light rainfall invalidates prior dry evidence without proving hydration', () => {
  const r = evaluate([observation('DRY', 2)], [...weather(), sample('liquid_rain_mm', .3, .5)]); expect(r.water.needsWater).toBeNull(); expect(r.checkStatus).toBe('CHECK_SOON');
});
test('forecast rain neither invalidates dry observation nor creates completed watering', () => {
  const r = evaluate([observation('DRY')], [...weather(), sample('liquid_rain_mm', 25, 3, true)]); expect(r.water.needsWater).toBe(true);
  expect(r.recommendations.find(x => x.category === 'heavy-rain')?.reasonCodes).toEqual(['forecast_heavy-rain']);
});
test('forecast that never happens leaves no rainfall credit', () => expect(evaluate([], weather()).checkStatus).toBe('CHECK_NOW'));
test('missing rain stays unknown', () => expect(evaluate([], weather().filter(s => s.variable !== 'liquid_rain_mm')).recommendations.find(r => r.type === 'watering')?.evidence.rainfallMm).toBeNull());
test('sustained humidity independently prompts mildew and Botrytis inspections', () => {
  const r = evaluate([], weather(22, 95, 1)); expect(r.hazards.powderyMildew).toBe('INSPECT'); expect(r.hazards.botrytis).toBe('WATCH');
  expect(r.recommendations.filter(x => x.type === 'health').map(x => x.category)).toEqual(expect.arrayContaining(['powderyMildew', 'botrytis']));
});
test('mildew signal does not require rain or imply Botrytis', () => {
  const r = evaluate([], weather(24, 87, 1)); expect(r.hazards.powderyMildew).toBe('INSPECT'); expect(r.hazards.botrytis).toBe('NO_CURRENT_SIGNAL');
});
test('an isolated humidity spike is not a sustained hazard', () => {
  const r = evaluate([], [...weather().filter(s => s.variable !== 'air_rh_pct' || s.valid_end_utc !== now - 3600), sample('air_rh_pct', 98)]);
  expect(r.hazards.powderyMildew).toBe('NO_CURRENT_SIGNAL');
});
test('repeated wet reports prompt drainage inspection, not root rot diagnosis', () => {
  const r = evaluate([observation('WET', 30), observation('WET', 1)]); expect(r.hazards.drainage).toBe('INSPECT'); expect(r.water.needsWater).toBe(false);
  expect(r.recommendations.find(x => x.category === 'drainage')?.reasonCodes).toEqual(['persistent_wet_observations']);
});
test('extreme wind forecast functions without usable watering data', () => {
  const r = evaluate([], [sample('wind_gust_ms', 24, 4, true)]); expect(r.checkStatus).toBe('INSUFFICIENT_DATA');
  expect(r.recommendations[0].category).toBe('wind'); expect(r.recommendations[0].description).toContain('Forecast');
});
test('hazards disappear when inputs no longer support them', () => {
  expect(evaluate([], weather(22, 95, 1)).hazards.powderyMildew).toBe('INSPECT'); expect(evaluate().hazards.powderyMildew).toBe('NO_CURRENT_SIGNAL');
});
test('duplicate weather rows do not inflate humidity duration or rainfall', () => expect(evaluate([], [...weather(), ...weather()])).toEqual(evaluate()));
const transitions = () => [70, 48, 26].flatMap(h => [observation('MOIST', h), observation('DRY', h - 8)]);
test.each([{ logs: [] }, { logs: [observation('MOIST', 12), observation('DRY', 4)] }])('limited history retains baseline', ({ logs }) => expect(evaluate(logs).learning.adjustment).toBe('BASELINE'));
test('repeated qualified transitions learn one bounded earlier-check step', () => {
  const r = evaluate(transitions()); expect(r.learning.qualifiedTransitions).toBe(3); expect(r.learning.adjustment).toBe('EARLIER');
});
test('configuration changes reset learning', () => {
  for (const change of [{ potSize: '50 L' }, { locationRevision: 2 }]) expect(evaluate(transitions(), weather(), { plant: { ...plant, ...change } }).learning.qualifiedTransitions).toBe(0);
});
test('missing weather or ambiguous observations cannot train timing', () => {
  expect(evaluate(transitions(), []).learning.adjustment).toBe('BASELINE');
  expect(evaluate(transitions().map(l => ({ ...l, occurrencePrecision: 'date' }))).learning.qualifiedTransitions).toBe(0);
  expect(evaluate(transitions().map(l => ({ ...l, moistureConfiguration: undefined }))).learning.qualifiedTransitions).toBe(0);
});
test('watering is never training evidence of dryness', () => expect(evaluate(transitions().map(l => ({ ...l, moistureState: undefined, type: 'watering' }))).learning.qualifiedTransitions).toBe(0));
test('learned timing never overrides a recent moist observation', () => expect(evaluate([...transitions(), observation('MOIST', 1)]).water.needsWater).toBe(false));
test('plants sharing immutable weather retain independent advice', () => {
  const shared = weather(); expect(evaluate([observation('DRY')], shared).water.needsWater).toBe(true); expect(evaluate([observation('WET')], shared).water.needsWater).toBe(false);
});
test.each(['indoor', 'greenhouse'] as const)('unsupported %s has no outdoor recommendations', environment => expect(evaluate([], weather(), { plant: { ...plant, environment } }).recommendations).toEqual([]));
test('stale, delayed, future-acquired and invalid weather does not generate hazards', () => {
  for (const samples of [weather().map(s => ({ ...s, retrieved_at_utc: now - 3600 })), weather().map(s => ({ ...s, available_at_utc: now + 10 })), weather().map(s => ({ ...s, value: NaN }))]) expect(evaluate([], samples).drying).toBe('UNKNOWN');
});
test('UTC elapsed time works across local midnight and timezone changes', () => {
  const logs = [observation('MOIST')];
  expect(evaluate(logs, weather(), { plant: { ...plant, locationTimeZone: 'America/New_York' } }).water.needsWater).toBe(false);
  expect(evaluate(logs, weather(), { nowUtc: now + 86400 }).water.needsWater).toBeNull();
});
test('unchanged evaluation is deterministic and produces one soil action', () => {
  const logs = [observation('MOIST')]; expect(evaluate(logs)).toEqual(evaluate(logs)); expect(evaluate(logs).recommendations.filter(r => r.type === 'watering')).toHaveLength(1);
});
test('notification planner ignores refreshes, expires results and detects meaningful changes', () => {
  const recommendations = evaluate([], [sample('wind_gust_ms', 20, 4, true)]).recommendations;
  const initial = planCareNotifications(recommendations, {}, now); expect(initial.send).toHaveLength(1);
  expect(planCareNotifications(recommendations.map(r => ({ ...r, generatedAt: now + 1 })), initial.signatures, now + 1).send).toEqual([]);
  expect(planCareNotifications(recommendations, {}, now + 3600).send).toEqual([]);
  const changed = { ...recommendations[0], priority: 'MEDIUM' as const }; expect(recommendationSignature(changed)).not.toBe(recommendationSignature(recommendations[0]));
});
test('history read failure suppresses soil claims but retains wind preparation', () => {
  const r = evaluate([observation('DRY')], [sample('wind_gust_ms', 20, 3, true)], { historyReliable: false });
  expect(r.water.needsWater).toBeNull(); expect(soilCode(r)).toBe('journal_history_unavailable'); expect(r.recommendations[0].category).toBe('wind');
});
test('configurable freshness policy changes observation lifetime', () => expect(evaluate([observation('DRY', 3)], weather(), { policy: { ...OUTDOOR_POLICY, fastFreshnessHours: 2 } }).water.needsWater).toBeNull());

test('interrupted wet observations do not imply prolonged saturated soil', () => expect(evaluate([observation('WET', 30), observation('MOIST', 3), observation('WET', 1)]).hazards.drainage).toBe('NO_CURRENT_SIGNAL'));
test('inspection usefulness is retained as plant-specific evidence without overriding soil', () => {
  const r = evaluate([{ ...observation('MOIST'), inspectionFeedback: 'too_early' }]);
  expect(r.learning.feedback.too_early).toBe(1); expect(r.water.needsWater).toBe(false); expect(r.learning.adjustment).toBe('BASELINE');
});
test('WET to MOIST transitions are tracked without treating them as dryness', () => {
  const r = evaluate([observation('WET', 12), observation('MOIST', 1)]);
  expect(r.learning.wetToMoistTransitions).toBe(1); expect(r.learning.adjustment).toBe('BASELINE');
});
test('cumulative forecast rain is a preparation prompt, never completed watering', () => {
  const r = evaluate([observation('DRY')], [...weather(), ...Array.from({ length: 12 }, (_, i) => sample('liquid_rain_mm', 2, i + 2, true))]);
  expect(r.recommendations.find(x => x.category === 'heavy-rain')?.reasonCodes).toEqual(['forecast_heavy-rain']); expect(r.water.needsWater).toBe(true);
});
test('sharp forecast temperature changes remain independent of soil observations', () => {
  const r = evaluate([observation('MOIST')], [...weather(), sample('air_temperature_c', 12, 4, true)]);
  expect(r.recommendations.find(x => x.category === 'temperature-change')?.reasonCodes).toEqual(['forecast_severe_temperature_change']); expect(r.water.needsWater).toBe(false);
});
test('historical rainfall interrupts older learning pairs, not only todays pairs', () => {
  const samples = weather().map(s => s.variable === 'liquid_rain_mm' && s.valid_end_utc === now - 66 * 3600 ? { ...s, value: 5 } : s);
  expect(evaluate(transitions(), samples).learning.qualifiedTransitions).toBe(2);
});
test('an incomplete humidity window cannot establish absence of a disease signal', () => {
  expect(evaluate([], [sample('air_rh_pct', 40), sample('air_temperature_c', 22)]).hazards.powderyMildew).toBe('UNKNOWN');
});
test('humidity weather alerts remain independent of mildew temperature requirements', () => {
  const r = evaluate([], weather(8, 88, 1));
  expect(r.hazards.powderyMildew).toBe('NO_CURRENT_SIGNAL');
  expect(r.recommendations.find(x => x.category === 'humidity')?.reasonCodes).toEqual(['sustained_humidity']);
});
