import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { JournalCategory } from './plantJournal';
export interface JournalDraft { version: 1; requestId: string; category?: JournalCategory; date: string; description: string; measurements: Record<string, string> }
export const journalDraftKey = (uid: string, plantId: string, entryId = 'new') => `weedgrow.journal.v1.${uid}.${plantId}.${entryId}`;
const queues = new Map<string, Promise<void>>();
function enqueue(key: string, action: () => Promise<void>) {
  const pending = (queues.get(key) || Promise.resolve()).catch(() => {}).then(action);
  queues.set(key, pending);
  const cleanup = () => { if (queues.get(key) === pending) queues.delete(key); };
  void pending.then(cleanup, cleanup);
  return pending;
}
export function decodeJournalDraft(raw: string | null): JournalDraft | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (value?.version !== 1 || typeof value.requestId !== 'string' || typeof value.description !== 'string' || typeof value.date !== 'string' || !value.measurements || typeof value.measurements !== 'object' || Array.isArray(value.measurements)) return null;
    if (value.category && !['watering', 'feeding', 'pests', 'health', 'training', 'notes'].includes(value.category)) return null;
    if (Object.values(value.measurements).some(item => typeof item !== 'string')) return null;
    return value;
  } catch { return null; }
}
export async function readJournalDraft(key: string) { return decodeJournalDraft(await AsyncStorage.getItem(key)); }
export async function writeJournalDraft(key: string, draft: JournalDraft) {
  const raw = JSON.stringify(draft);
  // Web must persist before a tab can close; native storage remains asynchronous.
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(key, raw);
  else await enqueue(key, () => AsyncStorage.setItem(key, raw));
}
export async function clearJournalDraft(key: string) { await enqueue(key, () => AsyncStorage.removeItem(key)); }
