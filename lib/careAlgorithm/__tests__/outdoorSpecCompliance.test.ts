import { evaluateLocalCare, defaultLocalCareSettings } from '../localCare';
import { meteoFixture } from '@/lib/weather/__tests__/meteoFixture';
import { openMeteoWeatherResponse } from '@/lib/weather/openMeteo';
import { evaluateOutdoorCare } from '../outdoorIntelligence';
import { careConfiguration, careEventWindow } from '../outdoorContext';
import { planCareNotifications } from '../careNotifications';
import { makePlantSummary, makeTimestamp } from '@/lib/suggestions/__tests__/fixtures';
import type { PlantLog } from '@/firestoreModels';
import type { WeatherSample } from '../types';
const now = Date.parse('2026-11-10T12:00:00Z') / 1000;
const plant = makePlantSummary({ potSize: '10 L', sunlightExposure: 'Full sun', locationTimeZone: 'Africa/Johannesburg', rainReception: { soil: 'yes', canopy: 'yes' } });
function row(variable: WeatherSample['variable'], value: number, hours = -1): WeatherSample {
  const at = now + hours * 3600;
  return { schema_version: '8.4', provider: 'test-model', product: 'model-history', source_revision: '1', model_selection: 'fixture', model_selection_basis: 'test',
    location_revision: 0, retrieved_at_utc: now, available_at_utc: now, issued_at_utc: null, variable, value,
    unit: variable === 'air_temperature_c' ? '°C' : variable === 'air_rh_pct' ? '%' : variable === 'liquid_rain_mm' ? 'mm' : 'm/s',
    time_support: variable === 'liquid_rain_mm' ? 'interval_sum' : 'point', kind: hours > 0 ? 'forecast' : 'occurred_estimate',
    valid_start_utc: variable === 'liquid_rain_mm' ? at - 3600 : at, valid_end_utc: at, quality: 'ok', reason_codes: [] };
}
const weather = () => Array.from({ length: 120 }, (_, i) => [row('air_temperature_c', 24, -i - 1), row('air_rh_pct', 60, -i - 1), row('wind_speed_ms', 2, -i - 1), row('liquid_rain_mm', 0, -i - 1)]).flat();
const observation = (state: 'DRY' | 'MOIST' | 'WET', hours: number, id = String(hours)) => ({ id, type: 'note', category: 'health', moistureState: state,
  occurrencePrecision: 'time', moistureConfiguration: careConfiguration(plant), timestamp: makeTimestamp(new Date((now - hours * 3600) * 1000)), updatedBy: 'owner' }) as PlantLog;
const evaluate = (logs: PlantLog[] = [], samples = weather(), overrides: Partial<Parameters<typeof evaluateOutdoorCare>[0]> = {}) => evaluateOutdoorCare({ plantId: plant.id, plant, logs, samples, nowUtc: now, ...overrides });

describe.each([-1, 3])('wind preparation with signal offset %s hours', hours => {
  test.each([
    [10, 20, false], [25, 40, false], [36, 54, false],
    [39.999, 59.999, false], [40, 0, true], [0, 60, true], [45, 65, true],
  ])('sustained %s km/h and gust %s km/h => warning %s', (speed, gust, expected) => {
    const result = evaluate([], [row('wind_speed_ms', speed / 3.6, hours), row('wind_gust_ms', gust / 3.6, hours)]);
    expect(result.recommendations.some(r => r.category === 'wind')).toBe(expected);
  });
});
test('a light breeze now can coexist with an explicitly labelled stronger forecast', () => {
  const result = evaluate([], [row('wind_speed_ms', 2), row('wind_gust_ms', 60 / 3.6, 3)]);
  const wind = result.recommendations.find(r => r.category === 'wind')!;
  expect(wind.description).toContain('Forecast gusts of 60 km/h within the next 24 hours');
  expect(wind.evidence.startUtc).toBe(now + 3 * 3600);
});
test('recent wind is labelled as reported, while stale, wrong-location and distant forecasts stay silent', () => {
  expect(evaluate([], [row('wind_speed_ms', 40 / 3.6)]).recommendations.find(r => r.category === 'wind')?.description).toContain('Recently reported sustained wind of 40 km/h');
  const badSignals = [row('wind_gust_ms', 30, 25), row('wind_gust_ms', 30, -7),
    { ...row('wind_gust_ms', 30, 3), retrieved_at_utc: now - 3600 },
    { ...row('wind_gust_ms', 30, 3), location_revision: 99 }];
  for (const signal of badSignals) expect(evaluate([], [signal]).recommendations.some(r => r.category === 'wind')).toBe(false);
});

