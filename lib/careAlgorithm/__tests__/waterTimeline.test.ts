import { replayWater, type ReplayInput } from '../replay';
import { initialize } from '../waterBank';
import { selectSamples } from '../weather';
import { canonicalEvents } from '../events';
import { scenario, setup, profile, source, sample } from './helpers';
const basic = (initial = 1, et0 = 1.5): ReplayInput => ({ setup, profile: { ...profile, scenarios: [{ ...scenario, initialReserveL: [initial, initial] }] },
  anchorUtc: 0, evaluationUtc: 3600, anchored: true, et0Source: source, rainSource: source,
  weather: [sample('et0_mm', et0, { available_at_utc: 3600, retrieved_at_utc: 3600 }), sample('liquid_rain_mm', 0, { available_at_utc: 3600, retrieved_at_utc: 3600 })], events: [] });

test('date-only known refill bounds overflow timing without asserting a full refill', () => {
  const input = basic(1, 2.5); input.events = [{ id: 'date-log', revision: 1, startUtc: 0, endUtc: 3600, appliedL: 3.75 }];
  const out = replayWater(input); expect(out.states[0].reserveL).toEqual([1.5, 2]); expect(out.candidate).toBe('not_due');
});
test('exact occurrence inside a completed integral bounds forcing order and can still establish due', () => {
  const input = basic(.1, 3); input.events = [{ id: 'time-log', revision: 1, startUtc: 1200, endUtc: 1200, appliedL: .5 }];
  const out = replayWater(input); expect(out.states[0].reserveL[0]).toBe(0); expect(out.states[0].reserveL[1]).toBeCloseTo(.4);
  expect(out.candidate).toBe('water');
});
test('rain reception uncertainty brackets zero/full rather than guessing a percentage or refusing all replay', () => {
  const input = basic(.7, .5); input.setup = { ...setup, soilRain: 'unknown' }; input.weather = [sample('et0_mm', .5, { available_at_utc: 3600, retrieved_at_utc: 3600 }), sample('liquid_rain_mm', 5, { available_at_utc: 3600, retrieved_at_utc: 3600 })];
  const out = replayWater(input); expect(out.states[0].reserveL[0]).toBeCloseTo(.6); expect(out.states[0].reserveL[1]).toBeCloseTo(1);
  expect(out.candidate).toBe('uncertain');
});
function staged(): ReplayInput {
  const old = { ...profile, version: 'veg', scenarios: [{ ...scenario, initialReserveL: [1.6, 1.6] as const }] };
  const next = { ...profile, version: 'flower', domain: { ...profile.domain, stages: ['flowering'] }, scenarios: [{ ...scenario, id: 'flower', effectiveLossM2: .4 }] };
  const flower = { ...setup, stage: 'flowering' };
  return { ...basic(), profile: next, setup: flower, setupAtAnchor: setup, profileAtAnchor: old, evaluationUtc: 7200,
    transitions: [{ atUtc: 3600, mode: 'carry', setup: flower, profile: next, scenarioMap: { synthetic: 'flower' } }],
    weather: [sample('et0_mm', 1), sample('liquid_rain_mm', 0), sample('et0_mm', 1, { valid_start_utc: 3600, valid_end_utc: 7200 }), sample('liquid_rain_mm', 0, { valid_start_utc: 3600, valid_end_utc: 7200 })] };
}
test('dated compatible stage change uses old demand before the boundary and new demand afterwards', () => {
  const out = replayWater(staged()); expect(out.states[0].reserveL[0]).toBeCloseTo(1);
  expect(out.candidate).toBe('not_due'); expect(out.states[0].scenario.id).toBe('flower');
});
test('date-only timing can cross a demand update whose refill semantics stay compatible', () => {
  const input = staged(); input.events = [{ id: 'bounded', revision: 1, startUtc: 0, endUtc: 7000, appliedL: .2 }];
  const out = replayWater(input); expect(out.states[0].reserveL[0]).toBeCloseTo(1.16); expect(out.states[0].reserveL[1]).toBeCloseTo(1.16);
});
test('physical repot reinitializes [0,new capacity], instead of scaling old water up', () => {
  const input = staged(); input.setup = { ...input.setup, potVolumeL: 20 }; input.profile = { ...input.profile, rootZoneKey: 'new-root-zone',
    scenarios: [{ ...input.profile.scenarios[0], capacityL: 4 }] };
  input.transitions = [{ atUtc: 3600, mode: 'reinitialize', profile: input.profile, setup: input.setup }];
  const out = replayWater(input); expect(out.states[0].reserveL[0]).toBe(0); expect(out.states[0].reserveL[1]).toBeCloseTo(3.6);
  expect(out.candidate).toBe('uncertain');
});
test('unrecorded transition, unsplittable forcing boundary and unspecified exact-edge event order do not invent history', () => {
  const input = staged(); expect(replayWater({ ...input, transitions: [] }).reasonCodes).toContain('missing_dated_setup_transition');
  expect(replayWater({ ...input, transitions: [{ ...input.transitions![0], atUtc: 1800 }] }).candidate).toBe('uncertain');
  const event = { id: 'edge', revision: 1, startUtc: 3600, endUtc: 3600, appliedL: .2 };
  expect(replayWater({ ...input, events: [event] }).reasonCodes).toContain('event_transition_order_unresolved');
  expect(replayWater({ ...input, events: [event], transitions: [{ ...input.transitions![0], eventsAtBoundary: 'before' }] }).states[0].reserveL[0]).toBeCloseTo(1.16);
});
test('saved checkpoints require exact event revision provenance; edits/deletions/new old logs force replay', () => {
  const input = basic(); const event = { id: 'past', revision: 1, startUtc: 0, endUtc: 0, appliedL: .1 };
  const checkpoint = initialize(input.profile.scenarios[0], 0, profile.rootZoneKey, true);
  expect(replayWater({ ...input, savedStates: [checkpoint], events: [event] }).reasonCodes).toContain('checkpoint_event_provenance_missing');
  const saved = { ...input, savedStates: [checkpoint], anchorEventRevisions: [{ id: 'past', revision: 1 }], events: [event] };
  expect(replayWater(saved).states[0].reserveL[0]).toBeCloseTo(.7, 10);
  expect(replayWater({ ...saved, events: [{ ...event, revision: 2 }] }).reasonCodes).toContain('checkpoint_history_changed');
  expect(replayWater({ ...saved, events: [{ id: event.id, revision: 2, deleted: true }] }).reasonCodes).toContain('checkpoint_history_changed');
});
test('history can select different immutable revisions on declared windows; future corrections stay unavailable', () => {
  const rows = [sample('et0_mm', 1), sample('et0_mm', 2, { valid_start_utc: 3600, valid_end_utc: 7200 }),
    sample('et0_mm', 0, { valid_start_utc: 3600, valid_end_utc: 7200, source_revision: 'r2' })];
  const selected = selectSamples(rows, 'et0_mm', { provider: source.provider, product: source.product, modelSelection: source.modelSelection,
    revisionWindows: [{ sourceRevision: 'r1', startUtc: 0, endUtc: 3600 }, { sourceRevision: 'r2', startUtc: 3600, endUtc: 7200 }] }, 1, 7200);
  expect(selected.map(s => s.value)).toEqual([1, 0]);
  const event = { id: 'e', revision: 1, startUtc: 0, endUtc: 0, appliedL: .1, availableUtc: 10 };
  expect(canonicalEvents([event, { ...event, revision: 2, appliedL: 10, availableUtc: 20 }], 15).events).toEqual([event]);
});
test('timing bounds contain every microstep placement in an independent exhaustive discrete oracle', () => {
  for (const initial of [0, .25, 1, 2]) for (const applied of [0, .1, 1, 3]) for (const demand of [0, .5, 2, 4]) {
    const input = basic(initial, demand / .2); input.events = [{ id: 'e', revision: 1, startUtc: 0, endUtc: 3600, appliedL: applied }];
    const [lower, upper] = replayWater(input).states[0].reserveL;
    for (let placement = 0; placement <= 4; placement++) {
      let reserve = initial;
      for (let step = 0; step <= 4; step++) {
        if (step === placement) reserve = Math.min(2, reserve + applied * .8);
        if (step < 4) reserve = Math.max(0, reserve - demand / 4);
      }
      expect(reserve).toBeGreaterThanOrEqual(lower - 1e-10); expect(reserve).toBeLessThanOrEqual(upper + 1e-10);
    }
  }
});
