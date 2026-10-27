import React from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/services/session';
import type { EditBaseline } from '@/lib/plants/editConflict';
const queues = new Map<string, Promise<void>>();
function store(key: string, value: string | null) {
  const job = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value));
  queues.set(key, job); void job.finally(() => { if (queues.get(key) === job) queues.delete(key); }).catch(() => {}); return job;
}
interface Draft<T> { value: T; baseline: EditBaseline; savedAt: number }
export function useEditDraft<T>(scope: string, value: T, source: EditBaseline, dirty: boolean, enabled = true) {
  const { user } = useSession();
  const key = user && enabled ? `weedgrow.edit.v1.${user.uid}.${scope}` : '';
  const [loaded, setLoaded] = React.useState(''); const [saved, setSaved] = React.useState<Draft<T> | null>(null);
  const [error, setError] = React.useState('');
  const baseline = React.useRef(source); const sourceRef = React.useRef(source); sourceRef.current = source;
  const suspended = React.useRef(false);
  React.useEffect(() => {
    if (!key) return;
    let active = true; suspended.current = false; baseline.current = sourceRef.current; setLoaded(''); setSaved(null);
    void (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => AsyncStorage.getItem(key)).then(raw => {
      if (!active) return;
      const draft = raw ? JSON.parse(raw) as Draft<T> : null;
      if (draft && (!draft.value || !draft.baseline || !Number.isFinite(draft.savedAt))) throw new Error('Invalid draft');
      setSaved(draft); setError(''); setLoaded(key);
    }).catch(() => { if (active) { setError('Draft recovery is unavailable. Keep this form open until saved.'); setLoaded(key); } });
    return () => { active = false; };
  }, [key]);
  const serialized = JSON.stringify(value);
  React.useEffect(() => {
    if (!key || loaded !== key || saved || suspended.current) return;
    let active = true;
    void store(key, !dirty ? null : JSON.stringify({ value: JSON.parse(serialized), baseline: baseline.current, savedAt: Date.now() })).catch(() => { if (active) setError('This draft could not be saved on this device. Keep the form open.'); });
    return () => { active = false; };
  }, [key, loaded, saved, dirty, serialized]);
  const clear = async () => { suspended.current = true; setSaved(null); if (key) await store(key, null); };
  const recover = (apply: (value: T) => void) => { if (saved) { baseline.current = saved.baseline; apply(saved.value); setSaved(null); } };
  const discard = async () => { try { if (key) await store(key, null); setSaved(null); setError(''); } catch { setError('Could not discard the saved draft. Try again.'); } };
  return { ready: !key || loaded === key, saved, error, baseline, clear, recover, discard };
}
export function DraftRecovery<T>({ draft, apply, theme }: { draft: ReturnType<typeof useEditDraft<T>>; apply(value: T): void; theme?: { text: string; muted: string; accent: string; surface: string; danger: string } }) {
  const t = theme || { text: '#edf0e3', muted: '#bdcbb7', accent: '#d2e4a2', surface: '#29402f', danger: '#ffce9b' };
  return <View style={{ gap: 8 }}>{!!draft.error && <Text style={{ color: t.danger }}>{draft.error}</Text>}{draft.saved && <View style={{ padding: 12, backgroundColor: t.surface, borderRadius: 10, gap: 8 }}><Text style={{ color: t.text }}>Unfinished edits saved {new Date(draft.saved.savedAt).toLocaleString()}. Recover them or start with the current details.</Text><Pressable accessibilityRole="button" onPress={() => draft.recover(apply)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Resume unfinished edits</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void draft.discard()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Start new</Text></Pressable></View>}</View>;
}
