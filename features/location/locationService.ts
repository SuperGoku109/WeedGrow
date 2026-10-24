import Constants from 'expo-constants';

export interface Coordinates { lat: number; lng: number }
export interface PlaceResult extends Coordinates { label: string }
export function validCoordinates(value?: Coordinates | null): value is Coordinates {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
export function coordinateLabel(value: Coordinates) { return `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`; }
const cache = new Map<string, { expires: number; places: PlaceResult[] }>();
async function geocode(path: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.places;
  const key = Constants.expoConfig?.extra?.OPENWEATHERMAP_API_KEY;
  if (!key) throw new Error('Place search is not configured. You can still choose a pin on the map.');
  const response = await fetch(`https://api.openweathermap.org/geo/1.0/${path}&appid=${encodeURIComponent(key)}`, { signal });
  if (!response.ok) throw new Error('Place names could not be loaded. Try again; your map pin is kept.');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Place search returned an unexpected response. Try again.');
  const places = data.filter(item => typeof item?.name === 'string' && validCoordinates({ lat: item.lat, lng: item.lon }))
    .map(item => ({ label: [item.name, item.state, item.country].filter(Boolean).join(', '), lat: item.lat, lng: item.lon }));
  if (signal?.aborted) throw new Error('Search cancelled.');
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(path, { places, expires: Date.now() + 3600000 });
  return places;
}
export async function searchPlaces(text: string, signal?: AbortSignal) {
  const query = text.trim().slice(0, 120);
  if (query.length < 2) return [];
  return geocode(`direct?q=${encodeURIComponent(query)}&limit=5`, signal);
}
export async function nameForCoordinates(coords: Coordinates, signal?: AbortSignal): Promise<string> {
  if (!validCoordinates(coords)) throw new Error('Choose valid coordinates.');
  const places = await geocode(`reverse?lat=${coords.lat.toFixed(4)}&lon=${coords.lng.toFixed(4)}&limit=1`, signal);
  return places[0]?.label || coordinateLabel(coords);
}
