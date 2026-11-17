import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { PlantListSkeleton } from '@/ui/LoadingFeedback';
import { FlatList, RefreshControl, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import PlantLogComposer, { logChoices, type ActivitySaveOptions, type ActivitySaveResult } from '../components/PlantLogComposer';
import { newLogId, saveJournalEntry, type LogInput } from '@/lib/logs/journalRepository';
import { buildManualPlantLog, type JournalCategory } from '@/lib/logs/plantJournal';
import { plantDay } from '@/lib/dates/plantDay';
import { careConfiguration } from '@/lib/careAlgorithm/outdoorContext';
import AppNotice from '@/ui/AppNotice';
import { gardenThemes } from '@/design-system/tokens/garden';
import { usePlantList } from '../hooks/usePlantList';
import { usePlantsWateredToday } from '../hooks/usePlantsWateredToday';
import PlantGridCard from '../components/PlantGridCard';
import PlantEditorSheet from '../components/PlantEditorSheet';
import { plantsInGarden, type HomeGarden } from '@/features/home/gardenSelection';
import { DEFAULT_PLANT_LIST_OPTIONS, plantFilterValues, selectPlantList, type PlantListOptions } from '@/lib/plants/plantListOptions';
import type { Plant } from '@/firestoreModels';
import type { PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';
import type { GardenCareGroup } from '@/features/home/gardenCare';

type ListedPlant = Plant & { id: string };
const pastOptions = [{ value: 'past', label: 'All past plants' }, { value: 'archived', label: 'Archived' }, { value: 'harvested', label: 'Harvested' }, { value: 'dead', label: 'Deceased' }];
export default function PlantListScreen({ garden, searchQuery, setSearchQuery, statusFilter, setStatusFilter, title, onAddPlant, careGroups, careResults, careAdviceLoading, careAdviceError, header, footer, initialOffset = 0, onOffsetChange, options = DEFAULT_PLANT_LIST_OPTIONS, onResetFilters }: {
  title: string; onAddPlant(): void;
  careGroups: GardenCareGroup[]; careResults: PlantSuggestionResult[]; careAdviceLoading: boolean; careAdviceError: boolean;
  garden?: HomeGarden | null; searchQuery: string; setSearchQuery(value: string): void; statusFilter: string | null; setStatusFilter(value: string | null): void;
  options?: PlantListOptions; onResetFilters?(): void; header?: React.ReactElement; footer?: React.ReactElement; initialOffset?: number; onOffsetChange(offset: number): void;
}) {
  const t = useAppTheme();
  const s = makeStyles(t);
  const [layoutWidth, setLayoutWidth] = React.useState(0);
  const router = useRouter();
  const collection = usePlantList();
  const plants = React.useMemo(() => plantsInGarden(collection.plants, garden || null), [collection.plants, garden]);
  const activePlants = React.useMemo(() => plants.filter(plant => plant.status === 'active'), [plants]);
  const ids = React.useMemo(() => activePlants.map(plant => plant.id), [activePlants]);
  const care = usePlantsWateredToday(ids, activePlants);
  const [pastOpen, setPastOpen] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [batchComposerOpen, setBatchComposerOpen] = React.useState(false);
  const batchRequestIds = React.useRef(new Map<string, Map<string, string>>());
  const [message, setMessage] = React.useState('');
  const [initialGridEntrancePlayed, setInitialGridEntrancePlayed] = React.useState(false);
  const list = React.useRef<FlatList<ListedPlant>>(null);
  const restored = React.useRef(false);
  const initialPosition = React.useRef(initialOffset);
  React.useEffect(() => { if (restored.current) list.current?.scrollToOffset({ offset: 0, animated: false }); }, [searchQuery, statusFilter, options]);
  const hasFilters = plantFilterValues(options.stage).length > 0 || plantFilterValues(options.environment).length > 0;
  const filtered = React.useMemo(() => selectPlantList(plants, searchQuery, statusFilter, options), [plants, statusFilter, searchQuery, options]);
  const selectedPlants = React.useMemo(() => plants.filter(plant => selectedIds.includes(plant.id) && plant.status === 'active' && !plant.deleting), [plants, selectedIds]);
  const careGroupsByPlant = React.useMemo(() => {
    const map = new Map<string, GardenCareGroup[]>();
    for (const group of careGroups) for (const plant of group.plants) map.set(plant.id, [...(map.get(plant.id) || []), group]);
    return map;
  }, [careGroups]);
  const wateringByPlant = React.useMemo(() => new Map(careResults.map(result => [result.plantId, result.cards.find(card => card.kind === 'watering' && card.active)])), [careResults]);
  const selectablePlants = React.useMemo(() => filtered.filter(plant => plant.status === 'active' && !plant.deleting), [filtered]);
  const allVisibleSelected = selectablePlants.length > 0 && selectablePlants.every(plant => selectedIds.includes(plant.id));
  React.useEffect(() => { setSelectionMode(false); setSelectedIds([]); setBatchComposerOpen(false); batchRequestIds.current.clear(); }, [garden?.id, statusFilter]);
  React.useEffect(() => { if (selectionMode && selectedIds.length === 0) { setSelectionMode(false); batchRequestIds.current.clear(); } }, [selectionMode, selectedIds.length]);
  const startSelection = (plantId: string) => { setSelectionMode(true); setSelectedIds(previous => previous.includes(plantId) ? previous : [...previous, plantId]); };
  const toggleSelected = (plantId: string) => setSelectedIds(previous => previous.includes(plantId) ? previous.filter(id => id !== plantId) : [...previous, plantId]);
  const toggleSelectAll = () => setSelectedIds(allVisibleSelected ? [] : selectablePlants.map(plant => plant.id));
  const saveBatchActivity = async (category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string, _options?: ActivitySaveOptions): Promise<ActivitySaveResult> => {
    let requests = batchRequestIds.current.get(requestId);
    if (!requests) {
      requests = new Map(selectedPlants.map(plant => [plant.id, newLogId()]));
      batchRequestIds.current.set(requestId, requests);
    }
    const input = { ...buildManualPlantLog(category, description), ...measurements };
    const results = await Promise.all(selectedPlants.map(plant => saveJournalEntry(plant.id, input, date, undefined, requests!.get(plant.id)!)));
    return results[0];
  };
  const batchActivitySaved = (_result: ActivitySaveResult, category: JournalCategory) => {
    batchRequestIds.current.clear();
    setBatchComposerOpen(false);
    setSelectionMode(false);
    setSelectedIds([]);
    collection.refresh(); care.refresh();
    const label = logChoices.find(choice => choice.key === category)?.label || 'Activity';
    setMessage(`${label} recorded for ${selectedPlants.length} ${selectedPlants.length === 1 ? 'plant' : 'plants'}.`);
  };
  React.useEffect(() => {
    if (!collection.loading && filtered.length > 0) setInitialGridEntrancePlayed(true);
  }, [collection.loading, filtered.length]);
  const openPlant = (plant: ListedPlant) => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } });
  const setStatus = (value: string | null) => { setStatusFilter(value); list.current?.scrollToOffset({ offset: 0, animated: false }); onOffsetChange(0); };
  const active = statusFilter === 'active';
  return <View onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)} style={{ flex: 1 }}>
    {!active && <View style={s.historyContext}>
      <Pressable accessibilityRole="button" accessibilityLabel="Filter past plants" onPress={() => setPastOpen(true)} style={s.historyFilter}><MaterialCommunityIcons name="archive-outline" color={t.muted} size={18} /><Text style={s.hint}>{pastOptions.find(option => option.value === statusFilter)?.label || 'All past plants'}</Text><MaterialCommunityIcons name="chevron-down" color={t.muted} size={17} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to active plants" onPress={() => setStatus('active')} style={s.backToPlants}><MaterialCommunityIcons name="arrow-left" color={t.accent} size={17} /><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Back to plants</Text></Pressable>
    </View>}
    {!!care.error && <Pressable accessibilityRole="button" onPress={care.refresh} style={s.notice}><Text style={{ color: t.danger }}>Watering status unavailable · Retry</Text></Pressable>}
    {!!collection.error && <Pressable accessibilityRole="button" onPress={collection.refresh} style={s.notice}><Text style={{ color: t.danger }}>{collection.error} · Retry</Text></Pressable>}
    <FlatList numColumns={2} columnWrapperStyle={{ gap: 10 }} ref={list} testID="home-plants-list" data={filtered} keyExtractor={plant => plant.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: selectionMode ? 100 : 20 }}
      refreshControl={<RefreshControl tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} refreshing={collection.loading && !!plants.length} onRefresh={collection.refresh} />} scrollEventThrottle={32}
      onScroll={event => { if (restored.current) onOffsetChange(event.nativeEvent.contentOffset.y); }}
      onContentSizeChange={() => { if (!restored.current && !collection.loading) { restored.current = true; list.current?.scrollToOffset({ offset: initialPosition.current, animated: false }); } }}
      ListEmptyComponent={collection.loading ? <PlantListSkeleton /> : !collection.error ? <View style={s.empty}>
        <MaterialCommunityIcons name={searchQuery || hasFilters ? 'magnify' : active ? 'sprout-outline' : 'archive-outline'} size={30} color={t.accent} />
        <Text style={s.emptyTitle}>{searchQuery || hasFilters ? 'No matching plants' : active ? 'Room for something new' : statusFilter === 'dead' ? 'No deceased plants yet' : 'No past plants here yet'}</Text>
        <Text style={[s.hint, { textAlign: 'center' }]}>{searchQuery || hasFilters ? 'Try a different search or reset your filters.' : active ? 'Add a plant to start its story in this garden.' : 'Archived, harvested and deceased plants stay here with their history.'}</Text>
        {hasFilters && onResetFilters && <Pressable accessibilityRole="button" onPress={onResetFilters} style={s.action}><Text style={{ color: t.accent }}>Reset filters</Text></Pressable>}
        {!!searchQuery && <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} style={s.action}><Text style={{ color: t.accent }}>Clear search</Text></Pressable>}
      </View> : null}
      ListHeaderComponent={<>{header}<Animated.View layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)} style={s.listHeading}><Text accessibilityRole="header" style={s.section}>{title}</Text><Animated.View key={selectionMode ? 'select-all-action' : 'add-plant-action'} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}>{selectionMode ? <Pressable accessibilityRole="checkbox" accessibilityLabel="Select all plants shown" accessibilityState={{ checked: allVisibleSelected, disabled: !selectablePlants.length }} aria-checked={allVisibleSelected} disabled={!selectablePlants.length} onPress={toggleSelectAll} style={s.selectAll}><View style={[s.selectCheckbox, { borderColor: allVisibleSelected ? t.accent : t.border, backgroundColor: allVisibleSelected ? t.accent : 'transparent' }]}>{allVisibleSelected && <MaterialCommunityIcons name="check" size={15} color={t.onAccent} />}</View><Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Select All</Text></Pressable> : <GrowPress accessibilityRole="button" accessibilityLabel="Add plant" onPress={onAddPlant} style={s.add}><MaterialCommunityIcons name="plus" size={19} color={t.accent} /><Text style={s.addText}>Add plant</Text></GrowPress>}</Animated.View></Animated.View></>}
      ListFooterComponent={footer}
      renderItem={({ item, index }) => {
        const alerts = careGroupsByPlant.get(item.id) || [];
        const wateringCard = wateringByPlant.get(item.id);
        const routineDue = alerts.some(group => group.key === 'routine:watering');
        const waterStatus = care.wateredMap[item.id] ? 'watered' : !care.loading && !care.error && !careAdviceLoading && !careAdviceError && (wateringCard?.metrics.needsWater === true || routineDue) ? 'water' : 'check';
        return <Animated.View entering={!initialGridEntrancePlayed ? FadeInDown.delay(Math.min(index * 55, 220)).duration(300).reduceMotion(ReduceMotion.System) : undefined} style={{ width: Math.max(0, (layoutWidth - 46) / 2), marginBottom: 10 }}><PlantGridCard plant={item} onPress={() => openPlant(item)} wateredToday={!!care.wateredMap[item.id]} waterStatus={waterStatus} careAlertCount={alerts.length} selecting={selectionMode} selected={selectedIds.includes(item.id)} onSelect={() => toggleSelected(item.id)} onStartSelection={item.status === 'active' ? () => startSelection(item.id) : undefined} /></Animated.View>;
      }}
    />
    {selectionMode && <GrowPress accessibilityRole="button" accessibilityLabel={`Log activity for ${selectedPlants.length} ${selectedPlants.length === 1 ? 'plant' : 'plants'}`} disabled={!selectedPlants.length} onPress={() => setBatchComposerOpen(true)} style={[s.batchAction, { backgroundColor: t.accent, opacity: selectedPlants.length ? 1 : .5 }]}><MaterialCommunityIcons name="notebook-plus-outline" size={20} color={t.onAccent} /><Text style={{ color: t.onAccent, fontSize: 16, fontWeight: '700' }}>Log activity for {selectedPlants.length} {selectedPlants.length === 1 ? 'plant' : 'plants'}</Text></GrowPress>}
    {batchComposerOpen && selectedPlants[0] && <PlantLogComposer key={`batch:${selectedIds.join(',')}`} plantId={selectedPlants[0].id} name={`${selectedPlants.length} ${selectedPlants.length === 1 ? 'plant' : 'plants'}`} theme={t} timeZone={selectedPlants[0].locationTimeZone} configuration={careConfiguration(selectedPlants[0])} initialDate={plantDay(new Date(), selectedPlants[0].locationTimeZone)} onClose={() => setBatchComposerOpen(false)} onSave={saveBatchActivity} onSaved={batchActivitySaved} />}
    {pastOpen && <PlantEditorSheet title="Past plants" subtitle="Keep every plant's story within reach." theme={t} onClose={() => setPastOpen(false)}>{pastOptions.map(option => <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: statusFilter === option.value }} onPress={() => { setStatus(option.value); setPastOpen(false); }} style={s.menuRow}><Text style={s.menuText}>{option.label}</Text>{statusFilter === option.value && <MaterialCommunityIcons name="check" color={t.accent} size={22} />}</Pressable>)}</PlantEditorSheet>}
    <AppNotice visible={!!message} onDismiss={() => setMessage('')} duration={6000}>{message}</AppNotice>
  </View>;
}
const makeStyles = (t: typeof gardenThemes.grove) => StyleSheet.create({
  hint: { color: t.muted, fontSize: 13, lineHeight: 21 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingBottom: 8 }, section: { color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  add: { minHeight: 44, borderRadius: 12, backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 4 }, addText: { color: t.accent, fontWeight: '500', fontSize: 14 },
  selectAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 }, selectCheckbox: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  historyContext: { marginHorizontal: 18, paddingBottom: 6, borderBottomWidth: 1, borderColor: t.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  historyFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  backToPlants: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 6 },
  notice: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 8, justifyContent: 'center' }, empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 12 }, emptyTitle: { color: t.text, fontSize: 19, fontWeight: '600' },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }, menuRow: { minHeight: 58, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: 1, borderColor: t.border }, menuText: { color: t.text, fontSize: 16, flex: 1 },
  batchAction: { position: 'absolute', left: 18, right: 18, bottom: 12, minHeight: 56, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
