import { useCallback } from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useSession } from '@/services/session';
import { journalDaysStore, journalWeatherStore } from '@/services/plantJournalData';

export function usePlantJournalData(id: string, start: string, end: string, timeZone?: string | null, enabled = true) {
  const { user, loading: accountLoading } = useSession();
  const key = user && id && enabled ? JSON.stringify([user.uid, id, start, end, timeZone || null]) : '';
  const logs = useLiveResource(journalDaysStore, key || null, enabled && accountLoading);
  const weather = useLiveResource(journalWeatherStore, key || null, enabled && accountLoading);
  const retry = useCallback(() => {
    if (!key) return;
    if (journalDaysStore.get(key).error) journalDaysStore.refresh(key);
    if (journalWeatherStore.get(key).error) journalWeatherStore.refresh(key);
  }, [key]);
  return { logs: logs.data, weather: weather.data.entries, weatherDayErrors: weather.data.errors, status: logs.status, weatherStatus: weather.status, loading: logs.loading, weatherLoading: weather.loading, error: logs.error, weatherError: weather.error, retry };
}
