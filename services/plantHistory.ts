import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './session';
import { decodeLog } from '@/lib/data/recordDecoders';

export type HistoryCursor = QueryDocumentSnapshot;
export async function fetchPlantHistoryPage(plantId: string, cursor?: HistoryCursor) {
  requireUserId();
  const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'logs'), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(30)));
  return {
    entries: snapshot.docs.map(item => ({ ...decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/logs/${item.id}`), id: item.id })),
    cursor: snapshot.docs.at(-1), hasMore: snapshot.size === 30,
  };
}
