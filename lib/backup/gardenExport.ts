import { collection, doc, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { queryPages } from '@/lib/data/queryPages';
import { csvHeader, csvRow } from './journalCsv';
import { encodeBackupRecord } from './backupCodec';
import { MAX_BACKUP_BYTES, MAX_BACKUP_RECORDS, utf8Bytes } from './backupLimits';
import { validateBackup, type GardenBackup, type BackupRecord } from './backupFormat';
export { journalCsv } from './journalCsv';
export interface ExportOptions { signal?: AbortSignal; onProgress?: (records: number) => void }
function guard(uid: string, options?: ExportOptions) { if (options?.signal?.aborted) throw new Error('Export cancelled.'); if (requireUserId() !== uid) throw new Error('Your account changed. Start the export again.'); }
export async function exportGarden(options?: ExportOptions): Promise<GardenBackup> {
  const uid = requireUserId(); const active = () => guard(uid, options); const records: BackupRecord[] = [];
  let bytes = 2048; let unavailablePhotos = 0;
  const append = (path: string, raw: Record<string, unknown>) => {
    active(); if (raw.deleting) throw new Error('Finish pending deletions before making a complete backup.');
    const data = encodeBackupRecord(raw); delete data.deleting; delete data.careSummary; delete data.careRevision;
    for (const key of ['imageUri', 'imageUrl', 'url', 'photoUri']) if (typeof data[key] === 'string' && data[key] && !data[key].startsWith('firestore-photo:') && !/^https:\/\//i.test(data[key])) { data[key] = null; unavailablePhotos++; }
    if (path.includes('/progressPics/') && !data.imageUrl && !data.url) return;
    const record = { path, data }; bytes += utf8Bytes(JSON.stringify(record)) + 1;
    if (bytes > MAX_BACKUP_BYTES || records.length >= MAX_BACKUP_RECORDS) throw new Error('This export exceeds the supported 30 MB / 50,000 record limit. No incomplete backup was downloaded.');
    records.push(record); options?.onProgress?.(records.length);
  };
  for (const kind of ['plants', 'groups', 'sensorProfiles']) {
    const base = query(collection(db, kind), where(kind === 'plants' ? 'owners' : 'createdBy', kind === 'plants' ? 'array-contains' : '==', uid));
    for await (const page of queryPages(base, 50, active)) for (const item of page) {
      append(item.ref.path, item.data());
      if (kind === 'plants') for (const sub of ['logs', 'progressPics', 'photoAssets', 'weatherCache']) for await (const children of queryPages(collection(item.ref, sub), sub === 'photoAssets' ? 10 : 50, active)) for (const child of children) append(child.ref.path, child.data());
    }
  }
  active();
  const result: GardenBackup = { format: 'weedgrow', version: 1, backupId: doc(collection(db, 'backupIds')).id, exportedAt: new Date().toISOString(), records, warnings: unavailablePhotos ? [`${unavailablePhotos} old device-only photo references were omitted because their image bytes were never uploaded.`] : [] };
  // Concurrent changes may leave an inconsistent cross-record export. Reject
  // it rather than downloading a file that cannot later be restored.
  if (!records.length) throw new Error('There is no garden data to export yet.');
  return validateBackup(JSON.stringify(result));
}
export async function exportJournalCsv(options?: ExportOptions) {
  const uid = requireUserId(); const active = () => guard(uid, options); const lines = [csvHeader]; let bytes = utf8Bytes(csvHeader);
  for await (const plants of queryPages(query(collection(db, 'plants'), where('owners', 'array-contains', uid)), 50, active)) for (const plant of plants) {
    for await (const logs of queryPages(collection(plant.ref, 'logs'), 50, active)) for (const log of logs) {
      const row = csvRow(plant.data().name, encodeBackupRecord(log.data())); bytes += utf8Bytes(row) + 2;
      if (bytes > MAX_BACKUP_BYTES || lines.length > MAX_BACKUP_RECORDS) throw new Error('The journal export exceeds the supported 30 MB / 50,000 entry limit.');
      lines.push(row); options?.onProgress?.(lines.length - 1);
    }
  }
  active(); return lines.join('\r\n');
}
