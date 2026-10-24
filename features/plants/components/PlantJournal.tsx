import React from 'react';
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlantLog } from '@/firestoreModels';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
import { journalCategory, localDateKey } from '@/lib/logs/plantJournal';
import { logChoices } from './PlantLogComposer';
import { detailStyles as ds, EmptyCard, SectionTitle } from './PlantDetailPanels';
import type { PlantTheme } from './plantDetailTheme';
export function JournalTimeline({ logs, theme: t, loading, error, onEdit, onDelete }: { onEdit?: (log: PlantLog & { id: string }) => void; onDelete?: (log: PlantLog & { id: string }) => void; logs: (PlantLog & { id: string })[]; theme: PlantTheme; loading: boolean; error: string }) {
  if (!logs.length) return <EmptyCard theme={t} title={error ? 'Journal unavailable' : loading ? 'Loading entries…' : 'No activity recorded'} text={error || (loading ? 'Fetching this day’s activity.' : 'Use Add log below to record an activity for this day.')} />;
  return <GrowReveal><View style={[ds.card, { backgroundColor: t.surface, borderColor: t.border }]}>{logs.map((log, index) => {
    const category = journalCategory(log);
    const choice = logChoices.find(item => item.key === category);
    const label = choice?.label ?? ({ photo: 'Photo', stage_change: 'Stage change', harvest: 'Harvest' } as Record<string, string>)[category] ?? 'Activity';
    return <View key={log.id} style={{ flexDirection: 'row', gap: 12, paddingBottom: index === logs.length - 1 ? 0 : 22 }}>
      <View style={{ alignItems: 'center', width: 35 }}><View style={{ width: 35, height: 35, backgroundColor: t.elevated, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={choice?.icon ?? 'calendar-check-outline'} size={18} color={t.accent} /></View>{index < logs.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: t.border, position: 'absolute', top: 40, bottom: -16 }} />}</View>
      <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{label}</Text><Text style={{ color: t.muted, fontSize: 12 }}>{log.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View><Text style={{ color: t.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }}>{log.description || 'Activity recorded.'}</Text><Text style={{ color: t.muted, fontSize: 12, marginTop: 5 }}>{[log.waterMl != null && `${log.waterMl} ml water`, log.nutrientMlPerL != null && `${log.nutrientMlPerL} ml/L nutrients`, log.ph != null && `pH ${log.ph}`, log.heightCm != null && `${log.heightCm} cm`, log.soilMoisture != null && `${log.soilMoisture}% moisture`].filter(Boolean).join(' · ')}</Text><View style={{ flexDirection: 'row', gap: 14 }}>{onEdit && choice && <GrowPress accessibilityRole="button" accessibilityLabel={`Edit ${label} entry`} onPress={() => onEdit(log)} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent }}>Edit</Text></GrowPress>}{onDelete && <GrowPress accessibilityRole="button" accessibilityLabel={`Delete ${label} entry`} onPress={() => onDelete(log)} style={{ paddingVertical: 12 }}><Text style={{ color: t.danger }}>Delete</Text></GrowPress>}</View></View>
    </View>;
  })}</View></GrowReveal>;
}
interface CalendarProps { historyStatus?: 'loading' | 'error' | 'ready'; today?: string; theme: PlantTheme; dates: string[]; selected: string; range: number; logs: Record<string, PlantLog[]>; onSelect: (date: string) => void; onRange: (range: 7 | 14) => void; onMove: (direction: number) => void; onToday: () => void; onJump: (date: string) => void }
export function JournalCalendar({ historyStatus = 'ready', today = localDateKey(), theme: t, dates, selected, range, logs, onSelect, onRange, onMove, onToday, onJump }: CalendarProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const dayWidth = Math.min(64, Math.max(44, (Math.min(width, 760) - 72) / 7));
  return <View>
    <SectionTitle theme={t} title="Journal" />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={ds.row}><GrowPress accessibilityRole="button" accessibilityLabel="Previous calendar week" onPress={() => onMove(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="chevron-left" size={22} color={t.text} /></GrowPress><GrowPress accessibilityRole="button" accessibilityLabel="Choose journal date from full calendar" onPress={() => setPickerOpen(true)} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 10 }}><Text style={{ color: t.text, fontSize: 12 }}>{new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} ▾</Text></GrowPress><GrowPress accessibilityRole="button" accessibilityLabel="Next calendar week" onPress={() => onMove(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="chevron-right" size={22} color={t.text} /></GrowPress></View>
      <View style={{ flexDirection: 'row', gap: 5 }}>{([7, 14] as const).map(value => <GrowPress key={value} accessibilityRole="button" accessibilityLabel={`Show ${value} days`} accessibilityState={{ selected: range === value }} onPress={() => onRange(value)} style={{ backgroundColor: range === value ? t.accent : t.surface, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12 }}><Text style={{ color: range === value ? t.onAccent : t.muted, fontSize: 13, fontWeight: '700' }}>{value}D</Text></GrowPress>)}</View>
    </View>
    <ScrollView key={dates[0] + range} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
      {dates.map(date => { const d = new Date(`${date}T12:00:00`); const active = selected === date; const dayLogs = logs[date] || []; return <GrowPress key={date} accessibilityRole="button" accessibilityLabel={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${historyStatus === 'loading' ? 'loading entries' : historyStatus === 'error' ? 'entries unavailable' : dayLogs.length + ' entries'}`} accessibilityState={{ selected: active }} onPress={() => onSelect(date)} style={{ width: dayWidth, paddingVertical: 12, alignItems: 'center', borderRadius: 17, backgroundColor: active ? t.accent : t.surface, borderWidth: 1, borderColor: active ? t.accent : t.border }}>
        <Text style={{ fontSize: 12, color: active ? t.onAccent : t.muted }}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</Text><Text style={{ fontSize: 18, fontWeight: '700', color: active ? t.onAccent : t.text, marginTop: 7 }}>{d.getDate()}</Text>
        <View style={{ height: 5, flexDirection: 'row', gap: 3, marginTop: 9 }}>{dayLogs.length ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? t.onAccent : t.water }} /> : <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: date === today ? 1 : 0, borderColor: active ? t.onAccent : t.muted }} />}</View>
      </GrowPress>; })}
    </ScrollView>
    <Modal transparent visible={pickerOpen} animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setPickerOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(8,17,12,0.75)' }}><View style={{ width: '100%', maxWidth: 430, backgroundColor: t.surface, padding: 17, borderRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>Find a day</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close date picker" onPress={() => setPickerOpen(false)} style={{ padding: 10 }}><MaterialCommunityIcons name="close" size={22} color={t.text} /></GrowPress></View>
        {pickerOpen && <Calendar key={selected + t.background} current={selected} onDayPress={day => { onJump(day.dateString); setPickerOpen(false); }} markedDates={{ ...Object.fromEntries(Object.entries(logs).map(([date, entries]) => [date, { marked: entries.length > 0, dotColor: t.accent }])), [selected]: { marked: !!logs[selected]?.length, selected: true, selectedColor: t.accent, selectedTextColor: t.onAccent } }} theme={{ calendarBackground: t.surface, textSectionTitleColor: t.muted, dayTextColor: t.text, monthTextColor: t.text, todayTextColor: t.accent, arrowColor: t.accent, textDisabledColor: t.muted, textDayFontSize: 13, textMonthFontSize: 15 }} />}
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18, marginTop: 12 }}>Pick a date to see its weather and journal entries.</Text>
      </View></View>
    </Modal>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: t.muted, fontSize: 12 }}>● Journal entry   ○ Today</Text><GrowPress accessibilityRole="button" onPress={onToday} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 13, paddingVertical: 10 }}>Back to today</Text></GrowPress></View>
  </View>;
}
