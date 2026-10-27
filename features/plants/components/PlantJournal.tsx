import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlantLog } from '@/firestoreModels';
import { GrowPress } from '@/ui/GrowMotion';
import { PlantImage } from '@/ui/PlantImage';
import { journalCategory } from '@/lib/logs/plantJournal';
import { measurementFields, measurementKeys } from '@/lib/logs/logMeasurements';
import { journalEntryTime, journalKind } from '../journalPresentation';
import type { PlantTheme } from './plantDetailTheme';
type Entry = PlantLog & { id: string };
export function JournalTimeline({ logs, theme: t, loading, error, onEdit, onDelete, emptyMessage = 'Nothing recorded for this day.', timeZone, highlightedId, highlightLabel = 'Selected activity', onEntryLayout, onRetry, onViewPhoto }: { onEdit?: (log: Entry) => void; onDelete?: (log: Entry) => void; logs: Entry[]; theme: PlantTheme; loading: boolean; error: string; compactEmpty?: boolean; emptyMessage?: string; timeZone?: string | null; highlightedId?: string; highlightLabel?: string; onEntryLayout?(id: string, y: number): void; onRetry?(): void; onViewPhoto?(log: Entry): void }) {
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const action = (label: string, handler: () => void, danger = false) => <GrowPress accessibilityRole="button" accessibilityLabel={label} onPress={handler} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: danger ? t.danger : t.accent, fontSize: 14 }}>{label.startsWith('Edit ') ? 'Edit entry' : label.startsWith('Delete ') ? 'Delete entry' : label}</Text></GrowPress>;
  return <View style={{ gap: 12 }}>
    {loading && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10 }}><ActivityIndicator color={t.accent} size="small" /><Text style={{ color: t.muted }}>{logs.length ? 'Updating journal…' : 'Loading activities…'}</Text></View>}
    {!!error && <View style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: t.surface }}><Text accessibilityRole="alert" style={{ color: t.danger }}>Activity could not be refreshed.</Text><Text style={{ color: t.muted, lineHeight: 21 }}>{logs.length ? 'The entries below may be out of date.' : 'Your saved activities are kept. Try loading this day again.'}</Text>{onRetry && action('Retry activities', onRetry)}</View>}
    {!logs.length && !loading && !error && <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' }}><View style={{ backgroundColor: t.surface, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="notebook-outline" size={22} color={t.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 15 }}>{emptyMessage}</Text><Text style={{ color: t.muted, lineHeight: 20, fontSize: 13, marginTop: 5 }}>Use Add activity to keep a record of your care.</Text></View></View>}
    {logs.map(log => {
      const kind = journalKind(log); const time = journalEntryTime(log, timeZone); const category = journalCategory(log);
      const manual = !log.movement && ['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(category);
      const editable = !!onEdit && manual; const deletable = !!onDelete && manual;
      const selected = highlightedId === log.id;
      const long = (log.description?.length || 0) > 240 || (log.description?.split('\n').length || 0) > 5;
      return <View key={log.id} onLayout={event => onEntryLayout?.(log.id, event.nativeEvent.layout.y)} style={{ padding: 16, borderRadius: 16, backgroundColor: t.surface, borderWidth: selected ? 1 : 0, borderColor: t.accent }}>
        {selected && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}><MaterialCommunityIcons name="check-circle-outline" color={t.accent} size={17} /><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{highlightLabel}</Text></View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 42, height: 42, backgroundColor: t.elevated, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={kind.icon} size={22} color={category === 'watering' ? t.water : t.accent} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{kind.label}</Text><Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{time}</Text></View>{(editable || deletable) && <GrowPress accessibilityRole="button" accessibilityLabel={`Manage ${kind.label} entry at ${time}`} accessibilityState={{ expanded: menuId === log.id }} onPress={() => setMenuId(menuId === log.id ? null : log.id)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="dots-horizontal" size={23} color={t.muted} /></GrowPress>}</View>
        {category === 'photo' && log.photoUri && <GrowPress accessibilityRole="button" accessibilityLabel="View progress photo" onPress={() => onViewPhoto?.(log)} disabled={!onViewPhoto} style={{ marginTop: 14 }}><PlantImage source={{ uri: log.photoUri }} style={{ width: '100%', height: 160, borderRadius: 12, backgroundColor: t.elevated }} /></GrowPress>}
        {!!log.description && <Text selectable numberOfLines={long && !expanded[log.id] ? 4 : undefined} style={{ color: t.text, fontSize: 14, lineHeight: 22, marginTop: 12 }}>{log.description}</Text>}
        {long && action(expanded[log.id] ? 'Show less' : 'Read full observation', () => setExpanded(previous => ({ ...previous, [log.id]: !previous[log.id] })))}
        {measurementKeys.some(key => log[key] != null) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{measurementKeys.filter(key => log[key] != null).map(key => <View key={key} style={{ backgroundColor: t.elevated, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, gap: 3 }}><Text style={{ color: t.muted, fontSize: 11 }}>{measurementFields[key].label}</Text><Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{log[key]}{key === 'ph' ? '' : ' ' + measurementFields[key].unit}</Text></View>)}</View>}
        {category === 'photo' && onViewPhoto && action('View in Photos', () => onViewPhoto(log))}
        {menuId === log.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, borderTopWidth: 1, borderColor: t.border, gap: 12 }}>{editable && action(`Edit ${kind.label} entry`, () => { setMenuId(null); onEdit?.(log); })}{deletable && action(`Delete ${kind.label} entry`, () => { setMenuId(null); onDelete?.(log); }, true)}</View>}
      </View>;
    })}
  </View>;
}
