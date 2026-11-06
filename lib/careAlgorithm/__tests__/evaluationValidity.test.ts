import { evaluationValidAt, waterDecisionAt } from '../evaluationValidity';
import { evaluateCare } from '../evaluate';
import { setup } from './helpers';
const base = evaluateCare({ setup, evaluationUtc: 1000, policyVersion: 'test', nextEvaluationUtc: null, profile: null, warningWindows: [] });
test('valid uncertainty stays null; unversioned, malformed and future evaluations cannot become actionable', () => {
  expect(evaluationValidAt(base, 1001)).toBe(true); expect(waterDecisionAt(base, 1001)).toBeNull();
  for (const e of [undefined, {}, { ...base, evaluationUtc: NaN }, { ...base, evaluationUtc: 2000 }, { ...base, water: { decision: 'uncertain', needsWater: false } }]) {
    expect(evaluationValidAt(e as any, 1001)).toBe(false); expect(waterDecisionAt(e as any, 1001)).toBeNull();
  }
});
test('definite decisions require a profile version and explicit future validity bound', () => {
  const e = { ...base, water: { decision: 'water' as const, needsWater: true, reasonCodes: [] } };
  expect(waterDecisionAt(e, 1001)).toBeNull();
  expect(waterDecisionAt({ ...e, profileVersion: 'test', nextEvaluationUtc: 1100 }, 1001)).toBe(true);
  expect(waterDecisionAt({ ...e, profileVersion: 'test', nextEvaluationUtc: 1100 }, 1100)).toBeNull();
});
