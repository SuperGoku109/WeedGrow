import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Plant } from '@/firestoreModels';
import { inspectCareSnapshot } from '@/lib/careAlgorithm/snapshot';
import type { CareReadResult } from '@/lib/careAlgorithm/careDiagnostics';

/** A protected server snapshot is the only weather-care source; legacy client caches cannot authenticate it. */
export async function readPlantCareEvaluation(id: string, plant: Plant, now: Date) {
  return (await readPlantCareStatus(id, plant, now)).evaluation;
}
export async function readPlantCareStatus(id: string, plant: Plant, now: Date): Promise<CareReadResult> {
  if (!plant.careEvaluationRevision || plant.deleting || plant.status !== 'active') return inspectCareSnapshot(null, plant, now.getTime() / 1000);
  try {
    const result = await getDoc(doc(db, 'plants', id, 'care', 'current'));
    return inspectCareSnapshot(result.exists() ? result.data() : null, plant, now.getTime() / 1000);
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code).replace(/^firestore\//, '') : '';
    const status = code === 'permission-denied' || code === 'unauthenticated' ? 'server_snapshot_read_permission_denied'
      : ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code) ? 'server_snapshot_read_unavailable' : 'server_snapshot_read_failed';
    // Raw SDK/provider messages can contain request details. Only stable diagnostic codes leave this service.
    return { evaluation: null, diagnostic: { source: 'local_fallback', status, checkedAtUtc: now.getTime() / 1000, backendRevisionPresent: true } };
  }
}
