import type { Plant } from '@/firestoreModels';
import { plantSetup } from './appAdapter';
import { revisionFingerprint } from './evaluate';
import { evaluationValidAt } from './evaluationValidity';
import { ENGINE_VERSION, finite, type Evaluation } from './types';
import type { CareReadResult } from './careDiagnostics';

export interface CareSnapshot { schemaVersion: 1; revision: string; inputKey: string; evaluation: Evaluation; configurationRevision: number | null; waterConfigurationRevision?: number | null }
/** Only actual care dependencies; names/notes/dismissal do not rewrite plant state. */
export function careInputKey(plant: Plant) {
  return revisionFingerprint({ setup: plantSetup(plant), location: plant.location ?? null,
    careRevision: plant.careRevision ?? 0, waterLedgerRevision: plant.waterLedgerRevision ?? 0, setupLedgerRevision: plant.setupLedgerRevision ?? 0, locationTimeZone: plant.locationTimeZone ?? null });
}
export function inspectCareSnapshot(value: unknown, plant: Plant, nowUtc: number): CareReadResult {
  const raw = value && typeof value === 'object' ? value as Partial<CareSnapshot> : null;
  const e = raw?.evaluation;
  const base = { source: 'local_fallback' as const, checkedAtUtc: nowUtc, backendRevisionPresent: !!plant.careEvaluationRevision,
    ...(finite(e?.evaluationUtc) ? { snapshotEvaluatedUtc: e.evaluationUtc } : {}), ...(finite(e?.nextEvaluationUtc) ? { snapshotExpiresUtc: e.nextEvaluationUtc } : {}) };
  const reject = (status: string): CareReadResult => ({ evaluation: null, diagnostic: { ...base, status } });
  if (e?.execution === 'local-experimental') return reject('server_snapshot_release_invalid');
  if (!plant.careEvaluationRevision) return reject('server_evaluation_missing');
  if (value == null) return reject('server_snapshot_missing');
  if (!raw) return reject('server_snapshot_invalid');
  const s = value as Partial<CareSnapshot>;
  if (s.schemaVersion !== 1 || typeof s.revision !== 'string') return reject('server_snapshot_invalid');
  if (s.revision !== plant.careEvaluationRevision) return reject('server_snapshot_revision_mismatch');
  if (s.inputKey !== careInputKey(plant)) return reject('server_snapshot_input_changed');
  if (e?.engineVersion !== ENGINE_VERSION) return reject('server_snapshot_engine_unsupported');
  if (e?.locationRevision !== (plant.locationRevision ?? 0)) return reject('server_snapshot_location_mismatch');
  if (finite(e?.evaluationUtc) && e.evaluationUtc > nowUtc) return reject('server_snapshot_future_evaluation');
  if (finite(e?.nextEvaluationUtc) && e.nextEvaluationUtc <= nowUtc) return reject('server_evaluation_expired');
  if (!evaluationValidAt(e, nowUtc)) return reject('server_snapshot_invalid');
  const warnings = s.evaluation!.warnings;
  const states = ['triggered', 'not_triggered', 'unknown', 'not_applicable', 'disabled', 'context_only', 'review_requested'];
  if (!Array.isArray(warnings) || warnings.length !== 14 || new Set(warnings.map(w => w?.id)).size !== 14
    || !warnings.every(w => w && /^W(0[1-9]|1[0-4])$/.test(w.id) && states.includes(w.state)
      && ['current', 'historical24h', 'forecast24h'].includes(w.phase) && Array.isArray(w.reasonCodes))) return reject('server_snapshot_invalid');
  // Authorization originates in the protected backend document, never plant fields or a shadow candidate.
  if (s.evaluation!.water.needsWater !== null) {
    const release = s.evaluation!.waterRelease;
    if (!release || ![release.approvalRecordId, release.profileId, release.profileVersion].every(v => typeof v === 'string' && !!v.trim())
      || release.profileVersion !== s.evaluation!.profileVersion || !Number.isFinite(s.waterConfigurationRevision)) return reject('server_snapshot_release_invalid');
  }
  return { evaluation: s.evaluation!, diagnostic: { ...base, source: 'backend', status: 'backend_evaluation_available' } };
}
export function decodeCareSnapshot(value: unknown, plant: Plant, nowUtc: number): Evaluation | null {
  return inspectCareSnapshot(value, plant, nowUtc).evaluation;
}