test('qualified learning actually advances the next check while soil guidance remains moist', () => {
  const latest = observation('MOIST', 20);
  const history = [100, 70, 40].flatMap(h => [observation('MOIST', h), observation('DRY', h - 8)]);
  expect(evaluate([latest]).checkStatus).toBe('CHECK_SOON');
  const learned = evaluate([...history, latest]);
  expect(learned.learning.adjustment).toBe('EARLIER'); expect(learned.checkStatus).toBe('CHECK_NOW'); expect(learned.water.needsWater).toBe(false);
  expect(learned.water.estimate?.explanation).toContain('previous');
});
test('upcoming hot windy weather advances checks without overriding a moist report', () => {
  const baseline = evaluate([observation('MOIST', 1)]);
  const planned = evaluate([observation('MOIST', 1)], [...weather(), row('air_temperature_c', 34, 4), row('air_rh_pct', 30, 4), row('wind_speed_ms', 8, 4)]);
  expect(baseline.checkStatus).toBe('CHECK_LATER'); expect(planned.checkStatus).toBe('CHECK_SOON'); expect(planned.water.needsWater).toBe(false);
  expect(planned.water.estimate?.explanation).toContain('Forecast');
});
test('failed journal read cannot leave a dry-soil title or confirmation action', () => {
  const result = evaluate([observation('DRY', 1)], weather(), { historyReliable: false });
  const card = result.recommendations.find(r => r.type === 'watering')!;
  expect(card.title).toBe('Check soil moisture'); expect(card.action).toBe('CHECK_SOIL'); expect(card.evidence.latestObservation).toBeNull();
});
test('old humidity runs cannot masquerade as ongoing mildew conditions', () => {
  const samples = weather().map(s => s.variable === 'air_rh_pct' && s.valid_end_utc <= now - 12 * 3600 && s.valid_end_utc > now - 21 * 3600 ? { ...s, value: 96 } : s);
  expect(evaluate([], samples).hazards.powderyMildew).toBe('NO_CURRENT_SIGNAL');
});
test('duplicate and conflicting weather revisions are independent of input order', () => {
  const a = row('wind_gust_ms', 2, 3), b = { ...a, value: 25, retrieved_at_utc: now - 10, available_at_utc: now - 10 };
  expect(evaluate([], [a, b])).toEqual(evaluate([], [b, a]));
});
test('unknown wind gusts cannot establish absence of weather exposure', () => expect(evaluate([], [row('air_rh_pct', 50)]).hazards.exposure).toBe('UNKNOWN'));
test('date-only watering cannot pretend to have occurred at its placeholder noon timestamp', () => {
  const log = { ...observation('MOIST', 2), type: 'watering' as const, moistureState: undefined, occurrencePrecision: 'date' as const, calendarDay: '2026-11-10', timeZone: 'Africa/Johannesburg' };
  const r = evaluate([observation('DRY', 1), log]); expect(r.water.needsWater).toBeNull();
});
test('material wind escalation is a meaningful notification change', () => {
  const first = evaluate([], [row('wind_gust_ms', 18, 3)]).recommendations;
  const previous = planCareNotifications(first, {}, now).signatures;
  expect(planCareNotifications(evaluate([], [row('wind_gust_ms', 30, 3)]).recommendations, previous, now).send).toHaveLength(1);
});
test('notification rate limits do not mark unsent recommendations as delivered', () => {
  const recs = Array.from({ length: 5 }, (_, i) => ({ ...evaluate([], [row('wind_gust_ms', 20, 3)]).recommendations[0], id: `plant-${i}:wind`, plantId: `plant-${i}` }));
  const first = planCareNotifications(recs, {}, now); expect(first.send).toHaveLength(3);
  expect(planCareNotifications(recs, first.signatures, now).send).toHaveLength(2);
});

