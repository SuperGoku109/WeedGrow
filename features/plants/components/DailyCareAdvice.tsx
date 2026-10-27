import PlantActionButton from './PlantActionButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GrowPress } from '@/ui/GrowMotion';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { PlantTheme } from './plantDetailTheme';
import { InsightPanel } from './PlantDetailPanels';
export default function DailyCareAdvice({ cards, loading, error, hasLocation, theme: t, onRefresh, onRecord, canRecord = true }: { cards: SuggestionCard[]; loading: boolean; error: string; hasLocation: boolean; theme: PlantTheme; onRefresh(): void; onRecord?(category: import('@/lib/logs/plantJournal').JournalCategory, context?: 'soil-check'): void; canRecord?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const [openNote, setOpenNote] = React.useState<string | null>(null);
  if (!hasLocation) return <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21 }}>Add a location in Details for weather-based care advice.</Text>;
  if (loading) return <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}><ActivityIndicator size="small" color={t.accent} /><Text style={{ color: t.muted, fontSize: 14 }}>Checking today’s care advice…</Text></View>;
  if (error) return <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 14 }}>{error}</Text><PlantActionButton label="Retry care advice" icon="refresh" theme={t} onPress={onRefresh} /></View>;
  if (!cards.length) return <Text style={{ color: t.muted, fontSize: 14, paddingVertical: 8 }}>No care alerts for today.</Text>;
  const priority = { critical: 0, warn: 1, watch: 2, info: 3 };
  const ordered = [...cards].sort((a, b) => priority[a.severity] - priority[b.severity]);
  const lead = ordered[0];
  const color = lead.severity === 'critical' ? t.danger : lead.severity === 'info' ? t.accent : t.warm;
  const severity = { critical: 'Urgent', warn: 'Needs attention', watch: 'Watch', info: 'Care note' }[lead.severity];
  const count = `${ordered.length} ${ordered.length === 1 ? 'note' : 'notes'}`;
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${expanded ? 'Minimize' : 'Expand'} care notes. ${count}. ${severity}: ${lead.title}`} accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); setOpenNote(null); }} style={s.header}>
      <View style={[s.icon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="leaf" size={22} color={color} /></View>
      <View style={s.copy}>
        <View style={s.heading}><Text style={[s.title, { color: t.text }]}>Care today</Text><Text style={[s.count, { color: t.muted }]}>{count}</Text></View>
        {!expanded && <Text style={[s.summary, { color: t.text }]}><Text style={{ color, fontWeight: '600' }}>{severity} · </Text>{lead.title}</Text>}
      </View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={t.muted} />
    </GrowPress>
    {expanded && <View>
      {ordered.map(card => <View key={card.id} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }}><InsightPanel theme={t} card={card} expanded={openNote === card.id} onToggle={() => setOpenNote(openNote === card.id ? null : card.id)} onRecord={canRecord && onRecord ? () => onRecord('health', card.kind === 'watering' ? 'soil-check' : undefined) : undefined} /></View>)}
      <View style={[s.footer, { borderTopColor: t.border }]}><PlantActionButton label="Refresh care advice" icon="refresh" theme={t} onPress={onRefresh} /></View>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  card: { marginTop: 8, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  header: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  heading: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  count: { fontSize: 12, lineHeight: 18 },
  summary: { fontSize: 13, lineHeight: 19 },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
});
