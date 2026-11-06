import { openWeatherStormConditions, type StormCondition } from '../stormConditions';
import { evaluateCare } from '../evaluate';
import { weatherCards } from '../weatherCards';
import { activeSourceEvents, type SourceEvent } from '../sourceEvents';
import { deliveryRoute } from '../delivery';
import { sample, setup, profile, scenario, source } from './helpers';

const scope = { sourceRevision: 'provider-r1', locationRevision: 1, availableUtc: 7200 };
const decode = (raw: unknown) => openWeatherStormConditions(raw, scope, 7200, 900, 86400);
const rawRow = (id: unknown, dt = 10800) => ({ dt, weather: [{ id, main: 'Thunderstorm', description: 'hail, flooding and crop damage' }] });
test.each([200, 201, 202, 210, 211, 212, 221, 230, 231, 232])('documented OpenWeather code %s supports thunderstorm preparation only', code => {
  expect(decode({ hourly: [rawRow(code)] })).toEqual([{ ...scope, hazard: 'thunderstorm', code, phase: 'forecast24h', validUtc: 10800 }]);
});
test.each([800, 801, 500, 511, 600, 771, 781, 906, 209, '211', null, true])('code %s and scary description cannot invent hail or a thunderstorm', code => {
  expect(decode({ hourly: [rawRow(code)] })).toEqual([]);
});
test.each([
  ['current', 7200, 1], ['current', 6300, 0], ['current', 6299, 0], ['current', 7201, 0],
  ['hourly', 7200, 0], ['hourly', 7199, 0], ['hourly', 7201, 1], ['hourly', 93600, 1], ['hourly', 93601, 0],
] as const)('%s condition at %s respects current age/forecast boundaries', (path, dt, count) => {
  expect(decode(path === 'current' ? { current: rawRow(211, dt) } : { hourly: [rawRow(211, dt)] })).toHaveLength(count);
});
test('all condition entries are checked, retries deduplicate and invalid rows stay independent', () => {
  const row = { dt: 10800, weather: [{ id: 800 }, { id: 211 }] };
  expect(decode({ hourly: [null, { dt: '10800', weather: [{ id: 211 }] }, row, row] })).toHaveLength(1);
  expect(decode({ hourly: Array.from({ length: 97 }, () => row), current: rawRow(211, 7200) })).toHaveLength(1);
  expect(openWeatherStormConditions({ current: rawRow(211, 7200) }, { ...scope, availableUtc: 7201 }, 7200, 900, 86400)).toEqual([]);
});

const pmCases = [12, 22, 36].flatMap(temperature => [0, 30, 60, 89, 90, 100, null].flatMap(humidity => [0, 1].map(rain => ({ temperature, humidity, rain }))));
test.each(pmCases)('PM case T=$temperature C RH=$humidity rain=$rain: ambient data cannot diagnose or clear disease', ({ temperature, humidity, rain }) => {
  const hourly = { valid_start_utc: 3600, valid_end_utc: 7200 };
  const rows = [sample('et0_mm', 2, hourly), sample('liquid_rain_mm', rain, hourly),
    sample('air_rh_pct', humidity, { ...hourly, time_support: 'interval_mean' }),
    sample('air_temperature_c', temperature, { time_support: 'point', valid_start_utc: 7200, valid_end_utc: 7200 })];
  const e = evaluateCare({ setup: { ...setup, stage: 'flowering' }, profile: { ...profile, domain: { ...profile.domain, stages: ['flowering'] } },
    evaluationUtc: 7200, nextEvaluationUtc: 8000, policyVersion: 'test',
    warningWindows: [{ phase: 'current', startUtc: 3600, endUtc: 7200, completeVariables: ['air_rh_pct', 'liquid_rain_mm'], samples: rows }] });
  e.weatherPreparationEnabled = true;
  expect(e.warnings.find(w => w.id === 'W10')).toMatchObject({ state: 'disabled', reasonCodes: ['predictive_disease_not_validated'] });
  expect(e.warnings.find(w => w.id === 'W07')?.state).not.toBe('triggered');
  expect(weatherCards('plant', e, 7300).some(card => ['powderyMildew', 'rootRot'].includes(card.kind))).toBe(false);
  // Independently supported bank calculation: 1 - 2*.2 + rain*.08 = .60/.68 L, both below .8 L.
  const approved = { ...profile, domain: { ...profile.domain, stages: ['flowering'] }, scenarios: [scenario] };
  const water = evaluateCare({ evaluationUtc: 7200, nextEvaluationUtc: 8000, policyVersion: 'test', setup: { ...setup, stage: 'flowering' }, profile: approved, warningWindows: [],
    approvedProfiles: { [`${approved.id}@${approved.version}`]: { profile: approved, approvalRecordId: 'TEST-ONLY' } },
    replay: { anchorUtc: 3600, anchored: true, weather: rows, et0Source: source, rainSource: source, events: [] } });
  expect(water.water.needsWater).toBe(true);
  expect(water.water.evidence?.scenarios[0].reserveL[0]).toBeCloseTo(.6 + rain * .08, 10);
});

