import React from 'react';
import { Text, View } from 'react-native';
import { addDays } from '@/lib/dates/plantDay';
import { GrowPress } from '@/ui/GrowMotion';
import { journalCategory } from '@/lib/logs/plantJournal';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { journalEntryDay, journalEntryTime, journalKind } from '../journalPresentation';
import { usePlantHistorySearch } from '../hooks/usePlantHistorySearch';
import type { PlantTheme } from './plantDetailTheme';
import { EditorField, EditorTheme, EditorSelect } from './PlantEditorFields';
import PlantDateField, { displayDay } from './PlantDateField';
export interface JournalSearchFilters { text: string; category: string; start: string; end: string; datesOpen: boolean }
export default function JournalSearch({ plantId, theme: t, today, timeZone, onSelectEntry, filters, onFilters, minimum }: { plantId: string; theme: PlantTheme; today: string; timeZone?: string | null; onSelectEntry(entry: JournalEntry): void; filters: JournalSearchFilters; onFilters(value: JournalSearchFilters): void; minimum?: string }) {
  const recent = addDays(today, -29);
  const start = filters.start || (minimum && minimum > recent ? minimum : recent);
  const end = filters.end || today;
  const { entries, busy, error, retry } = usePlantHistorySearch(plantId, start, end, timeZone);
  const terms = filters.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = entries.filter(entry => (filters.category === 'all' || journalCategory(entry) === filters.category) && terms.every(term => [entry.description, journalKind(entry).label, entry.waterMl != null ? `${entry.waterMl} ml water` : '', entry.nutrientMlPerL != null ? `${entry.nutrientMlPerL} ml/L nutrients` : '', entry.heightCm != null ? `${entry.heightCm} cm` : '', entry.ph != null ? `pH ${entry.ph}` : '', entry.soilMoisture != null ? `${entry.soilMoisture}% moisture` : ''].join(' ').toLowerCase().includes(term)));
  return <EditorTheme.Provider value={t}><View style={{ gap: 14 }}>
    <EditorField label="Search journal" value={filters.text} onChangeText={text => onFilters({ ...filters, text })} placeholder="Observation, activity or measurement" />
    <EditorSelect label="Activity" value={filters.category} options={[['all', 'All activities'], ['watering', 'Watering'], ['feeding', 'Feeding'], ['health', 'Health'], ['pests', 'Pests'], ['training', 'Training'], ['notes', 'Observations'], ['photo', 'Photos'], ['harvest', 'Harvest'], ['stage_change', 'Stage changes']].map(([value, label]) => ({ value, label }))} onSelect={category => onFilters({ ...filters, category })} />
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded: filters.datesOpen }} onPress={() => onFilters({ ...filters, datesOpen: !filters.datesOpen })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>{displayDay(start)} – {displayDay(end)} · Change dates</Text></GrowPress>
    {filters.datesOpen && <><PlantDateField label="From date" value={start} onChange={value => onFilters({ ...filters, start: value, end: value > end ? value : end })} today={today} /><PlantDateField label="Through date" value={end} onChange={value => onFilters({ ...filters, end: value, start: value < start ? value : start })} today={today} /><GrowPress accessibilityRole="button" onPress={() => onFilters({ ...filters, start: recent, end: today })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Last 30 days</Text></GrowPress></>}
    <Text accessibilityLiveRegion="polite" style={{ color: t.muted, lineHeight: 21 }}>{busy ? `Searching this date range… ${entries.length} activities checked.` : error ? 'Search is incomplete. Retry to include the whole date range.' : `${matches.length} ${matches.length === 1 ? 'result' : 'results'} in this date range.`}</Text>
    {!!error && <><Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text><GrowPress accessibilityRole="button" onPress={retry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Retry search</Text></GrowPress></>}
    {!busy && !error && !matches.length && <Text style={{ color: t.muted }}>No matching activities. Try another phrase or a wider date range.</Text>}
    {matches.map(entry => <GrowPress key={entry.id} accessibilityRole="button" accessibilityLabel={`Open ${journalKind(entry).label} on ${journalEntryDay(entry, timeZone)}`} onPress={() => onSelectEntry(entry)} style={{ padding: 14, borderBottomWidth: 1, borderColor: t.border, gap: 8 }}><Text style={{ color: t.text, fontWeight: '600' }}>{journalKind(entry).label}</Text><Text style={{ color: t.muted }}>{displayDay(journalEntryDay(entry, timeZone))} · {journalEntryTime(entry, timeZone)}</Text>{!!entry.description && <Text numberOfLines={3} style={{ color: t.text, lineHeight: 21 }}>{entry.description}</Text>}<Text style={{ color: t.accent }}>View activity →</Text></GrowPress>)}
  </View></EditorTheme.Provider>;
}
