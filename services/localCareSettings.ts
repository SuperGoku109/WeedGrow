import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultLocalCareSettings, localCareSettingsError, type LocalCareSettings } from '@/lib/careAlgorithm/localCare';
import { registerPrivateCacheReset } from '@/lib/data/liveStore';
import { requireUserId } from './session';
export type { LocalCareSettings } from '@/lib/careAlgorithm/localCare';
const settings = new Map<string, Promise<LocalCareSettings>>();
const listeners = new Set<() => void>();
let revision = 0;
const publish = () => { revision++; listeners.forEach(listener => listener()); };
registerPrivateCacheReset(() => { settings.clear(); publish(); });
export const subscribeLocalCareSettings = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const localCareSettingsRevision = () => revision;
const keyFor = (uid: string, plantId: string) => `weedgrow.local-care.v1.${uid}.${plantId}`;
export async function loadLocalCareSettings(plantId: string, nowUtc = Date.now() / 1000) {
  const uid = requireUserId(); const key = keyFor(uid, plantId);
  let result = settings.get(key);
  if (!result) {
    result = AsyncStorage.getItem(key).then(raw => {
      if (!raw) return defaultLocalCareSettings(nowUtc);
      const parsed: unknown = JSON.parse(raw);
      if (localCareSettingsError(parsed)) throw new Error('Saved algorithm test inputs are invalid. Reset the test inputs.');
      return { ...(parsed as LocalCareSettings), profileMode: (parsed as LocalCareSettings).profileMode ?? 'automatic', weatherMode: (parsed as LocalCareSettings).weatherMode ?? 'open-meteo' };
    });
    settings.set(key, result);
    if (settings.size > 100) settings.delete(settings.keys().next().value!);
  }
  try { const value = await result; if (requireUserId() !== uid) throw new Error('Account changed.'); return value; }
  catch (error) { if (settings.get(key) === result) settings.delete(key); throw error; }
}
let writes = Promise.resolve();
export async function saveLocalCareSettings(plantId: string, value: LocalCareSettings) {
  const error = localCareSettingsError(value); if (error) throw new Error(error);
  const uid = requireUserId(); const key = keyFor(uid, plantId); const copy = { ...value };
  const job = writes.catch(() => {}).then(async () => {
    if (requireUserId() !== uid) throw new Error('Account changed.');
    await AsyncStorage.setItem(key, JSON.stringify(copy));
    if (requireUserId() !== uid) throw new Error('Account changed.');
    settings.set(key, Promise.resolve(copy)); publish();
  });
  writes = job; return job;
}
