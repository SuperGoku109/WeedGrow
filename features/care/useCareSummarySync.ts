import { AppState } from 'react-native';
import { useEffect } from 'react';
import { currentCareSummary, type CareSummarySource } from '@/lib/care/careSummary';
import { ensureCareSummary } from '@/services/careSummaries';
import { mapConcurrent } from '@/lib/data/mapConcurrent';
export function useCareSummarySync(plants: readonly (CareSummarySource & { id: string })[], ids: readonly string[]) {
  const requested = new Set(ids);
  const key = JSON.stringify(plants.filter(p => requested.has(p.id) && !currentCareSummary(p)).map(p => [p.id, p.careRevision ?? 0]));
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
