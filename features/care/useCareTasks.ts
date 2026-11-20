import React from 'react';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { buildCareTasks } from '@/lib/care/careTasks';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { usePlantActivity } from './usePlantActivity';
export function useCareTasks(enabled = true, scopeIds?: readonly string[]) {
  const garden = usePlantList(); const now = useMinuteClock();
  const scopeKey = scopeIds ? JSON.stringify([...scopeIds].sort()) : null;
  const active = React.useMemo(() => { const scope = scopeKey ? new Set<string>(JSON.parse(scopeKey)) : null; return garden.plants.filter(plant => plant.status === 'active' && !plant.deleting && (!scope || scope.has(plant.id))); }, [garden.plants, scopeKey]);
  const activity = usePlantActivity((enabled ? active : []).map(plant => plant.id), ['watering', 'fertilizing'], active);
  const refreshActivity = activity.refresh; const refreshGarden = garden.refresh;
  const refresh = React.useCallback(() => { refreshActivity(); refreshGarden(); }, [refreshActivity, refreshGarden]);
  const tasks = React.useMemo(() => activity.loading || activity.error ? [] : active.flatMap(plant => buildCareTasks(plant, [...(activity.logs[`${plant.id}:watering`] || []), ...(activity.logs[`${plant.id}:fertilizing`] || [])], now)), [active, activity.loading, activity.error, activity.logs, now]);
  return { ...garden, plantLoading: garden.loading, plantError: garden.error, refresh, tasks, now, error: garden.error || activity.error, loading: garden.loading || activity.loading };
}
