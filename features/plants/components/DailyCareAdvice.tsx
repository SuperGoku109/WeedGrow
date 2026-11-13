import React from 'react';
import { PendingStatus } from '@/ui/LoadingFeedback';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
import type { JournalCategory } from '@/lib/logs/plantJournal';
import type { PlantTheme } from './plantDetailTheme';
import { careAction, careFacts } from '../careSuggestionPresentation';

export default function DailyCareAdvice({ cards, loading, error, hasLocation, theme: t, onRefresh, onRecord, canRecord = true }: {
  cards: SuggestionCard[]; loading: boolean; error: string; hasLocation: boolean; theme: PlantTheme; onRefresh(): void;
  onRecord?(category: JournalCategory, context?: 'soil-check'): void; canRecord?: boolean;
}) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const retry = (label: string) => <GrowPress accessibilityRole="button" accessibilityLabel={label} onPress={onRefresh} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.accent, fontSize: 14 }}>{label}</Text></GrowPress>;
  if (!hasLocation && !loading && !cards.some(card => card.metrics.experimental === true || card.metrics.observationDriven === true)) return <View style={[s.panel, { backgroundColor: t.surface }]}><Text style={{ color: t.muted, fontSize: 14, lineHeight: 22 }}>Add a location in Plant info for local care advice.</Text></View>;
  if (loading) return <PendingStatus label="Checking today’s care…" theme={t} />;
  if (error) return <View style={[s.panel, { backgroundColor: t.surface }]}><Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 14, lineHeight: 22 }}>{error}</Text>{retry('Retry care advice')}</View>;
  if (!cards.length) return <View style={[s.panel, { backgroundColor: t.surface }]}><Text style={{ color: t.muted, fontSize: 14 }}>Care advice is unavailable.</Text>{retry('Refresh care advice')}</View>;
  const priority = { critical: 0, warn: 1, watch: 2, info: 3 };
  const ordered = [...cards].sort((a, b) => priority[a.severity] - priority[b.severity]);
  return <View style={[s.panel, { backgroundColor: t.surface }]}>
    <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 13, fontWeight: '500' }}>Care today</Text>
    {ordered.map((card, index) => {
      const title = card.kind === 'watering' && card.metrics.observationDriven ? ({ CHECK_LATER: 'Check again later', CHECK_SOON: 'Soil check coming up' } as Record<string, string>)[String(card.metrics.checkStatus)] || card.title : card.title;
      const color = card.severity === 'critical' ? t.danger : card.severity === 'info' ? t.text : t.warm;
      const action = careAction(card), facts = careFacts(card);
      const reasons = [...new Set(card.reasons)].filter(reason => reason && !card.summary.includes(reason));
      return <View key={card.id} style={{ gap: 9, ...(index ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border, paddingTop: 18 } : {}) }}>
        <Text accessibilityRole={card.severity === 'critical' ? 'alert' : 'header'} style={{ color, fontSize: 17, lineHeight: 24, fontWeight: '600' }}>{card.severity === 'critical' ? 'Urgent: ' : ''}{title}</Text>
        {!!card.summary && <Text style={{ color: t.muted, fontSize: 14, lineHeight: 22 }}>{card.summary}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginTop: 2 }}>
          {action && canRecord && onRecord && <GrowPress accessibilityRole="button" accessibilityLabel={action.label + ': ' + card.title} onPress={() => onRecord(action.category, action.context)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.elevated, flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name={action.icon} size={17} color={card.kind === 'watering' ? t.water : t.accent} /><Text style={{ color: card.kind === 'watering' ? t.water : t.accent, fontSize: 13, fontWeight: '600' }}>{action.label}</Text></GrowPress>}
          <GrowPress accessibilityRole="button" accessibilityLabel={(open[card.id] ? 'Hide why: ' : 'Learn why: ') + card.title} accessibilityState={{ expanded: !!open[card.id] }} onPress={() => setOpen(previous => ({ ...previous, [card.id]: !previous[card.id] }))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 13 }}>{open[card.id] ? 'Hide explanation' : 'Learn why'}</Text></GrowPress>
        </View>
        {open[card.id] && <View testID={'care-evidence-' + card.id} style={{ backgroundColor: t.elevated, borderRadius: 12, padding: 14, gap: 14 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Why this suggestion</Text>
          {reasons.map(reason => <Text key={reason} style={{ color: t.text, fontSize: 13, lineHeight: 21 }}>{reason}</Text>)}
          {facts.map((fact, i) => <View key={fact.label + i} style={{ gap: 4 }}><Text style={{ color: t.muted, fontSize: 12 }}>{fact.label}</Text><Text style={{ color: t.text, fontSize: 13, lineHeight: 21 }}>{fact.value}</Text></View>)}
          {!facts.length && !reasons.length && <Text style={{ color: t.muted, fontSize: 13, lineHeight: 21 }}>The explanation above is available, but detailed input values were not supplied with this suggestion.</Text>}
        </View>}
      </View>;
    })}
  </View>;
}
const s = StyleSheet.create({
  panel: { marginTop: 16, padding: 16, borderRadius: 18, gap: 12 },
});