test('changing pot configuration prompts a new check instead of inheriting an old moist schedule', () => {
  const r = evaluate([observation('MOIST', 1)], weather(), { plant: { ...plant, potSize: '40 L' } });
  expect(r.checkStatus).toBe('CHECK_NOW'); expect(r.water.needsWater).toBeNull();
});
test('forecast conditions never postpone an already relevant soil check', () => {
  expect(evaluate([], [...weather(), row('wind_gust_ms', 25, 4)]).checkStatus).toBe('CHECK_NOW');
});
test('repeated moist checks can extend timing by one bounded step', () => {
  const history = [100, 64, 28, 1].map(h => observation('MOIST', h));
  const baseline = evaluate([history.at(-1)!]); const learned = evaluate(history);
  expect(learned.learning.adjustment).toBe('LATER'); expect(learned.nextCheckUtc! - baseline.nextCheckUtc!).toBe(6 * 3600); expect(learned.water.needsWater).toBe(false);
});
test('an intervening weather gap excludes a training pair even when its ending weather is available', () => {
  const history = [100, 70, 40].flatMap(h => [observation('MOIST', h), observation('DRY', h - 8)]);
  const samples = weather().filter(s => !(s.variable === 'wind_speed_ms' && s.valid_end_utc === now - 96 * 3600));
  expect(evaluate(history, samples).learning.qualifiedTransitions).toBe(2);
});
test('user-confirmed rainfall stays separate from API rain and completed watering', () => {
  const rain = { ...observation('MOIST', 1), moistureState: undefined, rainfallObservation: 'HEAVY' as const };
  const r = evaluate([observation('DRY', 2), rain]);
  expect(r.water.needsWater).toBeNull(); expect(r.checkStatus).toBe('CHECK_LATER'); expect(r.lastWateringUtc).toBeNull();
  const evidence = r.recommendations.find(x => x.type === 'watering')!.evidence;
  expect(evidence.rainfallMm).toBe(0); expect(evidence.userConfirmedRain).toEqual([expect.objectContaining({ category: 'HEAVY', source: 'user_confirmed' })]);
});
test('rain no longer defers checks after its configured short planning pause', () => {
  const samples = weather().map(s => s.variable === 'liquid_rain_mm' && s.valid_end_utc === now - 20 * 3600 ? { ...s, value: 10 } : s);
  expect(evaluate([], samples).checkStatus).toBe('CHECK_NOW');
});
test('recent low-risk point readings do not double-count one hour as multiple weather observations', () => {
  const samples = [row('air_temperature_c', 30), row('air_rh_pct', 30), row('wind_speed_ms', 8)].flatMap(s => [s, { ...s, kind: 'current_point' as const }, { ...s, kind: 'current_point' as const, valid_end_utc: s.valid_end_utc + 1200, valid_start_utc: s.valid_start_utc + 1200 }]);
  expect(evaluate([], samples).drying).toBe('UNKNOWN');
});
test('a recent completed inspection reduces repeat inspection prompts without declaring health', () => {
  const samples = weather().map(s => s.variable === 'air_rh_pct' ? { ...s, value: 87 } : s);
  const r = evaluate([{ ...observation('MOIST', 1), careCheck: 'powderyMildew', inspectionResult: 'no_symptoms' }], samples);
  expect(r.hazards.powderyMildew).toBe('WATCH'); expect(r.recommendations.find(x => x.category === 'powderyMildew')?.priority).toBe('LOW');
});
test('notification memory survives unknown weather and clears only a confirmed resolution', () => {
  const recs = evaluate([], [row('wind_gust_ms', 20, 3)]).recommendations;
  const previous = planCareNotifications(recs, {}, now).signatures;
  const unknown = planCareNotifications([], previous, now + 1, []);
  expect(planCareNotifications(recs, unknown.signatures, now + 2, []).send).toHaveLength(0);
  const cleared = planCareNotifications([], previous, now + 1, [recs[0].id]);
  expect(planCareNotifications(recs, cleared.signatures, now + 2, []).send).toHaveLength(1);
});
test('the strongest credible forecast is not hidden behind a weaker observed wind signal', () => {
  const r = evaluate([], [row('wind_gust_ms', 18), row('wind_gust_ms', 30, 3)]);
  expect(r.recommendations[0].evidence.value).toBe(30); expect(r.recommendations[0].reasonCodes).toEqual(['forecast_wind']);
});

