import { collection, query, where } from 'firebase/firestore';
import { listenPagedQuery } from '@/lib/data/pagedLiveQuery';
import { decodePlant, decodeGroup } from '@/lib/data/recordDecoders';
import { db } from './firebase';
import { createLiveStore } from '@/lib/data/liveStore';
import type { Plant, Group } from '@/firestoreModels';
export type OwnedPlant = Plant & { id: string };
export type OwnedGroup = Group & { id: string };
function ownedCollection<T extends { id: string }>(name: string, ownerField: string, operation: '==' | 'array-contains', message: string, decode: (raw: unknown, path: string, id: string) => T) {
  return createLiveStore<T[]>([], uid => (next, fail) => {
    let previous = new Map<string, { serialized: string; value: T }>();
    return listenPagedQuery(query(collection(db, name), where(ownerField, operation, uid)), item => {
      const raw = item.data({ serverTimestamps: 'estimate' }); const serialized = JSON.stringify(raw); const old = previous.get(item.id);
      const value = old?.serialized === serialized ? old.value : decode(raw, `${name}/${item.id}`, item.id);
      previous.set(item.id, { serialized, value }); return value;
    }, data => { const ids = new Set(data.map(item => item.id)); previous = new Map([...previous].filter(([id]) => ids.has(id))); next(data); }, fail);
  }, message);
}
export const plantsStore = ownedCollection<OwnedPlant>('plants', 'owners', 'array-contains', 'Your plants could not be loaded. Check your connection and retry.', (raw, path, id) => ({ ...decodePlant(raw, path), id }));
export const groupsStore = ownedCollection<OwnedGroup>('groups', 'createdBy', '==', 'Growing spaces could not be loaded. Please retry.', (raw, path, id) => ({ ...decodeGroup(raw, path), id }));
// Successful writes arrive through live streams; only failed streams reconnect.
export function invalidatePlantCache() { plantsStore.retryFailed(); }
