import { collection, documentId, getDocs, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { addDays, plantDay, zonedTime } from '@/lib/dates/plantDay';
import { decodeLog, decodeWeather, publishDecoded } from '@/lib/data/recordDecoders';
import { createLiveStore } from '@/lib/data/liveStore';
export type JournalDays = Record<string, (PlantLog & { id: string })[]>;
export const journalDaysStore = createLiveStore<JournalDays>({}, key => (next, fail) => {
  const [, id, start, end, zone] = JSON.parse(key) as [string, string, string, string, string | null];
  return onSnapshot(query(collection(db, 'plants', id, 'logs'),
    where('timestamp', '>=', Timestamp.fromDate(zonedTime(addDays(start, -2), '00:00', zone))),
    where('timestamp', '<', Timestamp.fromDate(zonedTime(addDays(end, 3), '00:00', zone)))), snapshot => {
    try {
    const grouped: JournalDays = {};
    snapshot.docs.forEach(item => {
      const log = { ...decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${id}/logs/${item.id}`), id: item.id };
      const instant = log.timestamp?.toDate?.(); if (!instant) return;
      const day = log.calendarDay || plantDay(instant, log.timeZone || zone);
      if (day >= start && day <= end) (grouped[day] ??= []).push(log);
    });
    Object.values(grouped).forEach(entries => entries.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    next(grouped);
    } catch (error) { fail(error); }
  }, fail);
}, 'Activity could not be loaded. Check your connection and retry.');
export const journalWeatherStore = createLiveStore<{ entries: Record<string, WeatherCacheEntry>; errors: Record<string, string> }>({ entries: {}, errors: {} }, key => (next, fail) => {
  const [, id, start, end] = JSON.parse(key) as string[];
  return onSnapshot(query(collection(db, 'plants', id, 'weatherCache'), where(documentId(), '>=', start), where(documentId(), '<=', end)), snapshot => {
    const entries: Record<string, WeatherCacheEntry> = {};
    const errors: Record<string, string> = {};
    for (const item of snapshot.docs) {
      try { entries[item.id] = decodeWeather(item.data({ serverTimestamps: 'estimate' }), `plants/${id}/weatherCache/${item.id}`); }
      catch { errors[item.id] = 'Saved weather for this day could not be read. The original record has been kept unchanged.'; }
    }
    next({ entries, errors });
  }, fail);
}, 'Saved weather could not be loaded. Check your connection and retry.');
export const movementStore = createLiveStore<PlantLog[]>([], key => (next, fail) => {
  const [, id] = JSON.parse(key) as string[];
  return onSnapshot(query(collection(db, 'plants', id, 'logs'), orderBy('timestamp', 'desc'), limit(100)), snapshot => publishDecoded(() => snapshot.docs.map(item => decodeLog(item.data({ serverTimestamps: 'estimate' }), `plants/${id}/logs/${item.id}`)).filter(item => !!item.movement), next, fail), fail);
}, 'Movement history could not be loaded.');
export async function listSavedWeatherLocations(plantId: string, date: string): Promise<WeatherCacheEntry[]> {
  const snapshot = await getDocs(query(collection(db, 'plants', plantId, 'weatherCache'), where('date', '==', date)));
  return snapshot.docs.filter(item => item.id.startsWith('location_')).map(item => decodeWeather(item.data({ serverTimestamps: 'estimate' }), `plants/${plantId}/weatherCache/${item.id}`));
}
