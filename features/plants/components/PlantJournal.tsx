import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlantLog } from '@/firestoreModels';
import { GrowPress } from '@/ui/GrowMotion';
import { journalCategory } from '@/lib/logs/plantJournal';
import { journalEntryTime, journalKind } from '../journalPresentation';
import { detailStyles as ds, EmptyCard } from './PlantDetailPanels';
import type { PlantTheme } from './plantDetailTheme';
type Entry = PlantLog & { id: string };
export function JournalTimeline({ logs, theme: t, loading, error, onEdit, onDelete, compactEmpty = false, emptyMessage = 'Nothing recorded for this day.', timeZone }: { onEdit?: (log: Entry) => void; onDelete?: (log: Entry) => void; logs: Entry[]; theme: PlantTheme; loading: boolean; error: string; compactEmpty?: boolean; emptyMessage?: string; timeZone?: string | null }) {
  const [menuId, setMenuId] = React.useState<string | null>(null);
  if (!logs.length && compactEmpty) return <Text accessibilityLiveRegion="polite" style={[ds.body, { color: error ? t.danger : t.muted }]}>{error ? 'Activity could not be loaded.' : loading ? 'Loading activity…' : emptyMessage}</Text>;
  if (!logs.length) return <EmptyCard theme={t} title={error ? 'Journal unavailable' : loading ? 'Loading entries…' : 'No activity recorded'} text={error || (loading ? 'Fetching this day’s activity.' : 'Use Add log below to record an activity for this day.')} />;
  return <View style={[ds.card, { backgroundColor: t.surface, borderColor: t.border }]}>{logs.map((log, index) => {
    const kind = journalKind(log); const time = journalEntryTime(log, timeZone);
    const editable = onEdit && ['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(journalCategory(log));
    const measurements = [log.waterMl != null && `${log.waterMl} ml water`, log.nutrientMlPerL != null && `${log.nutrientMlPerL} ml/L nutrients`, log.ph != null && `pH ${log.ph}`, log.heightCm != null && `${log.heightCm} cm`, log.soilMoisture != null && `${log.soilMoisture}% moisture`].filter(Boolean).join(' · ');
    return <View key={log.id} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 36, backgroundColor: t.elevated, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={kind.icon} size={18} color={t.accent} aria-hidden={true} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{kind.label}</Text><Text style={{ color: t.muted, fontSize: 13, marginTop: 3 }}>{time}</Text></View>
        {(editable || onDelete) && <GrowPress accessibilityRole="button" accessibilityLabel={`Manage ${kind.label} entry at ${time}`} accessibilityState={{ expanded: menuId === log.id }} onPress={() => setMenuId(menuId === log.id ? null : log.id)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={24} color={t.muted} /></GrowPress>}
      </View>
      {!!log.description && <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>{log.description}</Text>}
      {!!measurements && <Text style={{ color: t.text, fontSize: 13, lineHeight: 20, marginTop: 8 }}>{measurements}</Text>}
      {menuId === log.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>{editable && <GrowPress accessibilityRole="button" accessibilityLabel={`Edit ${kind.label} entry`} onPress={() => { setMenuId(null); onEdit?.(log); }} style={{ paddingHorizontal: 8, minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Edit entry</Text></GrowPress>}{onDelete && <GrowPress accessibilityRole="button" accessibilityLabel={`Delete ${kind.label} entry`} onPress={() => { setMenuId(null); onDelete(log); }} style={{ paddingHorizontal: 8, minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.danger }}>Delete entry</Text></GrowPress>}</View>}
    </View>;
  })}</View>;
}
