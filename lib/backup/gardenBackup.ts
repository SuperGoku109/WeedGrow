import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, query, where, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { escapeCsv, validateBackup, type GardenBackup, type BackupRecord } from './backupFormat';
function encode(value: any): any {
  if (value?.toMillis) return { $timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]));
  return value;
}
function decode(value: any): any {
  if (value && typeof value === 'object' && '$timestamp' in value) return Timestamp.fromMillis(value.$timestamp);
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
  return value;
}
export async function exportGarden(): Promise<GardenBackup> {
  const uid = requireUserId();
  const records: BackupRecord[] = [];
  let unavailablePhotos = 0;
  const portable = (data: Record<string, any>) => {
    for (const key of ['imageUri', 'imageUrl', 'url', 'photoUri']) if (typeof data[key] === 'string' && data[key] && !data[key].startsWith('firestore-photo:') && !/^https:\/\//i.test(data[key])) { data[key] = null; unavailablePhotos++; }
    return data;
  };
  for (const kind of ['plants', 'groups', 'sensorProfiles']) {
    const snapshot = await getDocs(query(collection(db, kind), where(kind === 'plants' ? 'owners' : 'createdBy', kind === 'plants' ? 'array-contains' : '==', uid)));
    for (const item of snapshot.docs) {
      const data = portable(encode(item.data()));
      // Old device-cache URIs cannot be restored on another device. Keep the
      // record but omit an image reference whose bytes were never uploaded.
      records.push({ path: item.ref.path, data });
      if (kind === 'plants') for (const sub of ['logs', 'progressPics', 'photoAssets', 'weatherCache']) {
        const children = await getDocs(collection(item.ref, sub));
        children.docs.forEach(child => { const data = portable(encode(child.data())); if (sub === 'progressPics' && !data.imageUrl && !data.url) return; records.push({ path: child.ref.path, data }); });
      }
    }
  }
  if (requireUserId() !== uid) throw new Error('Your account changed. Start the export again.');
  return { format: 'weedgrow', version: 1, backupId: doc(collection(db, 'backupIds')).id, exportedAt: new Date().toISOString(), records, warnings: [...(unavailablePhotos ? [`${unavailablePhotos} old device-only photo references were omitted because their image bytes were never uploaded.`] : [])] };
}
export function journalCsv(backup: GardenBackup) {
  const names = new Map(backup.records.filter(record => record.path.split('/').length === 2 && record.path.startsWith('plants/')).map(record => [record.path.split('/')[1], record.data.name]));
  return [['Plant', 'Date', 'Category', 'Observations', 'Water ml', 'Nutrients ml/L', 'pH', 'Height cm', 'Moisture %'].map(escapeCsv).join(','), ...backup.records.filter(record => record.path.includes('/logs/')).map(record => {
    const data = record.data as any;
    return [names.get(record.path.split('/')[1]), data.timestamp?.$timestamp ? new Date(data.timestamp.$timestamp).toISOString() : '', data.category || data.type, data.description, data.waterMl, data.nutrientMlPerL, data.ph, data.heightCm, data.soilMoisture].map(escapeCsv).join(',');
  })].join('\r\n');
}
export interface RestorePlan { operationId: string; paths: Record<string, string> }
function fingerprint(raw: string) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < raw.length; i++) { a = Math.imul(a ^ raw.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ raw.charCodeAt(i); }
  return `${raw.length}-${a >>> 0}-${b >>> 0}`;
}
export async function prepareRestore(raw: string): Promise<RestorePlan> {
  const uid = requireUserId(); const backup = validateBackup(raw);
  const key = `weedgrow.restore.v2.${uid}.${backup.backupId}.${fingerprint(raw)}`;
  const saved = await AsyncStorage.getItem(key);
  if (saved) return JSON.parse(saved) as RestorePlan;
  const plan = buildRestorePlan(backup);
  await AsyncStorage.setItem(key, JSON.stringify(plan));
  if (requireUserId() !== uid) throw new Error('Your account changed. Choose the backup again.');
  return plan;
}
export function createRestorePlan(raw: string): RestorePlan {
  return buildRestorePlan(validateBackup(raw));
}
function buildRestorePlan(backup: GardenBackup): RestorePlan {
  return { operationId: doc(collection(db, 'restoreIds')).id, paths: Object.fromEntries(backup.records.filter(record => record.path.split('/').length === 2).map(record => [record.path, `${record.path.split('/')[0]}/${doc(collection(db, record.path.split('/')[0])).id}`])) };
}
export async function restoreGarden(raw: string, plan?: RestorePlan, onProgress?: (done: number, total: number) => void) {
  const backup = validateBackup(raw);
  const uid = requireUserId();
  plan = plan || await prepareRestore(raw);
  // Each import has fresh IDs; restore never overwrites the existing garden.
  const mapping = new Map(Object.entries(plan.paths));
  const remapPath = (path: string) => { const parts = path.split('/'); return (mapping.get(parts.slice(0, 2).join('/')) || parts.slice(0, 2).join('/')) + (parts.length > 2 ? '/' + parts.slice(2).join('/') : ''); };
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  for (const record of backup.records) {
    const data = decode(record.data);
    const parts = record.path.split('/');
    if (parts.length === 2) {
      if (parts[0] === 'plants') data.owners = [uid]; else data.createdBy = uid;
      data.createdAt = serverTimestamp(); data.updatedAt = serverTimestamp();
      data.restoreOperationId = plan!.operationId;
      if (data.groupId) data.groupId = mapping.get(`groups/${data.groupId}`)?.split('/')[1] || null;
      if (data.sensorProfileId) data.sensorProfileId = mapping.get(`sensorProfiles/${data.sensorProfileId}`)?.split('/')[1] || null;
      if (Array.isArray(data.plantIds)) data.plantIds = data.plantIds.map((id: string) => mapping.get(`plants/${id}`)!.split('/')[1]);
      if (data.weatherSourcePlantId) data.weatherSourcePlantId = mapping.get(`plants/${data.weatherSourcePlantId}`)?.split('/')[1] || null;
    } else if (parts[2] === 'logs') data.updatedBy = uid;
    for (const field of ['imageUri', 'imageUrl', 'photoUri', 'url']) if (typeof data[field] === 'string' && data[field].startsWith('firestore-photo:')) data[field] = 'firestore-photo:' + remapPath(data[field].slice(16));
    writes.push({ path: remapPath(record.path), data });
  }
  // Parent records first; retries resume the same private destination IDs.
  // Small transactions stay below request-size and security-rule access limits.
  const ordered = [...writes.filter(write => write.path.split('/').length === 2), ...writes.filter(write => write.path.split('/').length > 2)];
  let done = 0;
  onProgress?.(done, ordered.length);
  while (done < ordered.length) {
    const chunk: typeof writes = []; const parents = new Set<string>(); let bytes = 0;
    for (let index = done; index < ordered.length; index++) {
      const write = ordered[index];
      const parent = write.path.split('/').slice(0, 2).join('/');
      const size = JSON.stringify(write.data).length;
      if (chunk.length && (chunk.length >= 30 || bytes + size > 1000000 || (!parents.has(parent) && parents.size >= 6))) break;
      parents.add(parent); chunk.push(write); bytes += size;
    }
    if (requireUserId() !== uid) throw new Error('Your account changed. Restore paused; sign back in and choose this file to resume.');
    await runTransaction(db, async tx => {
      const parentSnapshots = await Promise.all([...parents].map(path => tx.get(doc(db, path))));
      const existing = await Promise.all(chunk.map(write => tx.get(doc(db, write.path))));
      for (const parent of parentSnapshots) {
        if (parent.exists() && parent.data().restoreOperationId !== plan!.operationId) throw new Error('A restore destination changed. No existing garden records were replaced.');
      }
      chunk.forEach((write, index) => {
        // Immutable photo assets cannot be overwritten, and user edits to an
        // already restored copy also survive a retry.
        if (!existing[index].exists()) tx.set(doc(db, write.path), write.data);
      });
    });
    done += chunk.length; onProgress?.(done, ordered.length);
  }
  return mapping.size;
}
