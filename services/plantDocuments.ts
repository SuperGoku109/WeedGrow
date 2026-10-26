import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Plant } from '@/firestoreModels';
import { createLiveStore } from '@/lib/data/liveStore';
import { decodePlant } from '@/lib/data/recordDecoders';
export const plantDocuments = createLiveStore<Plant | null>(null, key => (next, fail) => {
  const [uid, id] = JSON.parse(key);
  return onSnapshot(doc(db, 'plants', id), snapshot => {
    try { const plant = snapshot.exists() ? decodePlant(snapshot.data({ serverTimestamps: 'estimate' }), `plants/${id}`) : null; next(plant?.owners.includes(uid) ? plant : null); }
    catch (error) { fail(error); }
  }, () => { next(null); fail(); });
}, 'This plant could not be loaded. Check your connection and retry.');
