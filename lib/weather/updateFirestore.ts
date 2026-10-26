import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { plantDay } from '@/lib/dates/plantDay';
import { sameLocation } from '@/features/location/locationState';
import type { WeatherCacheEntry } from '@/firestoreModels';
export interface WeatherLocation { location: { lat: number; lng: number }; locationRevision?: number; locationLabel?: string | null; locationTimeZone?: string | null; currentWeather?: WeatherCacheEntry | null }
function defined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(defined);
  if (value && typeof value === 'object' && !('toDate' in value)) return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, defined(child)]));
  return value;
}
// Only the current day and forecasts may be refreshed. A move never rewrites
// yesterday or older records, and earlier locations on the same day are kept.
export async function updateWeatherCache(plantId: string, parsedData: Record<string, WeatherCacheEntry>, expected: WeatherLocation): Promise<Record<string, WeatherCacheEntry>> {
  const uid = requireUserId();
  const resolvedZone = Object.values(parsedData).find(entry => entry.timeZone)?.timeZone || expected.locationTimeZone;
  const today = plantDay(new Date(), resolvedZone);
  const candidates = Object.entries(parsedData).filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today);
  if (!candidates.length) return {};
  return runTransaction(db, async tx => {
    const plant = await tx.get(doc(db, 'plants', plantId));
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().deleting) throw new Error('This plant is unavailable.');
    const current = plant.data();
    if (expected && (!sameLocation(expected.location, current.location) || (expected.locationRevision || 0) !== (current.locationRevision || 0))) throw new Error('The plant moved while weather was loading. Refresh at its current location.');
    const safeCandidates = candidates;
    // When moving west across a calendar boundary, the date-keyed document
    // may already be historical. Keep a separate location snapshot instead.
    const cacheId = (date: string) => date < (current.weatherHistoryBefore || '0000-00-00') ? `location_${current.locationRevision || 0}_${date}` : date;
    const snapshots = await Promise.all(safeCandidates.map(([date]) => tx.get(doc(db, 'plants', plantId, 'weatherCache', cacheId(date)))));
    const committed: Record<string, WeatherCacheEntry> = {};
    safeCandidates.forEach(([date, weather], index) => {
      const old = snapshots[index].data() as WeatherCacheEntry | undefined;
      if (old && sameLocation(old.sourceCoordinates, current.location) && (old.locationRevision || 0) === (current.locationRevision || 0) && (old.fetchedAt?.toMillis?.() || 0) > (weather.fetchedAt?.toMillis?.() || 0)) { committed[date] = old; return; }
      const history = [...(old?.previousLocations || [])];
      const moved = old && (!sameLocation(old.sourceCoordinates, current.location) || (old.locationRevision || 0) !== (current.locationRevision || 0));
      if (date === today && moved) { const { previousLocations: _history, ...prior } = old; history.push(prior); }
      const entry = defined({ ...weather, sourceCoordinates: current.location || null, locationRevision: current.locationRevision || 0, locationLabel: current.locationLabel || current.locationNickname || '', ...(history.length ? { previousLocations: history } : {}) }) as WeatherCacheEntry;
      if (JSON.stringify(entry).length > 800000) throw new Error('This day contains too much saved weather history to refresh safely. Earlier records have been kept.');
      committed[date] = entry;
      tx.set(snapshots[index].ref, entry);
    });
    const live = committed[today];
    const meta = { ...(resolvedZone && resolvedZone !== current.locationTimeZone ? { locationTimeZone: resolvedZone } : {}), ...(live && (cacheId(today) !== today || current.currentWeather) ? { currentWeather: cacheId(today) === today ? null : live } : {}) };
    if (Object.keys(meta).length) tx.update(plant.ref, meta);
    return committed;
  });
}
