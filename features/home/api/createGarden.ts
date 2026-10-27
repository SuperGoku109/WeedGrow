import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { Group } from '@/firestoreModels';

export const newGardenId = () => doc(collection(db, 'groups')).id;
export async function createGarden(id: string, name: string, environment: Group['environment']) {
  const uid = requireUserId();
  if (!name.trim() || name.trim().length > 100) throw new Error('Give your garden a name of 1–100 characters.');
  if (!['indoor', 'outdoor', 'greenhouse'].includes(environment)) throw new Error('Choose a garden environment.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'groups', id);
    const previous = await tx.get(ref);
    if (previous.exists()) {
      if (previous.data().createdBy !== uid) throw new Error('This garden is unavailable.');
      return; // Retrying a lost response must not create another garden.
    }
    tx.set(ref, { name: name.trim(), environment, plantIds: [], location: null, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return id;
}
