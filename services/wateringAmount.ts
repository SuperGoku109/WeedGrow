import AsyncStorage from '@react-native-async-storage/async-storage';
import { readLastWateringAmount } from '@/lib/logs/journalRepository';

const key = (uid: string, plantId: string) => `weedgrow.quick-water.v1.${uid}.${plantId}`;
export async function rememberWateringAmount(uid: string, plantId: string, amount?: number) {
  if (amount == null) await AsyncStorage.removeItem(key(uid, plantId));
  else await AsyncStorage.setItem(key(uid, plantId), String(amount));
}
export async function readRememberedWateringAmount(uid: string, plantId: string): Promise<string> {
  let cached: string | null = null;
  try { cached = await AsyncStorage.getItem(key(uid, plantId)); } catch { /* Journal reads still work without device storage. */ }
  const fallback = cached != null && /^\d+(\.\d+)?$/.test(cached) && Number(cached) <= 1000000 ? cached : '';
  try {
    const latest = await readLastWateringAmount(plantId);
    if (!latest.hasEntry) return fallback;
    await rememberWateringAmount(uid, plantId, latest.amount).catch(() => {});
    return latest.amount == null ? '' : String(latest.amount);
  } catch { return fallback; }
}
