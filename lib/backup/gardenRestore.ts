import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { validateRestorePlan, type RestorePlan } from './restorePlan';
import { validateBackup, type GardenBackup, type BackupRecord } from './backupFormat';
import { decodeBackupRecord } from './backupCodec';
import { utf8Bytes } from './backupLimits';
export { validateRestorePlan, type RestorePlan } from './restorePlan';
function fingerprint(raw: string) { let a = 2166136261, b = 5381; for (let i = 0; i < raw.length; i++) { a = Math.imul(a ^ raw.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ raw.charCodeAt(i); } return `${raw.length}-${a >>> 0}-${b >>> 0}`; }
function buildPlan(backup: GardenBackup): RestorePlan { return { operationId: doc(collection(db, 'restoreIds')).id, paths: Object.fromEntries(backup.records.filter(record => record.path.split('/').length === 2).map(record => [record.path, `${record.path.split('/')[0]}/${doc(collection(db, record.path.split('/')[0])).id}`])) }; }
async function loadPlan(raw: string, backup: GardenBackup, uid: string) {
  const key = `weedgrow.restore.v2.${uid}.${backup.backupId}.${fingerprint(raw)}`; const saved = await AsyncStorage.getItem(key);
  const plan = saved ? validateRestorePlan(JSON.parse(saved) as unknown, backup) : buildPlan(backup);
  if (!saved) await AsyncStorage.setItem(key, JSON.stringify(plan));
  if (requireUserId() !== uid) throw new Error('Your account changed. Choose the backup again.');
  return plan;
}
export async function prepareRestore(raw: string) { const uid = requireUserId(); return loadPlan(raw, validateBackup(raw), uid); }
export function createRestorePlan(raw: string) { return buildPlan(validateBackup(raw)); }
export async function restoreGarden(raw: string, inputPlan?: RestorePlan, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  const backup = validateBackup(raw); const uid = requireUserId();
  const plan = inputPlan ? validateRestorePlan(inputPlan, backup) : await loadPlan(raw, backup, uid);
  const mapping = new Map(Object.entries(plan.paths));
  const remapPath = (path: string) => { const parts = path.split('/'); const root = mapping.get(parts.slice(0, 2).join('/')); if (!root) throw new Error('A restore destination is missing.'); return root + (parts.length > 2 ? '/' + parts.slice(2).join('/') : ''); };
  const prepare = (record: BackupRecord) => {
    const data = decodeBackupRecord(record.data); const parts = record.path.split('/');
    if (parts.length === 2) {
      if (parts[0] === 'plants') data.owners = [uid]; else data.createdBy = uid;
      data.createdAt = serverTimestamp(); data.updatedAt = serverTimestamp(); data.restoreOperationId = plan.operationId;
      if (typeof data.groupId === 'string' && data.groupId) data.groupId = mapping.get(`groups/${data.groupId}`)?.split('/')[1] || null;
      if (typeof data.sensorProfileId === 'string' && data.sensorProfileId) data.sensorProfileId = mapping.get(`sensorProfiles/${data.sensorProfileId}`)?.split('/')[1] || null;
      if (Array.isArray(data.plantIds)) data.plantIds = data.plantIds.map((id: unknown) => { if (typeof id !== 'string' || !mapping.has(`plants/${id}`)) throw new Error('A restored member is missing.'); return mapping.get(`plants/${id}`)!.split('/')[1]; });
      if (typeof data.weatherSourcePlantId === 'string') data.weatherSourcePlantId = mapping.get(`plants/${data.weatherSourcePlantId}`)?.split('/')[1] || null;
    } else if (parts[2] === 'logs') data.updatedBy = uid;
    for (const field of ['imageUri', 'imageUrl', 'photoUri', 'url']) { const uri = data[field]; if (typeof uri === 'string' && uri.startsWith('firestore-photo:')) data[field] = 'firestore-photo:' + remapPath(uri.slice(16)); }
    return { path: remapPath(record.path), data };
  };
  // Only references to encoded records are reordered; decoded photo data exists
  // in one bounded chunk, not a second complete copy of the backup.
  const ordered = [...backup.records.filter(record => record.path.split('/').length === 2), ...backup.records.filter(record => record.path.split('/').length > 2)];
  let done = 0; onProgress?.(done, ordered.length);
  while (done < ordered.length) {
    if (signal?.aborted || requireUserId() !== uid) throw new Error('Restore paused. Choose the same backup in this account to resume.');
    const chunk: ReturnType<typeof prepare>[] = []; const parents = new Set<string>(); let bytes = 0;
    for (let index = done; index < ordered.length; index++) {
      const record = ordered[index]; const parent = remapPath(record.path).split('/').slice(0, 2).join('/'); const size = utf8Bytes(JSON.stringify(record.data));
      if (chunk.length && (chunk.length >= 30 || bytes + size > 1000000 || (!parents.has(parent) && parents.size >= 6))) break;
      parents.add(parent); chunk.push(prepare(record)); bytes += size;
    }
    await runTransaction(db, async tx => {
      if (signal?.aborted || requireUserId() !== uid) throw new Error('Restore paused. Choose the same backup to resume.');
      const parentSnapshots = await Promise.all([...parents].map(path => tx.get(doc(db, path))));
      const existing = await Promise.all(chunk.map(write => tx.get(doc(db, write.path))));
      for (const parent of parentSnapshots) if (parent.exists() && (parent.data().restoreOperationId !== plan.operationId || parent.data().deleting)) throw new Error('A restore destination changed. No existing garden records were replaced.');
      chunk.forEach((write, index) => { if (!existing[index].exists()) tx.set(doc(db, write.path), write.data); });
      for (const parent of parentSnapshots) {
        if (!parent.exists()) continue;
        const changedCare = chunk.some((write, index) => !existing[index].exists() && write.path.startsWith(parent.ref.path + '/logs/') && ['watering', 'fertilizing'].includes(String(write.data.type)));
        if (changedCare) tx.update(parent.ref, { careSummary: null, careRevision: (parent.data().careRevision || 0) + 1 });
      }
    });
    done += chunk.length; onProgress?.(done, ordered.length);
  }
  return mapping.size;
}
