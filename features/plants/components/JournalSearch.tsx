import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type QueryDocumentSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { GrowPress } from '@/ui/GrowMotion';
import { localDateKey, journalCategory, validateLogDate } from '@/lib/logs/plantJournal';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import type { PlantTheme } from './plantDetailTheme';
import { JournalTimeline } from './PlantJournal';
export default function JournalSearch({ plantId, theme: t, onEdit, onDelete }: { plantId: string; theme: PlantTheme; onEdit: (log: JournalEntry) => void; onDelete: (log: JournalEntry) => void }) {
  const [text, setText] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState(localDateKey());
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [cursor, setCursor] = React.useState<QueryDocumentSnapshot>();
  const [more, setMore] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searched, setSearched] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const lock = React.useRef(false);
  const searchRange = React.useRef({ start: '', end: '' });
  const search = async (append = false) => {
    if (lock.current) return;
    if ((start && validateLogDate(start)) || validateLogDate(end) || start > end) { setError('Choose valid past dates with the start before the end.'); return; }
    if (append && (searchRange.current.start !== start || searchRange.current.end !== end)) { setError('Dates changed. Run a new search first.'); return; }
    searchRange.current = { start, end };
    lock.current = true; setBusy(true); setError('');
    try {
      const constraints: QueryConstraint[] = [where('timestamp', '<=', Timestamp.fromDate(new Date(end + 'T23:59:59.999'))), orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(50)];
      if (start) constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(start + 'T00:00:00'))));
      if (append && cursor) constraints.push(startAfter(cursor));
      const snap = await getDocs(query(collection(db, 'plants', plantId, 'logs'), ...constraints));
      const page = snap.docs.map(item => ({ ...item.data(), id: item.id } as JournalEntry));
      setEntries(previous => append ? [...previous, ...page] : page); setCursor(snap.docs.at(-1)); setMore(snap.size === 50); setSearched(true);
    } catch { setError('Could not search the journal. Check your connection and try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const matches = entries.filter(entry => (category === 'all' || journalCategory(entry) === category) && (entry.description || '').toLowerCase().includes(text.toLowerCase()));
  if (!expanded) return <GrowPress accessibilityRole="button" onPress={() => setExpanded(true)} style={{ paddingVertical: 16 }}><Text style={{ color: t.accent }}>Search older journal history</Text></GrowPress>;
  return <View style={{ gap: 10, marginTop: 18 }}>
    <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Search history</Text>
    {[['Search observations', text, setText], ['From date (optional YYYY-MM-DD)', start, setStart], ['To date (YYYY-MM-DD)', end, setEnd]].map(([label, value, change]) => <TextInput key={label as string} accessibilityLabel={label as string} placeholder={label as string} value={value as string} onChangeText={change as (value: string) => void} placeholderTextColor={t.muted} style={{ color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12 }} />)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['all', 'watering', 'feeding', 'health', 'pests', 'training', 'notes', 'harvest'].map(value => <GrowPress key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={{ padding: 12, backgroundColor: category === value ? t.accent : t.surface, borderRadius: 12 }}><Text style={{ color: category === value ? t.onAccent : t.text }}>{value}</Text></GrowPress>)}</View>
    <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search()} style={{ padding: 14 }}><Text style={{ color: t.accent }}>{busy ? 'Searching…' : 'Search / refresh results'}</Text></GrowPress>
    <Text style={{ color: t.muted }}>Search checks loaded entries. Load more to continue through older history.</Text>
    {(searched || error || busy) && <JournalTimeline logs={matches} loading={busy && !entries.length} error={error} theme={t} onEdit={onEdit} onDelete={onDelete} />}
    {more && <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search(true)} style={{ padding: 14 }}><Text style={{ color: t.accent }}>Load older entries</Text></GrowPress>}
  </View>;
}
