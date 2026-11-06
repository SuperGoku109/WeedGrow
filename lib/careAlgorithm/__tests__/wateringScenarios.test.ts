import { evaluateCare } from '../evaluate';
import { replayWater, type ReplayInput } from '../replay';
import { normalizeMeteo } from '../adapters';
import { selectWaterHistory } from '../historySelection';
import { waterExplanation } from '../waterExplanation';
import { sample, setup, scenario, profile, source } from './helpers';
import type { Decision, Setup, WeatherSample } from '../types';

/** Hand-derived bank outcomes in litres, not adjudicated real-plant labels or recommended coefficients. */
interface Case {
  name: string; initial: number; et0?: number | null; rain?: number | null; soil?: Setup['soilRain'];
  applied?: number | null; end?: number; expected: Decision; reserve?: readonly [number, number];
}
const cases: Case[] = [
  { name: 'dry bank crosses due after occurred demand', initial: .9, et0: 1, expected: 'water', reserve: [.7, .7] },
  { name: 'high reserve survives mild weather demand', initial: 1.9, et0: .5, expected: 'not_due', reserve: [1.8, 1.8] },
  { name: 'high ET0 depletes a previously wet bank', initial: 1.6, et0: 7, expected: 'water', reserve: [.2, .2] },
  { name: 'zero demand does not refill an already dry plant', initial: .1, et0: 0, expected: 'water', reserve: [.1, .1] },
  { name: 'a warm day alone need not exhaust a wet bank', initial: 2, et0: 1, expected: 'not_due', reserve: [1.8, 1.8] },
  { name: 'reachable rain can lift reserve above action threshold', initial: .2, rain: 10, expected: 'not_due', reserve: [1, 1] },
  { name: 'a light shower does not automatically satisfy water need', initial: .2, rain: 1, expected: 'water', reserve: [.28, .28] },
  { name: 'root-zone shelter blocks direct rain refill', initial: .2, rain: 10, soil: 'no', expected: 'water', reserve: [.2, .2] },
  { name: 'unknown reception spanning due and not-due remains unknown', initial: .2, rain: 10, soil: 'unknown', expected: 'uncertain', reserve: [.2, 1] },
  { name: 'partial reception is bounded instead of guessed as half', initial: .2, rain: 10, soil: 'partial', expected: 'uncertain', reserve: [.2, 1] },
  { name: 'unknown reception still permits due when even full rain is insufficient', initial: .2, rain: 1, soil: 'unknown', expected: 'water', reserve: [.2, .28] },
  { name: 'known dry rain path works with unknown reception', initial: 1.2, rain: 0, soil: 'unknown', expected: 'not_due', reserve: [1.2, 1.2] },
  { name: 'capacity caps excessive rain without inferring disease', initial: .2, rain: 100, expected: 'not_due', reserve: [2, 2] },
  { name: 'threshold equality means watering due', initial: .8, expected: 'water', reserve: [.8, .8] },
  { name: 'just above threshold means not due', initial: .80001, expected: 'not_due', reserve: [.80001, .80001] },
  { name: 'known exact-now retained watering changes current need', initial: .1, applied: 1, expected: 'not_due', reserve: [.9, .9] },
  { name: 'insufficient watering today does not suppress due', initial: .1, applied: .1, expected: 'water', reserve: [.18, .18] },
  { name: 'literal zero watering supplies zero water', initial: .1, applied: 0, expected: 'water', reserve: [.1, .1] },
  { name: 'omitted amount does not assert a full bank', initial: .1, applied: null, expected: 'uncertain', reserve: [.1, 2] },
  { name: 'known large refill caps at capacity', initial: .1, applied: 100, expected: 'not_due', reserve: [2, 2] },
  { name: 'missing ET0 is unknown rather than zero demand', initial: 1.8, et0: null, expected: 'uncertain' },
  { name: 'missing exposed rain is unknown rather than zero rain', initial: .1, rain: null, expected: 'uncertain' },
  { name: 'sheltered roots do not require a rain value', initial: .1, rain: null, soil: 'no', expected: 'water', reserve: [.1, .1] },
  { name: 'unfinished current hour is not filled using the last completed hour', initial: .1, end: 3601, expected: 'uncertain' },
];
function input(c: Case): ReplayInput {
  return { setup: { ...setup, soilRain: c.soil ?? 'yes' }, profile: { ...profile, scenarios: [{ ...scenario,
    unknownRefillL: [0, 2], initialReserveL: [c.initial, c.initial] }] }, anchorUtc: 0, evaluationUtc: c.end ?? 3600, anchored: true,
    et0Source: source, rainSource: source, weather: [sample('et0_mm', c.et0 === undefined ? 0 : c.et0, { available_at_utc: 3600, retrieved_at_utc: 3600 }),
      sample('liquid_rain_mm', c.rain === undefined ? 0 : c.rain, { available_at_utc: 3600, retrieved_at_utc: 3600 })],
    events: Object.hasOwn(c, 'applied') ? [{ id: 'actual-watering', revision: 1, startUtc: 3600, endUtc: 3600, appliedL: c.applied! }] : [] };
}
test.each(cases)('$name', c => {
  const i = input(c); const replay = replayWater(i);
  expect(replay.candidate).toBe(c.expected);
  if (c.reserve) replay.states[0].reserveL.forEach((v, k) => expect(v).toBeCloseTo(c.reserve![k], 10));
  const evaluation = evaluateCare({ ...i, policyVersion: 'SYNTHETIC-TEST-ONLY', nextEvaluationUtc: 8000, warningWindows: [], replay: i,
    approvedProfiles: { [`${i.profile.id}@${i.profile.version}`]: { profile: i.profile, approvalRecordId: 'TEST-ONLY' } } });
  expect(evaluation.water.needsWater).toBe(c.expected === 'uncertain' ? null : c.expected === 'water');
  expect(evaluation.warnings.find(w => w.id === 'W06')?.state).toBe(c.expected === 'uncertain' ? 'unknown' : c.expected === 'water' ? 'triggered' : 'not_triggered');
  expect(waterExplanation(evaluation.water)).toMatch(c.expected === 'water' ? /watering is due/ : c.expected === 'not_due' ? /not due at the evaluation time/ : /unavailable/);
});

