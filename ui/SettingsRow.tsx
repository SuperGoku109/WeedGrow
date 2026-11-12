import React from 'react';
import { GrowPress } from './GrowMotion';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { gardenControls, gardenThemes } from '@/design-system/tokens/garden';
const t = gardenThemes.grove;
export default function SettingsRow({ label, icon = 'chevron-right', onPress, disabled, busy = false }: { label: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress(): void; disabled?: boolean; busy?: boolean }) {
  return <GrowPress hitSlop={gardenControls.hitSlop} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? t.elevated : t.surface, borderRadius: 14, opacity: disabled ? 0.6 : 1 })}>
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background, borderRadius: 10 }}><MaterialCommunityIcons name={icon} size={20} color={t.accent} /></View>
    <Text style={{ flex: 1, color: t.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{label}</Text>
    {busy ? <ActivityIndicator color={t.accent} size="small" /> : <MaterialCommunityIcons name="chevron-right" size={20} color={t.muted} />}
  </GrowPress>;
}
