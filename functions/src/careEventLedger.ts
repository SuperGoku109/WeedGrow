import { createHash } from 'node:crypto';
import { getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { normalizeWaterLog, type WaterLogFact } from '../../lib/careAlgorithm/logAdapter';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { canonicalEvents, type WaterEvent } from '../../lib/careAlgorithm/events';

const utc = (value: unknown): number | null => {
  if (!value || typeof value !== 'object' || !('toMillis' in value) || typeof value.toMillis !== 'function') return null;
  const millis: unknown = value.toMillis(); return typeof millis === 'number' && Number.isFinite(millis) ? millis / 1000 : null;
};
function sourceFact(raw: DocumentData | undefined): WaterLogFact | null {
  return raw ? { type: raw.type, occurredUtc: utc(raw.timestamp), recordedUtc: utc(raw.recordedAt), assertedUtc: utc(raw.editedAt),
    calendarDay: raw.calendarDay ?? null, timeZone: raw.timeZone ?? null, precision: raw.occurrencePrecision ?? 'unknown', waterMl: raw.waterMl ?? null } : null;
}
const factDigest = (fact: WaterLogFact | null) => createHash('sha256').update(revisionFingerprint(fact ? { ...fact, assertedUtc: null } : null)).digest('hex');
/** Re-read current source facts in the transaction: old/out-of-order triggers cannot overwrite newer source facts. */
export async function captureWaterEvent(plantId: string, logId: string, clock: () => number = () => Date.now() / 1000) {
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`); const source = parent.collection('logs').doc(logId);
  const key = createHash('sha256').update(logId).digest('hex'); const head = parent.collection('careEvents').doc(`head_${key}`);
  return db.runTransaction(async tx => {
    const [plant, log, previous] = await Promise.all([tx.get(parent), tx.get(source), tx.get(head)]);
    if (!plant.exists || plant.data()?.deleting) return false;
    const raw = log.data(); const prior = previous.data();
    if (!prior && raw?.type !== 'watering') return false;
    const fact = sourceFact(raw);
    // Captions and other presentation edits cannot create a new physical watering revision.
    const digest = factDigest(fact);
    if (prior?.sourceDigest === digest) return false;
    const availableUtc = clock(); const revision = (prior?.revision ?? 0) + 1;
    if (!Number.isFinite(availableUtc)) throw new Error('invalid_event_acquisition_time');
    const normalized = normalizeWaterLog(logId, revision, fact, availableUtc);
    const stored = { schemaVersion: 1, kind: 'revision', logId, revision, sourceDigest: digest,
      availableUtc, event: normalized.event, reasonCodes: normalized.reasonCodes };
    tx.set(parent.collection('careEvents').doc(`revision_${key}_${String(revision).padStart(12, '0')}`), stored);
    tx.set(head, { ...stored, kind: 'head' });
    tx.update(parent, { waterLedgerRevision: (plant.data()?.waterLedgerRevision ?? 0) + 1 });
    return true;
  });
}
/** Bounded complete read. Overflow is explicit uncertainty, never a silently truncated watering history. */
export async function readWaterEvents(plantId: string, asOfUtc: number, maxRecords = 2000) {
  if (!Number.isFinite(asOfUtc) || !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000) throw new Error('invalid_ledger_read');
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`);
  const [rows, heads, currentWater] = await db.runTransaction(async tx => Promise.all([
    tx.get(parent.collection('careEvents').where('kind', '==', 'revision').limit(maxRecords + 1)),
    tx.get(parent.collection('careEvents').where('kind', '==', 'head').limit(maxRecords + 1)),
    tx.get(parent.collection('logs').where('type', '==', 'watering').limit(maxRecords + 1)),
  ]), { readOnly: true });
  if (rows.size > maxRecords) return { events: [] as WaterEvent[], reasonCodes: ['event_history_read_limit'], complete: false };
  if (heads.size > maxRecords || currentWater.size > maxRecords) return { events: [] as WaterEvent[], reasonCodes: ['event_source_read_limit'], complete: false };
  const headById = new Map(heads.docs.map(doc => [doc.data().logId, doc.data()]));
  const activeIds = new Set(currentWater.docs.map(doc => doc.id));
  if (currentWater.docs.some(doc => headById.get(doc.id)?.sourceDigest !== factDigest(sourceFact(doc.data())))
    || heads.docs.some(doc => doc.data().event && doc.data().event.deleted !== true && !activeIds.has(doc.data().logId))) {
    return { events: [] as WaterEvent[], reasonCodes: ['event_source_not_synchronized'], complete: false };
  }
  const records = rows.docs.map(row => row.data()).filter(row => row.availableUtc <= asOfUtc);
  const latest = new Map<string, typeof records[number]>();
  for (const row of records) {
    const existing = latest.get(row.logId);
    if (!existing || row.revision > existing.revision) latest.set(row.logId, row);
  }
  const issues = [...latest.values()].flatMap(row => row.event ? [] : row.reasonCodes);
  const events = records.flatMap(row => row.event ? [row.event as WaterEvent] : []);
  // An invalid latest fact cannot leave an older valid watering active.
  if (issues.length) return { events: [], reasonCodes: [...new Set(issues)] as string[], complete: false };
  const canonical = canonicalEvents(events, asOfUtc);
  return { events, reasonCodes: canonical.issues, complete: canonical.issues.length === 0 };
}
/** Initial/repair scan, bounded without truncating. It does not rewrite original user log timestamps. */
export async function synchronizeWaterEvents(plantId: string, maxRecords = 2000, clock: () => number = () => Date.now() / 1000) {
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000) throw new Error('invalid_ledger_scan');
  const parent = getFirestore().doc(`plants/${plantId}`);
  const [water, heads] = await Promise.all([parent.collection('logs').where('type', '==', 'watering').limit(maxRecords + 1).get(),
    parent.collection('careEvents').where('kind', '==', 'head').limit(maxRecords + 1).get()]);
  if (water.size > maxRecords || heads.size > maxRecords) return { complete: false, reasonCodes: ['event_source_read_limit'] };
  const ids = new Set([...water.docs.map(doc => doc.id), ...heads.docs.map(doc => doc.data().logId as string)]);
  for (const id of ids) await captureWaterEvent(plantId, id, clock);
  const result = await readWaterEvents(plantId, clock(), maxRecords);
  return { complete: result.complete, reasonCodes: result.reasonCodes };
}
