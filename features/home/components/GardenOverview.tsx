import { plantDay } from '@/lib/dates/plantDay';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlantActivity } from '@/features/care/usePlantActivity';
import { useSession } from '@/services/session';
import { useCareTasks } from '@/features/care/useCareTasks';
import { useCareSnoozes } from '@/hooks/useCareSnoozes';
import { relevantCareGaps } from '@/features/plants/plantCare';
import { MaterialCommunityIcons } from '@expo/vector-icons';
export default function GardenOverview({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter(); const { user } = useSession();
  const [expanded, setExpanded] = React.useState(false);
  const { plants, tasks, recordedToday, now, loading, error, plantLoading, plantError } = useCareTasks(enabled); const { snoozes, error: snoozeError, loading: snoozesLoading } = useCareSnoozes(user?.uid);
  const recentActivity = usePlantActivity((enabled && expanded ? plants : []).map(plant => plant.id), ['recent']);
  const recent = React.useMemo(() => Object.fromEntries(plants.map(plant => [plant.id, recentActivity.logs[`${plant.id}:recent`] || []])), [plants, recentActivity.logs]);
  const activityError = recentActivity.error ? 'Some recent activity could not be loaded.' : '';
  const missing = plants.filter(plant => plant.status === 'active' && relevantCareGaps(plant).length);
  const overdue = tasks.filter(task => !task.completedToday && !task.skippedToday && task.due <= now && !(snoozes[task.id] > now.getTime()));
  const stats = [{ label: 'Due checks', value: loading || error || snoozesLoading || snoozeError ? '—' : overdue.length, action: () => router.push('/care') }, { label: 'Care logged today', value: loading || error ? '—' : recordedToday, action: () => router.push('/care') }, { label: 'Setup gaps', value: plantLoading || plantError ? '—' : missing.length, action: () => router.push('/setup-gaps') }];
  return <View style={{ marginVertical: 12, padding: 14, borderRadius: 18, backgroundColor: '#23342a', gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text accessibilityRole="header" style={{ color: '#edf0e3', fontSize: 18, fontWeight: '700', flexShrink: 1 }}>At a glance</Text><Pressable accessibilityRole="button" onPress={() => router.push('/care')} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: '#c8e78b', fontSize: 14, fontWeight: '600' }}>Care checklist →</Text></Pressable></View><View style={{ flexDirection: 'row', gap: 6 }}>{stats.map(stat => <Pressable key={stat.label} accessibilityRole="button" accessibilityLabel={`${stat.label}: ${stat.value}`} onPress={stat.action} style={{ flex: 1, minWidth: 0, minHeight: 80, backgroundColor: '#1b2c22', padding: 10, borderRadius: 12 }}><Text style={{ color: '#d2e4a2', fontWeight: '700', fontSize: 23 }}>{stat.value}</Text><Text style={{ color: '#bdcbb7', fontSize: 13, lineHeight: 18 }}>{stat.label === 'Care logged today' ? 'Logged today' : stat.label}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: '#bac8b3', fontSize: 14 }}>Recent activity & setup</Text><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#bac8b3" /></Pressable>
    {expanded && <>
    {!!(error || snoozeError) && <Text style={{ color: '#ffce9b', fontSize: 13 }}>Care history is incomplete. Open the checklist to retry.</Text>}
    {!!missing.length && <Text style={{ color: '#bdcbb7', fontSize: 13 }}>{missing.slice(0, 3).map(plant => plant.name).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''} could use important setup details.</Text>}
    {recentActivity.loading && <Text style={{ color: '#bdcbb7', fontSize: 13 }}>Loading recent activity…</Text>}
    {!!activityError && <Pressable accessibilityRole="button" onPress={recentActivity.refresh} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#ffce9b' }}>Retry recent activity</Text></Pressable>}
    <Text style={{ color: '#edf0e3', fontWeight: '600' }}>Recent activity</Text>{Object.entries(recent).flatMap(([id, entries]) => entries.map(log => [id, log] as const)).filter(([, log]) => !!log.timestamp?.toMillis).sort((a, b) => b[1].timestamp.toMillis() - a[1].timestamp.toMillis()).slice(0, 4).map(([id, log]) => <Pressable key={`${id}:${log.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id, returnToPlants: '1', journalDate: log.calendarDay || plantDay(log.timestamp.toDate(), log.timeZone || plants.find(plant => plant.id === id)?.locationTimeZone) } })} style={{ paddingVertical: 8, minHeight: 48 }}><Text style={{ color: '#edf0e3' }}>{plants.find(plant => plant.id === id)?.name} · {log.category || log.type}</Text><Text style={{ color: '#aabda1', fontSize: 13 }}>{log.timestamp.toDate().toLocaleString()} · {(log.description || 'Care recorded').slice(0, 100)}</Text></Pressable>)}{!!activityError && <Text style={{ color: '#ffce9b', fontSize: 13 }}>{activityError}</Text>}<Pressable accessibilityRole="button" onPress={() => router.push('/journal')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#d2e4a2' }}>Open full garden journal →</Text></Pressable>
    </>}
  </View>;
}
