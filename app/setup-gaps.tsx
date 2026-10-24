import { useSession } from '@/services/session';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { relevantCareGaps } from '@/features/plants/plantCare';
export default function SetupGaps() {
  const { user, loading: accountLoading } = useSession();
  const router = useRouter(); const { plants, loading, error, refresh } = usePlantList();
  const missing = plants.filter(plant => plant.status === 'active').map(plant => ({ plant, gaps: relevantCareGaps(plant) })).filter(item => item.gaps.length);
  return <ScrollView style={{ flex: 1, backgroundColor: '#15231c' }} contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44 }}><Text style={{ color: '#d2e4a2' }}>← Back</Text></Pressable>
    <Text style={{ color: '#edf0e3', fontSize: 26 }}>Complete your garden setup</Text>
    {(loading || accountLoading) && <Text style={{ color: '#bdcbb7' }}>Checking plant details…</Text>}
    {!!error && <Pressable accessibilityRole="button" onPress={refresh}><Text style={{ color: '#ffce9b' }}>{error} · Retry</Text></Pressable>}
    {!loading && !accountLoading && !!user && !!plants.length && !error && !missing.length && <Text style={{ color: '#bdcbb7' }}>All active plants have their important setup details.</Text>}
    {!accountLoading && !user && <Text style={{ color: '#bdcbb7' }}>Sign in to check your garden’s setup details.</Text>}
    {!loading && !accountLoading && !!user && !plants.length && !error && <Text style={{ color: '#bdcbb7' }}>Add your first plant to start its setup checklist.</Text>}
    {missing.map(({ plant, gaps }) => <View key={plant.id} style={{ backgroundColor: '#23342a', padding: 16, borderRadius: 14, gap: 12 }}><Text style={{ color: '#edf0e3', fontSize: 20 }}>{plant.name}</Text>{gaps.map(gap => <Pressable key={gap.label} accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id, editSection: gap.section } })} style={{ minHeight: 48, gap: 4 }}><Text style={{ color: '#d2e4a2' }}>Add {gap.label.toLowerCase()} →</Text><Text style={{ color: '#bdcbb7' }}>{gap.reason}</Text></Pressable>)}</View>)}
  </ScrollView>;
}
