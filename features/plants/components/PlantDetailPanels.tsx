import { gardenControls } from '@/design-system/tokens/garden';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PlantTheme } from './plantDetailTheme';
import CountBadge from '@/ui/CountBadge';

export const detailStyles = StyleSheet.create({
  section: { marginTop: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  eyebrow: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { minHeight: gardenControls.height, borderRadius: gardenControls.radius, paddingHorizontal: gardenControls.paddingHorizontal, paddingVertical: gardenControls.paddingVertical, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
export function SectionTitle({ title, caption, theme, flush = false }: { title: string; caption?: string; theme: PlantTheme; flush?: boolean }) {
  return <View style={[detailStyles.section, { flexWrap: 'wrap' }, flush && { marginTop: 0, marginBottom: 0 }]}><Text style={[detailStyles.title, { color: theme.text }]}>{title}</Text>{!!caption && (/^\d+\+? photos?$/.test(caption) ? <CountBadge value={caption.split(' ')[0]} label={caption} color={theme.muted} backgroundColor={theme.elevated} /> : <Text style={{ color: theme.muted, fontSize: 13 }}>{caption}</Text>)}</View>;
}
export { default as WeatherPanel } from './WeatherPanel';
export { default as PlantDetails } from './PlantDetails';
