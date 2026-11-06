import { makeWaterCheckpoint, resumeWaterCheckpoint } from '../checkpoint';
import { runWaterModel, type WaterModelInput } from '../waterModel';
import { scenario, setup, profile, source, sample } from './helpers';
const base = (): WaterModelInput => ({ setup, profile, anchorUtc: 0, evaluationUtc: 3600, anchored: true, et0Source: source, rainSource: source, events: [],
  weather: [sample('et0_mm', 1, { available_at_utc: 3600, retrieved_at_utc: 3600 }), sample('liquid_rain_mm', 0, { available_at_utc: 3600, retrieved_at_utc: 3600 })] });
const extend = (input: WaterModelInput): WaterModelInput => ({ ...input, evaluationUtc: 7200, weather: [...input.weather,
  sample('et0_mm', 1, { valid_start_utc: 3600, valid_end_utc: 7200 }), sample('liquid_rain_mm', 0, { valid_start_utc: 3600, valid_end_utc: 7200 })] });
test('saved state resumes without double applying already included watering and matches full origin replay', () => {
  const input = base(); input.events = [{ id: 'e', revision: 1, startUtc: 3600, endUtc: 3600, appliedL: .1 }];
  const first = runWaterModel(input); const checkpoint = makeWaterCheckpoint(input, first.states);
  const next = extend(input); const resumed = runWaterModel({ ...next, checkpoint }); const full = runWaterModel(next);
  expect(resumed.states).toEqual(full.states); expect(resumed.reasonCodes).toContain('checkpoint_reused');
});
test('late forcing correction discards the saved state and replays the original history automatically', () => {
  const input = base(); const checkpoint = makeWaterCheckpoint(input, runWaterModel(input).states);
  const next = extend(input); next.weather = next.weather.map(s => s.variable === 'et0_mm' && s.valid_end_utc === 3600 ? { ...s, value: 2 } : s);
  const out = runWaterModel({ ...next, checkpoint });
  expect(out.reasonCodes).toContain('checkpoint_forcing_changed'); expect(out.states[0].reserveL[0]).toBeCloseTo(.4);
});
test('edited/deleted old logs discard checkpoint state rather than carrying stale water', () => {
  const input = base(); input.events = [{ id: 'e', revision: 1, startUtc: 3600, endUtc: 3600, appliedL: .5 }];
  const checkpoint = makeWaterCheckpoint(input, runWaterModel(input).states);
  const next = extend(input); next.events = [{ id: 'e', revision: 2, deleted: true }];
  const out = runWaterModel({ ...next, checkpoint }); expect(out.reasonCodes).toContain('checkpoint_events_changed');
  expect(out.states[0].reserveL[0]).toBeCloseTo(.6);
});
test('same immutable forcing refetched later does not invalidate state merely because retrieval metadata changed', () => {
  const input = base(); const checkpoint = makeWaterCheckpoint(input, runWaterModel(input).states);
  const next = extend(input); next.weather = next.weather.map(s => ({ ...s, retrieved_at_utc: 7200 }));
  expect(resumeWaterCheckpoint(next, checkpoint).reused).toBe(true);
  expect(resumeWaterCheckpoint({ ...next, profile: { ...profile, scenarios: [{ ...scenario, effectiveLossM2: .3 }] } }, checkpoint).reused).toBe(false);
});

test('newly available date-only log spanning a checkpoint replays the full origin instead of getting stuck', () => {
  const input = base(); const checkpoint = makeWaterCheckpoint(input, runWaterModel(input).states);
  const next = extend(input); next.events = [{ id: 'late-date-log', revision: 1, startUtc: 1800, endUtc: 5400, appliedL: .2 }];
  const out = runWaterModel({ ...next, checkpoint });
  expect(out.reasonCodes).toContain('checkpoint_events_changed');
  expect(out.states).toEqual(runWaterModel(next).states); expect(out.states).not.toHaveLength(0);
});

test.each(['missing', 'wrong_time', 'wrong_scenario'] as const)('invalid checkpoint %s falls back to the complete origin', bad => {
  const input = base(); const checkpoint = makeWaterCheckpoint(input, runWaterModel(input).states);
  if (bad === 'missing') checkpoint.states = [];
  if (bad === 'wrong_time') checkpoint.states[0].atUtc = 1;
  if (bad === 'wrong_scenario') checkpoint.states[0].scenario = { ...scenario, id: 'unrelated' };
  const out = runWaterModel({ ...extend(input), checkpoint });
  expect(out.reasonCodes).toContain('checkpoint_state_invalid'); expect(out.states).toEqual(runWaterModel(extend(input)).states);
});
