import React from 'react';
import { collection, documentId, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { localDateKey } from '@/lib/logs/plantJournal';

export function usePlantJournalData(id: string, start: string, end: string) {
  const [logs, setLogs] = React.useState<Record<string, (PlantLog & { id: string })[]>>({});
  const [weather, setWeather] = React.useState<Record<string, WeatherCacheEntry>>({});
  const [loading, setLoading] = React.useState(true);
  const [weatherLoading, setWeatherLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [weatherError, setWeatherError] = React.useState('');
  React.useEffect(() => {
    setLogs({}); setWeather({}); setError(''); setWeatherError(''); setLoading(true); setWeatherLoading(true);
    if (!id) { setLoading(false); setWeatherLoading(false); return; }
    const unsubscribeLogs = onSnapshot(query(collection(db, 'plants', id, 'logs'),
      where('timestamp', '>=', Timestamp.fromDate(new Date(`${start}T00:00:00`))),
      where('timestamp', '<=', Timestamp.fromDate(new Date(`${end}T23:59:59.999`)))), snapshot => {
      const grouped: Record<string, (PlantLog & { id: string })[]> = {};
      snapshot.docs.forEach(doc => {
        const log = { ...doc.data(), id: doc.id } as PlantLog & { id: string };
        const date = log.timestamp?.toDate?.();
        if (!date) return;
        const key = localDateKey(date);
        (grouped[key] ??= []).push(log);
      });
      Object.values(grouped).forEach(items => items.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
      setLogs(grouped); setLoading(false);
    }, () => { setError('Activity could not be loaded. Check your connection and try again.'); setLoading(false); });
    const unsubscribeWeather = onSnapshot(query(collection(db, 'plants', id, 'weatherCache'),
      where(documentId(), '>=', start), where(documentId(), '<=', end)), snapshot => {
      setWeather(Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data() as WeatherCacheEntry]))); setWeatherLoading(false);
    }, () => { setWeatherError('Weather could not be loaded.'); setWeatherLoading(false); });
    return () => { unsubscribeLogs(); unsubscribeWeather(); };
  }, [id, start, end]);
  return { logs, weather, loading, weatherLoading, error, weatherError };
}
