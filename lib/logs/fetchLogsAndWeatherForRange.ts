import { plantDay, zonedTime, addDays, isCalendarDay } from '@/lib/dates/plantDay';
import { collection, getDocs, query, where, Timestamp, documentId } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
/** Two independent range queries instead of one network request per weather day. */
export async function fetchLogsAndWeatherForRange(plantId: string, startDate: string, endDate: string, timeZone?: string | null): Promise<Record<string, { logs: PlantLog[]; weather: WeatherCacheEntry | null }>> {
  if (!isCalendarDay(startDate) || !isCalendarDay(endDate) || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) >= 90 * 86400000) throw new Error('Choose a valid date range of at most 90 days.');
  const dates: string[] = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) dates.push(day);
  // The margin includes entries recorded in a different timezone before a move.
  const logsQuery = query(collection(db, 'plants', plantId, 'logs'), where('timestamp', '>=', Timestamp.fromDate(zonedTime(addDays(startDate, -2), '00:00', timeZone))), where('timestamp', '<', Timestamp.fromDate(zonedTime(addDays(endDate, 3), '00:00', timeZone))));
  const weatherQuery = query(collection(db, 'plants', plantId, 'weatherCache'), where(documentId(), '>=', startDate), where(documentId(), '<=', endDate));
  const [logs, weather] = await Promise.all([getDocs(logsQuery), getDocs(weatherQuery)]);
  const result = Object.fromEntries(dates.map(date => [date, { logs: [] as PlantLog[], weather: null as WeatherCacheEntry | null }]));
  logs.docs.forEach(item => {
    const log = item.data() as PlantLog; const instant = log.timestamp?.toDate?.();
    const day = log.calendarDay || (instant ? plantDay(instant, log.timeZone || timeZone) : undefined);
    if (day && result[day]) result[day].logs.push(log);
  });
  weather.docs.forEach(item => { if (result[item.id]) result[item.id].weather = item.data() as WeatherCacheEntry; });
  return result;
}
