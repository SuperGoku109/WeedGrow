/**
 * Screen component for viewing and managing a specific plant group
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import GroupDetailHeader from '@/features/groups/components/GroupDetailHeader';
import GroupPlantList from '@/features/groups/components/GroupPlantList';
import GroupScreenLayout from '@/features/groups/components/GroupScreenLayout';
import { useGroupDetail } from '@/features/groups/hooks/useGroupDetail';
import { useGroupWeather } from '@/features/groups/hooks/useGroupWeather';
import { View, StyleSheet, TouchableOpacity, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDeleteModal from '@/features/groups/components/ConfirmDeleteModal';
import { updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { Snackbar, Searchbar } from 'react-native-paper';
import { addPlantLog } from '@/lib/logs/addPlantLog';
import logger from '@/lib/logger';
import { usePlantsWateredToday } from '@/features/plants/hooks/usePlantsWateredToday';
import { groupEditValues } from '../groupCollection';

// Web-only style helper for backdrop blur without using `any`
const webBackdropStyle: ViewStyle = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(10px)' } as unknown as ViewStyle)
  : ({} as ViewStyle);

// Header section extracted for clarity (no UI/behavior changes)
const HeaderSection = memo(function HeaderSection({
  name,
  environment,
  weather,
  totalPlants,
  avgAgeDays,
  needsWaterCount,
  onMoreOptions,
  query,
  onChangeQuery,
}: {
  name: string;
  environment: string;
  weather?: { temperature: number; rain: number; humidity: number };
  totalPlants: number;
  avgAgeDays?: number;
  needsWaterCount?: number;
  onMoreOptions: (action: 'edit' | 'delete') => void;
  query: string;
  onChangeQuery: (q: string) => void;
}) {
  return (
    <View style={styles.headerWrapper}>
      <GroupDetailHeader
        name={name}
        environment={environment}
        weather={weather}
        totalPlants={totalPlants}
        onMoreOptions={onMoreOptions}
        avgAgeDays={avgAgeDays}
        needsWaterCount={needsWaterCount}
      />
      <View style={styles.controlsRow}>
        <Searchbar
          placeholder="Search plants"
          value={query}
          onChangeText={onChangeQuery}
          style={styles.searchBar}
          inputStyle={{ color: '#fff', textAlignVertical: 'center' }}
        />
      </View>
    </View>
  );
});

// Floating "Add Plant" button extracted (no UI/behavior changes)
const FloatingAddPlantButton = memo(function FloatingAddPlantButton({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={[styles.fabContainer, { bottom }]}> 
      <LinearGradient
        colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.06)"]}
        style={[styles.fab, webBackdropStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.fabInner} accessibilityLabel="Add Plant" onPress={onPress}>
          <MaterialCommunityIcons name="plus" size={26} color="#243420" />
          <ThemedText style={styles.fabText}>Add Plant</ThemedText>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
});

/**
 * Group detail screen showing group information and plants
 */
