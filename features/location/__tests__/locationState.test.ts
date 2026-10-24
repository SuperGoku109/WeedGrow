import { sameLocation, weatherMatchesLocation } from '../locationState';
import type { WeatherCacheEntry } from '@/firestoreModels';
it('rejects weather from an earlier location even if its fetch time is fresh', () => {
  const weather = { locationRevision: 2, sourceCoordinates: { lat: 1, lng: 2 } } as WeatherCacheEntry;
  expect(weatherMatchesLocation(weather, { location: { lat: 1, lng: 2 }, locationRevision: 2 })).toBe(true);
  expect(weatherMatchesLocation(weather, { location: { lat: 3, lng: 4 }, locationRevision: 3 })).toBe(false);
  expect(weatherMatchesLocation(weather, { location: { lat: 1, lng: 2 }, locationRevision: 4 })).toBe(false);
});
it('accepts untagged legacy weather only until the plant has moved', () => {
  expect(weatherMatchesLocation({} as WeatherCacheEntry, { location: { lat: 1, lng: 2 } })).toBe(true);
  expect(weatherMatchesLocation({} as WeatherCacheEntry, { location: { lat: 1, lng: 2 }, locationRevision: 1 })).toBe(false);
  expect(sameLocation(null, undefined)).toBe(true);
  expect(sameLocation({ lat: 0, lng: 0 }, null)).toBe(false);
});
