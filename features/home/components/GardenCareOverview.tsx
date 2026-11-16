import React from 'react';
import { plantDay } from '@/lib/dates/plantDay';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { Plant } from '@/firestoreModels';
import type { CareTask } from '@/lib/care/careTasks';
import { gardenCareGroups } from '../gardenCare';
import { useGardenCareSuggestions } from '../hooks/useGardenCareSuggestions';
import { colorAlpha } from '@/design-system/tokens/garden';

// Survive Home remounts without showing the transient refresh state again.
const completedSummaries = new Map<string, ReturnType<typeof gardenCareGroups>>();

export default function GardenCareOverview({ plants, tasks, now, loading, error, onRetry, cacheKey }: {
  cacheKey?: string; plants: (Plant & { id: string })[]; tasks: CareTask[]; now: Date; loading: boolean; error: string | null; onRetry(): void;
}) {
  const t = useAppTheme();
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const advice = useGardenCareSuggestions(plants, now);
  const pending = loading || advice.loading;
  const failed = !!error || advice.error;
  const scope = JSON.stringify([cacheKey, plants.filter(plant => plant.status === 'active' && !plant.deleting).map(plant => [plant.id, plant.name, plantDay(now, plant.locationTimeZone)]).sort((a, b) => a[0].localeCompare(b[0]))]);
  const settled = React.useRef<{ scope: string; groups: ReturnType<typeof gardenCareGroups> } | null>(null);
  const latestGroups = React.useMemo(() => gardenCareGroups(advice.results, tasks, plants, now), [advice.results, tasks, plants, now]);
  const previousGroups = settled.current?.scope === scope ? settled.current.groups : cacheKey ? completedSummaries.get(scope) : undefined;
  const groups = pending && previousGroups ? previousGroups : latestGroups;
  const initialLoading = pending && !previousGroups;
  React.useEffect(() => {
    if (pending || failed) return;
    settled.current = { scope, groups: latestGroups };
    if (cacheKey) {
      completedSummaries.delete(scope); completedSummaries.set(scope, latestGroups);
      if (completedSummaries.size > 24) completedSummaries.delete(completedSummaries.keys().next().value!);
    }
  }, [scope, latestGroups, pending, failed, cacheKey]);
  const count = groups.length;
  const title = initialLoading ? 'Checking your garden…' : failed ? 'Care needs a refresh' : count ? `${count} ${count === 1 ? 'thing needs' : 'things need'} checking` : 'No checks due right now';
  const subtitle = initialLoading ? 'Gathering care advice for your plants' : failed ? 'Some care advice is unavailable' : count ? groups.map(group => group.title).join(' · ') : 'Keep an eye on your plants as conditions change';
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: colorAlpha(t.border, 0.48), borderWidth: 0.75 }]}>
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
      {!initialLoading && groups.map(group => <View key={group.key} style={s.group}>
        <Text accessibilityRole="header" style={{ color: group.priority === 0 ? t.danger : t.accent, fontWeight: '600', fontSize: 15 }}>{group.title}</Text>
        {group.plants.map(plant => <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={`Open care for ${plant.name}: ${group.title}`} onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } })} style={[s.plant, { backgroundColor: t.elevated }]}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{plant.name}</Text><Text style={[s.subtitle, { color: t.muted }]}>{plant.detail}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={19} color={t.accent} />
        </Pressable>)}
      </View>)}
      {!initialLoading && !count && <Text style={[s.subtitle, { color: t.muted }]}>{failed ? 'Refresh to check the latest advice.' : 'Your current care suggestions and routine reminders will appear here when a check is due.'}</Text>}
      {failed && <Pressable accessibilityRole="button" onPress={() => { onRetry(); advice.refresh(); }} style={s.retry}><Text style={{ color: t.accent, fontWeight: '600' }}>Retry care advice</Text></Pressable>}
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
