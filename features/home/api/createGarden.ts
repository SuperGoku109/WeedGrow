import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { Group } from '@/firestoreModels';
import { validCoordinates, coordinateLabel, type Coordinates } from '@/features/location/locationService';

export const newGardenId = () => doc(collection(db, 'groups')).id;
export async function createGarden(id: string, name: string, environment: Group['environment'], location: Coordinates, locationLabel = '') {
  const uid = requireUserId();
  if (!name.trim() || name.trim().length > 100) throw new Error('Give your garden a name of 1–100 characters.');
  if (!['indoor', 'outdoor', 'greenhouse'].includes(environment)) throw new Error('Choose a garden environment.');
  if (!validCoordinates(location)) throw new Error('Choose a location for your garden to start collecting weather.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'groups', id);
    const previous = await tx.get(ref);
    if (previous.exists()) {
      if (previous.data().createdBy !== uid) throw new Error('This garden is unavailable.');
      return; // Retrying a lost response must not create another garden.
    }
    tx.set(ref, { name: name.trim(), environment, plantIds: [], location: { lat: location.lat, lng: location.lng }, locationLabel: locationLabel.trim() || coordinateLabel(location), createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return id;
}
