import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Snackbar, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import GrowHero from '@/features/home/components/GrowHero';
import HomeScrollbar from '@/features/home/components/HomeScrollbar';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
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
  const theme = (useColorScheme() ?? 'dark') as keyof typeof Colors;
  const initialKey = useMemo(() => (initialTabIndex === 0 ? 'groups' : 'plants'), [initialTabIndex]);
  const {
    state,
    searchQuery,
    setSearchQuery,
    filteredGroups,
    groupPlantsMap,
    snackVisible,
    setSnackVisible,
    snackMessage,
    handleEditGroup,
  } = useHomeScreenState();
  const { suggestions: wateringSuggestions, plantsNeedingWater } = useWateringSuggestions(state.allPlants);
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [plantEnvFilter, setPlantEnvFilter] = useState<string | null>(null);
  const [plantedFilter, setPlantedFilter] = useState<string | null>(null);
  const [trainingFilter, setTrainingFilter] = useState<string | null>(null);
  const [plantFiltersVisible, setPlantFiltersVisible] = useState(false);
  const suggestionItems = wateringSuggestions;
  const tlcCount = plantsNeedingWater.length;

  const handleAddGroup = useCallback(() => router.push('/add-group'), [router]);

  const renderGroupsTab = useCallback(() => (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search groups"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
          placeholderTextColor="#9aac97" iconColor="#aabd99" inputStyle={{ color: '#edf0e3', fontSize: 13, minHeight: 46 }}
        />
      </View>
      <GroupList
        groups={filteredGroups}
        groupPlantsMap={groupPlantsMap}
        loading={state.loading}
        error={state.error}
        onEditGroup={handleEditGroup}
        onAddGroup={handleAddGroup}
        theme={theme}
      />
    </View>
  ), [searchQuery, setSearchQuery, filteredGroups, groupPlantsMap, state.loading, state.error, handleEditGroup, handleAddGroup, theme]);

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
      <PlantListScreen
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
  ), [plantSearchQuery, statusFilter, plantEnvFilter, plantedFilter, trainingFilter, plantFiltersVisible]);

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
        {/* TLC needed indicator */}
        <GrowHero plants={state.allPlants.length} groups={state.groups.length} attention={tlcCount} />

        {/* Suggestion Catalog */}
        {suggestionItems.length > 0 && (
          <SuggestionCatalog suggestions={suggestionItems} />
        )}

        {/* Swipe Tabs Implementation */}
        <View style={{ marginTop: 4, marginBottom: 4, flex: 1 }}>
          <SwipeTabs tabs={tabs} initialKey={initialKey} />
        </View>
        <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}>
          {snackMessage}
        </Snackbar>
        <EditGroupModal
          visible={!!state.editGroup}
          group={state.editGroup as any}
          allPlants={state.allPlants}
          onClose={() => state.setEditGroup(null)}
          onSave={state.reloadGroups}
        />
      </SafeAreaView>
    </View>
  );
}
