import { ENGINE_VERSION, finite, type Evaluation, type Profile, type Setup, type WaterResult } from './types';
import { profileIssues, productionProfileApproved, type ApprovedProfiles } from './profiles';
import { replayWater, type ReplayInput } from './replay';
import { evaluateWarnings, type WarningWindow } from './warnings';
import { revisionFingerprint } from './revisions';
import { runWaterModel, type WaterModelInput } from './waterModel';
export { revisionFingerprint } from './revisions';
export interface EvaluationInput {
  setup: Setup; evaluationUtc: number; profile: Profile | null;
  policyVersion: string; nextEvaluationUtc: number | null;
  warningWindows: readonly WarningWindow[]; replay?: Omit<ReplayInput, 'setup' | 'profile' | 'evaluationUtc'>;
  /** Only the trusted backend supplies a registry decoded from protected release configuration. */
  approvedProfiles?: ApprovedProfiles;
  problemTopic?: 'excess_root_water' | 'establishment' | 'root_wilt';
}
function asOfWindows(windows: readonly WarningWindow[], now: number): WarningWindow[] {
  return windows.filter(w => w && ['current', 'historical24h', 'forecast24h'].includes(w.phase)
    && finite(w.startUtc) && finite(w.endUtc) && w.startUtc <= w.endUtc && w.endUtc - w.startUtc <= 86400
    && (w.phase === 'forecast24h' ? w.startUtc === now : w.endUtc === now)
    && Array.isArray(w.samples) && Array.isArray(w.completeVariables)).map(w => {
    const unavailable = w.samples.filter(s => !s || !finite(s.available_at_utc) || s.available_at_utc > now
      || s.kind !== 'forecast' && s.valid_end_utc > now);
    return { ...w, samples: w.samples.filter(s => !unavailable.includes(s)),
      completeVariables: w.completeVariables.filter(variable => !unavailable.some(s => s?.variable === variable)) };
  });
}
export function evaluateCare(input: EvaluationInput): Evaluation {
  if (!finite(input.evaluationUtc) || !input.policyVersion || !Number.isInteger(input.setup.locationRevision)
    || (input.nextEvaluationUtc !== null && (!finite(input.nextEvaluationUtc) || input.nextEvaluationUtc <= input.evaluationUtc))) throw new Error('invalid_evaluation_envelope');
  const reasons = profileIssues(input.setup, input.profile);
  if (!productionProfileApproved(input.profile, input.approvedProfiles)) reasons.push('profile_not_approved');
  if (input.replay && [input.replay.profileAtAnchor, ...(input.replay.transitions ?? []).map(t => t.profile)].some(p => p && !productionProfileApproved(p, input.approvedProfiles))) reasons.push('historical_profile_not_approved');
  if (input.setup.status !== 'active' || input.setup.deleting) reasons.push('inactive_plant');
  if (!input.replay) reasons.push('supported_history_unavailable');
  let water: WaterResult = { decision: 'uncertain', needsWater: null, reasonCodes: reasons };
  if (!reasons.length && input.profile && input.replay) {
    try {
      const replay = replayWater({ ...input.replay, setup: input.setup, profile: input.profile, evaluationUtc: input.evaluationUtc });
      water = { decision: replay.candidate, needsWater: replay.candidate === 'uncertain' ? null : replay.candidate === 'water', reasonCodes: replay.reasonCodes,
        ...('coverageIssue' in replay && replay.coverageIssue ? { coverageIssue: replay.coverageIssue } : {}),
        ...('evidence' in replay ? { evidence: replay.evidence } : {}) };
    } catch { water = { decision: 'uncertain', needsWater: null, reasonCodes: ['water_path_invalid'] }; }
  }
  return { engineVersion: ENGINE_VERSION, policyVersion: input.policyVersion, profileVersion: typeof input.profile?.version === 'string' ? input.profile.version : null,
    evaluationUtc: input.evaluationUtc, locationRevision: input.setup.locationRevision,
    dataRevisionFingerprint: revisionFingerprint({ engine: ENGINE_VERSION, ...input }), nextEvaluationUtc: input.nextEvaluationUtc,
    water, warnings: evaluateWarnings(input.setup, asOfWindows(input.warningWindows, input.evaluationUtc), water, input.problemTopic) };
}
/** Explicit engineering entry point. Its outputs are never accepted by production consumers. */
export function evaluateShadow(input: WaterModelInput) {
  const issues = profileIssues(input.setup, input.profile);
  if (issues.length) return { mode: 'shadow' as const, states: [], candidate: 'uncertain' as const, reasonCodes: issues };
  try { return runWaterModel(input); }
  catch { return { mode: 'shadow' as const, states: [], candidate: 'uncertain' as const, reasonCodes: ['water_path_invalid'], projection: null }; }
}
