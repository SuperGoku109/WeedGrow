import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useJournalSearch } from '@/hooks/useJournalSearch';
import { GrowPress } from '@/ui/GrowMotion';
import { journalCategory } from '@/lib/logs/plantJournal';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { journalEntryDay, journalEntryTime, journalKind } from '../journalPresentation';
import type { PlantTheme } from './plantDetailTheme';
export interface JournalSearchFilters { text: string; category: string; start: string; end: string; datesOpen: boolean }
export default function JournalSearch({ plantId, theme: t, today, timeZone, onSelectEntry, filters, onFilters, minimum }: { plantId: string; theme: PlantTheme; today: string; timeZone?: string | null; onSelectEntry(entry: JournalEntry): void; minimum?: string; filters: JournalSearchFilters; onFilters(value: JournalSearchFilters): void }) {
  const { text, category, datesOpen } = filters;
  const start = filters.start || minimum || '';
  const beforeAdded = !!minimum && start < minimum;
  const end = filters.end || today;
  const setText = (value: string) => onFilters({ ...filters, text: value });
  const setCategory = (value: string) => onFilters({ ...filters, category: value });
  const setStart = (value: string) => onFilters({ ...filters, start: value });
  const setEnd = (value: string) => onFilters({ ...filters, end: value });
  const { entries, more, busy, error, searched, search } = useJournalSearch([{ id: plantId, name: '' }], start, end, 50, !beforeAdded, today);
  const matches = entries.filter(entry => (category === 'all' || journalCategory(entry) === category) && (entry.description || '').toLowerCase().includes(text.toLowerCase()));
  const field = (label: string, value: string, change: (value: string) => void, placeholder: string) => <View style={{ gap: 7 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text><TextInput accessibilityLabel={label} placeholder={placeholder} value={value} onChangeText={change} onSubmitEditing={() => void search()} returnKeyType="search" placeholderTextColor={t.muted} style={{ color: t.text, backgroundColor: t.background, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 52 }} /></View>;
  return <View style={{ gap: 14 }}>
    <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Load saved history for the date range, then filter the loaded entries by text or activity. Older entries load in pages.</Text>
    {field('Filter loaded observations', text, setText, 'Filter descriptions')}
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded: datesOpen }} onPress={() => onFilters({ ...filters, datesOpen: !datesOpen })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 14 }}>{datesOpen ? 'Hide date filters −' : 'Filter by date range +'}</Text></GrowPress>
    {datesOpen && <View style={{ gap: 14 }}>{field('From date (optional)', start, setStart, 'YYYY-MM-DD')}{field('Through date', end, setEnd, 'YYYY-MM-DD')}</View>}
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['all', 'watering', 'feeding', 'health', 'pests', 'training', 'notes', 'harvest'].map(value => <GrowPress key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: category === value ? t.accent : t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 24 }}><Text style={{ color: category === value ? t.onAccent : t.text, fontSize: 14, textTransform: 'capitalize' }}>{category === value ? '✓ ' : ''}{value}</Text></GrowPress>)}</ScrollView></View>
    <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search()} style={{ minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent, borderRadius: 12, opacity: busy ? 0.6 : 1 }}><Text style={{ color: t.onAccent, fontSize: 16, fontWeight: '700' }}>{busy ? 'Searching…' : searched ? 'Reload history' : 'Load history'}</Text></GrowPress>
    {beforeAdded && <Text accessibilityRole="alert" style={{ color: t.danger }}>History starts on {minimum}, when the plant was added.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{busy ? 'Loading journal history…' : searched ? `${matches.length} matches in ${entries.length} loaded entries. Filtering applies to loaded entries only.${more ? ' Load older entries to extend the search.' : ''}` : 'Load history to begin. Your text and activity filters are kept when you close this sheet.'}</Text>
    {matches.map(entry => { const day = journalEntryDay(entry, timeZone); return <GrowPress key={entry.id} accessibilityRole="button" accessibilityLabel={`Open ${journalKind(entry).label} on ${day}`} onPress={() => onSelectEntry(entry)} style={{ padding: 16, borderRadius: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{journalKind(entry).label}</Text><Text style={{ color: t.muted, fontSize: 13, marginTop: 6 }}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {journalEntryTime(entry, timeZone)}</Text>{!!entry.description && <Text numberOfLines={3} style={{ color: t.text, fontSize: 14, lineHeight: 21, marginTop: 10 }}>{entry.description}</Text>}<Text style={{ color: t.accent, fontSize: 13, marginTop: 10 }}>Open this day →</Text></GrowPress>; })}
    {more && <GrowPress accessibilityRole="button" disabled={busy} onPress={() => void search(true)} style={{ padding: 14, minHeight: 48 }}><Text style={{ color: t.accent }}>Load older entries</Text></GrowPress>}
  </View>;
}
