import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import { gardenThemes } from '@/design-system/tokens/garden';
import { usePlantList } from '../hooks/usePlantList';
import { usePlantsWateredToday } from '../hooks/usePlantsWateredToday';
import { PlantCard } from '../components/PlantCard';
import QuickWateringDialog from '../components/QuickWateringDialog';
import PlantEditorSheet from '../components/PlantEditorSheet';
import { deleteJournalEntry } from '@/lib/logs/journalRepository';
import { plantsInGarden, type HomeGarden } from '@/features/home/gardenSelection';
import { matchesPlantStatus } from '../plantListPresentation';
import type { Plant } from '@/firestoreModels';

type ListedPlant = Plant & { id: string };
const t = gardenThemes.grove;
const pastOptions = [{ value: 'past', label: 'All past plants' }, { value: 'archived', label: 'Archived' }, { value: 'harvested', label: 'Harvested' }, { value: 'dead', label: 'Dead' }];
export default function PlantListScreen({ garden, searchQuery, setSearchQuery, statusFilter, setStatusFilter, footer, onMovePlant, initialOffset = 0, onOffsetChange }: {
  garden?: HomeGarden | null; searchQuery: string; setSearchQuery(value: string): void; statusFilter: string | null; setStatusFilter(value: string | null): void;
  footer?: React.ReactElement; onMovePlant(plant: ListedPlant): void; initialOffset?: number; onOffsetChange(offset: number): void;
}) {
  const router = useRouter();
  const collection = usePlantList();
  const plants = React.useMemo(() => plantsInGarden(collection.plants, garden || null), [collection.plants, garden]);
  const activePlants = React.useMemo(() => plants.filter(plant => plant.status === 'active'), [plants]);
  const ids = React.useMemo(() => activePlants.map(plant => plant.id), [activePlants]);
  const care = usePlantsWateredToday(ids, activePlants);
  const [pastOpen, setPastOpen] = React.useState(false);
  const [menuPlant, setMenuPlant] = React.useState<ListedPlant | null>(null);
  const [waterPlant, setWaterPlant] = React.useState<ListedPlant | null>(null);
  const [message, setMessage] = React.useState('');
  const [undo, setUndo] = React.useState<{ plantId: string; id: string; mutationId: string } | null>(null);
  const list = React.useRef<FlatList<ListedPlant>>(null);
  const restored = React.useRef(false);
  const initialPosition = React.useRef(initialOffset);
  React.useEffect(() => { if (restored.current) list.current?.scrollToOffset({ offset: 0, animated: false }); }, [searchQuery, statusFilter]);
  const filtered = React.useMemo(() => plants.filter(plant => matchesPlantStatus(plant, statusFilter || 'past') && `${plant.name} ${plant.strain || ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase())), [plants, statusFilter, searchQuery]);
  const openPlant = (plant: ListedPlant) => router.push({ pathname: '/plant/[id]', params: { id: plant.id, returnToPlants: '1' } });
  const setStatus = (value: string | null) => { setStatusFilter(value); list.current?.scrollToOffset({ offset: 0, animated: false }); onOffsetChange(0); };
  const active = statusFilter === 'active';
  return <View style={{ flex: 1 }}>
    {!active && <View style={s.historyContext}>
      <Pressable accessibilityRole="button" accessibilityLabel="Filter past plants" onPress={() => setPastOpen(true)} style={s.historyFilter}><MaterialCommunityIcons name="archive-outline" color={t.muted} size={18} /><Text style={s.hint}>{pastOptions.find(option => option.value === statusFilter)?.label || 'All past plants'}</Text><MaterialCommunityIcons name="chevron-down" color={t.muted} size={17} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to active plants" onPress={() => setStatus('active')} style={s.backToPlants}><MaterialCommunityIcons name="arrow-left" color={t.accent} size={17} /><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Back to plants</Text></Pressable>
    </View>}
    {!!care.error && <Pressable accessibilityRole="button" onPress={care.refresh} style={s.notice}><Text style={{ color: t.danger }}>Watering status unavailable · Retry</Text></Pressable>}
    {!!collection.error && <Pressable accessibilityRole="button" onPress={collection.refresh} style={s.notice}><Text style={{ color: t.danger }}>{collection.error} · Retry</Text></Pressable>}
    <FlatList ref={list} testID="home-plants-list" data={filtered} keyExtractor={plant => plant.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 }}
      refreshing={collection.loading && !!plants.length} onRefresh={collection.refresh} scrollEventThrottle={32}
      onScroll={event => { if (restored.current) onOffsetChange(event.nativeEvent.contentOffset.y); }}
      onContentSizeChange={() => { if (!restored.current && !collection.loading) { restored.current = true; list.current?.scrollToOffset({ offset: initialPosition.current, animated: false }); } }}
      ListEmptyComponent={collection.loading ? <View style={s.empty}><ActivityIndicator color={t.accent} /><Text style={s.hint}>Loading plants…</Text></View> : !collection.error ? <View style={s.empty}>
        <MaterialCommunityIcons name={searchQuery ? 'magnify' : active ? 'sprout-outline' : 'archive-outline'} size={30} color={t.accent} />
        <Text style={s.emptyTitle}>{searchQuery ? 'No matching plants' : active ? 'Room for something new' : 'No past plants here yet'}</Text>
        <Text style={[s.hint, { textAlign: 'center' }]}>{searchQuery ? 'Try a different name or strain.' : active ? 'Add a plant to start its story in this garden.' : 'Archived, harvested and dead plants stay here with their history.'}</Text>
        {!!searchQuery && <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} style={s.action}><Text style={{ color: t.accent }}>Clear search</Text></Pressable>}
      </View> : null}
      ListFooterComponent={footer}
      renderItem={({ item }) => <PlantCard plant={item} showEnvironment={!garden} onPress={() => openPlant(item)} onMore={() => setMenuPlant(item)} onAddLog={item.status === 'active' ? () => setWaterPlant(item) : undefined} wateredToday={!!care.wateredMap[item.id]} waterDisabled={care.loading || !!care.error} />}
    />
    {pastOpen && <PlantEditorSheet title="Past plants" subtitle="Keep every plant's story within reach." theme={t} onClose={() => setPastOpen(false)}>{pastOptions.map(option => <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: statusFilter === option.value }} onPress={() => { setStatus(option.value); setPastOpen(false); }} style={s.menuRow}><Text style={s.menuText}>{option.label}</Text>{statusFilter === option.value && <MaterialCommunityIcons name="check" color={t.accent} size={22} />}</Pressable>)}</PlantEditorSheet>}
    {menuPlant && <PlantEditorSheet title={menuPlant.name} subtitle="Plant actions" theme={t} onClose={() => setMenuPlant(null)}>
      <Pressable accessibilityRole="button" onPress={() => { openPlant(menuPlant); setMenuPlant(null); }} style={s.menuRow}><MaterialCommunityIcons name="sprout-outline" color={t.accent} size={22} /><Text style={s.menuText}>Open plant</Text><MaterialCommunityIcons name="chevron-right" color={t.muted} size={20} /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { onMovePlant(menuPlant); setMenuPlant(null); }} style={s.menuRow}><MaterialCommunityIcons name="swap-horizontal" color={t.accent} size={22} /><Text style={s.menuText}>Move to garden</Text><MaterialCommunityIcons name="chevron-right" color={t.muted} size={20} /></Pressable>
    </PlantEditorSheet>}
    {waterPlant && <QuickWateringDialog plant={waterPlant} onClose={() => setWaterPlant(null)} onSaved={result => { setUndo(result); setMessage(`Watering saved for ${waterPlant.name}.`); care.refresh(); }} />}
    <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={6000} action={undo ? { label: 'Undo', onPress: async () => { try { await deleteJournalEntry(undo.plantId, undo.id, undo.mutationId); setMessage('Watering undone.'); care.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not undo watering.'); } finally { setUndo(null); } } } : undefined}>{message}</Snackbar>
  </View>;
}
const s = StyleSheet.create({
  hint: { color: t.muted, fontSize: 13, lineHeight: 21 },
  historyContext: { marginHorizontal: 18, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#344735', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  historyFilter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  backToPlants: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 6 },
  notice: { paddingHorizontal: 18, paddingVertical: 8 }, empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 12 }, emptyTitle: { color: t.text, fontSize: 19, fontWeight: '600' },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }, menuRow: { minHeight: 58, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#344735' }, menuText: { color: t.text, fontSize: 16, flex: 1 },
});
