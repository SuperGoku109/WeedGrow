import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { validCoordinates } from '@/features/location/locationService';
import { sameLocation } from '@/features/location/locationState';
import { plantDay } from '@/lib/dates/plantDay';
import type { Group, WeatherCacheEntry } from '@/firestoreModels';
import { fetchWeather } from './fetchWeather';
import { parseWeatherData } from './parseWeatherData';

const pending = new Map<string, Promise<void>>();
function defined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(defined);
  if (value && typeof value === 'object' && !('toDate' in value)) return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, defined(child)]));
  return value;
}

// Garden weather starts before plants exist. Never write it into a plant's history.
export function refreshGardenWeather(id: string, force = false): Promise<void> {
  const uid = requireUserId();
  const key = `${uid}:${id}`;
  const existing = pending.get(key); if (existing) return existing;
  const job = (async () => {
    const ref = doc(db, 'groups', id);
    const snapshot = await getDoc(ref);
    const garden = snapshot.data() as Group & { deleting?: boolean } | undefined;
    if (!garden || garden.createdBy !== uid || garden.deleting) throw new Error('This garden is unavailable.');
    if (!validCoordinates(garden.location)) return; // Existing gardens may not have a pin yet.
    const location = garden.location;
    const cached = garden.currentWeather;
    const fetched = cached?.fetchedAt?.toMillis?.();
    if (!force && cached && sameLocation(cached.sourceCoordinates, location) && cached.date === plantDay(new Date(), cached.timeZone) && fetched && Date.now() - fetched >= 0 && Date.now() - fetched < 6 * 3600000) return;
    const parsed = parseWeatherData(await fetchWeather(location.lat, location.lng, force));
    const live = Object.values(parsed).find(entry => !entry.forecasted);
    if (!live) throw new Error('Weather provider did not return current conditions.');
    const today = plantDay(new Date(), live.timeZone);
    const entries = Object.entries(parsed).filter(([date]) => date >= today);
    await runTransaction(db, async tx => {
      const latest = await tx.get(ref);
      const current = latest.data() as typeof garden;
      if (!current || current.createdBy !== uid || current.deleting) throw new Error('This garden is unavailable.');
      if (!sameLocation(current.location, location)) throw new Error('The garden location changed while weather was loading. Retry at its new location.');
      const refs = entries.map(([date]) => doc(db, 'groups', id, 'weatherCache', date));
      const previous = await Promise.all(refs.map(target => tx.get(target)));
      const committed: Record<string, WeatherCacheEntry> = {};
      entries.forEach(([date, weather], index) => {
        const old = previous[index].data() as WeatherCacheEntry | undefined;
        if (old && (old.fetchedAt?.toMillis?.() || 0) > weather.fetchedAt.toMillis()) { committed[date] = old; return; }
        const history = [...(old?.previousLocations || [])];
        if (old && date === today && !sameLocation(old.sourceCoordinates, location)) { const { previousLocations: _history, ...prior } = old; history.push(prior); }
        const entry = defined({ ...weather, sourceCoordinates: location, locationLabel: current.locationLabel || '', ...(history.length ? { previousLocations: history } : {}) }) as WeatherCacheEntry;
        if (JSON.stringify(entry).length > 800000) throw new Error('This day has too much saved weather history to refresh safely.');
        committed[date] = entry;
        tx.set(refs[index], entry);
      });
      if (committed[today]) tx.update(ref, { currentWeather: committed[today] });
    });
  })().finally(() => { if (pending.get(key) === job) pending.delete(key); });
  pending.set(key, job); return job;
}
