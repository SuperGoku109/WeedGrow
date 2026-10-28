import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, where } from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './session';
import type { CareSummary, CareSummaryEntry } from '@/firestoreModels';
const pending = new Map<string, Promise<void>>();
/** Revision-checked derived data. Journal mutations invalidate it in the same transaction. */
export async function ensureCareSummary(id: string): Promise<void> {
  const uid = requireUserId(); const key = `${uid}:${id}`;
  const previous = pending.get(key); if (previous) return previous;
  const work = (async () => {
    const ref = doc(db, 'plants', id);
    for (let attempt = 0; attempt < 3; attempt++) {
      const initial = await getDoc(ref); const data = initial.data();
      if (!data || !data.owners?.includes(uid) || data.deleting) return;
      const revision = data.careRevision || 0;
      if (data.careSummary?.version === 1 && data.careSummary.revision === revision) return;
      const summary: CareSummary = { version: 1, revision, watering: null, fertilizing: null };
      for (const kind of ['watering', 'fertilizing'] as const) {
        const result = await getDocs(query(collection(db, 'plants', id, 'logs'), where('type', '==', kind), orderBy('timestamp', 'desc'), limit(1)));
        if (result.metadata?.fromCache) return; // Cached partial history cannot establish a complete summary.
        const log = result.docs[0]; const entry = log?.data();
        if (entry) summary[kind] = { id: log.id, timestamp: entry.timestamp, ...(entry.mutationId ? { mutationId: entry.mutationId } : {}), ...(entry.calendarDay ? { calendarDay: entry.calendarDay } : {}), ...(entry.timeZone ? { timeZone: entry.timeZone } : {}) } as CareSummaryEntry;
      }
      const saved = await runTransaction(db, async tx => {
        if (requireUserId() !== uid) return false;
        const current = await tx.get(ref); const plant = current.data();
        if (!plant || plant.deleting || !plant.owners?.includes(uid)) return true;
        if ((plant.careRevision || 0) !== revision) return false;
        if (plant.careSummary?.version === 1 && plant.careSummary.revision === revision) return true;
        tx.update(ref, { careSummary: summary }); return true;
      });
      if (saved) return;
    }
  })().finally(() => { if (pending.get(key) === work) pending.delete(key); });
  pending.set(key, work); return work;
}
