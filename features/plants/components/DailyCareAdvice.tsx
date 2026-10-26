import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { PlantTheme } from './plantDetailTheme';
import { InsightPanel } from './PlantDetailPanels';
export default function DailyCareAdvice({ cards, loading, error, hasLocation, theme: t, onRefresh }: { cards: SuggestionCard[]; loading: boolean; error: string; hasLocation: boolean; theme: PlantTheme; onRefresh(): void }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!hasLocation) return <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21 }}>Add a location in Details for weather-based care advice.</Text>;
  if (loading) return <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}><ActivityIndicator size="small" color={t.accent} /><Text style={{ color: t.muted, fontSize: 14 }}>Checking today’s care advice…</Text></View>;
  if (error) return <GrowPress accessibilityRole="button" onPress={onRefresh} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.danger, fontSize: 14 }}>{error} Tap to retry.</Text></GrowPress>;
  if (!cards.length) return <Text style={{ color: t.muted, fontSize: 14, paddingVertical: 8 }}>No care alerts for today.</Text>;
  const priority = { critical: 0, warn: 1, watch: 2, info: 3 };
  const ordered = [...cards].sort((a, b) => priority[a.severity] - priority[b.severity]);
  const alerts = ordered.filter(card => card.severity !== 'info');
  const urgent = alerts.some(card => card.severity === 'critical');
  const color = urgent ? t.danger : alerts.length ? t.warm : t.accent;
  return <View style={{ marginTop: 8 }}>
    <GrowPress accessibilityRole="button" accessibilityLabel={`${expanded ? 'Hide' : 'Show'} today’s care advice`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: color }}>
      <MaterialCommunityIcons name={alerts.length ? 'alert-circle-outline' : 'sprout'} size={24} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{alerts.length ? `${alerts.length} care ${alerts.length === 1 ? 'alert' : 'alerts'}${urgent ? ' · urgent' : ''}` : 'Today’s care notes'}</Text><Text numberOfLines={2} style={{ color: t.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{expanded ? 'Advice for today’s conditions' : (alerts[0] || cards[0]).title}</Text></View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={t.muted} />
    </GrowPress>
    {expanded && <View style={{ gap: 4, marginTop: 10 }}>{ordered.map(card => <InsightPanel key={card.id} theme={t} card={card} />)}<GrowPress accessibilityRole="button" accessibilityLabel="Refresh care advice" onPress={onRefresh} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 14 }}>Refresh today’s advice</Text></GrowPress></View>}
  </View>;
}
