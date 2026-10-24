import React from 'react';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { buildCareTasks } from '@/lib/care/careTasks';
import { plantDay } from '@/lib/dates/plantDay';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { usePlantActivity } from './usePlantActivity';
export function useCareTasks(enabled = true) {
  const garden = usePlantList(); const now = useMinuteClock();
  const active = React.useMemo(() => garden.plants.filter(plant => plant.status === 'active'), [garden.plants]);
  const activity = usePlantActivity((enabled ? active : []).map(plant => plant.id), ['watering', 'fertilizing']);
  const refreshActivity = activity.refresh; const refreshGarden = garden.refresh;
  const refresh = React.useCallback(() => { refreshActivity(); refreshGarden(); }, [refreshActivity, refreshGarden]);
  const tasks = React.useMemo(() => activity.loading || activity.error ? [] : active.flatMap(plant => buildCareTasks(plant, [...(activity.logs[`${plant.id}:watering`] || []), ...(activity.logs[`${plant.id}:fertilizing`] || [])], now)), [active, activity.loading, activity.error, activity.logs, now]);
  const recordedToday = React.useMemo(() => active.reduce((sum, plant) => sum + ['watering', 'fertilizing'].flatMap(type => activity.logs[`${plant.id}:${type}`] || []).filter(log => { const date = log.timestamp?.toDate?.(); return date && (log.calendarDay || plantDay(date, log.timeZone || plant.locationTimeZone)) === plantDay(now, plant.locationTimeZone); }).length, 0), [active, activity.logs, now]);
  return { ...garden, plantLoading: garden.loading, plantError: garden.error, refresh, tasks, recordedToday, now, error: garden.error || activity.error, loading: garden.loading || activity.loading };
}
