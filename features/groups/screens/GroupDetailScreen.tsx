import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { MAX_ATOMIC_WATERING_PLANTS } from '../groupPolicy';
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
import { View, Text, StyleSheet, TouchableOpacity, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDeleteModal from '@/features/groups/components/ConfirmDeleteModal';
import ActionDialog from '@/ui/ActionDialog';
import { GrowPress } from '@/ui/GrowMotion';
import { waterGrowingSpace } from '@/lib/logs/groupWatering';
import { deleteJournalEntry } from '@/lib/logs/journalRepository';
import { updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { Snackbar, Searchbar } from 'react-native-paper';
import QuickWateringDialog from '@/features/plants/components/QuickWateringDialog';
import MovePlantDialog from '../components/MovePlantDialog';
import { useOwnedGroups } from '@/hooks/useGardenData';
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
  wateredTodayCount,
  onMoreOptions,
  query,
  onChangeQuery,
}: {
  name: string;
  environment: string;
  weather?: { temperature: number; rain: number; humidity: number };
  totalPlants: number;
  avgAgeDays?: number;
  wateredTodayCount?: number;
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
        wateredTodayCount={wateredTodayCount}
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
    error,
    editVisible,
    setEditVisible,
    handleDeleteGroup,
    refreshGroup,
    confirmDeleteVisible,
    cancelDeleteGroup,
    confirmDeleteGroup,
    avgAgeDays,
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
  const garden = usePlantList();
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [undo, setUndo] = useState<{ plantId: string; id: string; mutationId: string } | null>(null);
  const { wateredMap, loading: careLoading, error: careError, refresh: refreshWatered } = usePlantsWateredToday(plantIds, plants);
  const wateredTodayCount = careLoading || careError ? undefined : Object.values(wateredMap).filter(Boolean).length;
  const [waterPlant, setWaterPlant] = useState<(typeof plants)[number] | null>(null);
  const [movingPlant, setMovingPlant] = useState<(typeof plants)[number] | null>(null);
  const spaces = useOwnedGroups();

  // Search state (filtering only)
  const [query, setQuery] = useState('');
  const filteredPlants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plants;
    return plants.filter((p) => p.name?.toLowerCase?.().includes(q) || p.strain?.toLowerCase?.().includes(q));
  }, [plants, query]);

  // Handlers
  const handleEditClose = useCallback(() => setEditVisible(false), [setEditVisible]);
  const handleEditSave = useCallback(async (updated: GroupWithId, baseline: GroupWithId) => {
    try {
      await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>);
      setEditVisible(false);
    } catch (e) {
      logger.error('Failed to update group', e);
      throw e instanceof Error ? e : new Error('Failed to save garden changes. Please try again.');
    }
  }, [setEditVisible]);

  const handleAddPlant = useCallback(() => {
    if (!id) return;
    router.push({ pathname: '/add-plant', params: { gardenId: String(id) } });
  }, [router, id]);

  const [snack, setSnack] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const showSnack = useCallback((message: string) => setSnack({ visible: true, message }), []);

  const handleRemovePlant = useCallback(async (plantId: string) => {
    if (!group) return;
    try {
      const next = (group.plantIds || []).filter((pid) => pid !== plantId);
      await updateGroup(group.id, { plantIds: next });
      showSnack('Removed from garden');
    } catch (e) {
      logger.error('Failed to remove plant from garden', e);
      showSnack('Failed to remove');
    }
  }, [group, showSnack]);

  const handleQuickWater = useCallback((plantId: string) => {
    if (careLoading || careError) { showSnack(careError || 'Wait for watering history to load.'); return; }
    if (wateredMap[plantId]) { showSnack('Watering already recorded today.'); return; }
    const plant = plants.find(item => item.id === plantId);
    if (plant?.status === 'active') setWaterPlant(plant);
  }, [careLoading, careError, wateredMap, plants, showSnack]);

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
      wateredTodayCount={wateredTodayCount ?? undefined}
      query={query}
      onChangeQuery={setQuery}
    />
  ), [group?.name, group?.environment, weather, plants.length, setEditVisible, handleDeleteGroup, avgAgeDays, wateredTodayCount, query]);

  return (
    <GroupScreenLayout error={error} onRetry={refreshGroup} loading={loading} groupExists={!!group} scrollable={false}>
      {group && (
        <View style={{ flex: 1 }}>
          {careLoading && <Text accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, paddingTop: 12, color: '#c8e78b' }}>Loading watering history…</Text>}
          {!!careError && <GrowPress accessibilityRole="button" onPress={refreshWatered} style={{ padding: 16 }}><Text style={{ color: '#c8e78b' }}>Could not load watering history. Tap to retry.</Text></GrowPress>}
          <GrowPress accessibilityRole="button" onPress={() => setBulkConfirm(true)} style={{ padding: 16 }}><Text style={{ color: '#c8e78b' }}>Log garden watering</Text></GrowPress>
          {bulkConfirm && <ActionDialog title="Log garden watering" description={`Confirm you watered the active plants in this garden. Already-recorded plants are skipped. Gardens of up to ${MAX_ATOMIC_WATERING_PLANTS} plants are supported. Use individual watering for larger gardens.`} confirmLabel="Save garden watering" onClose={() => setBulkConfirm(false)} onConfirm={async () => { const result = await waterGrowingSpace(String(id)); await refreshWatered(); setUndo(null); showSnack(`${result.written.length} recorded · ${result.skipped} skipped`); }} />}
          <GroupPlantList
            plants={filteredPlants}
            searchActive={!!query.trim()}
            onClearSearch={() => setQuery('')}
            groupId={id ? String(id) : undefined}
            header={header}
            stickyHeader={false}
            showFooterAddButton={false}
            bottomInset={listBottomInset}
            onAddPlant={() => router.push({ pathname: '/add-group', params: { groupId: String(id) } })}
            onCreatePlant={handleAddPlant}
            onMovePlant={plantId => setMovingPlant(plants.find(item => item.id === plantId) || null)}
            refreshing={loading}
            onRefresh={refreshGroup}
            onRemovePlant={handleRemovePlant}
            onQuickWater={handleQuickWater}
            wateredMap={wateredMap}
            waterLoadingMap={{}}
            careUnavailable={careLoading || !!careError}
          />

          {waterPlant && <QuickWateringDialog plant={waterPlant} onClose={() => setWaterPlant(null)} onSaved={result => { setUndo(result); showSnack('Watering saved.'); void refreshWatered(); }} />}
          {movingPlant && <MovePlantDialog plant={movingPlant} gardens={spaces.groups} onClose={() => setMovingPlant(null)} onMoved={name => showSnack(`${movingPlant.name} moved to ${name}.`)} />}
          <GrowPress accessibilityRole="button" onPress={() => router.push({ pathname: '/add-group', params: { groupId: String(id) } })} style={{ paddingHorizontal: 18, minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#c8e78b' }}>Move existing plants here →</Text></GrowPress>
          <FloatingAddPlantButton bottom={24 + insets.bottom} onPress={handleAddPlant} />

          <EditGroupModal
            settingsOnly
            visible={editVisible}
            group={group}
            allPlants={garden.plants}
            onClose={handleEditClose}
            onSave={handleEditSave}
          />

          <ConfirmDeleteModal
            loading={deleting}
            error={deleteError}
            visible={confirmDeleteVisible}
            onCancel={cancelDeleteGroup}
            onConfirm={confirmDeleteGroup}
            title="Delete garden"
            subtitle="This will remove the garden but keep your plants safe."
          />

          <Snackbar
            visible={snack.visible}
            onDismiss={() => setSnack({ visible: false, message: '' })}
            duration={7000}
            action={undo ? { label: 'Undo', onPress: async () => { try { await deleteJournalEntry(undo.plantId, undo.id, undo.mutationId); setUndo(null); await refreshWatered(); showSnack('Watering undone'); } catch (err) { setUndo(null); showSnack(err instanceof Error ? err.message : 'Could not undo watering'); } } } : undefined}
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
