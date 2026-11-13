import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { GrowPress } from '@/ui/GrowMotion';
import { PlantImage } from '@/ui/PlantImage';
import { usePlantHistory } from '../hooks/usePlantHistory';
import { historyDate, historyDetails, historyEvent, historyRows } from '../plantHistoryPresentation';
import type { PlantTheme } from './plantDetailTheme';

export default function PlantHistory({ plantId, plant, theme: t, onViewPhoto, onViewDay }: {
  plantId: string; plant: Plant; theme: PlantTheme; onViewPhoto(entry: JournalEntry): void; onViewDay(day: string, entry: JournalEntry): void;
}) {
  const history = usePlantHistory(plantId);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const rows = historyRows(history.entries, plant, !history.loading && !history.hasMore && !history.error);
  return <View style={{ gap: 16, paddingTop: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>History</Text>
      <GrowPress accessibilityRole="button" accessibilityLabel="Refresh plant history" disabled={history.loading} onPress={history.refresh} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="refresh" color={t.muted} size={20} /></GrowPress>
    </View>
    {!!history.error && <View style={{ backgroundColor: t.surface, borderRadius: 14, padding: 14, gap: 8 }}><Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, lineHeight: 19 }}>{history.error}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Retry plant history" onPress={() => history.entries.length && history.hasMore ? void history.loadMore() : history.refresh()} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: t.accent, fontWeight: '600' }}>Retry</Text></GrowPress></View>}
    {!!rows.length && <View>{rows.map(({ log, day, time }, index) => {
      const created = log.id === '__created';
      const event = created ? { title: 'Plant added', icon: 'sprout-outline' as const, color: t.accent } : historyEvent(log, t);
      const details = created ? '' : historyDetails(log);
      const newDay = index === 0 || rows[index - 1].day !== day;
      const long = details.length > 200 || details.split('\n').length > 5;
      return <View key={log.id}>
        {newDay && <View style={{ paddingLeft: 40, paddingBottom: 12 }}><View style={{ alignSelf: 'flex-start', backgroundColor: t.elevated, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{historyDate(day)}</Text></View></View>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 30, alignItems: 'center', paddingTop: 8 }}>
            {index < rows.length - 1 && <View style={{ position: 'absolute', top: 36, bottom: rows[index + 1].day === day ? -8 : -46, width: 1, backgroundColor: t.elevated }} />}
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.surface, borderWidth: 1, borderColor: `${event.color}50`, justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name={event.icon} size={17} color={event.color} accessible={false} /></View>
          </View>
          <GrowPress containerStyle={{ flex: 1, minWidth: 0, marginBottom: 16 }} accessibilityRole={created ? undefined : 'button'} accessibilityLabel={created ? undefined : `${event.title}, ${historyDate(day)}, ${time === 'Time not recorded' ? 'date only' : time}. View in journal`} disabled={created} onPress={() => onViewDay(day, log)} style={{ padding: 12, gap: 8, borderRadius: 16, backgroundColor: `${event.color}18`, borderWidth: 1, borderColor: `${event.color}30` }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: event.color, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{event.title}</Text>
              <Text style={{ color: t.muted, fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{time === 'Time not recorded' ? 'Date only' : time}</Text>
            </View>
            {log.type === 'photo' && !!log.photoUri && <GrowPress accessibilityRole="button" accessibilityLabel={`Open photo from ${historyDate(day)}`} onPress={event => { event.stopPropagation(); onViewPhoto(log); }}><PlantImage source={{ uri: log.photoUri }} style={{ width: '100%', height: 148, borderRadius: 12, backgroundColor: t.elevated }} /></GrowPress>}
            {!!details && <Text numberOfLines={long && !expanded[log.id] ? 4 : undefined} style={{ color: t.text, fontSize: 13, lineHeight: 20 }}>{details}</Text>}
            {long && <GrowPress accessibilityRole="button" accessibilityLabel={expanded[log.id] ? 'Collapse event details' : 'Read full event details'} accessibilityState={{ expanded: !!expanded[log.id] }} onPress={event => { event.stopPropagation(); setExpanded(previous => ({ ...previous, [log.id]: !previous[log.id] })); }} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 12 }}>{expanded[log.id] ? 'Show less' : 'Read more'}</Text></GrowPress>}
          </GrowPress>
        </View>
      </View>;
    })}</View>}
    {history.loading && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}><ActivityIndicator size="small" color={t.accent} /><Text style={{ color: t.muted, fontSize: 13 }}>Loading history…</Text></View>}
    {history.hasMore && !history.loading && !history.error && <GrowPress accessibilityRole="button" accessibilityLabel="Load older plant events" onPress={() => void history.loadMore()} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderRadius: 12 }}><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Older events</Text></GrowPress>}
    {!history.loading && !history.error && !rows.length && <Text style={{ color: t.muted, fontSize: 14, paddingVertical: 16 }}>No events recorded yet.</Text>}
  </View>;
}
