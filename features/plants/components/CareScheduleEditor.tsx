import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { GrowPress } from '@/ui/GrowMotion';
import type { PlantReminderSchedule } from '@/firestoreModels';
import { plantThemes, type PlantTheme } from './plantDetailTheme';
/** Shared by creation and editing; each care kind has an independent schedule. */
export default function CareScheduleEditor({ kind, value, onChange, disabled = false, allowSmart = true, theme: t = plantThemes.grove }: {
  kind: 'watering' | 'feeding'; value: PlantReminderSchedule; onChange(value: PlantReminderSchedule): void; disabled?: boolean; allowSmart?: boolean; theme?: PlantTheme;
}) {
  const label = kind === 'watering' ? 'Watering' : 'Fertilizing';
  const mode = value.type === 'none' ? 'none' : value.type === 'smart' ? 'smart' : 'custom';
  const button = (name: string, selected: boolean, action: () => void) => <GrowPress key={name} accessibilityRole="button" accessibilityLabel={`${label}: ${name}`} accessibilityState={{ selected }} disabled={disabled} onPress={action} style={{ minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: selected ? t.elevated : t.surface, borderWidth: 1, borderColor: selected ? t.accent : t.border }}><Text style={{ color: selected ? t.accent : t.text }}>{name}</Text></GrowPress>;
  const input = (name: string, text: string, change: (value: string) => void, numeric = false) => <View style={{ gap: 5 }}><Text style={{ color: t.muted }}>{name}</Text><TextInput accessibilityLabel={`${label}: ${name}`} editable={!disabled} value={text} onChangeText={change} keyboardType={numeric ? 'number-pad' : 'default'} placeholder={numeric ? 'Enter days' : '09:00'} placeholderTextColor={t.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 12, color: t.text }} /></View>;
  return <View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{label} reminders</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{button('Off', mode === 'none', () => onChange({ type: 'none' }))}{allowSmart && button('Smart schedule', mode === 'smart', () => onChange({ type: 'smart', ...(kind === 'feeding' && value.intervalDays ? { intervalDays: value.intervalDays, timeOfDay: value.timeOfDay || '09:00' } : {}) }))}{button('Custom schedule', mode === 'custom', () => onChange({ type: 'interval', intervalDays: value.intervalDays ?? 7, timeOfDay: value.timeOfDay || '09:00' }))}</View>
    {mode === 'smart' && <Text style={{ color: t.muted, lineHeight: 20 }}>{kind === 'watering' ? 'Smart reminders ask you to check the soil. Timing follows observations, recent care and weather; it does not mean watering is automatically needed.' : 'Smart reviews use your product-label interval and feeding history, and can wait for the next soil check when current conditions need review. They do not calculate nutrient needs or doses.'}</Text>}
    {mode === 'custom' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{button('Every few days', value.type === 'interval', () => onChange({ type: 'interval', intervalDays: value.intervalDays ?? 7, timeOfDay: value.timeOfDay || '09:00' }))}{button('Selected weekdays', value.type === 'custom', () => onChange({ type: 'custom', customDays: value.customDays?.length ? value.customDays : ['mon'], timeOfDay: value.timeOfDay || '09:00' }))}</View>}
    {(value.type === 'interval' || value.type === 'smart' && kind === 'feeding') && input(value.type === 'smart' ? 'Interval from your product label (days)' : 'Repeat every (days)', value.intervalDays == null ? '' : String(value.intervalDays), raw => onChange({ ...value, intervalDays: raw.trim() ? Number(raw) : undefined }), true)}
    {value.type === 'custom' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => button(day.toUpperCase(), !!value.customDays?.includes(day), () => onChange({ ...value, customDays: value.customDays?.includes(day) ? value.customDays.filter(v => v !== day) : [...(value.customDays ?? []), day] })))}</View>}
    {mode !== 'none' && !(kind === 'watering' && mode === 'smart') && input('Reminder time (HH:MM)', value.timeOfDay || '09:00', raw => onChange({ ...value, timeOfDay: raw }))}
    {mode !== 'none' && <Text style={{ color: t.muted, fontSize: 12 }}>Phone alerts also require care reminders enabled in Settings. Custom times use the plant location time zone, or the device time zone if unknown.</Text>}
  </View>;
}
