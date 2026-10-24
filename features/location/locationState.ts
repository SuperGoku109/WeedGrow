import type { Plant, WeatherCacheEntry } from '@/firestoreModels';
type Point = { lat: number; lng: number } | null | undefined;
export function sameLocation(a: Point, b: Point) { return (!a && !b) || (!!a && !!b && a.lat === b.lat && a.lng === b.lng); }
export function weatherMatchesLocation(weather: WeatherCacheEntry | null | undefined, plant: Pick<Plant, 'location' | 'locationRevision'>) {
  if (!weather) return false;
  if (weather.sourceCoordinates && !sameLocation(weather.sourceCoordinates, plant.location)) return false;
  return (weather.locationRevision ?? 0) === (plant.locationRevision ?? 0);
}
