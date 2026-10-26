import type { JournalEntry } from '@/lib/logs/journalRepository';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSession } from '@/services/session';
import { activityStore, type ActivityKind } from '@/services/careActivity';
export { activityStore } from '@/services/careActivity';
export type { ActivityKind } from '@/services/careActivity';

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
