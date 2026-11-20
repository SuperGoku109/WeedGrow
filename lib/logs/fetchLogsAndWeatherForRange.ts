import { plantDay, addDays, isCalendarDay } from '@/lib/dates/plantDay';
import { getDocs } from 'firebase/firestore';
import { decodeLog, decodeWeather } from '@/lib/data/recordDecoders';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { journalRangeQuery, journalWeatherRangeQuery } from './journalRangeQueries';
/** Two independent range queries instead of one network request per weather day. */
export async function fetchLogsAndWeatherForRange(plantId: string, startDate: string, endDate: string, timeZone?: string | null, options?: { logsOnly?: boolean }): Promise<Record<string, { logs: PlantLog[]; weather: WeatherCacheEntry | null }>> {
  if (!isCalendarDay(startDate) || !isCalendarDay(endDate) || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) >= 90 * 86400000) throw new Error('Choose a valid date range of at most 90 days.');
  const dates: string[] = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) dates.push(day);
  const [logs, weather] = await Promise.all([
    getDocs(journalRangeQuery(plantId, startDate, endDate, timeZone)),
    options?.logsOnly ? null : getDocs(journalWeatherRangeQuery(plantId, startDate, endDate)),
  ]);
  if (options?.logsOnly && logs.metadata?.fromCache) throw new Error('Current watering history could not be confirmed.');
  const result = Object.fromEntries(dates.map(date => [date, { logs: [] as PlantLog[], weather: null as WeatherCacheEntry | null }]));
  logs.docs.forEach(item => {
    const log = decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/logs/${item.id}`); const instant = log.timestamp?.toDate?.();
    const day = log.calendarDay || (instant ? plantDay(instant, log.timeZone || timeZone) : undefined);
    const identified = { ...log, id: item.id };
    if (day && result[day]) result[day].logs.push(identified);
  });
  weather?.docs.forEach(item => { if (result[item.id]) result[item.id].weather = decodeWeather(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/weatherCache/${item.id}`); });
  return result;
}
