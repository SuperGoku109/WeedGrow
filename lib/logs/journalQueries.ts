import { plantDay, zonedTime, addDays } from '@/lib/dates/plantDay';
import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { decodeLog } from '@/lib/data/recordDecoders';
import { validateLogDate } from './plantJournal';
export type JournalCursor = QueryDocumentSnapshot;
/** Bound history in the plant's time zone when provided; other journal views use the device zone. */
export async function fetchJournalPage(plantId: string, start: string, end: string, pageSize = 50, cursor?: JournalCursor, timeZone?: string | null) {
  requireUserId();
  if ((start && validateLogDate(start, plantDay(new Date(), timeZone))) || validateLogDate(end, plantDay(new Date(), timeZone)) || start > end || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Choose a valid journal date range and page size.');
  const constraints: QueryConstraint[] = [where('timestamp', '<=', Timestamp.fromDate(new Date(zonedTime(addDays(end, 1), '00:00', timeZone).getTime() - 1))), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(pageSize)];
  if (start) constraints.push(where('timestamp', '>=', Timestamp.fromDate(zonedTime(start, '00:00', timeZone))));
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'logs'), ...constraints));
  return { entries: snapshot.docs.map(item => ({ ...decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/logs/${item.id}`), id: item.id })), cursor: snapshot.docs.at(-1), hasMore: snapshot.size === pageSize };
}
