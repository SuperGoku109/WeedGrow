import type { Profile, Setup } from '../../lib/careAlgorithm/types';
import { profileIssues, type ApprovedProfiles } from '../../lib/careAlgorithm/profiles';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';

export interface WaterProfileApproval {
  profile: Profile; approvalRecordId: string; approved: boolean;
  outcomeCriterionId: string; validationEvidenceId: string; statisticalReviewId: string;
  policyLockedBeforeHoldout: boolean; sourceAdapterContractsPassed: boolean; consumerIntegrationPassed: boolean;
  numericTargets: { minimumIndependentPlants: number; minimumPositiveCases: number; minimumNegativeCases: number;
    minimumDecisionCoverage: number; maximumFalseWaterRate: number; maximumUnaddressedDueRate: number };
}
export interface WaterPolicy {
  enabled: true; version: string; historyModel: string; licensingEvidenceId: string; adapterReviewId: string;
  requestTimeoutMs: number; retryAfterSeconds: number; refreshSeconds: number; maxRequestsPerDay: number;
  backfillDays: number; historyRecheckDays: number; profiles: WaterProfileApproval[];
  carryMappings?: { fromProfile: string; toProfile: string; scenarioMap: Record<string, string> }[];
}
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
export function readWaterPolicy(value: unknown): WaterPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as WaterPolicy;
  if (p.enabled !== true || ![p.version, p.historyModel, p.licensingEvidenceId, p.adapterReviewId].every(text)
    || !['best_match', 'era5', 'era5_land', 'era5_seamless', 'ecmwf_ifs', 'cerra'].includes(p.historyModel)
    || ![p.requestTimeoutMs, p.retryAfterSeconds, p.refreshSeconds, p.maxRequestsPerDay, p.backfillDays].every(v => Number.isInteger(v) && v > 0)
    || p.requestTimeoutMs > 30000 || p.retryAfterSeconds > 86400 || p.refreshSeconds > 86400
    || p.maxRequestsPerDay > 10000 || p.backfillDays > 31 || !Number.isInteger(p.historyRecheckDays) || p.historyRecheckDays < 0 || p.historyRecheckDays >= p.backfillDays
    || !Array.isArray(p.profiles) || p.profiles.length > 100
    || p.carryMappings !== undefined && (!Array.isArray(p.carryMappings) || p.carryMappings.length > 100 || p.carryMappings.some(m => !m || !text(m.fromProfile)
      || !text(m.toProfile) || !m.scenarioMap || typeof m.scenarioMap !== 'object' || Array.isArray(m.scenarioMap) || !Object.values(m.scenarioMap).every(text)))) return null;
  return p;
}
/** No synthetic coefficients or caller-owned approval flags are installed here. */
export function approvedWaterProfiles(policy: WaterPolicy): ApprovedProfiles {
  const registry: Record<string, { profile: Profile; approvalRecordId: string }> = {};
  const conflicts = new Set<string>();
  for (const entry of policy.profiles) {
    if (!entry?.profile || entry.approved !== true || ![entry.approvalRecordId, entry.statisticalReviewId].every(text)
      || entry.policyLockedBeforeHoldout !== true || entry.sourceAdapterContractsPassed !== true || entry.consumerIntegrationPassed !== true
      || entry.outcomeCriterionId !== entry.profile.criterionId || entry.validationEvidenceId !== entry.profile.validationEvidenceId) continue;
    const targets = entry.numericTargets;
    if (!targets || ![targets.minimumIndependentPlants, targets.minimumPositiveCases, targets.minimumNegativeCases].every(v => Number.isInteger(v) && v > 0)
      || ![targets.minimumDecisionCoverage, targets.maximumFalseWaterRate, targets.maximumUnaddressedDueRate].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) continue;
    const key = `${entry.profile.id}@${entry.profile.version}`;
    if (registry[key] && revisionFingerprint(registry[key]) !== revisionFingerprint({ profile: entry.profile, approvalRecordId: entry.approvalRecordId })) conflicts.add(key);
    registry[key] = { profile: entry.profile, approvalRecordId: entry.approvalRecordId };
  }
  for (const key of conflicts) delete registry[key];
  return registry;
}
export function selectWaterProfile(setup: Setup, profiles: ApprovedProfiles): Profile | null {
  const matches = Object.values(profiles).map(p => p.profile).filter(p => !profileIssues(setup, p).length);
  // Overlapping domains require an explicit release/configuration correction, not first-match precedence.
  return matches.length === 1 ? matches[0] : null;
}
