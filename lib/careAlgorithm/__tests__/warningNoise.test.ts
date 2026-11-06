import { evaluateCare } from '../evaluate';
import { weatherCards } from '../weatherCards';
import { openWeatherStormConditions } from '../stormConditions';
import { sample, setup } from './helpers';
import type { WeatherSample } from '../types';
import type { WarningWindow } from '../warnings';
import { normalizeOpenWeather } from '../adapters';
import { rawWeatherRevision, weatherWarningWindows } from '../../../functions/src/careWeather';

const now = 7200;
const point = { valid_start_utc: now, valid_end_utc: now, kind: 'current_point', time_support: 'point' } as const;
function evaluate(rows: WeatherSample[], windows?: WarningWindow[]) {
  const e = evaluateCare({ setup, profile: null, evaluationUtc: now, nextEvaluationUtc: 10000, policyVersion: 'test',
    warningWindows: windows ?? [{ phase: 'current', startUtc: 3600, endUtc: now, completeVariables: [], samples: rows }] });
  e.weatherPreparationEnabled = true; return e;
}
const windCases = [0, 3, 5, 7, 9.999, 10, 10.001, 14].flatMap(speed => [0, 5, 10, 14.999, 15, 15.001].map(gust => ({ speed, gust })));
test.each(windCases)('wind $speed m/s and gust $gust m/s cannot invent a thunderstorm or unnecessary wind card', ({ speed, gust }) => {
  const e = evaluate([sample('wind_speed_ms', speed, point), sample('wind_gust_ms', gust, point)]);
  const cards = weatherCards('plant', e, now);
  const crosses = speed >= 10 || gust >= 15;
  expect(e.warnings.find(w => w.id === 'W03')?.state === 'triggered').toBe(crosses);
  expect(cards).toHaveLength(crosses ? 1 : 0);
  expect(cards.some(c => c.metrics.hazard === 'thunderstorm')).toBe(false);
  if (crosses) expect(cards[0].title).toBe('Wind preparation');
});
const rainCases = [0, .1, 2, 5, 9.999, 10, 10.001].flatMap(rate => [0, .1, 2, 10, 24.999, 25, 25.001].map(amount => ({ rate, amount })));
test.each(rainCases)('rate $rate mm/h and known amount $amount mm require their own rain threshold, never a storm', ({ rate, amount }) => {
  const e = evaluate([sample('rain_rate_mm_h', rate, { ...point, time_support: 'rate' }),
    sample('liquid_rain_mm', amount, { valid_start_utc: 3600, valid_end_utc: now })]);
  const cards = weatherCards('plant', e, now);
  const crosses = rate >= 10 || amount >= 25;
  expect(e.warnings.find(w => w.id === 'W04')?.state === 'triggered').toBe(crosses);
  expect(cards).toHaveLength(crosses ? 1 : 0);
  if (crosses) expect(cards[0].title).toBe('Heavy rain reported');
  expect(cards.some(c => c.metrics.hazard === 'thunderstorm')).toBe(false);
});
test.each([0, 1, 3, 5, 7])('medium wind %s m/s plus ordinary rain cannot combine into a storm warning', speed => {
  const e = evaluate([sample('wind_speed_ms', speed, point), sample('wind_gust_ms', speed + 3, point),
    sample('rain_rate_mm_h', 2, { ...point, time_support: 'rate' }), sample('liquid_rain_mm', 2)]);
  e.stormConditions = openWeatherStormConditions({ current: { dt: now, wind_speed: speed, weather: [{ id: 500, description: 'stormy weather' }] } },
    { sourceRevision: 'r1', locationRevision: 1, availableUtc: now }, now, 900, 86400);
  expect(weatherCards('plant', e, now)).toEqual([]);
});
test('explicit thunderstorm evidence still warrants lightning preparation with modest wind', () => {
  const e = evaluate([sample('wind_speed_ms', 5, point), sample('wind_gust_ms', 7, point)]);
  e.stormConditions = openWeatherStormConditions({ current: { dt: now, weather: [{ id: 210 }] } },
    { sourceRevision: 'r1', locationRevision: 1, availableUtc: now }, now, 900, 86400);
  const cards = weatherCards('plant', e, now);
  expect(cards).toHaveLength(1); expect(cards[0].title).toBe('Thunderstorm reported');
  expect(e.warnings.find(w => w.id === 'W03')?.state).not.toBe('triggered');
});
test.each([NaN, Infinity, -1, '36', true, null])('invalid wind %s cannot become a warning by coercion or coverage declaration', value => {
  const rows = [sample('wind_speed_ms', value as number, point), sample('wind_gust_ms', value as number, point)];
  const e = evaluate(rows, [{ phase: 'current', startUtc: 3600, endUtc: now, completeVariables: ['wind_speed_ms', 'wind_gust_ms'], samples: rows }]);
  expect(weatherCards('plant', e, now)).toEqual([]);
});
test('km/h values cannot be read as m/s', () => {
  const badUnit = sample('wind_speed_ms', 25, { ...point, unit: 'km/h' });
  expect(weatherCards('plant', evaluate([badUnit]), now)).toEqual([]);
});
test.each([
  [31.999, false, false], [32, true, false], [32.001, true, false], [5.001, false, false], [5, false, true], [4.999, false, true],
] as const)('temperature %s C crosses only its own documented boundary', (temperature, heat, cold) => {
  const e = evaluate([sample('air_temperature_c', temperature, point)]);
  const cards = weatherCards('plant', e, now);
  expect(e.warnings.find(w => w.id === 'W01')?.state === 'triggered').toBe(heat);
  expect(e.warnings.find(w => w.id === 'W02')?.state === 'triggered').toBe(cold);
  expect(cards).toHaveLength(heat || cold ? 1 : 0);
});
test.each([60, 70, 89.999, 90, 90.001])('RH %s percent produces only supported informational context, never a mildew/storm warning', humidity => {
  const e = evaluate([sample('air_rh_pct', humidity, { valid_start_utc: 3600, valid_end_utc: now, time_support: 'interval_mean' })]);
  const cards = weatherCards('plant', e, now);
  expect(cards).toHaveLength(humidity >= 90 ? 1 : 0);
  expect(cards.every(c => c.kind === 'weatherContext' && c.severity === 'info')).toBe(true);
  expect(e.warnings.find(w => w.id === 'W10')?.state).toBe('disabled');
});
test('current evidence takes precedence over a forecast regardless of input-window order', () => {
  const rows = [sample('wind_speed_ms', 10, point)];
  const forecast: WarningWindow = { phase: 'forecast24h', startUtc: now, endUtc: now + 3600, completeVariables: [],
    samples: [sample('wind_speed_ms', 20, { kind: 'forecast', time_support: 'point', valid_start_utc: now + 3600, valid_end_utc: now + 3600 })] };
  const current: WarningWindow = { phase: 'current', startUtc: 3600, endUtc: now, completeVariables: [], samples: rows };
  expect(weatherCards('plant', evaluate([], [forecast, current]), now)[0].title).toBe('Wind preparation');
});
test('elapsed forecast cannot remain labelled upcoming and adding current evidence does not duplicate storm cards', () => {
  const e = evaluate([]);
  const scope = { sourceRevision: 'r1', locationRevision: 1, availableUtc: now };
  e.stormConditions = openWeatherStormConditions({ hourly: [{ dt: 7300, weather: [{ id: 211 }] }] }, scope, now, 900, 86400);
  expect(weatherCards('plant', e, 7300)).toEqual([]);
  e.stormConditions.push(...openWeatherStormConditions({ current: { dt: now, weather: [{ id: 211 }] }, hourly: [{ dt: 8000, weather: [{ id: 211 }] }] }, scope, now, 900, 86400));
  expect(weatherCards('plant', e, now)).toHaveLength(1);
});
test('current-source evidence expires exactly at its policy deadline, even with a fresh acquisition cache', () => {
  const raw = { current: { dt: now, temp: 40, humidity: 70, wind_speed: 20, weather: [{ id: 211 }] } };
  const revision = rawWeatherRevision(raw);
  const samples = normalizeOpenWeather(raw, 'onecall_metric', { retrievedUtc: now, firstAvailableUtc: now, sourceRevision: revision,
    locationRevision: 1, modelSelection: 'provider_unspecified' }).samples;
  const policy = { enabled: true, version: 'test', product: 'onecall_metric', maxAcquisitionAgeSeconds: 3600, maxCurrentAgeSeconds: 900,
    maxForecastLeadSeconds: 86400, requestTimeoutMs: 1000, licensingEvidenceId: 'test', adapterReviewId: 'test', retryAfterSeconds: 60, retentionSeconds: 86400, maxRequestsPerDay: 1 } as const;
  const record = { schemaVersion: 1, policyVersion: 'test', revision, firstAvailableUtc: now, retrievedUtc: now, coordinates: { lat: 0, lng: 0 }, locationRevision: 1, raw, samples } as const;
  expect(weatherWarningWindows(record, policy, now + 899)).toHaveLength(1);
  expect(weatherWarningWindows(record, policy, now + 900)).toEqual([]);
});
