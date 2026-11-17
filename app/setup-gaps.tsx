import { useAppTheme } from '@/hooks/useAppTheme';
import { useSession } from '@/services/session';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { relevantCareGaps } from '@/features/plants/plantCare';
export default function SetupGaps() {
  const t = useAppTheme();
  const { user, loading: accountLoading } = useSession();
  const router = useRouter(); const { plants, loading, error, refresh } = usePlantList();
  const missing = plants.filter(plant => plant.status === 'active').map(plant => ({ plant, gaps: relevantCareGaps(plant) })).filter(item => item.gaps.length);
  return <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44 }}><Text style={{ color: t.accent }}>← Back</Text></Pressable>
    <Text style={{ color: t.text, fontSize: 26 }}>Complete your garden setup</Text>
    {(loading || accountLoading) && <Text style={{ color: t.muted }}>Checking plant details…</Text>}
    {!!error && <Pressable accessibilityRole="button" onPress={refresh} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.danger }}>{error} · Retry</Text></Pressable>}
    {!loading && !accountLoading && !!user && !!plants.length && !error && !missing.length && <Text style={{ color: t.muted }}>All active plants have their important setup details.</Text>}
    {!accountLoading && !user && <Text style={{ color: t.muted }}>Sign in to check your garden’s setup details.</Text>}
    {!loading && !accountLoading && !!user && !plants.length && !error && <Text style={{ color: t.muted }}>Add your first plant to start its setup checklist.</Text>}
    {missing.map(({ plant, gaps }) => <View key={plant.id} style={{ backgroundColor: t.surface, padding: 16, borderRadius: 14, gap: 12 }}><Text style={{ color: t.text, fontSize: 20 }}>{plant.name}</Text>{gaps.map(gap => <Pressable key={gap.label} accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, editSection: gap.section } })} style={{ minHeight: 48, gap: 4 }}><Text style={{ color: t.accent }}>Add {gap.label.toLowerCase()} →</Text><Text style={{ color: t.muted }}>{gap.reason}</Text></Pressable>)}</View>)}
  </ScrollView>;
}
