import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { createLiveStore } from '@/lib/data/liveStore';
import { decodeLog, publishDecoded } from '@/lib/data/recordDecoders';
import type { JournalEntry } from '@/lib/logs/journalRepository';
export type ActivityKind = 'watering' | 'fertilizing' | 'recent';
export const activityStore = createLiveStore<JournalEntry[]>([], key => (next, fail) => {
  const [, id, kind] = JSON.parse(key) as string[];
  const ref = collection(db, 'plants', id, 'logs');
  const q = kind === 'recent' ? query(ref, orderBy('timestamp', 'desc'), limit(4)) : query(ref, where('type', '==', kind), orderBy('timestamp', 'desc'), limit(1));
  return onSnapshot(q, snapshot => publishDecoded(() => snapshot.docs.map(item => ({ ...decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${id}/logs/${item.id}`), id: item.id })), next, fail), fail);
}, 'Some care history could not be loaded. Retry before recording care.');
