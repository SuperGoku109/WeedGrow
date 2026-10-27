import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { PlantTheme } from './plantDetailTheme';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Props = { label: string; icon: Icon; theme: PlantTheme; onPress(): void; disabled?: boolean; busy?: boolean; danger?: boolean; primary?: boolean; compact?: boolean; accessibilityLabel?: string };
export function PlantIconButton({ label, icon, theme: t, onPress, disabled = false, busy = false }: Props) {
  return <GrowPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated, opacity: disabled ? 0.5 : 1 }}>
    {busy ? <ActivityIndicator size="small" color={t.accent} /> : <MaterialCommunityIcons name={icon} size={22} color={t.accent} accessible={false} />}
  </GrowPress>;
}
export default function PlantActionButton({ label, icon, theme: t, onPress, disabled = false, busy = false, danger = false, primary = false, compact = false, accessibilityLabel }: Props) {
  const color = primary ? t.onAccent : danger ? t.danger : t.accent;
  return <GrowPress accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={{ minHeight: 48, paddingHorizontal: compact ? 10 : 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: primary ? t.accent : t.border, backgroundColor: primary ? t.accent : t.elevated, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8, opacity: disabled ? 0.5 : 1 }}>
    {busy ? <ActivityIndicator size="small" color={color} /> : <MaterialCommunityIcons name={icon} size={20} color={color} accessible={false} />}<Text style={{ color, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
  </GrowPress>;
}
