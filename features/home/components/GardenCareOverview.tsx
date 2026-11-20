import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { Plant } from '@/firestoreModels';
import type { CareTask } from '@/lib/care/careTasks';
import { plantDay } from '@/lib/dates/plantDay';
import { gardenCareGroups, pendingCareGroups } from '../gardenCare';
import { useGardenCareSuggestions } from '../hooks/useGardenCareSuggestions';
import { CareTipRows } from '@/features/care/CareTipRows';
import { useCareTipHistory } from '@/features/care/useCareTipHistory';
import { GrowPress } from '@/ui/GrowMotion';

// Keep the last settled groups visible during a refresh in the same garden.
const completedSummaries = new Map<string, ReturnType<typeof gardenCareGroups>>();

export default function GardenCareOverview({ advice, plants, tasks, now, loading, error, onRetry, cacheKey, uid, gardenId }: {
  advice?: ReturnType<typeof useGardenCareSuggestions>;
  cacheKey?: string;
  uid?: string;
  gardenId?: string;
  plants: (Plant & { id: string })[];
  tasks: CareTask[];
  now: Date;
  loading: boolean;
  error: string | null;
  onRetry(): void;
}) {
  const t = useAppTheme();
  const router = useRouter();
  const fallbackAdvice = useGardenCareSuggestions(advice ? [] : plants, now);
  const careAdvice = advice || fallbackAdvice;
  const pending = loading || careAdvice.loading;
  const failed = !!error || careAdvice.error;
  const scope = JSON.stringify([cacheKey, plants.filter(plant => plant.status === 'active' && !plant.deleting)
    .map(plant => [plant.id, plant.name, plant.locationRevision, plantDay(now, plant.locationTimeZone)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
  const settled = React.useRef<{ scope: string; groups: ReturnType<typeof gardenCareGroups> } | null>(null);
  const latest = React.useMemo(() => gardenCareGroups(careAdvice.results, tasks, plants, now), [careAdvice.results, tasks, plants, now]);
  const previous = settled.current?.scope === scope ? settled.current.groups : cacheKey ? completedSummaries.get(scope) : undefined;
  const groups = pending && previous ? pendingCareGroups(previous, plants) : latest;
  const history = useCareTipHistory(uid, latest, plants, !pending && !failed);
  React.useEffect(() => {
    if (pending || failed) return;
    settled.current = { scope, groups: latest };
    if (cacheKey) {
      completedSummaries.delete(scope);
      completedSummaries.set(scope, latest);
      if (completedSummaries.size > 24) completedSummaries.delete(completedSummaries.keys().next().value!);
    }
  }, [scope, latest, pending, failed, cacheKey]);

  return <View style={s.section}>
    <Text accessibilityRole="header" style={[s.heading, { color: t.text }]}>Today’s care</Text>
    {!groups.length && <Text accessibilityLiveRegion="polite" style={[s.hint, { color: t.muted }]}>
      {pending && !previous ? 'Checking your garden…' : failed ? 'Some care tips could not be loaded.' : 'No care items flagged.'}
    </Text>}
    <CareTipRows featureFirst confirmQuickAction groups={groups.slice(0, 3)} complete={history.complete} />
    {!!history.error && <Text accessibilityRole="alert" style={[s.hint, { color: t.danger }]}>{history.error}</Text>}
    {(failed || !!history.error) && <Pressable accessibilityRole="button" accessibilityLabel="Retry care advice" onPress={() => { onRetry(); careAdvice.refresh(); history.refresh(); }} style={s.link}>
      <Text style={{ color: t.accent, fontWeight: '600' }}>Retry care advice</Text>
    </Pressable>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Show all care"
      onPress={() => router.push({ pathname: '/care-tips', params: gardenId ? { gardenId } : {} })}
      style={[s.allCare, { backgroundColor: t.elevated }]}>
      <MaterialCommunityIcons name="format-list-checks" size={20} color={t.accent} accessible={false} />
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>Show all care</Text>
    </GrowPress>
  </View>;
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 2, paddingTop: 8 },
  heading: { fontSize: 29, lineHeight: 34, letterSpacing: -.7, fontFamily: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }) },
  hint: { paddingTop: 9, fontSize: 14 },
  link: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingRight: 10 },
  allCare: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 24, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9 },
});
