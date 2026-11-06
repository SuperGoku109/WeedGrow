import { evaluateWarnings, flowerContext, type WarningWindow } from '../warnings';
import { deliveryRoute } from '../delivery';
import { evaluateCare } from '../evaluate';
import { sample, setup } from './helpers';
const water = { decision: 'uncertain' as const, needsWater: null, reasonCodes: ['test'] };
test.each([
  ['vegetative', 'yes', true, true, true, true, 'not_applicable'],
  [null, 'yes', true, true, true, true, 'unknown'],
  ['flowering', 'no', false, true, true, true, 'context_only'],
  ['flowering', 'yes', true, false, false, false, 'context_only'],
  ['flowering', 'unknown', true, true, false, true, 'unknown'],
  ['flowering', 'yes', false, false, false, false, 'unknown'],
  ['flowering', 'no', false, false, false, true, 'not_triggered'],
  ['flowering', 'unknown', false, true, false, true, 'not_triggered'],
  ['flowering', 'partial', true, true, false, true, 'unknown'],
] as const)('W11 truth table %s/%s/rain=%s', (stage, reception, rain, rainComplete, humidity, humidityComplete, expected) => {
  expect(flowerContext(stage, reception, rain, rainComplete, humidity, humidityComplete)).toBe(expected);
});
test('all 14 IDs survive an outage; absent evidence is not a disease all-clear', () => {
  const flags = evaluateWarnings(setup, [], water);
  expect(flags).toHaveLength(14); expect(new Set(flags.map(f => f.id)).size).toBe(14);
  expect(flags.find(f => f.id === 'W06')!.state).toBe('unknown');
  expect(flags.find(f => f.id === 'W10')!.state).toBe('disabled');
  expect(evaluateWarnings({ ...setup, stage: 'flowering' }, [], water).find(f => f.id === 'W11')!.state).toBe('unknown');
});
test('positive heat survives missing watering/RH; container context merges into heat', () => {
  const window: WarningWindow = { phase: 'current', startUtc: 0, endUtc: 7200, completeVariables: [],
    samples: [sample('air_temperature_c', 40, { time_support: 'point', valid_start_utc: 3600 })] };
  const flags = evaluateWarnings(setup, [window], water);
  expect(flags.find(f => f.id === 'W01')).toMatchObject({ state: 'triggered', phase: 'current' });
  expect(flags.find(f => f.id === 'W08')).toMatchObject({ state: 'context_only', evidence: { mergedInto: 'W01' } });
  expect(flags.find(f => f.id === 'W06')!.state).toBe('unknown');
  expect(evaluateWarnings(setup, [{ ...window, phase: 'historical24h' }], water).find(f => f.id === 'W01')!.state).toBe('unknown');
});
test('root/wilt report routes one requested review without a water or root-rot diagnosis', () => {
  const flags = evaluateWarnings(setup, [], water, 'root_wilt');
  expect(flags.filter(f => f.state === 'review_requested').map(f => f.id)).toEqual(['W14']);
  expect(flags.find(f => f.id === 'W06')!.state).toBe('unknown');
});
test.each(['archived', 'dead', 'harvested'])('inactive %s receives no care', status => {
  expect(evaluateWarnings({ ...setup, status }, [], water).every(f => f.state === 'not_applicable')).toBe(true);
});
test('context, malformed flag routes and string permission gates cannot push', () => {
  const flags = evaluateWarnings(setup, [], water);
  const policy = { wateringApproved: true, weatherApproved: true, consent: true, pushEnabled: true, trustedSevereSource: true };
  const w06 = flags.find(f => f.id === 'W06')!;
  expect(deliveryRoute({ ...w06, state: 'context_only' }, policy)).toEqual({ card: null, pushEligible: false });
  expect(deliveryRoute({ ...w06, id: 'W10', state: 'triggered' }, policy)).toEqual({ card: null, pushEligible: false });
  expect(deliveryRoute({ ...w06, state: 'triggered' }, { ...policy, consent: 'true' } as any).pushEligible).toBe(false);
});
test('evaluation is deterministic, immutable, revision-aware and explicitly timed', () => {
  const input = { setup, evaluationUtc: 7200, profile: null, policyVersion: 'test', nextEvaluationUtc: null, warningWindows: [] };
  const before = JSON.stringify(input); const first = evaluateCare(input);
  expect(evaluateCare(input)).toEqual(first); expect(JSON.stringify(input)).toBe(before);
  expect(evaluateCare({ ...input, setup: { ...setup, soilRain: 'no' } }).dataRevisionFingerprint).not.toBe(first.dataRevisionFingerprint);
});
