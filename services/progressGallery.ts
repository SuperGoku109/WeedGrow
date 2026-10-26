import { collection, getDocs, limit, orderBy, query, startAfter, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { decodePhoto } from '@/lib/data/recordDecoders';
export type PhotoCursor = QueryDocumentSnapshot;
export async function fetchProgressPage(plantId: string, cursor?: PhotoCursor) {
  const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(20)];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'progressPics'), ...constraints));
  return { pics: snapshot.docs.map(item => decodePhoto(item.data({ serverTimestamps: 'estimate' }), item.id, `plants/${plantId}/progressPics/${item.id}`)), cursor: snapshot.docs.at(-1), hasMore: snapshot.size === 20 };
}
