import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRecord } from '@/lib/data/recordDecoders';
export interface Preferences { defaultEnvironment: 'outdoor' | 'indoor' | 'greenhouse'; reminders: boolean }
export const defaults: Preferences = { defaultEnvironment: 'outdoor', reminders: false };
const subscribers = new Set<() => void>();
export const preferencesKey = (uid?: string) => `weedgrow.preferences.v1.${uid || 'device'}`;
export async function readPreferences(uid?: string): Promise<Preferences> {
  const value: unknown = JSON.parse(await AsyncStorage.getItem(preferencesKey(uid)) || '{}');
  if (!isRecord(value)) throw new Error('Invalid saved preferences.');
  const raw = value;
  return { defaultEnvironment: ['outdoor', 'indoor', 'greenhouse'].includes(String(raw.defaultEnvironment)) ? raw.defaultEnvironment as Preferences['defaultEnvironment'] : defaults.defaultEnvironment, reminders: raw.reminders === true };
}
export async function savePreferences(value: Preferences, uid?: string) {
  await AsyncStorage.setItem(preferencesKey(uid), JSON.stringify(value)); subscribers.forEach(listener => listener());
}
export function subscribePreferences(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
