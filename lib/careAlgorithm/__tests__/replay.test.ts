import { replayWater, projectWater, type ReplayInput } from '../replay';
import { initialize } from '../waterBank';
import { canonicalEvents, occurrenceWindow } from '../events';
import { evaluateCare, evaluateShadow } from '../evaluate';
import { parseVolumeL, productionProfileApproved } from '../profiles';
import { profile, sample, scenario, setup, source } from './helpers';
const input = (): ReplayInput => ({ setup, profile, anchorUtc: 0, anchored: true, evaluationUtc: 7200, weather: [
  sample('et0_mm', 1.5, { valid_end_utc: 7200, valid_start_utc: 3600 }), sample('liquid_rain_mm', 0, { valid_end_utc: 7200, valid_start_utc: 3600 }),
  sample('et0_mm', 0), sample('liquid_rain_mm', 0)], et0Source: source, rainSource: source, events: [] });
test('history ends at requested instant and exact-now small watering remains due', () => {
  const i = input(); i.events = [{ id: 'e', revision: 1, startUtc: 7200, endUtc: 7200, appliedL: .1 }];
  const out = replayWater(i); expect(out.candidate).toBe('water'); expect(out.states[0].reserveL[0]).toBeCloseTo(.78);
});
test('forecasts of the past cannot fill occurred history; a partial hour cannot be credited', () => {
  const i = input(); i.weather = i.weather.map(s => ({ ...s, kind: 'forecast' }));
  expect(replayWater(i).candidate).toBe('uncertain');
  expect(replayWater({ ...input(), evaluationUtc: 5400 }).reasonCodes).toContain('history_gap');
});
test('duplicate retries count once; distinct equal events both count', () => {
  const event = { id: 'a', revision: 1, startUtc: 7200, endUtc: 7200, appliedL: .1 };
  expect(canonicalEvents([event, event]).events).toHaveLength(1);
  expect(canonicalEvents([event, { ...event, id: 'b' }]).events).toHaveLength(2);
  expect(replayWater({ ...input(), events: [event, event] }).states[0].reserveL[0]).toBeCloseTo(.78);
  expect(replayWater({ ...input(), events: [event, { ...event, id: 'b' }] }).states[0].reserveL[0]).toBeCloseTo(.86);
});
test('latest authoritative correction/deletion resolves earlier conflict', () => {
  const a = { id: 'a', revision: 1, startUtc: 0, endUtc: 0, appliedL: .1 };
  const conflict = { ...a, appliedL: .5 };
  expect(canonicalEvents([a, conflict]).issues).toContain('event_revision_conflict');
  expect(canonicalEvents([a, conflict, { ...a, revision: 2 }]).issues).toEqual([]);
  expect(canonicalEvents([a, { ...a, revision: 2, deleted: true }]).events).toEqual([]);
});
test('date-only occurrence retains 23/25-hour IANA bounds and recording cap', () => {
  for (const [day, hours] of [['2026-03-08', 23], ['2026-11-01', 25]] as const) {
    const [start, end] = occurrenceWindow(day, 'America/New_York', 2000000000, 2000000000);
    expect((end - start) / 3600).toBe(hours);
    expect(occurrenceWindow(day, 'America/New_York', start + 100, 2000000000)).toEqual([start, start + 100]);
  }
  expect(() => occurrenceWindow('2026-02-30', 'UTC', 0, 0)).toThrow();
  expect(() => occurrenceWindow('2026-01-01', 'not/a-zone', 2000000000, 2000000000)).toThrow();
});
test('ambiguous log timing uses reserve bounds instead of inventing noon or redistributing a shower', () => {
  const i = input(); i.events = [{ id: 'e', revision: 1, startUtc: 0, endUtc: 7000, appliedL: null }];
  const out = replayWater(i);
  expect(out.reasonCodes).toContain('conservative_event_timing_bounds');
  expect(out.states[0].reserveL[0]).toBeCloseTo(.78);
  expect(out.states[0].reserveL[1]).toBeCloseTo(1.02);
  expect(out.candidate).toBe('uncertain');
});
test('forecast branch censoring leaves upper waiting time null', () => {
  const s = initialize({ ...scenario, initialReserveL: [1, 1] }, 0, 'test', true);
  const out = projectWater([s], [[{ startUtc: 0, endUtc: 3600, et0Mm: 2, rainMm: 0 }], [{ startUtc: 0, endUtc: 3600, et0Mm: 0, rainMm: 10 }]], 3600, true);
  expect(out).toMatchObject({ available: true, earliestUtc: 0, latestUtc: null, censored: true });
  expect(out.crossings[0]).toMatchObject({ earliestUtc: 0, latestUtc: 3600 });
  expect(projectWater([s], [], 3600, true).available).toBe(false);
});
test('client approval fields and synthetic shadow results never activate production', () => {
  const p = { ...profile, approved: true, adapter_verified: true };
  expect(evaluateShadow({ ...input(), profile: p }).candidate).toBe('water');
  const result = evaluateCare({ setup, profile: p, evaluationUtc: 7200, policyVersion: 'test', nextEvaluationUtc: null, warningWindows: [], replay: input() });
  expect(result.water.needsWater).toBeNull(); expect(result.water.reasonCodes).toContain('profile_not_approved');
  expect(JSON.stringify(result)).not.toContain('candidate'); expect(result.warnings).toHaveLength(14);
});
test('malformed JSON profile becomes uncertainty without crashing the orchestrator', () => {
  expect(productionProfileApproved({ id: 'forged', approved: true } as any)).toBe(false);
  const result = evaluateCare({ setup, profile: { id: 'forged', approved: true } as any,
    evaluationUtc: 7200, policyVersion: 'test', nextEvaluationUtc: null, warningWindows: [] });
  expect(result.water.needsWater).toBeNull(); expect(result.water.reasonCodes).toContain('invalid_profile_shape');
});
test.each([['10', null], ['2 gal', null], ['2 US gal', 7.570823568], ['2 imperial gal', 9.09218], ['500 ml', .5], ['10 L', 10], ['0 L', null]])('volume %s -> %s', (value, expected) => expect(parseVolumeL(value)).toBe(expected));
