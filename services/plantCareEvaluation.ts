import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Plant } from '@/firestoreModels';
import { inspectCareSnapshot } from '@/lib/careAlgorithm/snapshot';
import type { CareReadResult } from '@/lib/careAlgorithm/careDiagnostics';
import { registerPrivateCacheReset } from '@/lib/data/liveStore';
import { requireUserId } from './session';

const snapshots = new Map<string, Promise<unknown>>();
registerPrivateCacheReset(() => snapshots.clear());

/** A protected server snapshot is the only weather-care source; legacy client caches cannot authenticate it. */
export async function readPlantCareEvaluation(id: string, plant: Plant, now: Date) {
  return (await readPlantCareStatus(id, plant, now)).evaluation;
}
export async function readPlantCareStatus(id: string, plant: Plant, now: Date): Promise<CareReadResult> {
  if (!plant.careEvaluationRevision || plant.deleting || plant.status !== 'active') return inspectCareSnapshot(null, plant, now.getTime() / 1000);
  try {
    const uid = requireUserId();
    if (!plant.owners.includes(uid)) throw { code: 'permission-denied' };
    const key = JSON.stringify([uid, id, plant.careEvaluationRevision]);
    let pending = snapshots.get(key);
    if (!pending) {
      pending = getDoc(doc(db, 'plants', id, 'care', 'current')).then(result => result.exists() ? result.data() : null);
      snapshots.set(key, pending);
      if (snapshots.size > 100) snapshots.delete(snapshots.keys().next().value!);
    }
    const value = await pending.catch(error => { if (snapshots.get(key) === pending) snapshots.delete(key); throw error; });
    if (requireUserId() !== uid) throw { code: 'unauthenticated' };
    // The server pointer is an immutable revision identity. Always revalidate
    // setup and expiry against this caller's current plant/time, even on a hit.
    const inspected = inspectCareSnapshot(value, plant, now.getTime() / 1000);
    if (!['backend_evaluation_available', 'server_evaluation_expired'].includes(inspected.diagnostic.status)) {
      if (snapshots.get(key) === pending) snapshots.delete(key);
    }
    return inspected;
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code).replace(/^firestore\//, '') : '';
    const status = code === 'permission-denied' || code === 'unauthenticated' ? 'server_snapshot_read_permission_denied'
      : ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code) ? 'server_snapshot_read_unavailable' : 'server_snapshot_read_failed';
    // Raw SDK/provider messages can contain request details. Only stable diagnostic codes leave this service.
    return { evaluation: null, diagnostic: { source: 'local_fallback', status, checkedAtUtc: now.getTime() / 1000, backendRevisionPresent: true } };
  }
}
