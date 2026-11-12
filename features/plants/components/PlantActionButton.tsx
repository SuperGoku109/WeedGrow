import { gardenControls } from '@/design-system/tokens/garden';
import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { PlantTheme } from './plantDetailTheme';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Props = { label: string; icon: Icon; theme: PlantTheme; onPress(): void; disabled?: boolean; busy?: boolean; danger?: boolean; primary?: boolean; compact?: boolean; accessibilityLabel?: string; expanded?: boolean };
export function PlantIconButton({ label, icon, theme: t, onPress, disabled = false, busy = false }: Props) {
  return <GrowPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={{ width: gardenControls.height, height: gardenControls.height, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated, opacity: disabled ? 0.5 : 1 }}>
    {busy ? <ActivityIndicator size="small" color={t.accent} /> : <MaterialCommunityIcons name={icon} size={gardenControls.iconSize} color={t.accent} accessible={false} />}
  </GrowPress>;
}
export default function PlantActionButton({ label, icon, theme: t, onPress, disabled = false, busy = false, danger = false, primary = false, compact = false, accessibilityLabel, expanded }: Props) {
  const color = primary ? t.onAccent : danger ? t.danger : t.accent;
  return <GrowPress accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled: disabled || busy, busy, ...(expanded != null ? { expanded } : {}) }} disabled={disabled || busy} onPress={onPress}
    style={{ minHeight: gardenControls.height, paddingHorizontal: compact ? 10 : gardenControls.paddingHorizontal, paddingVertical: gardenControls.paddingVertical, borderRadius: gardenControls.radius, borderWidth: 1, borderColor: primary ? t.accent : t.border, backgroundColor: primary ? t.accent : t.elevated, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8, opacity: disabled ? 0.5 : 1 }}>
    {busy ? <ActivityIndicator size="small" color={color} /> : <MaterialCommunityIcons name={icon} size={gardenControls.iconSize} color={color} accessible={false} />}<Text style={{ color, fontSize: gardenControls.labelSize, fontWeight: '600', flexShrink: 1 }}>{label}</Text>
  </GrowPress>;
}
