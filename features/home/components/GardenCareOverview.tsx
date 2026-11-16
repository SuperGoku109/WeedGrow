import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { evaluateSuggestionCardsForPlants, type PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';
import type { Plant } from '@/firestoreModels';
import type { CareTask } from '@/lib/care/careTasks';
import { gardenCareGroups } from '../gardenCare';

export default function GardenCareOverview({ plants, tasks, now, loading, error, onRetry }: {
  plants: (Plant & { id: string })[]; tasks: CareTask[]; now: Date; loading: boolean; error: string | null; onRetry(): void;
}) {
  const t = useAppTheme();
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const [state, setState] = React.useState<{ key: string; results: PlantSuggestionResult[]; loading: boolean; error: boolean }>({ key: '', results: [], loading: true, error: false });
  const revision = useLocalCareRevision();
  const inputKey = JSON.stringify(plants.filter(p => p.status === 'active' && !p.deleting).map(adviceInput));
  // Refresh on return from recording care, and at the next expiry window.
  const minute = Math.floor(now.getTime() / 60000);
  useFocusEffect(React.useCallback(() => { setRefresh(value => value + 1); }, []));
  React.useEffect(() => {
    const controller = new AbortController();
    setState({ key: inputKey, results: [], loading: true, error: false });
    evaluateSuggestionCardsForPlants(JSON.parse(inputKey), { execution: 'local' }, controller.signal)
      .then(results => { if (!controller.signal.aborted) setState({ key: inputKey, results, loading: false, error: results.length < JSON.parse(inputKey).length }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key: inputKey, results: [], loading: false, error: true }); });
    return () => controller.abort();
  }, [inputKey, revision, refresh, minute]);
  const pending = loading || state.loading || state.key !== inputKey;
  const failed = !!error || state.error;
  const groups = gardenCareGroups(state.key === inputKey ? state.results : [], tasks, plants, now);
  const count = groups.length;
  const title = pending ? 'Checking your garden…' : failed ? 'Care needs a refresh' : count ? `${count} ${count === 1 ? 'thing needs' : 'things need'} checking` : 'No checks due right now';
  const subtitle = pending ? 'Gathering care advice for your plants' : failed ? 'Some care advice is unavailable' : count ? groups.map(group => group.title).join(' · ') : 'Keep an eye on your plants as conditions change';
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Today’s garden care. ${title}`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={s.header}>
      <View style={[s.icon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="sprout" size={32} color={t.accent} /></View>
      <View style={[s.copy, { borderColor: t.elevated }]}>
        <Text style={[s.eyebrow, { color: t.accent }]}>TODAY’S GARDEN CARE</Text>
        <Text accessibilityLiveRegion="polite" style={[s.title, { color: t.text }]}>{title}</Text>
        <Text numberOfLines={expanded ? undefined : 1} style={[s.subtitle, { color: t.muted }]}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name={expanded ? 'chevron-down' : 'chevron-right'} size={25} color={t.accent} />
    </Pressable>
    {expanded && <View style={[s.details, { borderColor: t.elevated }]}>
      {!pending && groups.map(group => <View key={group.key} style={s.group}>
        <Text accessibilityRole="header" style={{ color: group.priority === 0 ? t.danger : t.accent, fontWeight: '600', fontSize: 15 }}>{group.title}</Text>
        {group.plants.map(plant => <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={`Open care for ${plant.name}: ${group.title}`} onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } })} style={[s.plant, { backgroundColor: t.elevated }]}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{plant.name}</Text><Text style={[s.subtitle, { color: t.muted }]}>{plant.detail}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={19} color={t.accent} />
        </Pressable>)}
      </View>)}
      {!pending && !count && <Text style={[s.subtitle, { color: t.muted }]}>{failed ? 'Refresh to check the latest advice.' : 'Your current care suggestions and routine reminders will appear here when a check is due.'}</Text>}
      {failed && <Pressable accessibilityRole="button" onPress={() => { onRetry(); setRefresh(value => value + 1); }} style={s.retry}><Text style={{ color: t.accent, fontWeight: '600' }}>Retry care advice</Text></Pressable>}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, minHeight: 100 },
  icon: { width: 48, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, borderLeftWidth: 1, paddingLeft: 12, gap: 5 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  details: { borderTopWidth: 1, marginHorizontal: 14, paddingVertical: 14, gap: 16 },
  group: { gap: 8 },
  plant: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 10, minHeight: 48 },
  retry: { minHeight: 44, justifyContent: 'center' },
});
