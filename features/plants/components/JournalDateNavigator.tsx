import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DropDownPicker from 'react-native-dropdown-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlantLog } from '@/firestoreModels';
import { GrowPress, useReducedMotion } from '@/ui/GrowMotion';
import type { PlantTheme } from './plantDetailTheme';

interface Props {
  today: string; selected: string; dates: string[]; logs: Record<string, PlantLog[]>;
  historyStatus: 'loading' | 'error' | 'ready'; theme: PlantTheme; minimum?: string; canGoBack: boolean;
  onSelect(day: string): void; onJump(day: string): void; onMove(direction: number): void; onToday(): void; onSearch(): void;
}
export default function JournalDateNavigator({ today, selected, dates, logs, historyStatus, theme: t, minimum, canGoBack, onSelect, onJump, onMove, onToday, onSearch }: Props) {
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const [calendarMonth, setCalendarMonth] = React.useState(selected.slice(0, 7) + '-01');
  const [yearsOpen, setYearsOpen] = React.useState(false);
  const minimumYear = minimum ? Number(minimum.slice(0, 4)) : Math.max(1, Number(today.slice(0, 4)) - 100);
  const maximumYear = Math.min(9998, Math.max(Number(today.slice(0, 4)) + 1, Number(calendarMonth.slice(0, 4)), Number(selected.slice(0, 4))));
  const years = React.useMemo(() => Array.from({ length: Math.max(0, maximumYear - minimumYear + 1) }, (_, index) => ({ label: String(minimumYear + index), value: minimumYear + index })), [minimumYear, maximumYear]);
  const showCalendar = () => { setCalendarMonth(selected.slice(0, 7) + '-01'); setYearsOpen(false); setCalendarOpen(true); };
  const chooseYear = (value: number) => {
    if (!Number.isInteger(value) || value < minimumYear || value > 9998) return;
    const candidate = String(value).padStart(4, '0') + calendarMonth.slice(4);
    const month = minimum && candidate.slice(0, 7) < minimum.slice(0, 7) ? minimum.slice(0, 7) + '-01' : candidate;
    setCalendarMonth(month); setYearsOpen(false);
  };
  const [width, setWidth] = React.useState(354);
  const gridWidth = Math.max(332, width);
  const strip = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    const column = Math.max(0, dates.indexOf(selected)) % 7;
    strip.current?.scrollTo({ x: Math.max(0, (column + 1) * (gridWidth / 7) - width), animated: false });
  }, [selected, dates, gridWidth, width]);
  const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const rangeLabel = `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`;
  return <View style={{ gap: 8, marginTop: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}><GrowPress accessibilityRole="button" accessibilityLabel="Choose journal date from full calendar" onPress={showCalendar} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}><MaterialCommunityIcons name="calendar-month-outline" size={20} color={t.accent} /><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{width < 330 ? new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : rangeLabel}</Text></GrowPress></View>
      <View style={{ flexDirection: 'row' }}>{([-1, 1] as const).map(direction => <GrowPress key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Previous 7 days' : 'Next 7 days'} disabled={direction < 0 && !canGoBack} onPress={() => onMove(direction)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: direction < 0 && !canGoBack ? 0.35 : 1 }}><MaterialCommunityIcons name={direction < 0 ? 'chevron-left' : 'chevron-right'} size={24} color={t.text} /></GrowPress>)}<GrowPress accessibilityRole="button" accessibilityLabel="Search plant journal" onPress={onSearch} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="magnify" size={23} color={t.accent} /></GrowPress></View>
    </View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: gridWidth, gap: 6, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>{dates.map(day => {
            const date = new Date(`${day}T12:00:00`); const active = day === selected; const count = logs[day]?.length || 0;
            const activity = historyStatus === 'loading' ? 'loading activity' : historyStatus === 'error' ? 'activity unavailable' : `${count} ${count === 1 ? 'entry' : 'entries'}`;
            return <GrowPress key={day} accessibilityRole="button" accessibilityLabel={`${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${activity}${day === today ? ', today' : ''}`} aria-pressed={active} accessibilityState={{ selected: active }} onPress={() => onSelect(day)} style={{ width: (gridWidth - 24) / 7, minWidth: 44, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: active ? t.accent : 'transparent', borderWidth: active || day === today ? 1 : 0, borderColor: active || day === today ? t.accent : t.border }}>
              <Text style={{ color: active ? t.onAccent : t.muted, fontSize: 11 }}>{day === today ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
              <Text style={{ color: active ? t.onAccent : t.text, fontSize: 19, fontWeight: '700' }}>{date.getDate()}</Text>
              <Text aria-hidden style={{ color: active ? t.onAccent : t.water, fontSize: 10, lineHeight: 13, fontWeight: '700' }}>{historyStatus === 'ready' && count ? `${count > 99 ? '99+' : count} •` : ' '}</Text>
            </GrowPress>;
          })}</View>
        </View>
      </ScrollView>
    </View>
    {selected !== today && <GrowPress accessibilityRole="button" accessibilityLabel="Back to today" onPress={onToday} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>↩ Back to today</Text></GrowPress>}
    <Modal transparent visible={calendarOpen} animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { setYearsOpen(false); setCalendarOpen(false); }}>
      <View style={{ flex: 1, backgroundColor: '#08110ccc', justifyContent: 'center', alignItems: 'center', padding: 18 }}><ScrollView style={{ width: '100%', maxWidth: 430, maxHeight: '94%', flexGrow: 0, backgroundColor: t.surface, borderRadius: 24 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled"><View accessibilityViewIsModal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>Choose a day</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close date picker" onPress={() => setCalendarOpen(false)} style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="close" size={22} color={t.text} /></GrowPress></View>
        <View style={{ marginVertical: 10, zIndex: 2000 }}>
          <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>Year</Text>
          <DropDownPicker<number> open={yearsOpen} setOpen={setYearsOpen} value={Number(calendarMonth.slice(0, 4))} items={years} setValue={action => { const value = typeof action === 'function' ? action(Number(calendarMonth.slice(0, 4))) : action; if (typeof value === 'number') chooseYear(value); }} searchable={false} listMode="SCROLLVIEW" scrollViewProps={{ nestedScrollEnabled: true }} maxHeight={200} props={{ accessibilityLabel: 'Calendar year', accessibilityRole: 'combobox', accessibilityState: { expanded: yearsOpen } }} style={{ minHeight: 48, backgroundColor: t.background, borderColor: t.border, borderRadius: 12 }} dropDownContainerStyle={{ backgroundColor: t.surface, borderColor: t.border, borderRadius: 12 }} textStyle={{ color: t.text, fontSize: 16 }} listItemContainerStyle={{ minHeight: 48 }} selectedItemContainerStyle={{ backgroundColor: t.elevated }} selectedItemLabelStyle={{ color: t.accent, fontWeight: '700' }} ArrowDownIconComponent={() => <MaterialCommunityIcons name="chevron-down" size={22} color={t.accent} />} ArrowUpIconComponent={() => <MaterialCommunityIcons name="chevron-up" size={22} color={t.accent} />} TickIconComponent={() => <MaterialCommunityIcons name="check" size={20} color={t.accent} />} />
        </View>
        {calendarOpen && <Calendar key={calendarMonth + t.background} current={calendarMonth} minDate={minimum} disableAllTouchEventsForDisabledDays disableArrowLeft={!!minimum && calendarMonth.slice(0, 7) <= minimum.slice(0, 7)} onMonthChange={month => { const value = minimum && month.dateString.slice(0, 7) < minimum.slice(0, 7) ? minimum : month.dateString; setCalendarMonth(value.slice(0, 7) + '-01'); setYearsOpen(false); }} onDayPress={day => { if (minimum && day.dateString < minimum) return; onJump(day.dateString); setCalendarOpen(false); }} markedDates={{ ...Object.fromEntries(Object.entries(logs).map(([day, entries]) => [day, { marked: !!entries.length, dotColor: t.accent }])), [selected]: { selected: true, selectedColor: t.accent, selectedTextColor: t.onAccent, marked: !!logs[selected]?.length } }} theme={{ calendarBackground: t.surface, textSectionTitleColor: t.muted, dayTextColor: t.text, monthTextColor: t.text, todayTextColor: t.accent, arrowColor: t.accent, textDisabledColor: t.muted, textDayFontSize: 14, textMonthFontSize: 16 }} />}
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20, marginTop: 10 }}>{minimum ? `Available from ${new Date(minimum + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, when this plant was added.` : 'Choose a day to see its activity and saved conditions.'} Dots mark activity in the loaded week.</Text>
      </View></ScrollView></View>
    </Modal>
  </View>;
}
