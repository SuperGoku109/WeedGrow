import { Timestamp } from 'firebase/firestore';
import { parseWeatherMeasurements } from './weatherMeasurements';
import type { WeatherCacheEntry } from '@/firestoreModels';
/** Client timestamp adapter around the parser shared with scheduled collection. */
export function parseWeatherData(input: unknown): Record<string, WeatherCacheEntry> {
  return Object.fromEntries(Object.entries(parseWeatherMeasurements(input)).map(([day, { fetchedAtMillis, ...entry }]) => [day, { ...entry, fetchedAt: Timestamp.fromMillis(fetchedAtMillis) }]));
}
