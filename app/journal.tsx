import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useJournalSearch } from '@/hooks/useJournalSearch';
import { useSession } from '@/services/session';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { journalCategory, localDateKey } from '@/lib/logs/plantJournal';
import { GrowPress } from '@/ui/GrowMotion';
import { palette, s, Field } from '@/features/addPlant/components/FlowUI';
import { SafeAreaView } from 'react-native-safe-area-context';
export default function GardenJournal() {
  const router = useRouter();
  const garden = usePlantList();
  const { user } = useSession();
  const [text, setText] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState(localDateKey());
  const [datesOpen, setDatesOpen] = React.useState(false);
  const { entries, more, busy, error, searched, search } = useJournalSearch(garden.plants, start, end, 25, !garden.loading);
  const results = entries.filter(entry => (category === 'all' || journalCategory(entry) === category) && `${entry.plantName} ${entry.description || ''}`.toLowerCase().includes(text.toLowerCase()));
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
    <GrowPress accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)?tabIndex=1')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: palette.accent, fontSize: 15 }}>← Garden</Text></GrowPress><Text accessibilityRole="header" style={{ color: palette.ink, fontSize: 28, lineHeight: 34, fontWeight: '700' }}>Garden journal</Text>
    <Field label="Find an observation" value={text} onChangeText={setText} placeholder="Plant name or observation" returnKeyType="search" />
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded: datesOpen }} onPress={() => setDatesOpen(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: palette.accent, fontSize: 15 }}>{datesOpen ? 'Hide date range −' : 'Filter by date range +'}</Text></GrowPress>
    {datesOpen && <View style={{ gap: 16, padding: 16, backgroundColor: palette.panel, borderRadius: 16 }}><Field label="From" optional value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" /><Field label="Through" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" /></View>}
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['all', 'watering', 'feeding', 'pests', 'health', 'notes', 'training', 'harvest'].map(value => <GrowPress key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 24, backgroundColor: category === value ? palette.accent : palette.panel }}><Text style={{ color: category === value ? palette.dark : palette.muted, fontSize: 14, textTransform: 'capitalize' }}>{category === value ? '✓ ' : ''}{value}</Text></GrowPress>)}</ScrollView></View>
    <GrowPress accessibilityRole="button" accessibilityState={{ busy }} disabled={busy || garden.loading || !user} onPress={() => void search()} style={[s.button, (busy || garden.loading || !user) && { opacity: 0.6 }]}><Text style={s.buttonText}>{busy ? 'Searching…' : 'Search journal'}</Text></GrowPress>
    {!!(error || garden.error) && <Text accessibilityRole="alert" style={s.error}>{error || garden.error}</Text>}
    <Text accessibilityLiveRegion="polite" style={s.hint}>{!user ? 'Sign in to search your garden journal.' : busy ? 'Loading saved observations…' : !searched ? 'Search to load your saved observations. You can filter them by plant, category or date.' : `${results.length} matches in ${entries.length} loaded entries.${more ? ' Load older entries to extend the search.' : ''}`}</Text>
    {results.map(entry => <GrowPress key={`${entry.plantId}/${entry.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id: entry.plantId } })} style={{ padding: 18, borderRadius: 16, backgroundColor: palette.panel }}><Text style={{ color: palette.ink, fontWeight: '700' }}>{entry.plantName} · {journalCategory(entry)}</Text><Text style={s.hint}>{entry.timestamp.toDate().toLocaleString()}</Text><Text style={s.hint}>{entry.description || 'Activity recorded.'}</Text></GrowPress>)}
    {more && <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search(true)} style={{ padding: 14 }}><Text style={{ color: palette.accent }}>Load older entries</Text></GrowPress>}
    {!busy && !!entries.length && !results.length && <Text style={s.hint}>No loaded observations match. Try another category or clear your search.</Text>}
  </ScrollView></SafeAreaView>;
}
