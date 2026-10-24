// features/plants/screens/PlantListScreen.tsx

import React from 'react';
import { Alert, FlatList, ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/ui/ThemedText';
import { ActivityIndicator, Snackbar } from 'react-native-paper';
import { PlantCard } from '@/features/plants/components/PlantCard';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { usePlantsWateredToday } from '@/features/plants/hooks/usePlantsWateredToday';
import { deleteJournalEntry } from '@/lib/logs/journalRepository';
import { addPlantLog } from '@/lib/logs/addPlantLog';
import logger from '@/lib/logger';

interface PlantListScreenProps {
  enabled?: boolean;
  header?: React.ReactElement;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filtersVisible: boolean;
  setFiltersVisible: (v: boolean) => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  envFilter: string | null;
  setEnvFilter: (v: string | null) => void;
  plantedFilter: string | null;
  setPlantedFilter: (v: string | null) => void;  trainingFilter: string | null;
  setTrainingFilter: (v: string | null) => void;
  // Optional tab index for navigation
  currentTabIndex?: number;
}

export default function PlantListScreen({
  header, enabled = true,
  searchQuery,
  setSearchQuery,
  filtersVisible,
  setFiltersVisible,
  statusFilter,
  setStatusFilter,
  envFilter,
  setEnvFilter,
  plantedFilter,
  setPlantedFilter,
  trainingFilter,
  setTrainingFilter,
  currentTabIndex,
}: PlantListScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = (useColorScheme() ?? 'dark') as keyof typeof Colors;
  const {
    plants, loading, error, refresh
  } = usePlantList();
  const plantIds = React.useMemo(() => plants.map(p => p.id), [plants]);
  const {
    wateredMap, loading: careLoading, error: careError,
    refresh: refreshWatered,
  } = usePlantsWateredToday(plantIds, plants, enabled);
  const [undo, setUndo] = React.useState<{ plantId: string; id: string; mutationId: string } | null>(null);
  const waterLocks = React.useRef(new Set<string>());
  const [waterLoadingMap, setWaterLoadingMap] = React.useState<Record<string, boolean>>({});
  const [snack, setSnack] = React.useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const showSnack = React.useCallback((message: string) => setSnack({ visible: true, message }), []);

  const handleQuickWater = React.useCallback(async (plantId: string) => {
    if (!plantId) return;
    if (waterLocks.current.has(plantId)) return;
    waterLocks.current.add(plantId);
    setWaterLoadingMap(previous => ({ ...previous, [plantId]: true }));
    try {
      const saved = await addPlantLog(plantId, { type: 'watering', description: 'Quick water', updatedBy: '' });
      setUndo({ plantId, ...saved });
      showSnack('Watered today');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to log watering';
      if (message.includes('already logged')) {
          showSnack('Already watered today');
      } else {
        Alert.alert('Watering failed', message);
      }
      logger.error('Failed to quick water plant', { plantId, err });
    } finally {
      waterLocks.current.delete(plantId);
      setWaterLoadingMap(prev => {
        const next = { ...prev };
        delete next[plantId];
        return next;
      });
    }
  }, [showSnack]);

  // Function to navigate to add plant with current tab index
  const navigateToAddPlant = () => {
    router.push({
      pathname: '/add-plant',
      params: { tabIndex: currentTabIndex || 1 }
    });
  };

  // Filter plants using props
  const filteredPlants = React.useMemo(() => plants.filter(
    (p) =>
      `${p.name} ${p.strain || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (!statusFilter || p.status === statusFilter) &&
      (!envFilter || p.environment === envFilter) &&
      (!plantedFilter || p.plantedIn === plantedFilter) &&
      (!trainingFilter || (p.trainingTags && p.trainingTags.includes(trainingFilter)))
  ), [plants, searchQuery, statusFilter, envFilter, plantedFilter, trainingFilter]);

  // Prevent rendering of FlatList items until animation is ready
  return (
    <View style={[styles.safeArea, { backgroundColor: 'transparent', flex: 1 }]}> 
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>{['active', 'archived', 'harvested', 'dead', 'all'].map(status => <TouchableOpacity key={status} accessibilityRole="button" accessibilityState={{ selected: (statusFilter || 'all') === status }} onPress={() => setStatusFilter(status === 'all' ? null : status)} style={{ padding: 12 }}><ThemedText style={{ color: (statusFilter || 'all') === status ? '#c8e78b' : '#a9bba1' }}>{status}</ThemedText></TouchableOpacity>)}</View>
      <View style={[styles.container, { paddingTop: 0, backgroundColor: 'transparent', flex: 1 }]}> 
        {careLoading && !loading && <ThemedText>Checking watering history…</ThemedText>}
        {!!careError && <TouchableOpacity accessibilityRole="button" onPress={refreshWatered}><ThemedText>{careError} · Retry</ThemedText></TouchableOpacity>}
        {loading && !plants.length && <ActivityIndicator style={styles.loading} color={Colors[theme].tint} />}
        {!!error && <TouchableOpacity accessibilityRole="button" onPress={refresh}><ThemedText style={[styles.errorText, { color: Colors[theme].tint }]}>Error: {error} Tap to retry.</ThemedText></TouchableOpacity>}
        {(!loading || plants.length > 0) && (!error || plants.length > 0) && filteredPlants.length > 0 && (
          <FlatList
            testID="home-plants-list"
            ListHeaderComponent={header}
            data={filteredPlants}
            refreshing={loading}
            onRefresh={refresh}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <>
                <PlantCard
                  plant={item}
                  onAddLog={() => handleQuickWater(item.id)}
                  wateredToday={!!wateredMap[item.id]}
                  waterLoading={!!waterLoadingMap[item.id]}
                  waterDisabled={careLoading || !!careError}
                />
                {index === filteredPlants.length - 1 && (
                  <View style={{ alignItems: 'center', marginTop: 16 }}>
                    <TouchableOpacity
                      accessibilityLabel="Add Plant"
                      onPress={navigateToAddPlant}
                      style={styles.addPlantButton}
                    >
                      <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 4 }} />
                      <ThemedText style={styles.addPlantText}>Add Plant</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          />
        )}
        {(!loading || plants.length > 0) && (!error || plants.length > 0) && filteredPlants.length === 0 && (
          <ScrollView>{header}<View style={{ alignItems: 'center', marginTop: 32 }}><ThemedText style={{ marginBottom: 28 }}>{plants.length ? 'No plants match these filters.' : 'Your garden is ready for its first plant.'}</ThemedText>
            <TouchableOpacity
              accessibilityLabel="Add Plant"
              onPress={navigateToAddPlant}
              style={styles.addPlantButton}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 4 }} />
              <ThemedText style={styles.addPlantText}>Add Plant</ThemedText>
            </TouchableOpacity>
          </View></ScrollView>
        )}
      </View>
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, message: '' })}
        duration={7000}
        action={undo ? { label: 'Undo', onPress: async () => { try { await deleteJournalEntry(undo.plantId, undo.id, undo.mutationId); setUndo(null); await refreshWatered(); showSnack('Watering undone'); } catch (err) { showSnack(err instanceof Error ? err.message : 'Could not undo watering'); setUndo(null); } } } : undefined}
        style={{ marginBottom: insets.bottom + 8 }}
      >
        {snack.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 16, paddingTop: 0 },
  loading: { marginTop: 20 },
  errorText: { marginTop: 10 },
  addPlantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    marginTop: -20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)', // Glassy white
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 6,
  },
  addPlantText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
});
