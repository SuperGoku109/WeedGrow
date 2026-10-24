import { collection, documentId, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { addDays, plantDay, zonedTime } from '@/lib/dates/plantDay';
import { createLiveStore } from '@/lib/data/liveStore';
export type JournalDays = Record<string, (PlantLog & { id: string })[]>;
export const journalDaysStore = createLiveStore<JournalDays>({}, key => (next, fail) => {
  const [, id, start, end, zone] = JSON.parse(key) as [string, string, string, string, string | null];
  return onSnapshot(query(collection(db, 'plants', id, 'logs'),
    where('timestamp', '>=', Timestamp.fromDate(zonedTime(addDays(start, -2), '00:00', zone))),
    where('timestamp', '<', Timestamp.fromDate(zonedTime(addDays(end, 3), '00:00', zone)))), snapshot => {
    const grouped: JournalDays = {};
    snapshot.docs.forEach(item => {
      const log = { ...item.data(), id: item.id } as PlantLog & { id: string };
      const instant = log.timestamp?.toDate?.(); if (!instant) return;
      const day = log.calendarDay || plantDay(instant, log.timeZone || zone);
      if (day >= start && day <= end) (grouped[day] ??= []).push(log);
    });
    Object.values(grouped).forEach(entries => entries.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    next(grouped);
  }, fail);
}, 'Activity could not be loaded. Check your connection and retry.');
export const journalWeatherStore = createLiveStore<Record<string, WeatherCacheEntry>>({}, key => (next, fail) => {
  const [, id, start, end] = JSON.parse(key) as string[];
  return onSnapshot(query(collection(db, 'plants', id, 'weatherCache'), where(documentId(), '>=', start), where(documentId(), '<=', end)), snapshot => {
    next(Object.fromEntries(snapshot.docs.map(item => [item.id, item.data() as WeatherCacheEntry])));
  }, fail);
}, 'Saved weather could not be loaded. Check your connection and retry.');
