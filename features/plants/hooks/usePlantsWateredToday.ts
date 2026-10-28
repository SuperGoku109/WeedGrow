import { useMemo } from 'react';
import type { Plant } from '@/firestoreModels';
import { plantDay } from '@/lib/dates/plantDay';
import { usePlantActivity } from '@/features/care/usePlantActivity';
import { useMinuteClock } from '@/hooks/useMinuteClock';
export function usePlantsWateredToday(plantIds: string[], plants: readonly (Pick<Plant, 'locationTimeZone' | 'careSummary' | 'careRevision'> & { id: string })[] = [], enabled = true) {
  const activity = usePlantActivity(enabled ? plantIds : [], ['watering'], plants); const now = useMinuteClock();
  const idsKey = JSON.stringify([...new Set(plantIds)].sort());
  const zonesKey = JSON.stringify(Object.fromEntries(plants.map(plant => [plant.id, plant.locationTimeZone || null])));
  const wateredMap = useMemo(() => {
    const zones = JSON.parse(zonesKey); const result: Record<string, boolean> = {};
    for (const id of JSON.parse(idsKey)) {
      const log = activity.logs[`${id}:watering`]?.[0]; const date = log?.timestamp?.toDate?.();
      result[id] = !!date && (log.calendarDay || plantDay(date, log.timeZone || zones[id])) === plantDay(now, zones[id]);
    }
    return result;
  }, [idsKey, zonesKey, activity.logs, now]);
  return { wateredMap, loading: activity.loading, error: activity.error || null, refresh: activity.refresh };
}
