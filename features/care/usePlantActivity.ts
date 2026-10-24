import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useSession } from '@/services/session';
import { createLiveStore } from '@/lib/data/liveStore';
import type { JournalEntry } from '@/lib/logs/journalRepository';
export type ActivityKind = 'watering' | 'fertilizing' | 'recent';
export const activityStore = createLiveStore<JournalEntry[]>([], key => (next, fail) => {
  const [, id, kind] = JSON.parse(key) as string[];
  const ref = collection(db, 'plants', id, 'logs');
  const q = kind === 'recent' ? query(ref, orderBy('timestamp', 'desc'), limit(4)) : query(ref, where('type', '==', kind), orderBy('timestamp', 'desc'), limit(1));
  return onSnapshot(q, snapshot => next(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as JournalEntry))), fail);
}, 'Some care history could not be loaded. Retry before recording care.');
const empty = { logs: {} as Record<string, JournalEntry[]>, loading: false, error: '' };
export function usePlantActivity(ids: readonly string[], kinds: readonly ActivityKind[]) {
  const { user } = useSession(); const uid = user?.uid;
  const idsKey = JSON.stringify([...new Set(ids)].sort()); const kindsKey = JSON.stringify([...new Set(kinds)].sort());
  const selection = useMemo(() => {
    const keys: { cache: string; name: string }[] = uid ? (JSON.parse(idsKey) as string[]).flatMap(id => (JSON.parse(kindsKey) as ActivityKind[]).map(kind => ({ cache: JSON.stringify([uid, id, kind]), name: `${id}:${kind}` }))) : [];
    let previous: ReturnType<typeof activityStore.get>[] = []; let value = empty;
    return {
      subscribe: (notify: () => void) => { const stops = keys.map(key => activityStore.subscribe(key.cache, notify)); return () => stops.forEach(stop => stop()); },
      get: () => {
        const snapshots = keys.map(key => activityStore.get(key.cache));
        if (snapshots.length !== previous.length || snapshots.some((snapshot, i) => snapshot !== previous[i])) {
          previous = snapshots;
          value = { logs: Object.fromEntries(snapshots.map((snapshot, i) => [keys[i].name, snapshot.data])), loading: snapshots.some(snapshot => snapshot.loading), error: snapshots.find(snapshot => snapshot.error)?.error || '' };
        }
        return value;
      },
      refresh: () => keys.forEach(key => activityStore.refresh(key.cache)),
    };
  }, [uid, idsKey, kindsKey]);
  const snapshot = useSyncExternalStore(selection.subscribe, selection.get, () => empty);
  const refresh = useCallback(() => selection.refresh(), [selection]);
  return { ...snapshot, refresh };
}
