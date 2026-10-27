import PlantActionButton from './PlantActionButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GrowPress } from '@/ui/GrowMotion';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { PlantTheme } from './plantDetailTheme';
import { InsightPanel } from './PlantDetailPanels';
export default function DailyCareAdvice({ cards, loading, error, hasLocation, theme: t, onRefresh, onRecord, canRecord = true }: { cards: SuggestionCard[]; loading: boolean; error: string; hasLocation: boolean; theme: PlantTheme; onRefresh(): void; onRecord?(category: import('@/lib/logs/plantJournal').JournalCategory, context?: 'soil-check'): void; canRecord?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!hasLocation) return <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21 }}>Add a location in Details for weather-based care advice.</Text>;
  if (loading) return <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}><ActivityIndicator size="small" color={t.accent} /><Text style={{ color: t.muted, fontSize: 14 }}>Checking today’s care advice…</Text></View>;
  if (error) return <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 14 }}>{error}</Text><PlantActionButton label="Retry care advice" icon="refresh" theme={t} onPress={onRefresh} /></View>;
  if (!cards.length) return <Text style={{ color: t.muted, fontSize: 14, paddingVertical: 8 }}>No care alerts for today.</Text>;
  const priority = { critical: 0, warn: 1, watch: 2, info: 3 };
  const ordered = [...cards].sort((a, b) => priority[a.severity] - priority[b.severity]);
  return <View style={{ marginTop: 8, gap: 6 }}>
    <InsightPanel key={ordered[0].id} theme={t} card={ordered[0]} preview onRecord={canRecord ? () => onRecord?.('health', ordered[0].kind === 'watering' ? 'soil-check' : undefined) : undefined} />
    {ordered.length > 1 && <><GrowPress accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, color: t.accent }}>{expanded ? 'Hide other care notes' : `Show ${ordered.length - 1} more care ${ordered.length === 2 ? 'note' : 'notes'}`}</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={t.accent} /></GrowPress>{expanded && ordered.slice(1).map(card => <InsightPanel key={card.id} theme={t} card={card} onRecord={canRecord ? () => onRecord?.('health', card.kind === 'watering' ? 'soil-check' : undefined) : undefined} />)}</>}
    {expanded && <PlantActionButton label="Refresh care advice" icon="refresh" theme={t} onPress={onRefresh} />}
  </View>;
}