function evaluation(conditions: StormCondition[]) {
  const e = evaluateCare({ setup, evaluationUtc: 7200, profile: null, policyVersion: 'test', nextEvaluationUtc: 8000, warningWindows: [] });
  e.weatherPreparationEnabled = true; e.stormConditions = conditions; return e;
}
test('storm conditions produce scoped, deduplicated preparation cards without changing water or disease', () => {
  const conditions = decode({ current: rawRow(211, 7200), hourly: [rawRow(211), rawRow(202, 14400)] });
  const e = evaluation(conditions); const before = JSON.stringify(e);
  const cards = weatherCards('plant', e, 7300);
  expect(cards).toHaveLength(1); expect(new Set(cards.map(c => c.id)).size).toBe(1);
  expect(cards[0].metrics).toMatchObject({ phase: 'current', hasCurrent: true, hasForecast: true });
  expect(cards.every(c => c.severity === 'watch' && c.summary.includes('Stay sheltered'))).toBe(true);
  expect(cards.every(c => c.summary.includes('do not confirm hail'))).toBe(true);
  expect(e.water.needsWater).toBeNull(); expect(JSON.stringify(e)).toBe(before);
  expect(e.warnings.find(w => w.id === 'W05')?.state).toBe('unknown');
  expect(e.warnings.find(w => w.id === 'W10')?.state).toBe('disabled');
});
test('disabled preparation, expired data, wrong scope, future availability and inactive lifecycle cannot show a storm card', () => {
  const conditions = decode({ current: rawRow(211, 7200) }); const e = evaluation(conditions);
  expect(weatherCards('plant', { ...e, weatherPreparationEnabled: false }, 7300)).toEqual([]);
  expect(weatherCards('plant', e, 8000)).toEqual([]);
  expect(weatherCards('plant', evaluation([{ ...conditions[0], locationRevision: 2 }]), 7300)).toEqual([]);
  expect(weatherCards('plant', evaluation([{ ...conditions[0], availableUtc: 7201 }]), 7300)).toEqual([]);
  expect(weatherCards('plant', { ...e, warnings: e.warnings.map(w => ({ ...w, state: 'not_applicable' })) }, 7300)).toEqual([]);
});
test('simultaneous thunderstorm, gust and rain screens retain distinct hazards without doubling water or diagnosing disease', () => {
  const instant = { valid_start_utc: 7200, valid_end_utc: 7200, kind: 'current_point', time_support: 'point' } as const;
  const e = evaluateCare({ setup, evaluationUtc: 7200, profile: null, policyVersion: 'test', nextEvaluationUtc: 8000,
    warningWindows: [{ phase: 'current', startUtc: 6300, endUtc: 7200, completeVariables: [],
      samples: [sample('wind_gust_ms', 20, instant), sample('rain_rate_mm_h', 15, { ...instant, time_support: 'rate' })] }] });
  e.weatherPreparationEnabled = true; e.stormConditions = decode({ current: rawRow(211, 7200) });
  const cards = weatherCards('plant', e, 7300);
  expect(cards.map(c => c.title)).toEqual(['Thunderstorm reported', 'Wind preparation', 'Heavy rain reported']);
  expect(new Set(cards.map(c => c.id)).size).toBe(cards.length);
  expect(e.water.needsWater).toBeNull();
  expect(e.warnings.find(w => w.id === 'W10')?.state).toBe('disabled');
  expect(e.warnings.find(w => w.id === 'W07')?.state).not.toBe('triggered');
});
test('a forged hail condition cannot enter the thunderstorm-card path', () => {
  const condition = decode({ current: rawRow(211, 7200) })[0];
  expect(weatherCards('plant', evaluation([{ ...condition, hazard: 'hail' } as unknown as StormCondition]), 7300)).toEqual([]);
});
const hail: SourceEvent = { issuer: 'test-authority', product: 'verified-test-only', id: 'hail', revision: 1, sourceRevision: 'r1', locationRevision: 1,
  availableUtc: 7000, startUtc: 7000, endUtc: 8000, hazard: 'hail', severity: 'issuer-severe', cancelled: false };
test.each(['hail', 'wind', 'rain', 'flood'] as const)('typed %s hazard preserves issuer severity and does not become water input', hazard => {
  const result = activeSourceEvents([{ ...hail, hazard }, { ...hail, hazard }], 7200, 1);
  expect(result.active).toHaveLength(1); expect(result.active[0].severity).toBe('issuer-severe');
  expect(result.active[0].hazard).toBe(hazard);
});
test.each([
  { cancelled: 'true' }, { startUtc: 9000, endUtc: 8000 }, { severity: '' }, { sourceRevision: '' }, { hazard: 'storm-from-free-text' },
])('invalid latest hail update %j cannot revive an older active warning', change => {
  const result = activeSourceEvents([hail, { ...hail, ...change, revision: 2 } as SourceEvent], 7200, 1);
  expect(result.active).toEqual([]); expect(result.issues).toContain('invalid_source_event');
});
test('hail cancellation, expiry, source conflict and scope changes remove current evidence; none are all-clears', () => {
  expect(activeSourceEvents([hail, { ...hail, revision: 2, cancelled: true }], 7200, 1).active).toEqual([]);
  expect(activeSourceEvents([hail], 8000, 1).active).toEqual([]);
  expect(activeSourceEvents([hail], 7200, 2).active).toEqual([]);
  expect(activeSourceEvents([hail, { ...hail, severity: 'conflicting' }], 7200, 1).issues).toContain('source_event_revision_conflict');
  const flag = evaluation([]).warnings.find(w => w.id === 'W05')!;
  expect(deliveryRoute({ ...flag, state: 'triggered' }, { wateringApproved: false, weatherApproved: true, consent: true, pushEnabled: true, trustedSevereSource: false }).pushEligible).toBe(false);
});
