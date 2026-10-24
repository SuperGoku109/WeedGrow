import { requireUserId } from '@/services/session';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Plant } from '@/firestoreModels';

export interface PlantItem extends Plant {
  id: string;
}

export const fetchPlants = async (): Promise<PlantItem[]> => {
  const q = query(collection(db, 'plants'), where('owners', 'array-contains', requireUserId()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Plant),
  }));
};
