import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from '@/services/session';
import { journalDaysStore, journalWeatherStore } from '@/services/plantJournalData';

export function usePlantJournalData(id: string, start: string, end: string, timeZone?: string | null, enabled = true) {
  const { user } = useSession();
  const key = user && id && enabled ? JSON.stringify([user.uid, id, start, end, timeZone || null]) : '';
  const subscribeLogs = useCallback((notify: () => void) => key ? journalDaysStore.subscribe(key, notify) : () => {}, [key]);
  const subscribeWeather = useCallback((notify: () => void) => key ? journalWeatherStore.subscribe(key, notify) : () => {}, [key]);
  const getLogs = useCallback(() => key ? journalDaysStore.get(key) : journalDaysStore.initial, [key]);
  const getWeather = useCallback(() => key ? journalWeatherStore.get(key) : journalWeatherStore.initial, [key]);
  const logs = useSyncExternalStore(subscribeLogs, getLogs, () => journalDaysStore.initial);
  const weather = useSyncExternalStore(subscribeWeather, getWeather, () => journalWeatherStore.initial);
  const retry = useCallback(() => {
    if (!key) return;
    if (journalDaysStore.get(key).error) journalDaysStore.refresh(key);
    if (journalWeatherStore.get(key).error) journalWeatherStore.refresh(key);
  }, [key]);
  return { logs: logs.data, weather: weather.data, loading: !!key && logs.loading, weatherLoading: !!key && weather.loading, error: logs.error, weatherError: weather.error, retry };
}