test('temperature, RH, gust and radiation do not double-count ET0 or diagnose wet roots', () => {
  const i = input(cases[0]); const base = replayWater(i);
  const current = { time_support: 'point', kind: 'current_point', valid_start_utc: 3600, available_at_utc: 3600, retrieved_at_utc: 3600 } as const;
  const extra: WeatherSample[] = [sample('air_temperature_c', 40, current), sample('air_rh_pct', 95, current), sample('wind_gust_ms', 25, current), sample('shortwave_w_m2', 1000, current)];
  expect(replayWater({ ...i, weather: [...i.weather, ...extra] })).toEqual(base);
  // These fields have their own screens; the water bank still has the exact same demand.
  const evaluated = evaluateCare({ ...i, profile: null, evaluationUtc: 3600, policyVersion: 'test', nextEvaluationUtc: 8000,
    replay: i, warningWindows: [{ phase: 'current', startUtc: 0, endUtc: 3600, completeVariables: [], samples: extra }] });
  expect(evaluated.warnings.find(w => w.id === 'W01')?.state).toBe('triggered');
  expect(evaluated.warnings.find(w => w.id === 'W07')?.state).not.toBe('triggered');
});
test('rain forecast and point rain rate cannot refill the current bank', () => {
  const i = input(cases[3]);
  const extra = [sample('liquid_rain_mm', 100, { kind: 'forecast' }), sample('rain_rate_mm_h', 100, { time_support: 'rate', valid_start_utc: 3600 })];
  expect(replayWater({ ...i, weather: [...i.weather, ...extra] }).states).toEqual(replayWater(i).states);
});
test('missing RH is independent of complete ET0/rain and snow is not liquid root-zone rain', () => {
  const raw = { utc_offset_seconds: 0, hourly_units: { time: 'unixtime', et0_fao_evapotranspiration: 'mm', rain: 'mm', snowfall: 'cm', precipitation: 'mm' },
    hourly: { time: [3600], et0_fao_evapotranspiration: [1], rain: [0], snowfall: [10], precipitation: [100] } };
  const decoded = normalizeMeteo(raw, 'archive', { retrievedUtc: 3600, firstAvailableUtc: 3600, locationRevision: 1, sourceRevision: 'archive', modelSelection: 'era5' });
  const selected = selectWaterHistory(decoded.samples, 'era5', 1, 3600); const i = input(cases[0]);
  i.profile = { ...i.profile, domain: { ...i.profile.domain, sourceKeys: ['Open-Meteo/archive/era5'] } };
  expect(replayWater({ ...i, evaluationUtc: 3600, weather: selected.samples,
    et0Source: selected.et0Source, rainSource: selected.rainSource }).candidate).toBe('water');
});
test('minority/mean votes cannot override scenario disagreement', () => {
  const i = input(cases[3]);
  i.profile = { ...i.profile, scenarios: [0, 1, 2, 3, 4].map(n => ({ ...scenario, id: `s${n}`, initialReserveL: n === 4 ? [1.9, 1.9] : [.1, .1] })) };
  expect(replayWater(i).candidate).toBe('uncertain');
});
test('stage-specific profiles select supported demand; a mismatched stage cannot reuse the profile', () => {
  const i = input({ name: 'stage', initial: 1.1, et0: 1, expected: 'not_due' });
  const next = { ...i.profile, version: 'flower', domain: { ...i.profile.domain, stages: ['flowering'] }, scenarios: [{ ...i.profile.scenarios[0], effectiveLossM2: .4 }] };
  expect(replayWater(i).candidate).toBe('not_due');
  expect(replayWater({ ...i, setup: { ...i.setup, stage: 'flowering' }, profile: next }).candidate).toBe('water');
  expect(replayWater({ ...i, setup: { ...i.setup, stage: 'flowering' } }).candidate).toBe('uncertain');
});

