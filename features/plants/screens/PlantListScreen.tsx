// features/plants/screens/PlantListScreen.tsx

import React from 'react';
import { Alert, FlatList, View, StyleSheet, TouchableOpacity } from 'react-native';
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
import { addPlantLog } from '@/lib/logs/addPlantLog';
import logger from '@/lib/logger';

interface PlantListScreenProps {
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
    plants, loading, error
  } = usePlantList();
  const plantIds = React.useMemo(() => plants.map(p => p.id), [plants]);
  const {
    wateredMap,
    markWatered,
  } = usePlantsWateredToday(plantIds);
  const [waterLoadingMap, setWaterLoadingMap] = React.useState<Record<string, boolean>>({});
  const [snack, setSnack] = React.useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const showSnack = React.useCallback((message: string) => setSnack({ visible: true, message }), []);

  const handleQuickWater = React.useCallback(async (plantId: string) => {
    if (!plantId) return;
    let skip = false;
    setWaterLoadingMap(prev => {
      if (prev[plantId]) {
        skip = true;
        return prev;
      }
      return { ...prev, [plantId]: true };
    });
    if (skip) return;
    try {
      await addPlantLog(plantId, { type: 'watering', description: 'Quick water', updatedBy: 'demoUser' });
      markWatered(plantId);
      showSnack('Watered today');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to log watering';
      if (message.includes('already logged')) {
        markWatered(plantId);
        showSnack('Already watered today');
      } else {
        Alert.alert('Watering failed', message);
      }
      logger.error('Failed to quick water plant', { plantId, err });
    } finally {
      setWaterLoadingMap(prev => {
        const next = { ...prev };
        delete next[plantId];
        return next;
      });
    }
  }, [markWatered, showSnack]);

  // Function to navigate to add plant with current tab index
  const navigateToAddPlant = () => {
    router.push({
      pathname: '/add-plant',
      params: { tabIndex: currentTabIndex || 1 }
    });
  };

  // Filter plants using props
  const filteredPlants = plants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (!statusFilter || p.status === statusFilter) &&
      (!envFilter || p.environment === envFilter) &&
      (!plantedFilter || p.plantedIn === plantedFilter) &&
      (!trainingFilter || (p.trainingTags && p.trainingTags.includes(trainingFilter)))
  );

  // Prevent rendering of FlatList items until animation is ready
  return (
    <View style={[styles.safeArea, { backgroundColor: 'transparent', flex: 1 }]}> 
      <View style={[styles.container, { paddingTop: 0, backgroundColor: 'transparent', flex: 1 }]}> 
        {loading && <ActivityIndicator style={styles.loading} color={Colors[theme].tint} />}
        {error && <ThemedText style={[styles.errorText, { color: Colors[theme].tint }]}>❌ Error: {error}</ThemedText>}
        {!loading && !error && filteredPlants.length > 0 && (
          <FlatList
            testID="home-plants-list"
            data={filteredPlants}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <>
                <PlantCard
                  plant={item}
                  onAddLog={() => handleQuickWater(item.id)}
                  wateredToday={!!wateredMap[item.id]}
                  waterLoading={!!waterLoadingMap[item.id]}
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
        {!loading && !error && filteredPlants.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 32 }}>
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
      </View>
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, message: '' })}
        duration={2000}
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
