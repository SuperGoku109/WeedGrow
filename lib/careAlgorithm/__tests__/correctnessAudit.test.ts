import { evaluateCare } from '../evaluate';
import { evaluateWarnings, type WarningWindow } from '../warnings';
import { integralPath, selectSamples } from '../weather';
import { bankStep, initialize, refill, decide } from '../waterBank';
import { projectWater, replayWater } from '../replay';
import { canonicalEvents } from '../events';
import { deliveryRoute } from '../delivery';
import { scenario, setup, sample, source, profile } from './helpers';
const unknownWater = { decision: 'uncertain' as const, needsWater: null, reasonCodes: [] };
const window = (samples: WarningWindow['samples'], completeVariables: WarningWindow['completeVariables']): WarningWindow => ({
  phase: 'current', startUtc: 0, endUtc: 7200, samples, completeVariables,
});
const flag = (windows: WarningWindow[], id: string) => evaluateWarnings({ ...setup, stage: 'flowering' }, windows, unknownWater).find(f => f.id === id)!;

test('declared rain coverage without rain records cannot clear W11/W12', () => {
  const rh = sample('air_rh_pct', 50, { time_support: 'interval_mean' });
  const w = window([rh], ['air_rh_pct', 'liquid_rain_mm']);
  expect(flag([w], 'W11').state).toBe('unknown');
  expect(flag([w], 'W12').state).toBe('unknown');
});
test('complete dry/humidity paths can clear their screens while a known humid crossing retains flower context', () => {
  const samples = [0, 3600].flatMap(start => [sample('liquid_rain_mm', 0, { valid_start_utc: start, valid_end_utc: start + 3600 }),
    sample('air_rh_pct', 50, { time_support: 'interval_mean', valid_start_utc: start, valid_end_utc: start + 3600 })]);
  const clear = window(samples, ['air_rh_pct', 'liquid_rain_mm']);
  expect(flag([clear], 'W11').state).toBe('not_triggered'); expect(flag([clear], 'W12').state).toBe('not_triggered');
  const humid = { ...clear, samples: samples.map(s => s.variable === 'air_rh_pct' ? { ...s, value: 95 } : s) };
  expect(flag([humid], 'W11').state).toBe('context_only');
});
test('invalid rain and humidity cannot become complete negative evidence after filtering', () => {
  const w = window([sample('liquid_rain_mm', null, { quality: 'invalid' }), sample('air_rh_pct', 50, { time_support: 'interval_mean' }),
    sample('air_rh_pct', null, { time_support: 'interval_mean', valid_start_utc: 3600, valid_end_utc: 7200, quality: 'invalid' })], ['air_rh_pct', 'liquid_rain_mm']);
  expect(flag([w], 'W09').state).toBe('unknown'); expect(flag([w], 'W11').state).toBe('unknown');
});
test('rain revision conflicts cannot select the last duplicate or declare a rain all-clear', () => {
  const a = sample('liquid_rain_mm', 30); const conflict = { ...a, value: 0 };
  for (const samples of [[a, conflict], [conflict, a]]) {
    const w = window(samples, ['liquid_rain_mm', 'rain_rate_mm_h']);
    expect(flag([w], 'W04').state).toBe('unknown'); expect(flag([w], 'W12').state).toBe('unknown');
  }
});
test('an interval mean or maximum cannot prove the absence of a point temperature crossing', () => {
  const w = window([sample('air_temperature_c', 20, { time_support: 'interval_mean' })], ['air_temperature_c']);
  expect(flag([w], 'W01').state).toBe('unknown');
});
test('empty or unrecognized stage does not assert a known nonflowering plant', () => {
  expect(evaluateWarnings({ ...setup, stage: '' }, [], unknownWater).find(f => f.id === 'W11')!.state).toBe('unknown');
  expect(evaluateWarnings({ ...setup, stage: 'unknown' }, [], unknownWater).find(f => f.id === 'W13')!.state).toBe('unknown');
});
test('current warning windows cannot contain future or historical-only weather', () => {
  const w = window([sample('air_temperature_c', 40, { time_support: 'point', valid_start_utc: 3600 })], []);
  const out = evaluateCare({ setup, evaluationUtc: 1000, profile: null, policyVersion: 'test', nextEvaluationUtc: null, warningWindows: [w] });
  expect(out.warnings.find(f => f.id === 'W01')!.state).toBe('unknown');
});
test('as-of replay preserves first acquisition when the same immutable revision is fetched again later', () => {
  const a = sample('et0_mm', 1, { available_at_utc: 3600, retrieved_at_utc: 9000 });
  expect(selectSamples([a], 'et0_mm', source, 1, 7200)).toHaveLength(1);
});
test('an integral path cannot mix variables and add ET0 to rain', () => {
  const et0 = sample('et0_mm', 1); const rain = sample('liquid_rain_mm', 2, { valid_start_utc: 3600, valid_end_utc: 7200 });
  expect(integralPath([et0, rain], 0, 7200, 'occurred_estimate').complete).toBe(false);
});
test('integrals from incompatible providers cannot silently become one complete path', () => {
  const a = sample('et0_mm', 1); const b = sample('et0_mm', 2, { valid_start_utc: 3600, valid_end_utc: 7200, provider: 'other' });
  expect(integralPath([a, b], 0, 7200, 'occurred_estimate').complete).toBe(false);
});
test('string deletion flags never erase a genuine watering event', () => {
  const out = canonicalEvents([{ id: 'e', revision: 1, startUtc: 0, endUtc: 0, appliedL: .1, deleted: 'false' } as any]);
  expect(out.issues).toContain('invalid_event');
});
test('bank arithmetic does not lose a small refill when potential overflow is very large', () => {
  expect(bankStep(1, 2, 1e20, .5).reserveL).toBe(1.5);
});
test('invalid saved reserve bounds cannot produce a definite decision or refill', () => {
  const bad = { ...initialize(scenario, 0, 'test', true), reserveL: [1.5, .2] as const };
  expect(decide([bad])).toBe('uncertain'); expect(() => refill(bad, .1)).toThrow();
});
test('deleted plants cannot produce even shadow watering decisions', () => {
  expect(replayWater({ setup: { ...setup, deleting: true }, profile, anchorUtc: 0, anchored: true, evaluationUtc: 0,
    weather: [], et0Source: source, rainSource: source, events: [] }).candidate).toBe('uncertain');
});
test('delivery requires every named boolean gate even for context-only cards', () => {
  const warning = flag([], 'W09');
  expect(deliveryRoute({ ...warning, state: 'context_only' }, {} as any)).toEqual({ card: null, pushEligible: false });
});
test('projection refuses invalid forcing and does not throw through care consumers', () => {
  const s = initialize(scenario, 0, 'test', true);
  expect(() => projectWater([s], [[{ startUtc: 0, endUtc: 3600, et0Mm: -1, rainMm: 0 }]], 3600, true)).not.toThrow();
  expect(projectWater([s], [[{ startUtc: 0, endUtc: 3600, et0Mm: -1, rainMm: 0 }]], 3600, true).available).toBe(false);
});
test('projection detects forecast gaps and excludes rain from sheltered root zones', () => {
  const s = initialize(scenario, 0, 'test', true);
  expect(projectWater([s], [[{ startUtc: 1800, endUtc: 3600, et0Mm: 2, rainMm: 0 }]], 3600, true).available).toBe(false);
  const step = { startUtc: 0, endUtc: 3600, et0Mm: 2, rainMm: 30 };
  expect(projectWater([s], [[step]], 3600, false).crossings[0]).toMatchObject({ earliestUtc: 0, latestUtc: 3600 });
});
