import { useCareSummarySync } from './useCareSummarySync';
import { currentCareSummary, type CareSummarySource } from '@/lib/care/careSummary';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useSession } from '@/services/session';
import { activityStore, type ActivityKind } from '@/services/careActivity';
export { activityStore } from '@/services/careActivity';
export type { ActivityKind } from '@/services/careActivity';

const empty = { logs: {} as Record<string, JournalEntry[]>, loading: false, error: '' };
export function usePlantActivity(ids: readonly string[], kinds: readonly ActivityKind[], plants: readonly (CareSummarySource & { id: string })[] = []) {
  useCareSummarySync(plants, ids);
  const { user } = useSession(); const uid = user?.uid;
  const idsKey = JSON.stringify([...new Set(ids)].sort()); const kindsKey = JSON.stringify([...new Set(kinds)].sort());
  const summariesKey = JSON.stringify(plants.map(p => [p.id, currentCareSummary(p)]));
  const selection = useMemo(() => {
    const ids = JSON.parse(idsKey) as string[];
    const kinds = JSON.parse(kindsKey) as ActivityKind[];
    const selectedIds = new Set(ids);
    const summaryLogs: Record<string, JournalEntry[]> = {};
    for (const plant of plants) {
      if (!uid || !selectedIds.has(plant.id)) continue;
      const summary = currentCareSummary(plant);
      if (!summary) continue;
      for (const kind of kinds) {
        if (kind === 'recent') continue;
        const entry = summary[kind];
        if (entry === null) summaryLogs[`${plant.id}:${kind}`] = [];
        else if (entry?.id && typeof entry.timestamp?.toDate === 'function') summaryLogs[`${plant.id}:${kind}`] = [{ ...entry, type: kind, updatedBy: '' }];
      }
    }
    const keys: { cache: string; name: string }[] = [];
    if (uid) for (const id of ids) for (const kind of kinds) {
      const name = `${id}:${kind}`;
      if (!Object.hasOwn(summaryLogs, name)) keys.push({ cache: JSON.stringify([uid, id, kind]), name });
    }
    let previous: ReturnType<typeof activityStore.get>[] = []; let value = { ...empty, logs: summaryLogs };
    return {
      subscribe: (notify: () => void) => { const stops = keys.map(key => activityStore.subscribe(key.cache, notify)); return () => stops.forEach(stop => stop()); },
      get: () => {
        const snapshots = keys.map(key => activityStore.get(key.cache));
        if (snapshots.length !== previous.length || snapshots.some((snapshot, i) => snapshot !== previous[i])) {
          previous = snapshots;
          value = { logs: { ...summaryLogs, ...Object.fromEntries(snapshots.map((snapshot, i) => [keys[i].name, snapshot.data])) }, loading: snapshots.some(snapshot => snapshot.loading), error: snapshots.find(snapshot => snapshot.error)?.error || '' };
        }
        return value;
      },
      refresh: () => keys.forEach(key => activityStore.refresh(key.cache)),
    };
  // The serialized key retains listeners when unrelated plant fields change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, idsKey, kindsKey, summariesKey]);
  const snapshot = useSyncExternalStore(selection.subscribe, selection.get, () => empty);
  const refresh = useCallback(() => selection.refresh(), [selection]);
  return { ...snapshot, refresh };
}
