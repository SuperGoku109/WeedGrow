import { useEffect, useState, useCallback } from 'react';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { addPlantLog } from '@/lib/logs/addPlantLog';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';

export function usePlantLogs(plantId: string, startDate: string, endDate: string) {
  const [data, setData] = useState<Record<string, { logs: PlantLog[]; weather: WeatherCacheEntry | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLogsAndWeatherForRange(plantId, startDate, endDate);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load logs.');
    } finally {
      setLoading(false);
    }
  }, [plantId, startDate, endDate]);

  useEffect(() => {
    if (plantId && startDate && endDate) {
      refresh();
    }
  }, [plantId, startDate, endDate, refresh]);

  // Centralized log add
  const addLog = useCallback(async (log: Omit<PlantLog, 'timestamp'>, date?: string) => {
    await addPlantLog(plantId, log, date);
    await refresh();
  }, [plantId, refresh]);

  return { data, loading, error, refresh, addLog };
}
