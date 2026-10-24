import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { Group } from '@/firestoreModels';
export type GrowingSpace = Group & { id: string };
export async function fetchGrowingSpaces(): Promise<GrowingSpace[]> {
  const uid = requireUserId();
  const snapshot = await getDocs(query(collection(db, 'groups'), where('createdBy', '==', uid)));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id } as GrowingSpace));
}
