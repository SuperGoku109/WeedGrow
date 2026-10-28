import { AppState } from 'react-native';
import { useEffect } from 'react';
import type { Plant } from '@/firestoreModels';
import { ensureCareSummary } from '@/services/careSummaries';
import { mapConcurrent } from '@/lib/data/mapConcurrent';
export function useCareSummarySync(plants: readonly (Pick<Plant, 'careSummary' | 'careRevision'> & { id: string })[], ids: readonly string[]) {
  const requested = new Set(ids);
  const key = JSON.stringify(plants.filter(p => requested.has(p.id) && (p.careSummary?.version !== 1 || p.careSummary.revision !== (p.careRevision || 0))).map(p => [p.id, p.careRevision || 0]));
  useEffect(() => {
    let active = true;
    const pending = JSON.parse(key) as [string, number][];
    if (!pending.length) return;
    const refresh = () => { void mapConcurrent(pending, 4, async ([id]) => { if (active) await ensureCareSummary(id).catch(() => {}); }).catch(() => {}); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; listener.remove(); };
  }, [key]);
}
