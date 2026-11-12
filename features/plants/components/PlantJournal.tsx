import AnchoredActionMenu, { type MenuAnchor } from '@/ui/AnchoredActionMenu';
import PlantActionButton from './PlantActionButton';
import { PendingStatus } from '@/ui/LoadingFeedback';
import React from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlantLog } from '@/firestoreModels';
import { GrowPress } from '@/ui/GrowMotion';
import { PlantImage } from '@/ui/PlantImage';
import { journalCategory } from '@/lib/logs/plantJournal';
import { measurementFields, measurementKeys } from '@/lib/logs/logMeasurements';
import { journalEntryTime, journalKind } from '../journalPresentation';
import type { PlantTheme } from './plantDetailTheme';
export function JournalSectionTitle({ title, caption, theme: t }: { title: string; caption?: string; theme: PlantTheme }) {
  return <View style={{ marginTop: 22, marginBottom: 14, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20, fontWeight: '600', letterSpacing: -.4 }}>{title}</Text>
    {!!caption && <View style={{ backgroundColor: t.elevated, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: t.muted, fontSize: 12, fontWeight: '500' }}>{caption}</Text></View>}
  </View>;
}

function ObservationRow({ label, value, color, theme: t, accessibilityLabel }: { label: string; value: string; color: string; theme: PlantTheme; accessibilityLabel: string }) {
  return <View accessible accessibilityLabel={accessibilityLabel} style={{ marginTop: 8, marginLeft: 30, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
    <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{label}</Text>
    <Text style={{ color, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{value}</Text>
  </View>;
}

type Entry = PlantLog & { id: string };
export function JournalTimeline({ logs, theme: t, loading, error, onEdit, onDelete, emptyMessage = 'Nothing recorded for this day.', timeZone, highlightedId, highlightLabel = 'Selected activity', onEntryLayout, onRetry, onViewPhoto }: { onEdit?: (log: Entry) => void; onDelete?: (log: Entry) => void; logs: Entry[]; theme: PlantTheme; loading: boolean; error: string; compactEmpty?: boolean; emptyMessage?: string; timeZone?: string | null; highlightedId?: string; highlightLabel?: string; onEntryLayout?(id: string, y: number): void; onRetry?(): void; onViewPhoto?(log: Entry): void }) {
  const [menu, setMenu] = React.useState<{ id: string; anchor: MenuAnchor } | null>(null);
  const entriesTop = React.useRef(0);
  const rowRefs = React.useRef<Record<string, View | null>>({});
  const openMenu = (log: Entry, event?: GestureResponderEvent) => {
    const open = (anchor: MenuAnchor) => setMenu({ id: log.id, anchor });
    const row = rowRefs.current[log.id];
    if (event && row?.measureInWindow) row.measureInWindow((x, y, width, height) => open({ x, y, width, height }));
    else open({ x: event?.nativeEvent.pageX || 12, y: event?.nativeEvent.pageY || 12, width: 0, height: 0 });
  };
  const menuEntry = menu && logs.find(log => log.id === menu.id && !log.movement && !log.stageReview && ['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(journalCategory(log)));
  React.useEffect(() => { if (menu && !menuEntry) setMenu(null); }, [menu, menuEntry]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const action = (label: string, handler: () => void, danger = false) => <PlantActionButton label={label.startsWith('Edit ') ? 'Edit entry' : label.startsWith('Delete ') ? 'Delete entry' : label} accessibilityLabel={label} icon={danger ? 'trash-can-outline' : label.startsWith('Edit ') ? 'pencil-outline' : label === 'Show less' ? 'chevron-up' : label.startsWith('Read ') ? 'chevron-down' : label === 'View in Photos' ? 'image-outline' : 'refresh'} theme={t} danger={danger} onPress={handler} />;
  return <View style={{ gap: 12 }}>
    {loading && <PendingStatus label={logs.length ? 'Updating journal…' : 'Loading activities…'} theme={t} />}
    {!!error && <View style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: t.surface }}><Text accessibilityRole="alert" style={{ color: t.danger }}>Activity could not be refreshed.</Text><Text style={{ color: t.muted, lineHeight: 21 }}>{logs.length ? 'The entries below may be out of date.' : 'Your saved activities are kept. Try loading this day again.'}</Text>{onRetry && action('Retry activities', onRetry)}</View>}
    {!logs.length && !loading && !error && <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' }}><View style={{ backgroundColor: t.surface, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="notebook-outline" size={22} color={t.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 15 }}>{emptyMessage}</Text><Text style={{ color: t.muted, lineHeight: 20, fontSize: 13, marginTop: 5 }}>Use Add activity to keep a record of your care.</Text></View></View>}
    {!!logs.length && <View onLayout={event => { entriesTop.current = event.nativeEvent.layout.y; }} style={{ backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden' }}>{logs.map((log, index) => {
      const kind = journalKind(log); const time = journalEntryTime(log, timeZone); const category = journalCategory(log);
      const manual = !log.movement && !log.stageReview && ['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(category);
      const editable = !!onEdit && manual; const deletable = !!onDelete && manual;
      const selected = highlightedId === log.id;
      const structured = !!log.moistureState || !!log.rainfallObservation || measurementKeys.some(key => log[key] != null);
      const description = (category === 'health' && structured && log.description === 'Health measurements recorded.') || (category === 'watering' && log.description === 'Watering recorded.') ? '' : log.description;
      const long = (description?.length || 0) > 240 || (description?.split('\n').length || 0) > 5;
      const spokenDetails = [description, log.moistureState && `Soil reported ${log.moistureState.toLowerCase()}`, log.rainfallObservation && `Rain reported ${log.rainfallObservation.toLowerCase()}`, ...measurementKeys.filter(key => log[key] != null).map(key => `${measurementFields[key].label}: ${log[key]} ${key === 'ph' ? '' : measurementFields[key].unit}`)].filter(Boolean).join('. ');
      const Row = editable || deletable ? Pressable : View;
      return <View key={log.id} ref={node => { rowRefs.current[log.id] = node; }} collapsable={false} onLayout={event => onEntryLayout?.(log.id, entriesTop.current + event.nativeEvent.layout.y)}>
        {index > 0 && <View style={{ height: 1, backgroundColor: t.elevated, marginHorizontal: 16 }} />}
        <Row accessibilityRole={editable || deletable ? 'button' : undefined} accessibilityLabel={editable || deletable ? `Manage ${kind.label} entry at ${time}${spokenDetails ? `. ${spokenDetails}` : ''}` : undefined} accessibilityHint={editable || deletable ? 'Opens edit and delete options.' : undefined} accessibilityState={editable || deletable ? { expanded: menu?.id === log.id } : undefined} onPress={editable || deletable ? event => openMenu(log, event) : undefined} style={{ padding: 16, minHeight: 64, justifyContent: 'center', backgroundColor: selected ? t.elevated : undefined }}>
        {selected && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}><MaterialCommunityIcons name="check-circle-outline" color={t.accent} size={17} /><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{highlightLabel}</Text></View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialCommunityIcons name={kind.icon} size={19} style={{ width: 20, textAlign: 'center' }} color={category === 'watering' ? t.water : t.accent} accessible={false} />
          <Text style={{ flex: 1, minWidth: 0, color: t.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{kind.label}</Text>
          <Text accessibilityLabel={time === 'Time not recorded' ? time : `Logged at ${time}`} style={{ color: t.muted, fontSize: 12, lineHeight: 20, fontVariant: ['tabular-nums'] }}>{time === 'Time not recorded' ? 'No time' : time}</Text>
        </View>
        {category === 'photo' && log.photoUri && <GrowPress accessibilityRole="button" accessibilityLabel="View progress photo" onPress={() => onViewPhoto?.(log)} disabled={!onViewPhoto} style={{ marginTop: 14 }}><PlantImage source={{ uri: log.photoUri }} style={{ width: '100%', height: 160, borderRadius: 12, backgroundColor: t.elevated }} /></GrowPress>}
        {!!description && <Text selectable numberOfLines={long && !expanded[log.id] ? 4 : undefined} style={{ color: t.text, fontSize: 14, lineHeight: 22, marginTop: 8, marginLeft: 30 }}>{description}</Text>}
        {log.rainfallObservation && <ObservationRow label="Rainfall" value={log.rainfallObservation[0] + log.rainfallObservation.slice(1).toLowerCase()} color={t.water} theme={t} accessibilityLabel={`Rain reported ${log.rainfallObservation.toLowerCase()} · user-confirmed rainfall`} />}
        {log.moistureState && <ObservationRow label="Soil condition" value={log.moistureState[0] + log.moistureState.slice(1).toLowerCase()} color={log.moistureState === 'DRY' ? t.warm : log.moistureState === 'WET' ? t.water : t.accent} theme={t} accessibilityLabel={`Soil reported ${log.moistureState.toLowerCase()} · user observation`} />}
        {measurementKeys.some(key => log[key] != null) && <View style={{ gap: 8, marginTop: 8, marginLeft: 30 }}>{measurementKeys.filter(key => log[key] != null).map(key => <View key={key} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><Text style={{ color: t.muted, fontSize: 13 }}>{measurementFields[key].label}</Text><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{log[key]}{key !== 'ph' && <Text style={{ color: t.muted, fontSize: 13, fontWeight: '400' }}> {measurementFields[key].unit}</Text>}</Text></View>)}</View>}
        </Row>
        {long && <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{action(expanded[log.id] ? 'Show less' : 'Read full observation', () => setExpanded(previous => ({ ...previous, [log.id]: !previous[log.id] })))}</View>}
        {category === 'photo' && onViewPhoto && <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{action('View in Photos', () => onViewPhoto(log))}</View>}
      </View>;
    })}</View>}
    {menu && menuEntry && <AnchoredActionMenu anchor={menu.anchor} title={`${journalKind(menuEntry).label} entry`} showTrigger={false} onClose={() => setMenu(null)} actions={[
      ...(onEdit ? [{ label: 'Edit entry', accessibilityLabel: `Edit ${journalKind(menuEntry).label} entry`, icon: 'pencil-outline' as const, onPress: () => { setMenu(null); onEdit(menuEntry); } }] : []),
      ...(onDelete ? [{ label: 'Delete entry', accessibilityLabel: `Delete ${journalKind(menuEntry).label} entry`, icon: 'trash-can-outline' as const, danger: true, onPress: () => { setMenu(null); onDelete(menuEntry); } }] : []),
    ]} />}
  </View>;
}
