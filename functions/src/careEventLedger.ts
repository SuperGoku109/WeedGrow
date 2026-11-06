import { createHash } from 'node:crypto';
import { getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { normalizeWaterLog, type WaterLogFact } from '../../lib/careAlgorithm/logAdapter';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { canonicalEvents, type WaterEvent } from '../../lib/careAlgorithm/events';
import { careInputKey } from '../../lib/careAlgorithm/snapshot';
import type { Plant } from '../../firestoreModels';
import { ENGINE_VERSION } from '../../lib/careAlgorithm/types';

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
async function inspectWaterEvents(plantId: string, asOfUtc: number, maxRecords = 2000) {
  if (!Number.isFinite(asOfUtc) || !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000) throw new Error('invalid_ledger_read');
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`);
  const [plant, rows, heads, currentWater] = await db.runTransaction(async tx => Promise.all([
    tx.get(parent),
    tx.get(parent.collection('careEvents').where('kind', '==', 'revision').limit(maxRecords + 1)),
    tx.get(parent.collection('careEvents').where('kind', '==', 'head').limit(maxRecords + 1)),
    tx.get(parent.collection('logs').where('type', '==', 'watering').limit(maxRecords + 1)),
  ]), { readOnly: true });
  const binding = { inputKey: plant.exists ? careInputKey(plant.data() as Plant) : null, asOfUtc,
    cacheable: rows.docs.every(doc => Number.isFinite(doc.data().availableUtc) && doc.data().availableUtc <= asOfUtc) };
  const fail = (reason: string) => ({ ...binding, events: [] as WaterEvent[], reasonCodes: [reason], complete: false, repairIds: [] as string[] });
  if (!plant.exists || plant.data()?.deleting) return fail('event_parent_unavailable');
  if (rows.size > maxRecords) return fail('event_history_read_limit');
  if (heads.size > maxRecords || currentWater.size > maxRecords) return fail('event_source_read_limit');
  const headById = new Map(heads.docs.map(doc => [doc.data().logId, doc.data()]));
  const activeIds = new Set(currentWater.docs.map(doc => doc.id));
  const repairIds = [...new Set([
    ...currentWater.docs.filter(doc => headById.get(doc.id)?.sourceDigest !== factDigest(sourceFact(doc.data()))).map(doc => doc.id),
    ...heads.docs.filter(doc => (!doc.data().event || doc.data().event.deleted !== true) && !activeIds.has(doc.data().logId)).map(doc => doc.data().logId as string),
  ])];
  if (repairIds.length) {
    return { ...fail('event_source_not_synchronized'), repairIds };
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
  if (issues.length) return { ...binding, events: [] as WaterEvent[], reasonCodes: [...new Set(issues)] as string[], complete: false, repairIds };
  const canonical = canonicalEvents(events, asOfUtc);
  return { ...binding, events, reasonCodes: canonical.issues, complete: canonical.issues.length === 0, repairIds };
}
export async function readWaterEvents(plantId: string, asOfUtc: number, maxRecords = 2000) {
  const { repairIds: _repairIds, ...result } = await inspectWaterEvents(plantId, asOfUtc, maxRecords);
  return result;
}
/** Initial/repair scan, bounded without truncating. It does not rewrite original user log timestamps. */
export async function synchronizeWaterEvents(plantId: string, maxRecords = 2000, clock: () => number = () => Date.now() / 1000,
  options: { useVerifiedCache?: boolean; cacheVerifiedResult?: boolean } = {}) {
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000) throw new Error('invalid_ledger_scan');
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`); const cacheRef = parent.collection('careWaterState').doc('eventView');
  let cached: FirebaseFirestore.DocumentData | undefined;
  if (options.useVerifiedCache || options.cacheVerifiedResult) {
    const [plant, cache] = await db.runTransaction(async tx => Promise.all([tx.get(parent), tx.get(cacheRef)]), { readOnly: true });
    cached = cache.data();
    const now = clock();
    if (options.useVerifiedCache && plant.exists && !plant.data()?.deleting && plant.data()?.careEventProtocol === 1
      && cached?.engineVersion === ENGINE_VERSION && cached.recordLimit === maxRecords
      && cached.result?.inputKey === careInputKey(plant.data() as Plant) && cached.result.complete === true && cached.result.cacheable === true
      && Number.isFinite(cached.result.asOfUtc) && cached.result.asOfUtc <= now
      && Array.isArray(cached.result.events) && Array.isArray(cached.result.reasonCodes)) {
      return { ...cached.result, asOfUtc: now } as Awaited<ReturnType<typeof readWaterEvents>>;
    }
    if (options.cacheVerifiedResult && plant.exists && !plant.data()?.deleting && plant.data()?.careEventProtocol !== 1) {
      // Close the legacy write window BEFORE taking the source snapshot. A
      // write committed before enrollment is included in the subsequent read;
      // one committed after enrollment must advance the protected revision.
      await db.runTransaction(async tx => {
        const current = await tx.get(parent);
        const revision = current.data()?.careRevision ?? 0;
        if (current.exists && !current.data()?.deleting && current.data()?.careEventProtocol !== 1
          && Number.isSafeInteger(revision) && revision >= 0) tx.update(parent, { careEventProtocol: 1 });
      });
    }
  }
  const first = await inspectWaterEvents(plantId, clock(), maxRecords);
  // A consistent source/ledger read already proves unchanged logs. Do not open
  // three-document transactions for every old watering on every timer tick.
  const { repairIds, ...verified } = first;
  for (const id of repairIds) await captureWaterEvent(plantId, id, clock);
  // Repairs can race new edits; only return a newly verified consistent view.
  const result = repairIds.length ? await readWaterEvents(plantId, clock(), maxRecords) : verified;
  // Protocol 1 is server-owned. Firestore rules require an atomic monotonically
  // increasing careRevision on every relevant source create/edit/delete. The
  // cache therefore cannot survive a client change, even before its trigger.
  if (options.cacheVerifiedResult && result.complete && result.cacheable && result.inputKey !== null
    && (cached?.result?.inputKey !== result.inputKey || cached.engineVersion !== ENGINE_VERSION || cached.recordLimit !== maxRecords)) {
    const stored = { engineVersion: ENGINE_VERSION, recordLimit: maxRecords, result };
    if (Buffer.byteLength(JSON.stringify(stored)) <= 600000) await db.runTransaction(async tx => {
      const current = await tx.get(parent);
      if (!current.exists || current.data()?.deleting || current.data()?.careEventProtocol !== 1 || careInputKey(current.data() as Plant) !== result.inputKey) return;
      if (!Number.isSafeInteger(current.data()?.careRevision ?? 0) || (current.data()?.careRevision ?? 0) < 0) return;
      tx.set(cacheRef, stored);
    });
  }
  return result;
}
