import React from 'react';
import { Switch, Text, View } from 'react-native';
import { GrowCollapse } from '@/ui/GrowMotion';
import { EditorField } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';
import type { ActivityErrors } from '../form/activityForm';

export default function RepeatWateringFields({ values, onChange, disabled, theme: t, errors }: {
  values: Record<string, string>; onChange(key: string, value: string): void; disabled: boolean; theme: PlantTheme; errors: ActivityErrors;
}) {
  const enabled = values.repeatEnabled === '1';
  return <View style={{ backgroundColor: t.surface, borderRadius: 16, padding: 14, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>Repeat automatically</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{enabled ? 'Watering entries are logged on your schedule.' : 'Save a regular watering routine.'}</Text></View><Switch accessibilityLabel="Repeat watering automatically" disabled={disabled} value={enabled} onValueChange={value => onChange('repeatEnabled', value ? '1' : '')} trackColor={{ false: t.elevated, true: t.accent }} thumbColor={enabled ? t.onAccent : t.muted} /></View>
    <GrowCollapse open={enabled}><View style={{ gap: 12, paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><EditorField label="Every" suffix="days" keyboardType="number-pad" value={values.repeatEveryDays || ''} onChangeText={value => onChange('repeatEveryDays', value)} editable={!disabled} error={errors.repeatEveryDays} /></View><View style={{ flex: 1 }}><EditorField label="At" placeholder="08:00" value={values.repeatTime || ''} onChangeText={value => onChange('repeatTime', value)} editable={!disabled} error={errors.repeatTime} maxLength={5} /></View></View>
      <EditorField label="Water per repeat" suffix="ml" keyboardType="decimal-pad" value={values.repeatWaterMl || ''} onChangeText={value => onChange('repeatWaterMl', value)} editable={!disabled} error={errors.repeatWaterMl} placeholder="e.g. 500" />
      <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>Time zone: {values.repeatTimeZone}. Entries are added while the app is open, or caught up when you reopen it. This logs watering; it does not control irrigation.</Text>
    </View></GrowCollapse>
  </View>;
}
