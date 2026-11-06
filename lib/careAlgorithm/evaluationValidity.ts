import { ENGINE_VERSION, finite, type Evaluation } from './types';

/** Consumer-side shape/expiry check. This does not approve a profile or authenticate a backend. */
export function evaluationValidAt(evaluation: Evaluation | undefined, nowUtc: number): boolean {
  if (!evaluation || evaluation.engineVersion !== ENGINE_VERSION || !finite(nowUtc) || !finite(evaluation.evaluationUtc)
    || evaluation.evaluationUtc > nowUtc || typeof evaluation.policyVersion !== 'string' || !evaluation.policyVersion.trim()
    || !Number.isInteger(evaluation.locationRevision) || evaluation.locationRevision < 0
    || typeof evaluation.dataRevisionFingerprint !== 'string' || !evaluation.dataRevisionFingerprint || !evaluation.water) return false;
  const { decision, needsWater } = evaluation.water;
  if (!(decision === 'water' && needsWater === true || decision === 'not_due' && needsWater === false || decision === 'uncertain' && needsWater === null)) return false;
  const expires = evaluation.nextEvaluationUtc;
  if (expires !== null && (!finite(expires) || expires <= evaluation.evaluationUtc || expires <= nowUtc)) return false;
  // A determinate recommendation requires explicit validity; no universal lifetime is invented.
  return needsWater === null || finite(expires) && typeof evaluation.profileVersion === 'string' && !!evaluation.profileVersion.trim();
}
export function waterDecisionAt(evaluation: Evaluation | undefined, nowUtc: number): boolean | null {
  return evaluationValidAt(evaluation, nowUtc) ? evaluation!.water.needsWater : null;
}
