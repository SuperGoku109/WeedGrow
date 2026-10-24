import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
export interface Preferences { defaultEnvironment: 'outdoor' | 'indoor' | 'greenhouse'; reminders: boolean }
export const defaults: Preferences = { defaultEnvironment: 'outdoor', reminders: false };
const subscribers = new Set<() => void>();
export const preferencesKey = (uid?: string) => `weedgrow.preferences.v1.${uid || 'device'}`;
export async function readPreferences(uid?: string): Promise<Preferences> {
  const raw = JSON.parse(await AsyncStorage.getItem(preferencesKey(uid)) || '{}');
  return { defaultEnvironment: ['outdoor', 'indoor', 'greenhouse'].includes(raw.defaultEnvironment) ? raw.defaultEnvironment : defaults.defaultEnvironment, reminders: raw.reminders === true };
}
export async function savePreferences(value: Preferences, uid?: string) {
  await AsyncStorage.setItem(preferencesKey(uid), JSON.stringify(value)); subscribers.forEach(listener => listener());
}
export function usePreferences(uid?: string) {
  const [value, setValue] = useState(defaults);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const read = () => { void readPreferences(uid).then(result => { if (active) { setValue(result); setError(''); } }).catch(() => { if (active) setError('Device preferences could not be loaded.'); }); };
    setValue(defaults); read(); subscribers.add(read);
    return () => { active = false; subscribers.delete(read); };
  }, [uid]);
  return { preferences: value, error };
}
