import { useAppTheme } from '@/hooks/useAppTheme';
import { PlantListSkeleton } from '@/ui/LoadingFeedback';
import CountBadge from '@/ui/CountBadge';
import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import PlantListScreen from '@/features/plants/screens/PlantListScreen';
import { gardenControls, gardenThemes } from '@/design-system/tokens/garden';
import { AppHeader } from '@/ui/AppHeader';
import ActionDialog from '@/ui/ActionDialog';
import AppNotice from '@/ui/AppNotice';
import { GrowPress } from '@/ui/GrowMotion';
import HomeBackground from '../components/HomeBackground';
import GardenDropdown from '../components/GardenDropdown';
import CreateGardenSheet from '../components/CreateGardenSheet';
import PlantFilterMenu from '../components/PlantFilterMenu';
import { DEFAULT_PLANT_LIST_OPTIONS, plantFilterValues, plantListChoiceCount, plantSortOptions, type PlantListOptions } from '@/lib/plants/plantListOptions';
import { guideStage } from '@/features/plants/growthStagePresentation';
import { decodeGardenSelection, plantsInGarden, resolveGardenSelection, summarizeGardenCollection, type GardenSelection } from '../gardenSelection';
import { useCareTasks } from '@/features/care/useCareTasks';
import { readGardenListView, saveGardenListView, saveGardenScrollOffset } from '@/services/homeGardenView';
import AnchoredActionMenu, { type MenuAnchor } from '@/ui/AnchoredActionMenu';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import { updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { groupEditValues } from '@/features/groups/groupCollection';
import { waterPlants } from '@/lib/logs/bulkWatering';
import type { Plant } from '@/firestoreModels';
import { useGardenWeather } from '../GardenWeatherProvider';
import GardenCareOverview from '../components/GardenCareOverview';
import { useGardenCareSuggestions } from '../hooks/useGardenCareSuggestions';
import { gardenCareGroups } from '../gardenCare';

export default function HomeScreen(_props: { initialTabIndex?: number }) {
  const { user, loading } = useSession();
  // Reset viewing preferences synchronously when the account changes.
  return <GardenHome key={user?.uid || 'signed-out'} uid={user?.uid} accountLoading={loading} />;
}

function GardenHome({ uid, accountLoading }: { uid?: string; accountLoading: boolean }) {
  const t = useAppTheme();
  const s = makeStyles(t);
  const router = useRouter();
  const spaces = useOwnedGroups();
  const collection = usePlantList();
  const [selection, setSelection] = React.useState<GardenSelection | null>(null);
  const [preferenceReady, setPreferenceReady] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [options, setOptions] = React.useState<PlantListOptions>(DEFAULT_PLANT_LIST_OPTIONS);
  const [filterAnchor, setFilterAnchor] = React.useState<MenuAnchor | null>(null);
  const filterTrigger = React.useRef<View>(null);
  const [status, setStatus] = React.useState<string | null>('active');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [actionsAnchor, setActionsAnchor] = React.useState<MenuAnchor | null>(null);
  const [editing, setEditing] = React.useState<GroupWithId | null>(null);
  const [watering, setWatering] = React.useState<{ name: string; plants: (Plant & { id: string })[] } | null>(null);
  const lastScope = React.useRef('');
  const pendingGarden = React.useRef<string | null>(null);
  const storageKey = `weedgrow.home-garden.v1.${uid || 'device'}`;
  const preferenceWrites = React.useRef(Promise.resolve());
  const restoreView = React.useCallback((gardenId: string) => {
    const view = readGardenListView(uid, gardenId);
    setQuery(view.query);
    setStatus(view.status);
    setOptions(view.options || DEFAULT_PLANT_LIST_OPTIONS);
  }, [uid]);
  const persistSelection = (value: GardenSelection, failureMessage: string) => {
    preferenceWrites.current = preferenceWrites.current.catch(() => {})
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(value)))
      .catch(() => setMessage(failureMessage));
  };
  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => {
      if (!active) return;
      const next = decodeGardenSelection(raw);
      setSelection(next);
      if (next) restoreView(next.kind === 'garden' ? next.id : 'all');
    }).catch(() => {}).finally(() => { if (active) setPreferenceReady(true); });
    return () => { active = false; };
  }, [storageKey, restoreView]);
  const gardens = React.useMemo(() => [...spaces.groups].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [spaces.groups]);
  const weatherCollection = useGardenWeather();
  React.useEffect(() => {
    if (!preferenceReady || (spaces.status !== 'ready' && spaces.status !== 'refreshing') || spaces.error) return;
    if (selection?.kind === 'garden' && pendingGarden.current === selection.id && !gardens.some(garden => garden.id === selection.id)) return;
    const next = resolveGardenSelection(selection, gardens);
    if (next !== selection) {
      restoreView(next.kind === 'garden' ? next.id : 'all');
      setSelection(next);
    }
  }, [gardens, preferenceReady, spaces.status, spaces.error, selection, restoreView]);
  const resolved = resolveGardenSelection(selection, gardens);
  const selected = resolved.kind === 'garden' ? gardens.find(item => item.id === resolved.id) || null : null;
  const scopedPlants = React.useMemo(() => plantsInGarden(collection.plants, selected), [collection.plants, selected]);
  const scopedIds = React.useMemo(() => scopedPlants.map(plant => plant.id), [scopedPlants]);
  const care = useCareTasks(!!uid && preferenceReady, scopedIds);
  const careAdvice = useGardenCareSuggestions(uid ? scopedPlants : [], care.now);
  const careGroups = React.useMemo(() => gardenCareGroups(careAdvice.results, care.tasks, scopedPlants, care.now), [careAdvice.results, care.tasks, scopedPlants, care.now]);
  const { counts, unassigned } = React.useMemo(() => summarizeGardenCollection(collection.plants, gardens), [collection.plants, gardens]);
  const ready = preferenceReady && !accountLoading && !spaces.loading;
  const choose = (value: GardenSelection) => {
    const nextKey = value.kind === 'garden' ? value.id : 'all';
    restoreView(nextKey);
    lastScope.current = nextKey;
    setSelection(value);
    setMessage('');
    persistSelection(value, 'Your garden is open. This device could not remember the selection.');
  };
  React.useEffect(() => {
    const id = pendingGarden.current;
    if (id && gardens.some(garden => garden.id === id)) { pendingGarden.current = null; setSelection({ kind: 'garden', id }); }
  }, [gardens]);
  const openWaterAll = () => setWatering({ name: selected?.name || 'All plants', plants: scopedPlants.filter(plant => plant.status === 'active' && !plant.deleting) });
  const addPlant = () => router.push({ pathname: '/add-plant', params: selected ? { gardenId: selected.id } : {} });
  const openCreate = () => {
    if (!uid) { router.push('/account'); return; }
    setCreating(true);
  };
  const listKey = selected?.id || 'all';
  React.useLayoutEffect(() => {
    if (lastScope.current === listKey || !preferenceReady) return;
    lastScope.current = listKey;
    restoreView(listKey);
  }, [listKey, preferenceReady, restoreView]);
  const remember = (nextQuery: string, nextStatus: string | null, nextOffset: number, nextOptions = options) => {
    saveGardenListView(uid, listKey, { query: nextQuery, status: nextStatus, offset: nextOffset, options: nextOptions });
  };
  const changeQuery = (value: string) => { setQuery(value); remember(value, status, 0); };
  const changeStatus = (value: string | null) => { setStatus(value); remember(query, value, 0); };
  const applyOptions = (nextOptions: PlantListOptions, nextStatus: string) => { setOptions(nextOptions); setStatus(nextStatus); remember(query, nextStatus, 0, nextOptions); };
  const resetOptions = () => applyOptions(DEFAULT_PLANT_LIST_OPTIONS, 'active');
  const choiceCount = plantListChoiceCount(options, status);
  const totalActivePlants = React.useMemo(() => collection.plants.filter(plant => plant.status === 'active' && !plant.deleting).length, [collection.plants]);
  const stageFilters = plantFilterValues(options.stage);
  const environmentFilters = plantFilterValues(options.environment);
  const summary = [stageFilters.length === 1 ? guideStage(stageFilters[0]).title : stageFilters.length ? `${stageFilters.length} stages` : '', environmentFilters.length === 1 ? environmentFilters[0][0].toUpperCase() + environmentFilters[0].slice(1) : environmentFilters.length ? `${environmentFilters.length} environments` : '', options.sort !== 'newest' ? plantSortOptions.find(item => item.value === options.sort)?.label : '', status !== 'active' ? 'Past plants' : ''].filter(Boolean).join(' · ');
  const refresh = () => { spaces.refresh(); collection.refresh(); };

  return <View style={{ flex: 1, backgroundColor: t.background }}>
    <HomeBackground />
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safeArea}>
      <AppHeader showDate={false} onActions={selected ? setActionsAnchor : undefined} actionsOpen={!!actionsAnchor} />
      <View style={s.top}>
        <GardenDropdown gardens={gardens} selection={resolved} counts={counts} allActiveCount={totalActivePlants} countsReady={!collection.loading && !collection.error} onSelect={choose} onCreate={openCreate} disabled={!ready} onWaterAll={openWaterAll} waterAllDisabled={!uid || collection.loading || !!collection.error || !scopedPlants.some(plant => plant.status === 'active' && !plant.deleting)} />
      </View>
      {!ready ? <View style={{ paddingHorizontal: 18, paddingTop: 12 }}><PlantListSkeleton label="Opening your garden…" /></View> : <View style={{ flex: 1, position: 'relative' }}><PlantListScreen key={listKey}
        header={<><View style={{ gap: 8 }}>
        {!uid && !accountLoading && <View style={s.notice}><Text style={s.hint}>Sign in to see your plants, or start a plant draft.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={s.textButton}><Text style={s.link}>Sign in or create an account →</Text></Pressable></View>}
        {!!spaces.error && <Pressable accessibilityRole="button" onPress={refresh} style={s.notice}><Text style={{ color: t.danger }}>{spaces.error} Tap to retry.</Text></Pressable>}
        {!!selected && !!weatherCollection.errors[selected.id] && <Pressable accessibilityRole="button" accessibilityLabel="Retry garden weather collection" onPress={() => void weatherCollection.retry(selected.id)} style={s.notice}><Text style={s.hint}>Weather collection needs attention. {weatherCollection.errors[selected.id]} <Text style={s.link}>Retry →</Text></Text></Pressable>}
        {!!uid && status === 'active' && <GardenCareOverview key={listKey} cacheKey={JSON.stringify([uid, listKey])}
          uid={uid} gardenId={selected?.id} plants={scopedPlants} now={care.now} groups={careGroups}
          loading={care.loading || careAdvice.loading} failed={!!care.error || careAdvice.error}
          onRetry={() => { care.refresh(); careAdvice.refresh(); }} />}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View testID="input-focus-frame" nativeID="plant-search-field" style={[s.search, { flex: 1, marginBottom: 0 }]}><MaterialCommunityIcons name="magnify" color={t.muted} size={20} /><TextInput nativeID="plant-search-input" accessibilityLabel="Search plants by name or strain" placeholder="Search" placeholderTextColor={t.muted} value={query} onChangeText={changeQuery} returnKeyType="search" style={s.input} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={() => changeQuery('')} style={s.clear}><MaterialCommunityIcons name="close" size={20} color={t.muted} /></Pressable>}</View><View ref={filterTrigger} collapsable={false} style={{ width: 44, height: 44 }}><GrowPress accessibilityRole="button" accessibilityLabel={`Filter and sort plants${choiceCount ? `, ${choiceCount} active ${choiceCount === 1 ? 'choice' : 'choices'}` : ''}`} accessibilityState={{ expanded: !!filterAnchor }} disabled={!ready || collection.loading && !scopedPlants.length} onPress={() => { Keyboard.dismiss(); filterTrigger.current?.measureInWindow((x, y, width, height) => { if (width > 0 && height > 0) setFilterAnchor({ x, y, width, height }); }); }} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: choiceCount ? t.accent : t.elevated, backgroundColor: choiceCount ? t.elevated : t.surface }}><MaterialCommunityIcons name="tune-variant" size={21} color={choiceCount ? t.accent : t.muted} />{choiceCount > 0 && <View style={{ position: 'absolute', top: -4, right: -3, alignItems: 'center', justifyContent: 'center' }}><CountBadge value={choiceCount} label={`${choiceCount} active filters`} color={t.onAccent} backgroundColor={t.accent} size={18} fontSize={10} /></View>}</GrowPress></View></View>
        {!!choiceCount && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={2} style={[s.hint, { flex: 1, fontSize: 12 }]}>{summary}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Reset plant filters and sorting" onPress={resetOptions} style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: t.accent, fontSize: 12 }}>Reset</Text></GrowPress></View>}
        </View>
        </>}
        title={status === 'active' ? 'Your plants' : 'Past plants'} onAddPlant={addPlant} careGroups={careGroups} careResults={careAdvice.results} careAdviceLoading={careAdvice.loading} careAdviceError={careAdvice.error} options={options} onResetFilters={resetOptions} garden={selected} searchQuery={query} setSearchQuery={changeQuery} statusFilter={status} setStatusFilter={changeStatus}
        initialOffset={readGardenListView(uid, listKey).offset} onOffsetChange={value => saveGardenScrollOffset(uid, listKey, value)}
        footer={<View style={s.footer}>
          {!gardens.length && <Pressable accessibilityRole="button" onPress={openCreate} style={s.tool}><MaterialCommunityIcons name="sprout-outline" size={22} color={t.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.link}>Make a home for your plants</Text><Text style={s.hint}>Create a garden for your patio, tent or greenhouse.</Text></View><MaterialCommunityIcons name="plus" size={20} color={t.accent} /></Pressable>}
          {!!selected && unassigned > 0 && <Pressable accessibilityRole="button" onPress={() => choose({ kind: 'all' })} style={s.textButton}><Text style={s.hint}>{unassigned} {unassigned === 1 ? 'plant is' : 'plants are'} outside a garden. <Text style={s.link}>View all plants →</Text></Text></Pressable>}
        </View>}
      /></View>}
      {filterAnchor && <PlantFilterMenu anchor={filterAnchor} key={listKey} options={options} status={status} plants={scopedPlants} query={query} showEnvironment={!selected} onApply={applyOptions} onClose={() => { setFilterAnchor(null); filterTrigger.current?.focus?.(); }} />}
      {actionsAnchor && <AnchoredActionMenu anchor={actionsAnchor} title={selected?.name || 'Your plants'} horizontal tone="hero" onClose={() => setActionsAnchor(null)} actions={[
        { label: 'Garden settings', icon: 'tune-variant', onPress: () => selected && setEditing(selected) },
        { label: 'Manage plants', icon: 'sprout-outline', onPress: () => selected && router.push({ pathname: '/group/[id]', params: { id: selected.id } }) },
      ]} />}
      <EditGroupModal visible={!!editing} settingsOnly group={editing} allPlants={collection.plants} onClose={() => setEditing(null)} onSave={async (updated, baseline) => { await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>); setMessage('Garden settings saved.'); }} />
      {watering && <ActionDialog title="Water all plants" tone="water" description={`Log watering for ${watering.plants.length} active ${watering.plants.length === 1 ? 'plant' : 'plants'} in ${watering.name}. Plants already watered today are skipped. This records completed watering.`} confirmLabel="Save watering for all" onClose={() => setWatering(null)} onConfirm={async () => {
        const result = await waterPlants(watering.plants);
        collection.refresh();
        if (result.failed) throw new Error(`${result.written} saved, ${result.skipped} already watered, ${result.failed} could not be saved. Try again to finish; saved waterings will be skipped.`);
        setMessage(`Saved ${result.written} watering records. ${result.skipped} already watered today.`);
      }} />}

      {creating && <CreateGardenSheet onClose={() => setCreating(false)} onCreated={id => {
        pendingGarden.current = id; setSelection({ kind: 'garden', id });
        persistSelection({ kind: 'garden', id }, 'Garden created. This device could not remember the selection.');
      }} />}
      <AppNotice visible={!!message} onDismiss={() => setMessage('')} tone={message.toLowerCase().includes('could not remember') ? 'error' : 'success'} duration={4000}>{message}</AppNotice>
    </SafeAreaView>
  </View>;
}

const makeStyles = (t: typeof gardenThemes.grove) => StyleSheet.create({
  safeArea: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  top: { paddingHorizontal: 18, paddingTop: 6, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: t.surface, paddingLeft: 10, marginBottom: 8 },
  input: { flex: 1, minWidth: 0, minHeight: gardenControls.height, paddingHorizontal: 8, color: t.text, fontSize: 16 },
  clear: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  loading: { padding: 28, alignItems: 'center', gap: 12 },
  hint: { fontSize: 13, color: t.muted, lineHeight: 20 },
  link: { fontSize: 14, color: t.accent, fontWeight: '600' },
  notice: { padding: 14, borderRadius: 14, backgroundColor: t.surface },
  textButton: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  footer: { gap: 8, paddingTop: 8, paddingBottom: 16 },
  tool: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