test('elapsed cached forecast rain is not credited as observed rainfall without a new acquisition', () => {
  const retrieved = now - 1800, native = meteoFixture(retrieved);
  native.hourly.rain[native.hourly.time.indexOf(now)] = 25;
  const raw = openMeteoWeatherResponse(native, retrieved * 1000);
  const logs = [observation('DRY', .25)];
  const evaluation = evaluateLocalCare(plant, logs, { ...defaultLocalCareSettings(now), enabled: true }, now, raw, retrieved, [], { basis: [] });
  expect(evaluation.water.needsWater).toBe(true);
  expect(evaluation.outdoor!.recommendations.find(r => r.type === 'watering')!.evidence.rainfallMm).toBe(0);
  const updated = evaluateLocalCare(plant, logs, { ...defaultLocalCareSettings(now), enabled: true }, now, openMeteoWeatherResponse(native, now * 1000), now, [], { basis: [] });
  expect(updated.water.needsWater).toBeNull();
});
test.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('date-only care respects the %s daylight-saving day', (day, hours) => {
  const evaluation = Date.parse(day + 'T00:00:00Z') / 1000 + 48 * 3600;
  const log = { ...observation('MOIST', 1), occurrencePrecision: 'date' as const, calendarDay: day, timeZone: 'America/New_York' };
  const window = careEventWindow(log, plant, evaluation)!; expect((window.end - window.start) / 3600).toBe(hours);
});
test('recommendations based on a soil report expire when that report becomes stale', () => {
  const r = evaluate([observation('MOIST', 23.9)]);
  expect(r.recommendations.find(x => x.type === 'watering')!.expiresAt).toBe(now + .1 * 3600);
});
test('strong sustained wind is actionable even when gust data is missing', () => {
  expect(evaluate([], [row('wind_speed_ms', 20, 3)]).recommendations[0].category).toBe('wind');
});
test('the latest corrected log revision wins independently of query order', () => {
  const old = { ...observation('DRY', 1, 'same'), editedAt: makeTimestamp(new Date((now - 300) * 1000)) };
  const corrected = { ...old, moistureState: 'MOIST' as const, editedAt: makeTimestamp(new Date((now - 100) * 1000)) };
  expect(evaluate([old, corrected]).water.needsWater).toBe(false); expect(evaluate([old, corrected])).toEqual(evaluate([corrected, old]));
});
test('stale dry reports prompt a check now, rather than repeatedly postponing it', () => expect(evaluate([observation('DRY', 48)]).checkStatus).toBe('CHECK_NOW'));
test('new rain does not erase an independent persistent wet-soil inspection signal', () => {
  const r = evaluate([observation('WET', 30), observation('WET', 1)], [...weather(), row('liquid_rain_mm', .5, -.5)]);
  expect(r.water.needsWater).toBeNull(); expect(r.hazards.drainage).toBe('INSPECT');
});
test('duplicate corrected feedback cannot make personalization evidence depend on row order', () => {
  const old = { ...observation('MOIST', 1, 'same'), inspectionFeedback: 'too_early' as const, editedAt: makeTimestamp(new Date((now - 300) * 1000)) };
  const corrected = { ...old, inspectionFeedback: 'useful' as const, editedAt: makeTimestamp(new Date((now - 100) * 1000)) };
  expect(evaluate([old, corrected])).toEqual(evaluate([corrected, old])); expect(evaluate([old, corrected]).learning.feedback.useful).toBe(1);
});
test('local anomalies compare the same local hours instead of a full-day average', () => {
  const samples = weather().map(s => s.variable === 'air_temperature_c' ? { ...s, value: new Date(s.valid_end_utc * 1000).getUTCHours() >= 6 && new Date(s.valid_end_utc * 1000).getUTCHours() <= 12 ? 27 : 10 } : s);
  expect(evaluate([], samples).recommendations.some(r => r.category === 'temperature-anomaly')).toBe(false);
  const warmer = [...samples, row('air_temperature_c', 25, 6)]; // future 18:00, recent same-hour baseline 10 C
  expect(evaluate([], warmer).recommendations.find(r => r.category === 'temperature-anomaly')?.reasonCodes).toEqual(['forecast_local_warm_anomaly']);
});
test('a date-only event respects its original recording cap instead of invalidating a newer observation', () => {
  const log = { ...observation('MOIST', 2), type: 'watering' as const, moistureState: undefined, occurrencePrecision: 'date' as const,
    calendarDay: '2026-11-10', timeZone: 'Africa/Johannesburg', recordedAt: makeTimestamp(new Date((now - 3 * 3600) * 1000)) };
  expect(evaluate([log, observation('DRY', 1)]).water.needsWater).toBe(true);
});
test('legacy timestamp-only watering still influences checks using an uncertain day window', () => {
  const log = { type: 'watering', timestamp: makeTimestamp(new Date((now - 2 * 3600) * 1000)), updatedBy: 'owner' } as PlantLog;
  expect(evaluate([log, observation('DRY', 1)]).water.needsWater).toBeNull();
});
test('a future or contradictory issue timestamp cannot supply usable forecast weather', () => {
  expect(evaluate([], [{ ...row('wind_gust_ms', 25, 3), issued_at_utc: now + 1 }]).recommendations.some(r => r.type === 'weather')).toBe(false);
});
