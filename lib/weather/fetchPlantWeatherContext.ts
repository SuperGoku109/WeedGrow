import { plantDay, addDays } from '@/lib/dates/plantDay';
import { weatherMatchesLocation } from '@/features/location/locationState';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { PlantAdviceContext } from './getPlantAdvice';
import type { WeatherCacheEntry } from '@/firestoreModels';

/**
 * Fetch weather data from Firestore for yesterday, today and tomorrow
 * and convert it into a PlantAdviceContext.
 */
export async function fetchPlantWeatherContext(
  plantId: string
): Promise<PlantAdviceContext> {
  const plant = (await getDoc(doc(db, 'plants', plantId))).data();
  const todayKey = plantDay(new Date(), plant?.locationTimeZone);
  const dates: string[] = [];
  // Build an array of date strings for yesterday, today and tomorrow
  for (let offset = -1; offset <= 1; offset++) {
    dates.push(addDays(todayKey, offset));
  }

  // Fetch the three documents in parallel from the weatherCache subcollection
  const docs = await Promise.all(
    dates.map(async (date) => {
      const ref = doc(db, 'plants', plantId, 'weatherCache', date);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as WeatherCacheEntry) : null;
    })
  );

  const [yesterday, today, tomorrow] = docs;

  if (!today || !plant?.location || !weatherMatchesLocation(today, plant as never)) throw new Error('No weather data found for today');
  if (
    today.rainfall === undefined ||
    today.humidity === undefined ||
    today.dewPoint === undefined ||
    today.cloudCoverage === undefined ||
    today.windGust === undefined ||
    today.pop === undefined
  ) {
    throw new Error('Missing required weather field in today\'s data');
  }

  // Do not default rainYesterday, just set undefined if missing
  const rainYesterday =
    yesterday && yesterday.rainfall !== undefined
      ? yesterday.rainfall
      : undefined;
  const rainTomorrow =
    tomorrow && tomorrow.rainfall !== undefined ? tomorrow.rainfall > 0 : false;

  return {
    rainToday: today.rainfall > 0,
    rainTomorrow,
    rainYesterday,
    humidity: today.humidity,
    dewPoint: today.dewPoint,
    cloudCoverage: today.cloudCoverage,
    windGust: today.windGust,
    pop: today.pop,
  };
}