test.each([
  ['indoor', { environment: 'indoor' }], ['greenhouse', { environment: 'greenhouse' }], ['ground using pot profile', { plantedIn: 'ground' }],
  ['unknown stage', { stage: 'unknown' }], ['unsupported medium', { medium: 'coco' }], ['unsupported exposure', { sun: 'shade' }],
  ['unsupported volume', { potVolumeL: 100 }], ['unknown volume', { potVolumeL: null }], ['moved weather scope', { locationRevision: 2 }],
  ['archived', { status: 'archived' }], ['harvested', { status: 'harvested' }], ['dead', { status: 'dead' }], ['deleting', { deleting: true }],
] as const)('%s cannot become a not-due decision using an unsupported existing profile', (_label, change) => {
  const i = input(cases[1]); expect(replayWater({ ...i, setup: { ...i.setup, ...change } }).candidate).toBe('uncertain');
});
test('unknown stage can use an explicitly supported aggregate domain without demanding measurements', () => {
  const i = input(cases[1]); i.setup = { ...i.setup, stage: 'unknown' };
  i.profile = { ...i.profile, domain: { ...i.profile.domain, stages: ['unknown'] } };
  expect(replayWater(i).candidate).toBe('not_due');
});
test.each(['ageDays', 'heightCm', 'climateRegion'])('an unimplemented %s domain cannot silently activate as an aggregate profile', dimension => {
  const i = input(cases[1]); i.profile = { ...i.profile, domain: { ...i.profile.domain, [dimension]: [1, 2] } };
  expect(replayWater(i).reasonCodes).toContain('unsupported_profile_domain_dimension');
});
test('independent within-hour placements remain inside conservative bounds with rain, loss, refill and overflow', () => {
  for (const order of ['inputs_first', 'loss_first'] as const) for (const initial of [0, 1, 2]) for (const rainL of [0, 1, 3])
    for (const lossL of [0, .5, 2]) for (const applied of [0, .5, 3]) {
      const i = input({ name: 'exhaustive', initial, et0: lossL / .2, rain: rainL / .08, expected: 'uncertain' });
      i.profile = { ...i.profile, scenarios: [{ ...i.profile.scenarios[0], order }] };
      i.events = [{ id: 'bounded', revision: 1, startUtc: 0, endUtc: 3600, appliedL: applied }];
      const [lower, upper] = replayWater(i).states[0].reserveL;
      for (let placement = 0; placement <= 4; placement++) {
        // Independent event simulation. Uniform loss here is one possible placement, not an inference policy.
        let reserve = initial;
        if (order === 'inputs_first') reserve = Math.min(2, reserve + rainL);
        for (let tick = 0; tick <= 4; tick++) {
          if (tick === placement) reserve = Math.min(2, reserve + applied * .8);
          if (tick < 4) reserve = Math.max(0, reserve - lossL / 4);
        }
        if (order === 'loss_first') reserve = Math.min(2, reserve + rainL);
        expect(reserve).toBeGreaterThanOrEqual(lower - 1e-10);
        expect(reserve).toBeLessThanOrEqual(upper + 1e-10);
      }
    }
});
