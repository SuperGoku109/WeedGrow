import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { useSession } from '@/services/session';
import { useCareTasks } from '@/features/care/useCareTasks';
import { CareTipRows, carePlantNames } from '@/features/care/CareTipRows';
import { useCareTipHistory } from '@/features/care/useCareTipHistory';
import { gardenCareGroups, pendingCareGroups } from '@/features/home/gardenCare';
import { plantsInGarden } from '@/features/home/gardenSelection';
import { useGardenCareSuggestions } from '@/features/home/hooks/useGardenCareSuggestions';
import { careTipRecords } from '@/lib/care/careTipHistory';
import { colorAlpha } from '@/design-system/tokens/garden';

const HISTORY_PAGE_SIZE = 6;

export default function CareTipsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user, loading: accountLoading } = useSession();
  const { gardenId } = useLocalSearchParams<{ gardenId?: string }>();
  const gardens = useOwnedGroups();
  const garden = gardens.groups.find(item => item.id === gardenId);
  const care = useCareTasks(!!user);
  const plants = React.useMemo(() => gardenId && !garden ? [] : plantsInGarden(care.plants, garden ?? null), [care.plants, garden, gardenId]);
  const advice = useGardenCareSuggestions(plants, care.now);
  const loading = accountLoading || care.loading || advice.loading || (!!gardenId && gardens.loading);
  const error = care.error || (gardenId && gardens.error) || (gardenId && !gardens.loading && !garden ? 'This garden is unavailable.' : '')
    || (advice.error ? 'Some care tips could not be loaded.' : '');
  const [historyLimit, setHistoryLimit] = React.useState(HISTORY_PAGE_SIZE);
  const groups = React.useMemo(() => gardenCareGroups(advice.results, care.tasks, plants, care.now, true), [advice.results, care.tasks, plants, care.now]);
  const pending = React.useMemo(() => pendingCareGroups(groups, plants), [groups, plants]);
  const history = useCareTipHistory(user?.uid, groups, plants, !loading && !error);
  const historyRows = React.useMemo(() => {
    const active = new Set(groups.flatMap(group => (group.tips ?? []).map(({ plantId, tip }) => JSON.stringify([plantId, tip.key]))));
    const rows = new Map<string, { title: string; plants: Map<string, { name: string }>; time: number; completed: boolean; detail: string }>();
    for (const plant of plants) for (const tip of careTipRecords(plant)) {
      const completed = tip.handledAt !== undefined;
      if (!completed && (loading || error || active.has(JSON.stringify([plant.id, tip.key])))) continue;
      const key = JSON.stringify([tip.day, tip.title, tip.kind, completed]);
      const time = tip.handledAt ?? tip.seenAt;
      const row = rows.get(key) ?? { title: tip.title, plants: new Map(), time, completed, detail: tip.detail };
      if (row.detail !== tip.detail) row.detail = '';
      row.plants.set(plant.id, { name: plant.name });
      row.time = Math.max(row.time, time);
      rows.set(key, row);
    }
    return [...rows.entries()].sort(([, a], [, b]) => b.time - a.time);
  }, [groups, plants, loading, error]);
  const completed = historyRows.filter(([, row]) => row.completed).length;
  const ready = !!user && !loading && !error;
  const summary = [
    { label: 'To do', value: pending.length },
    { label: 'Completed', value: completed },
    { label: 'Ended', value: historyRows.length - completed },
  ];
  const retry = () => { care.refresh(); advice.refresh(); history.refresh(); if (gardenId) gardens.refresh(); };

  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
    <ScrollView contentContainerStyle={s.page}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to garden"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={({ pressed }) => [s.link, pressed && s.pressed]}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={t.accent} accessible={false} /><Text style={{ color: t.accent, fontWeight: '600' }}>Garden</Text>
      </Pressable>
      <View style={[s.overview, { backgroundColor: t.hero }]}>
        <View style={s.overviewHeader}>
          <View style={s.overviewTitle}>
            <Text accessibilityRole="header" style={[s.heading, { color: t.heroText }]}>Garden care</Text>
            <Text style={{ color: t.heroText, fontSize: 14 }}>{garden?.name ?? (gardenId ? 'Selected garden' : 'All plants')}</Text>
          </View>
          <View style={[s.overviewIcon, { backgroundColor: colorAlpha(t.heroText, .1) }]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons name="sprout-outline" size={29} color={t.heroText} />
          </View>
        </View>
        {!!user && <View style={[s.summary, { borderTopColor: colorAlpha(t.heroText, .24) }]}>
          {summary.map(({ label, value }) => <View key={label} style={s.metric} accessible
            accessibilityLabel={ready ? `${label}, ${value}` : `${label} count unavailable`}>
            <Text style={[s.metricValue, { color: t.heroText }]}>{ready ? value : '—'}</Text>
            <Text style={[s.metricLabel, { color: t.heroText }]}>{label}</Text>
          </View>)}
        </View>}
      </View>
      {!user && !accountLoading && <Pressable accessibilityRole="button" style={s.link} onPress={() => router.push('/account')}><Text style={{ color: t.accent }}>Sign in to view garden care</Text></Pressable>}
      {!!(error || history.error) && <View>
        <Text accessibilityRole="alert" style={{ color: t.danger }}>{error || history.error}</Text>
        <Pressable accessibilityRole="button" style={s.link} onPress={retry}><Text style={{ color: t.accent }}>Retry care</Text></Pressable>
      </View>}
      {(!!user || loading) && <View style={s.section}>
        <Text accessibilityRole="header" style={[s.sectionTitle, { color: t.text }]}>Needs attention</Text>
        {loading && <Text accessibilityLiveRegion="polite" style={[s.body, { color: t.muted }]}>Checking garden care…</Text>}
        <CareTipRows groups={pending} complete={history.complete} />
        {ready && !pending.length && <View style={s.empty}>
          <MaterialCommunityIcons name="check-circle-outline" size={23} color={t.accent} accessible={false} />
          <Text style={[s.body, { color: t.text }]}>You’re caught up.</Text>
        </View>}
        {!!user && <Pressable accessibilityRole="button" accessibilityLabel="Routine checklist"
          style={({ pressed }) => [s.routine, { backgroundColor: t.elevated }, pressed && s.pressed]}
          onPress={() => router.push({ pathname: '/care', params: gardenId ? { gardenId } : {} })}>
          <MaterialCommunityIcons name="calendar-check-outline" size={20} color={t.accent} accessible={false} />
          <Text style={[s.routineLabel, { color: t.text }]}>Routine checklist</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={t.muted} accessible={false} />
        </Pressable>}
      </View>}
      {!!user && <View style={s.section}>
        <Text accessibilityRole="header" style={[s.sectionTitle, { color: t.text }]}>Care history</Text>
        {historyRows.slice(0, historyLimit).map(([key, row]) => {
          const statusColor = row.completed ? t.accent : t.muted;
          return <View key={key} style={[s.historyRow, { borderBottomColor: colorAlpha(t.border, .4) }]}>
            <View style={[s.historyIcon, { backgroundColor: colorAlpha(statusColor, .13) }]}>
              <MaterialCommunityIcons name={row.completed ? 'check' : 'clock-outline'} size={18} color={statusColor} accessible={false} />
            </View>
            <View style={s.historyCopy}>
              <View style={s.historyHeading}>
                <Text style={[s.historyTitle, { color: t.text }]}>{row.title}</Text>
                <Text style={[s.status, { color: statusColor }]}>{row.completed ? 'Completed' : 'Ended without completion'}</Text>
              </View>
              <Text style={{ color: t.muted, fontSize: 13 }}>{carePlantNames([...row.plants.values()])} · {new Date(row.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              {!!row.detail && <Text style={[s.body, { color: t.text }]}>{row.detail}</Text>}
            </View>
          </View>;
        })}
        {ready && !historyRows.length && <Text style={[s.body, { color: t.muted }]}>Completed tips and tips that end before completion will appear here.</Text>}
        {historyRows.length > historyLimit && <Pressable accessibilityRole="button" style={({ pressed }) => [s.link, pressed && s.pressed]}
          onPress={() => setHistoryLimit(value => value + HISTORY_PAGE_SIZE)}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Show older care</Text>
        </Pressable>}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 32, gap: 20 },
  overview: { padding: 16, borderRadius: 16, gap: 16 },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overviewTitle: { flex: 1, minWidth: 0, gap: 3 },
  heading: { fontSize: 32, lineHeight: 36, letterSpacing: -.7, fontFamily: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }) },
  overviewIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  metric: { flex: 1, minWidth: 72, gap: 2 },
  metricValue: { fontWeight: '700', fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 13, lineHeight: 18 },
  link: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
  pressed: { opacity: .68 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 21, fontWeight: '700', lineHeight: 26, letterSpacing: -.3 },
  body: { fontSize: 14, lineHeight: 21 },
  empty: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 },
  routine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  routineLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  historyRow: { flexDirection: 'row', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  historyIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0, gap: 4 },
  historyHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  historyTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  status: { fontSize: 12, fontWeight: '600' },
});
