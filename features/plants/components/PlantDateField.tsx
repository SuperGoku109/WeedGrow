import React from 'react';
import { Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { GrowPress } from '@/ui/GrowMotion';
import { isCalendarDay } from '@/lib/dates/plantDay';
import { EditorSelect, EditorTheme } from './PlantEditorFields';
export const displayDay = (day: string) => isCalendarDay(day) ? new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose date';

export default function PlantDateField({ label, value, onChange, today, minimum, disabled = false, optional = false }: { label: string; value: string; onChange(day: string): void; today: string; minimum?: string; disabled?: boolean; optional?: boolean }) {
  const t = React.useContext(EditorTheme);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState((isCalendarDay(value) ? value : today).slice(0, 7) + '-01');
  const maxYear = Number(today.slice(0, 4));
  const minYear = minimum ? Number(minimum.slice(0, 4)) : maxYear - 100;
  return <View style={{ gap: 8 }}><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${label}: ${displayDay(value)}`} accessibilityState={{ expanded: open }} disabled={disabled} onPress={() => { setMonth((isCalendarDay(value) ? value : today).slice(0, 7) + '-01'); setOpen(!open); }} style={{ minHeight: 48, padding: 14, borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface }}><Text style={{ color: t.text, fontSize: 16 }}>{displayDay(value)}{value === today ? ' · Today' : ''} ▾</Text></GrowPress>
    {open && <View style={{ gap: 8 }}><EditorSelect label="Year" value={month.slice(0, 4)} disabled={disabled} options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ label: String(maxYear - i), value: String(maxYear - i) }))} onSelect={year => setMonth(year + month.slice(4))} />
      <Calendar key={month + t.background} current={month} minDate={minimum} maxDate={today} disableAllTouchEventsForDisabledDays onMonthChange={day => setMonth(day.dateString.slice(0, 7) + '-01')} onDayPress={day => { if (!disabled && day.dateString <= today && (!minimum || day.dateString >= minimum)) { onChange(day.dateString); setOpen(false); } }} markedDates={{ [value]: { selected: true, selectedColor: t.accent, selectedTextColor: t.onAccent } }} theme={{ calendarBackground: t.background, monthTextColor: t.text, dayTextColor: t.text, textSectionTitleColor: t.muted, textDisabledColor: t.muted, todayTextColor: t.accent, arrowColor: t.accent }} />
      <View style={{ flexDirection: 'row', gap: 16 }}><GrowPress accessibilityRole="button" disabled={disabled} onPress={() => { onChange(today); setOpen(false); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Use today</Text></GrowPress>{optional && <GrowPress accessibilityRole="button" disabled={disabled} onPress={() => { onChange(''); setOpen(false); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.muted }}>Clear date</Text></GrowPress>}</View>
    </View>}
  </View>;
}
