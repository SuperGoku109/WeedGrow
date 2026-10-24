import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { plantDay } from '@/lib/dates/plantDay';
import { weatherMatchesLocation } from '@/features/location/locationState';
import { fetchWeather } from './fetchWeather';
import { parseWeatherData } from './parseWeatherData';
import { updateWeatherCache, type WeatherLocation } from './updateFirestore';
import type { WeatherCacheEntry } from '@/firestoreModels';
const pending = new Map<string, Promise<Record<string, WeatherCacheEntry>>>();
export function refreshPlantWeather(id: string, plant: WeatherLocation, force = false, requestedDate?: string) {
  const uid = requireUserId();
  const key = `${uid}:${id}:${plant.locationRevision || 0}:${plant.location.lat}:${plant.location.lng}:${force}:${requestedDate || 'today'}`;
  const existing = pending.get(key); if (existing) return existing;
  const job = (async () => {
    const today = plantDay(new Date(), plant.locationTimeZone);
    const wanted = requestedDate || today;
    if (!force) {
      const live = plant.currentWeather;
      const age = live?.fetchedAt?.toDate?.().getTime();
      if (live?.date === wanted && weatherMatchesLocation(live, plant) && age && Date.now() - age >= 0 && Date.now() - age < 6 * 3600000) return { [wanted]: live }; 
      const snapshot = await getDoc(doc(db, 'plants', id, 'weatherCache', wanted));
      const weather = snapshot.data() as WeatherCacheEntry | undefined;
      const fetched = weather?.fetchedAt?.toDate?.().getTime();
      if (plant.locationTimeZone && weatherMatchesLocation(weather, plant) && fetched && Date.now() - fetched >= 0 && Date.now() - fetched < 6 * 3600000) return { [wanted]: weather! };
    }
    const response = await fetchWeather(plant.location.lat, plant.location.lng, force);
    const parsed = parseWeatherData(response);
    const providerToday = Object.values(parsed).find(entry => !entry.forecasted)?.date;
    if (!providerToday) throw new Error('The weather provider did not return current conditions. Retry later.');
    const result = await updateWeatherCache(id, parsed, plant);
    if (requestedDate && !parsed[requestedDate] && plant.locationTimeZone) throw new Error('The provider has no forecast for this date. Choose a closer date or retry later.');
    return result;
  })().finally(() => { if (pending.get(key) === job) pending.delete(key); });
  pending.set(key, job); return job;
}
