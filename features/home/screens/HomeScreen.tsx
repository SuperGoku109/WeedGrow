import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useSession } from '@/services/session';
import { Snackbar, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import GardenOverview from '@/features/home/components/GardenOverview';
import GrowHero from '@/features/home/components/GrowHero';
import HomeScrollbar from '@/features/home/components/HomeScrollbar';

import { updateGroup } from '@/features/groups/api/groupApi';
import { groupEditValues } from '@/features/groups/groupCollection';
import GroupList from '@/features/home/components/GroupList';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import PlantListScreen from '@/features/plants/screens/PlantListScreen';
import { SuggestionCatalog } from '@/ui/SuggestionCatalog';
import { AppHeader } from '@/ui/AppHeader';

import HomeBackground from '@/features/home/components/HomeBackground';
import { useHomeScreenState } from '@/features/home/hooks/useHomeScreenState';
import { useWateringSuggestions } from '@/features/home/hooks/useWateringSuggestions';
import SwipeTabs from '@/ui/SwipeTabs';

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 0, paddingHorizontal: 18 },
  searchBar: {
    marginRight: 8,
    height: 46,
    minHeight: 46,
    paddingVertical: 0,
    flex: 1,
    backgroundColor: '#23332a',
    borderRadius: 15,
    borderWidth: 0,
    paddingHorizontal: 10,
  },

});


export default function HomeScreen({ initialTabIndex = 0 }: { initialTabIndex?: number }) {
  const router = useRouter();
  const { user, loading: accountLoading } = useSession();
  const initialKey = useMemo(() => (initialTabIndex === 0 ? 'groups' : 'plants'), [initialTabIndex]);
  const [activeTab, setActiveTab] = useState(initialTabIndex === 0 ? 0 : 1);
  React.useEffect(() => setActiveTab(initialTabIndex === 0 ? 0 : 1), [initialTabIndex]);
  const {
    state,
    groupPlantsMap,
    snackVisible,
    setSnackVisible,
    snackMessage,
    handleEditGroup,
  } = useHomeScreenState();
  const { suggestions: wateringSuggestions, plantsNeedingWater, loading: adviceLoading, error: adviceError, stale: adviceStale, refresh: refreshAdvice } = useWateringSuggestions(state.allPlants, activeTab === 1);
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('active');
  const [plantEnvFilter, setPlantEnvFilter] = useState<string | null>(null);
  const [plantedFilter, setPlantedFilter] = useState<string | null>(null);
  const [trainingFilter, setTrainingFilter] = useState<string | null>(null);
  const [plantFiltersVisible, setPlantFiltersVisible] = useState(false);
  const suggestionItems = wateringSuggestions;
  const tlcCount = plantsNeedingWater.length;

  const handleAddGroup = useCallback(() => router.push('/add-group'), [router]);

  const renderGroupsTab = useCallback(() => (
    <View style={{ flex: 1 }}>
      <GroupList
        groups={state.groups}
        groupPlantsMap={groupPlantsMap}
        loading={state.loading}
        error={state.error}
        onEditGroup={handleEditGroup}
        onAddGroup={handleAddGroup}
        onRefresh={state.reloadGroups}
      />
    </View>
  ), [groupPlantsMap, state.groups, state.loading, state.error, state.reloadGroups, handleEditGroup, handleAddGroup]);

  const renderPlantsTab = useCallback(() => (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search plants"
          value={plantSearchQuery}
          onChangeText={setPlantSearchQuery}
          style={styles.searchBar}
          placeholderTextColor="#9aac97" iconColor="#aabd99" inputStyle={{ color: '#edf0e3', fontSize: 13, minHeight: 46 }}
        />
      </View>
      <PlantListScreen enabled={activeTab === 1}
        header={<><GrowHero plants={state.allPlants.length} groups={state.groups.length} attention={tlcCount} /><GardenOverview enabled={activeTab === 1} />{adviceLoading && <Text style={{ color: '#bdcbb7', marginHorizontal: 20 }}>Checking current care advice…</Text>}{!!adviceError && <Text style={{ color: '#ffce9b', marginHorizontal: 20 }}>{adviceError}</Text>}{adviceStale && <Text style={{ color: '#ffce9b', marginHorizontal: 20 }}>Current conditions could not be confirmed. Refresh advice or check your plants manually.</Text>}<Pressable accessibilityRole="button" disabled={adviceLoading} onPress={refreshAdvice} style={{ minHeight: 44, justifyContent: 'center', marginHorizontal: 20 }}><Text style={{ color: '#c8e78b' }}>Refresh care advice</Text></Pressable>{suggestionItems.length > 0 && <SuggestionCatalog suggestions={suggestionItems} />}</>}
        searchQuery={plantSearchQuery}
        statusFilter={statusFilter}
        envFilter={plantEnvFilter}
        plantedFilter={plantedFilter}
        trainingFilter={trainingFilter}
        setSearchQuery={setPlantSearchQuery}
        setStatusFilter={setStatusFilter}
        setEnvFilter={setPlantEnvFilter}
        setPlantedFilter={setPlantedFilter}
        setTrainingFilter={setTrainingFilter}
        filtersVisible={plantFiltersVisible}
        setFiltersVisible={setPlantFiltersVisible}
        currentTabIndex={1}
      />
    </View>
  ), [plantSearchQuery, statusFilter, plantEnvFilter, plantedFilter, trainingFilter, plantFiltersVisible, state.allPlants.length, state.groups.length, tlcCount, suggestionItems, activeTab, adviceLoading, adviceError, adviceStale, refreshAdvice]);

  const tabs = useMemo(() => [
    { key: 'groups', title: 'Groups', render: renderGroupsTab },
    { key: 'plants', title: 'Plants', render: renderPlantsTab },
  ], [renderGroupsTab, renderPlantsTab]);

  return (
    <View style={{ flex: 1, backgroundColor: '#15231c', position: 'relative' }}>
      <HomeScrollbar />
      <HomeBackground />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent', width: '100%', maxWidth: 760, alignSelf: 'center' }} edges={['top', 'left', 'right']}>
        {/* Modern App Header */}
        <AppHeader />
        <Pressable accessibilityRole="button" onPress={() => router.push('/care')} style={{ marginHorizontal: 18, paddingVertical: 14 }}><Text style={{ color: '#c8e78b', fontWeight: '700' }}>Open daily care checklist →</Text></Pressable>
        {!user && !accountLoading && <View style={{ marginHorizontal: 18, marginBottom: 12, padding: 18, borderRadius: 16, backgroundColor: '#23342a', gap: 10 }}><Text style={{ color: '#edf0e3', fontSize: 17, fontWeight: '700' }}>Sign in to see your garden</Text><Text style={{ color: '#a9bba1', lineHeight: 21 }}>Your plants belong to your account. You can also start a new plant draft before signing in.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#c8e78b', fontWeight: '600' }}>Sign in or create an account</Text></Pressable></View>}
        {/* Swipe Tabs Implementation */}
        <View style={{ marginTop: 4, marginBottom: 4, flex: 1 }}>
          <SwipeTabs tabs={tabs} initialKey={initialKey} index={activeTab} onIndexChange={index => { setActiveTab(index); router.setParams({ tabIndex: String(index) }); }} />
        </View>
        <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}>
          {snackMessage}
        </Snackbar>
        <EditGroupModal
          visible={!!state.editGroup}
          group={state.editGroup}
          allPlants={state.allPlants}
          onClose={() => state.setEditGroup(null)}
          onSave={async (updated, baseline) => {
            await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>);
          }}
        />
      </SafeAreaView>
    </View>
  );
}
