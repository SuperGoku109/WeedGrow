import { finite, type Profile, type Setup } from './types';
import { validateScenario } from './waterBank';
import { revisionFingerprint } from './revisions';

/** This registry is compiled/protected configuration. Plant documents never supply approvals. */
export type ApprovedProfiles = Readonly<Record<string, { profile: Profile; approvalRecordId: string }>>;
const APPROVED_PROFILES: ApprovedProfiles = Object.freeze({});
export function productionProfileApproved(profile: Profile | null, registry: ApprovedProfiles = APPROVED_PROFILES): boolean {
  if (!profile || typeof profile.validationEvidenceId !== 'string' || !profile.validationEvidenceId.trim()) return false;
  const key = `${profile.id}@${profile.version}`;
  if (!Object.hasOwn(registry, key)) return false;
  const approved = registry[key];
  // An approved ID/version cannot authorize caller-altered coefficients, scope or evidence.
  return !!approved.approvalRecordId && revisionFingerprint(approved.profile) === revisionFingerprint(profile);
}
export function profileIssues(setup: Setup, profile: Profile | null): string[] {
  if (!profile) return ['profile_unavailable'];
  const d = profile.domain;
  const reasons: string[] = [];
  if (!d || !Array.isArray(d.stages) || !Array.isArray(d.suns) || !Array.isArray(d.mediums)
    || !Array.isArray(d.sourceKeys) || !Array.isArray(profile.scenarios)
    || (d.potVolumeL !== null && (!Array.isArray(d.potVolumeL) || d.potVolumeL.length !== 2
      || !d.potVolumeL.every(finite) || d.potVolumeL[0] <= 0 || d.potVolumeL[0] > d.potVolumeL[1]))) return ['invalid_profile_shape'];
  // Never silently discard a required age/height/climate/observation domain supplied by configuration.
  if (Object.keys(d).some(k => !['environment', 'plantedIn', 'stages', 'suns', 'mediums', 'potVolumeL', 'sourceKeys'].includes(k))) reasons.push('unsupported_profile_domain_dimension');
  if (![profile.id, profile.version, profile.criterionId, profile.validationEvidenceId, profile.stateAnchorBasis,
    profile.rootZoneKey, profile.transitionPolicy].every(v => typeof v === 'string' && v.trim())) reasons.push('profile_metadata_incomplete');
  if (setup.environment !== d.environment || setup.plantedIn !== d.plantedIn || !d.stages.includes(setup.stage)
    || !d.suns.includes(setup.sun) || !d.mediums.includes(setup.medium)) reasons.push('unsupported_setup_domain');
  if (setup.plantedIn === 'pot' && (!d.potVolumeL || !finite(setup.potVolumeL)
    || setup.potVolumeL < d.potVolumeL[0] || setup.potVolumeL > d.potVolumeL[1])) reasons.push('unsupported_volume_domain');
  try {
    if (!profile.scenarios.length || new Set(profile.scenarios.map(s => s.id)).size !== profile.scenarios.length) throw new Error();
    profile.scenarios.forEach(validateScenario);
  } catch { reasons.push('invalid_profile_scenarios'); }
  return reasons;
}
/** A unitless string or ambiguous gallon standard is never treated as litres. */
export function parseVolumeL(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(l|litres?|liters?|ml|us\s*gal(?:lons?)?|imp(?:erial)?\s*gal(?:lons?)?)$/i);
  if (!match) return null;
  const amount = Number(match[1]); const unit = match[2].toLowerCase();
  const litres = amount * (unit === 'ml' ? .001 : unit.startsWith('us') ? 3.785411784 : unit.startsWith('imp') ? 4.54609 : 1);
  return finite(litres) && litres > 0 ? litres : null;
}
