import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
const pending = new Map<string, Promise<any>>();
export async function fetchWeather(lat: number, lng: number, force = false): Promise<any> {
  const apiKey = Constants?.expoConfig?.extra?.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('Weather is not configured. Your plant and history are still available.');
  const key = `${lat}:${lng}`;
  const cacheKey = 'weedgrow.weather.v1.' + key;
  if (!force) {
    try { const stored = JSON.parse(await AsyncStorage.getItem(cacheKey) || 'null'); if (stored && Date.now() - stored.savedAt >= 0 && Date.now() - stored.savedAt < 30 * 60000 && stored.value?.current) return stored.value; } catch { /* A cache error must not prevent a request. */ }
  }
  // Only in-flight network calls are shared. A manual refresh must never join
  // a cache-only lookup and accidentally return old conditions.
  const existing = pending.get(key); if (existing) return existing;
  const job = (async () => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely,alerts&units=metric&appid=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Weather provider returned ${response.status}. Retry later.`);
      const value = await response.json();
      value._weedgrowFetchedAt = Date.now();
      if (!value?.current || !Number.isFinite(value.current.temp)) throw new Error('Weather response was incomplete.');
      await saveSharedWeather(cacheKey, value);

      return value;
    } catch (error) { throw new Error(error instanceof Error && error.message.startsWith('Weather provider') ? error.message : 'Weather could not be reached. Check your connection and retry.'); }
    finally { clearTimeout(timeout); }
  })().finally(() => { if (pending.get(key) === job) pending.delete(key); });
  pending.set(key, job); return job;
}

let cacheQueue = Promise.resolve();
async function saveSharedWeather(key: string, value: any) {
  const job = cacheQueue.catch(() => {}).then(async () => {
    const indexKey = 'weedgrow.weather.index.v1';
    const previous = JSON.parse(await AsyncStorage.getItem(indexKey) || '[]');
    const keys: string[] = Array.isArray(previous) ? previous.filter(item => typeof item === 'string' && item.startsWith('weedgrow.weather.v1.') && item !== key) : [];
    keys.push(key);
    const expired = keys.splice(0, Math.max(0, keys.length - 32));
    for (const old of expired) await AsyncStorage.removeItem(old);
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    await AsyncStorage.setItem(indexKey, JSON.stringify(keys));
  });
  cacheQueue = job; await job.catch(() => {}); // Plant snapshots are authoritative.
}
