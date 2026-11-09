import { decodeWeatherResponse, type WeatherResponse } from './weatherResponse';
import { isRecord } from '@/lib/data/recordDecoders';
import { openMeteoUrl, openMeteoWeatherResponse } from './openMeteo';
import AsyncStorage from '@react-native-async-storage/async-storage';
const pending = new Map<string, Promise<WeatherResponse>>();
const PREFIX = 'weedgrow.meteo.v1.';
export async function readCachedWeatherResponse(lat: number, lng: number): Promise<WeatherResponse | undefined> {
  try {
    const stored: unknown = JSON.parse(await AsyncStorage.getItem(`${PREFIX}${lat}:${lng}`) || 'null');
    if (!isRecord(stored)) return undefined;
    const value = decodeWeatherResponse(stored.value);
    return value._weedgrowProvider === 'Open-Meteo' ? value : undefined;
  } catch { return undefined; }
}
/** Public non-commercial Open-Meteo endpoint. One shared bundle per location, no API key. */
export async function fetchWeather(lat: number, lng: number, force = false): Promise<WeatherResponse> {
  const url = openMeteoUrl(lat, lng); const key = `${lat}:${lng}`; const cacheKey = PREFIX + key;
  if (!force) {
    const cached = await readCachedWeatherResponse(lat, lng); const at = cached?._weedgrowFetchedAt;
    if (typeof at === 'number' && Date.now() >= at && Date.now() - at < 3600000) return cached!;
  }
  const existing = pending.get(key); if (existing) return existing;
  const job = (async () => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}. ${response.status === 429 ? 'The free weather request limit was reached. Retry later.' : 'Retry later.'}`);
      const value = decodeWeatherResponse(openMeteoWeatherResponse(await response.json() as unknown));
      if (!value.current || !Number.isFinite(value.current.temp)) throw new Error('Open-Meteo did not return a usable recent temperature.');
      await saveSharedWeather(cacheKey, value); return value;
    } catch (error) {
      throw new Error(error instanceof Error && error.message.startsWith('Open-Meteo') ? error.message : 'Open-Meteo could not be reached. Check your connection and retry.');
    } finally { clearTimeout(timeout); }
  })().finally(() => { if (pending.get(key) === job) pending.delete(key); });
  pending.set(key, job); return job;
}
let cacheQueue = Promise.resolve();
async function saveSharedWeather(key: string, value: WeatherResponse) {
  const job = cacheQueue.catch(() => {}).then(async () => {
    const indexKey = 'weedgrow.meteo.index.v1'; const previous: unknown = JSON.parse(await AsyncStorage.getItem(indexKey) || '[]');
    const keys: string[] = Array.isArray(previous) ? previous.filter(item => typeof item === 'string' && item.startsWith(PREFIX) && item !== key) : [];
    keys.push(key); const expired = keys.splice(0, Math.max(0, keys.length - 16));
    for (const old of expired) await AsyncStorage.removeItem(old);
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    await AsyncStorage.setItem(indexKey, JSON.stringify(keys));
  });
  cacheQueue = job; await job.catch(() => {});
}
