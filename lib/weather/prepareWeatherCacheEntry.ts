import type { WeatherCacheEntry } from '@/firestoreModels';

/** Omit undefined object fields without flattening Firestore timestamps. */
export function prepareWeatherCacheEntry(entry: WeatherCacheEntry): WeatherCacheEntry {
  return omitUndefined(entry) as WeatherCacheEntry;
}

function omitUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (!value || typeof value !== 'object' || 'toDate' in value) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .map(([key, child]) => [key, omitUndefined(child)]));
}
