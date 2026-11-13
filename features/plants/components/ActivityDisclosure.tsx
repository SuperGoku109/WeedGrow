import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowCollapse, GrowPress, GrowRotate } from '@/ui/GrowMotion';
import type { PlantTheme } from './plantDetailTheme';

export default function ActivityDisclosure({ label, value, hint = 'Optional', expanded, onToggle, disabled, theme: t, children }: {
  label: string; value?: string; hint?: string; expanded: boolean; onToggle(): void; disabled?: boolean; theme: PlantTheme; children: React.ReactNode;
}) {
  return <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.elevated, borderRadius: 14, overflow: 'hidden' }}>
    <GrowPress accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value || hint }} accessibilityHint={expanded ? 'Hide optional details. Entered values are kept.' : 'Show optional details.'} accessibilityState={{ expanded }} disabled={disabled} onPress={onToggle} hitSlop={0} style={{ minHeight: 54, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: t.text, fontSize: 14, lineHeight: 19, fontWeight: '600' }}>{label}</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 16 }}>{hint}</Text></View>
      {!!value && <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{value}</Text>}
      <GrowRotate expanded={expanded}><MaterialCommunityIcons name="chevron-down" size={20} color={t.muted} /></GrowRotate>
    </GrowPress>
    <GrowCollapse open={expanded}><View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}><View style={{ height: 1, backgroundColor: t.elevated, marginBottom: 2 }} />{children}</View></GrowCollapse>
  </View>;
}
