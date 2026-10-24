import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { createLiveStore } from '@/lib/data/liveStore';
import type { Plant, Group } from '@/firestoreModels';
export type OwnedPlant = Plant & { id: string };
export type OwnedGroup = Group & { id: string };
function ownedCollection<T extends { id: string }>(name: string, ownerField: string, operation: '==' | 'array-contains', message: string) {
  return createLiveStore<T[]>([], uid => (next, fail) => {
    let previous = new Map<string, { serialized: string; value: T }>();
    return onSnapshot(query(collection(db, name), where(ownerField, operation, uid)), snapshot => {
      const records = new Map<string, { serialized: string; value: T }>();
      const data = snapshot.docs.map(item => {
        const raw = item.data(); const serialized = JSON.stringify(raw); const old = previous.get(item.id);
        const value = old?.serialized === serialized ? old.value : { ...raw, id: item.id } as T;
        records.set(item.id, { serialized, value }); return value;
      });
      previous = records; next(data);
    }, fail);
  }, message);
}
export const plantsStore = ownedCollection<OwnedPlant>('plants', 'owners', 'array-contains', 'Your plants could not be loaded. Check your connection and retry.');
export const groupsStore = ownedCollection<OwnedGroup>('groups', 'createdBy', '==', 'Growing spaces could not be loaded. Please retry.');
// Successful writes arrive through live streams; only failed streams reconnect.
export function invalidatePlantCache() { plantsStore.retryFailed(); }