const GroupDetailScreen = memo(function GroupDetailScreen() {
  // Params & nav
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Data
  const {
    group,
    deleting,
    deleteError,
    plants,
    loading,
    editVisible,
    setEditVisible,
    handleDeleteGroup,
    refreshGroup,
    confirmDeleteVisible,
    cancelDeleteGroup,
    confirmDeleteGroup,
    avgAgeDays,
    needsWaterCount,
  } = useGroupDetail(id);

  // Determine which location to use for weather: selected plant > group location
  const weatherLatLng = useMemo(() => {
    const sourceId = group?.weatherSourcePlantId;
    if (sourceId) {
      const p = plants.find(pl => pl.id === sourceId);
      if (p?.location) return { lat: p.location.lat, lng: p.location.lng };
    }
    if (group?.location) return { lat: group.location.lat, lng: group.location.lng };
    return undefined;
  }, [group?.weatherSourcePlantId, group?.location, plants]);

  const { weather } = useGroupWeather(weatherLatLng?.lat, weatherLatLng?.lng);

  const plantIds = useMemo(() => plants.map(p => p.id), [plants]);
  const { wateredMap, markWatered } = usePlantsWateredToday(plantIds);
  const [waterLoadingMap, setWaterLoadingMap] = useState<Record<string, boolean>>({});

  // Search state (filtering only)
  const [query, setQuery] = useState('');
  const filteredPlants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plants;
    return plants.filter((p) => p.name?.toLowerCase?.().includes(q) || p.strain?.toLowerCase?.().includes(q));
  }, [plants, query]);

  // Handlers
  const handleEditClose = useCallback(() => setEditVisible(false), [setEditVisible]);
  const handleEditSave = useCallback(async (updated: GroupWithId) => {
    try {
      await updateGroup(updated.id, groupEditValues(updated));
      setEditVisible(false);
      refreshGroup();
    } catch (e) {
      logger.error('Failed to update group', e);
      throw new Error('Failed to save group changes. Please try again.');
    }
  }, [refreshGroup, setEditVisible]);

  const handleAddPlant = useCallback(() => {
    if (!id) return;
    router.push({ pathname: '/add-group', params: { groupId: String(id) } });
  }, [router, id]);

  const [snack, setSnack] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const showSnack = useCallback((message: string) => setSnack({ visible: true, message }), []);

  const handleRemovePlant = useCallback(async (plantId: string) => {
    if (!group) return;
    try {
      const next = (group.plantIds || []).filter((pid) => pid !== plantId);
      await updateGroup(group.id, { plantIds: next });
      showSnack('Removed from group');
      refreshGroup();
    } catch (e) {
      logger.error('Failed to remove plant from group', e);
      showSnack('Failed to remove');
    }
  }, [group, refreshGroup, showSnack]);

  const handleQuickWater = useCallback(async (plantId: string) => {
    if (!plantId) return;
    if (wateredMap[plantId]) {
      showSnack('Already watered today');
      return;
    }
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
      await addPlantLog(plantId, { type: 'watering', updatedBy: 'system' });
      markWatered(plantId);
      showSnack('Watered');
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Failed to log';
      if (message.toLowerCase().includes('already')) {
        markWatered(plantId);
        showSnack('Already watered today');
      } else {
        showSnack(message);
      }
    } finally {
      setWaterLoadingMap(prev => {
        const next = { ...prev };
        delete next[plantId];
        return next;
      });
    }
  }, [markWatered, showSnack, wateredMap]);

  // Layout values
  const listBottomInset = useMemo(() => 72 + insets.bottom, [insets.bottom]);

  // Header (memoized to avoid re-renders)
  const header = useMemo(() => (
    <HeaderSection
      name={group?.name || ''}
      environment={group?.environment || 'indoor'}
      weather={weather ? { temperature: weather.temperature, rain: weather.rain, humidity: weather.humidity } : undefined}
      totalPlants={plants.length}
      onMoreOptions={(action) => {
        if (action === 'edit') setEditVisible(true);
        if (action === 'delete') handleDeleteGroup();
      }}
      avgAgeDays={avgAgeDays ?? undefined}
      needsWaterCount={needsWaterCount ?? undefined}
      query={query}
      onChangeQuery={setQuery}
    />
  ), [group?.name, group?.environment, weather, plants.length, setEditVisible, handleDeleteGroup, avgAgeDays, needsWaterCount, query]);

  return (
    <GroupScreenLayout loading={loading} groupExists={!!group} scrollable={false}>
      {group && (
        <View style={{ flex: 1 }}>
          <GroupPlantList
            plants={filteredPlants}
            searchActive={!!query.trim()}
            onClearSearch={() => setQuery('')}
            groupId={id ? String(id) : undefined}
            header={header}
            stickyHeader={false}
            showFooterAddButton={false}
            bottomInset={listBottomInset}
            onAddPlant={handleAddPlant}
            refreshing={loading}
            onRefresh={refreshGroup}
            onRemovePlant={handleRemovePlant}
            onQuickWater={handleQuickWater}
            wateredMap={wateredMap}
            waterLoadingMap={waterLoadingMap}
          />

          <FloatingAddPlantButton bottom={24 + insets.bottom} onPress={handleAddPlant} />

          <EditGroupModal
            visible={editVisible}
            group={group}
            allPlants={plants}
            onClose={handleEditClose}
            onSave={handleEditSave}
          />

          <ConfirmDeleteModal
            loading={deleting}
            error={deleteError}
            visible={confirmDeleteVisible}
            onCancel={cancelDeleteGroup}
            onConfirm={confirmDeleteGroup}
            title="Delete Group"
            subtitle="This will remove the group but keep your plants safe."
          />

          <Snackbar
            visible={snack.visible}
            onDismiss={() => setSnack({ visible: false, message: '' })}
            duration={2000}
            style={{ marginBottom: 16 + insets.bottom }}
          >
            {snack.message}
          </Snackbar>
        </View>
      )}
    </GroupScreenLayout>
  );
});

export default GroupDetailScreen;

const styles = StyleSheet.create({
  headerWrapper: {
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBar: {
    flex: 1,
    marginRight: 8,
    height: 50,
    minHeight: 50,
    paddingVertical: 0,
    backgroundColor: '#23342a',
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 10,
  },
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabInner: {
    backgroundColor: '#c8e78b',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    color: '#243420',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 6,
    letterSpacing: 0.3,
  },
});
