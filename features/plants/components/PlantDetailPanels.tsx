import PlantActionButton from './PlantActionButton';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress, GrowReveal } from '@/ui/GrowMotion';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { PlantTheme } from './plantDetailTheme';
import CareDiagnosticDetails from './CareDiagnosticDetails';

export const detailStyles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  eyebrow: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
export function SectionTitle({ title, caption, theme }: { title: string; caption?: string; theme: PlantTheme }) {
  return <View style={[detailStyles.section, { flexWrap: 'wrap' }]}><Text style={[detailStyles.title, { color: theme.text }]}>{title}</Text>{!!caption && <Text style={{ color: theme.muted, fontSize: 13 }}>{caption}</Text>}</View>;
}
export function EmptyCard({ title, text, theme }: { title: string; text: string; theme: PlantTheme }) {
  return <View style={[detailStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={{ color: theme.text, fontWeight: '600', marginBottom: 5 }}>{title}</Text><Text style={[detailStyles.body, { color: theme.muted }]}>{text}</Text></View>;
}
export { default as WeatherPanel } from './WeatherPanel';
export function InsightPanel({ card, theme, expanded, onToggle, onRecord, onWater, hideHeading = false, hideSummary = false }: { card: SuggestionCard; theme: PlantTheme; expanded: boolean; onToggle(): void; onRecord?(): void; onWater?(): void; hideHeading?: boolean; hideSummary?: boolean }) {
  const color = card.severity === 'critical' ? theme.danger : ['warn', 'watch'].includes(card.severity) ? theme.warm : theme.accent;
  const severity = { critical: 'Urgent', warn: 'Needs attention', watch: 'Watch', info: 'Care note' }[card.severity];
  return <View>
    {!hideHeading && <GrowPress accessibilityRole="button" accessibilityLabel={`${severity}: ${card.title}. ${expanded ? 'Hide' : 'Show'} explanation`} accessibilityState={{ expanded }} onPress={onToggle} style={{ minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MaterialCommunityIcons name={card.kind === 'watering' ? 'water-outline' : card.kind === 'rootRot' ? 'sprout-outline' : 'leaf'} size={21} color={card.kind === 'watering' ? theme.water : color} />
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{severity}</Text><Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{card.title}</Text></View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.muted} />
    </GrowPress>}
    {expanded && <GrowReveal style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{!hideSummary && <Text style={[detailStyles.body, { color: theme.muted }]}>{card.summary}</Text>}{Array.from(new Set(card.reasons)).filter(reason => !card.summary.toLowerCase().includes(reason.toLowerCase())).map(reason => <Text key={reason} style={[detailStyles.body, { color: theme.muted, marginTop: 6 }]}>• {reason}</Text>)}<Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 10, textTransform: 'capitalize' }}>{card.metrics.observationDriven ? 'Soil observations · Care history · Weather context' : card.metrics.automaticProfile ? 'Plant details · Weather · Watering history' : card.metrics.experimental ? card.metrics.weatherDriven ? 'On-device experiment · Model weather and test profile' : 'On-device experiment · Assumed weather and test profile' : card.algorithmVersion.startsWith('hops-') && card.metrics.needsWater === null ? 'No supported watering estimate' : `${card.confidence} confidence · Weather-based suggestion`}</Text>{card.kind === 'watering' && !!card.diagnostics?.length && <CareDiagnosticDetails entries={card.diagnostics} theme={theme} />}{onRecord && <View style={{ marginTop: 12, alignSelf: 'flex-start' }}><PlantActionButton label={card.kind === 'watering' ? 'Record soil check' : 'Log observation'} icon="notebook-plus-outline" theme={theme} onPress={onRecord} /></View>}{onWater && <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><PlantActionButton label="Log watering" icon="water-outline" theme={theme} onPress={onWater} /></View>}</GrowReveal>}
  </View>;
}

export { default as PlantDetails } from './PlantDetails';
