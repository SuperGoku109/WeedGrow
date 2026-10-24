import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useSession, requireUserId } from '@/services/session';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { journalCategory, localDateKey, validateLogDate } from '@/lib/logs/plantJournal';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { GrowPress } from '@/ui/GrowMotion';
import { palette, s } from '@/features/addPlant/components/FlowUI';
type Result = JournalEntry & { plantId: string; plantName: string };
export default function GardenJournal() {
  const router = useRouter();
  const garden = usePlantList();
  const { user } = useSession();
  const generation = React.useRef(0);
  React.useEffect(() => { generation.current++; setEntries([]); cursors.current = {}; setMore(false); }, [user?.uid]);
  const [text, setText] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState(localDateKey());
  const [entries, setEntries] = React.useState<Result[]>([]);
  const cursors = React.useRef<Record<string, QueryDocumentSnapshot | null>>({});
  const [more, setMore] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const searchRange = React.useRef({ start: '', end: '' });
  const search = async (append = false) => {
    if (lock.current || garden.loading) return;
    if (start && validateLogDate(start) || validateLogDate(end) || start > end) { setError('Choose valid past dates with the start before the end.'); return; }
    if (append && (searchRange.current.start !== start || searchRange.current.end !== end)) { setError('Dates changed. Run a new search first.'); return; }
    searchRange.current = { start, end };
    const uid = requireUserId(); const requestGeneration = generation.current;
    lock.current = true; setBusy(true); setError('');
    if (!append) { cursors.current = {}; setEntries([]); }
    try {
      const results: Result[] = [];
      const next = { ...cursors.current };
      // Bound parallel requests for large gardens and page each plant separately.
      for (let offset = 0; offset < garden.plants.length; offset += 4) await Promise.all(garden.plants.slice(offset, offset + 4).map(async plant => {
        if (append && next[plant.id] === null) return;
        const constraints: QueryConstraint[] = [where('timestamp', '<=', Timestamp.fromDate(new Date(end + 'T23:59:59.999'))), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(25)];
        if (start) constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(start + 'T00:00:00'))));
        if (append && next[plant.id]) constraints.push(startAfter(next[plant.id]));
        const snapshot = await getDocs(query(collection(db, 'plants', plant.id, 'logs'), ...constraints));
        results.push(...snapshot.docs.map(item => ({ ...item.data(), id: item.id, plantId: plant.id, plantName: plant.name } as Result)));
        next[plant.id] = snapshot.size === 25 ? snapshot.docs.at(-1)! : null;
      }));
      if (requestGeneration !== generation.current || requireUserId() !== uid) return;
      cursors.current = next; setMore(Object.values(next).some(Boolean));
      setEntries(previous => [...(append ? previous : []), ...results].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()));
    } catch { setError('Could not load the garden journal. Retry your search.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const results = entries.filter(entry => (category === 'all' || journalCategory(entry) === category) && `${entry.plantName} ${entry.description || ''}`.toLowerCase().includes(text.toLowerCase()));
  return <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 24, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
    <GrowPress accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>← Back</Text></GrowPress><Text style={s.sectionTitle}>Garden journal</Text>
    {[['Search plants and observations', text, setText], ['From YYYY-MM-DD (optional)', start, setStart], ['To YYYY-MM-DD', end, setEnd]].map(([label, value, change]) => <TextInput key={label as string} accessibilityLabel={label as string} value={value as string} onChangeText={change as (value: string) => void} placeholder={label as string} placeholderTextColor={palette.muted} style={{ color: palette.ink, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14 }} />)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{['all', 'watering', 'feeding', 'pests', 'health', 'notes', 'training', 'harvest'].map(value => <GrowPress key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={{ padding: 12 }}><Text style={{ color: category === value ? palette.accent : palette.muted }}>{value}</Text></GrowPress>)}</View>
    <GrowPress accessibilityRole="button" disabled={busy || garden.loading || !user} onPress={() => void search()} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>{busy ? 'Searching…' : 'Search / refresh garden journal'}</Text></GrowPress>
    {!!(error || garden.error) && <Text accessibilityRole="alert" style={s.error}>{error || garden.error}</Text>}
    <Text style={s.hint}>{results.length} matches in {entries.length} loaded entries. Load older entries to extend the search.</Text>
    {results.map(entry => <GrowPress key={`${entry.plantId}/${entry.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id: entry.plantId } })} style={{ padding: 18, borderRadius: 16, backgroundColor: palette.panel }}><Text style={{ color: palette.ink, fontWeight: '700' }}>{entry.plantName} · {journalCategory(entry)}</Text><Text style={s.hint}>{entry.timestamp.toDate().toLocaleString()}</Text><Text style={s.hint}>{entry.description || 'Activity recorded.'}</Text></GrowPress>)}
    {more && <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search(true)} style={{ padding: 14 }}><Text style={{ color: palette.accent }}>Load older entries</Text></GrowPress>}
  </ScrollView>;
}
