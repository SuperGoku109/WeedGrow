import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { decodeLog } from '@/lib/data/recordDecoders';
import { validateLogDate } from './plantJournal';
export type JournalCursor = QueryDocumentSnapshot;
/** The search controls intentionally use the viewer's calendar day. Plant-day
 * grouping and saved historical weather remain separate domain operations. */
export async function fetchJournalPage(plantId: string, start: string, end: string, pageSize = 50, cursor?: JournalCursor) {
  requireUserId();
  if ((start && validateLogDate(start)) || validateLogDate(end) || start > end || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Choose a valid journal date range and page size.');
  const constraints: QueryConstraint[] = [where('timestamp', '<=', Timestamp.fromDate(new Date(end + 'T23:59:59.999'))), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(pageSize)];
  if (start) constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(start + 'T00:00:00'))));
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'logs'), ...constraints));
  return { entries: snapshot.docs.map(item => ({ ...decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/logs/${item.id}`), id: item.id })), cursor: snapshot.docs.at(-1), hasMore: snapshot.size === pageSize };
}
