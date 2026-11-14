import { useAppTheme } from '@/hooks/useAppTheme';
import { PlantListSkeleton } from '@/ui/LoadingFeedback';
import CountBadge from '@/ui/CountBadge';
import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import PlantListScreen from '@/features/plants/screens/PlantListScreen';
import { gardenControls, gardenThemes } from '@/design-system/tokens/garden';
import { AppHeader } from '@/ui/AppHeader';
import ActionDialog from '@/ui/ActionDialog';
import { GrowPress } from '@/ui/GrowMotion';
import HomeBackground from '../components/HomeBackground';
import GardenDropdown from '../components/GardenDropdown';
import CreateGardenSheet from '../components/CreateGardenSheet';
import PlantFilterMenu from '../components/PlantFilterMenu';
import { DEFAULT_PLANT_LIST_OPTIONS, plantFilterValues, plantListChoiceCount, plantSortOptions, selectPlantList, type PlantListOptions } from '@/lib/plants/plantListOptions';
import { guideStage } from '@/features/plants/growthStagePresentation';
import { decodeGardenSelection, plantsInGarden, resolveGardenSelection, type GardenSelection } from '../gardenSelection';
import { useCareTasks } from '@/features/care/useCareTasks';
import { readGardenListView, saveGardenListView, saveGardenScrollOffset } from '@/services/homeGardenView';
import AnchoredActionMenu, { type MenuAnchor, type MenuAction } from '@/ui/AnchoredActionMenu';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import { updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { groupEditValues } from '@/features/groups/groupCollection';
import { waterGrowingSpace } from '@/lib/logs/groupWatering';
import { useGardenWeather } from '../GardenWeatherProvider';
import { MAX_ATOMIC_WATERING_PLANTS } from '@/features/groups/groupPolicy';

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
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [options, setOptions] = React.useState<PlantListOptions>(DEFAULT_PLANT_LIST_OPTIONS);
  const [filterAnchor, setFilterAnchor] = React.useState<MenuAnchor | null>(null);
  const filterTrigger = React.useRef<View>(null);
  const [status, setStatus] = React.useState<string | null>('active');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [actionsAnchor, setActionsAnchor] = React.useState<MenuAnchor | null>(null);
  const [editing, setEditing] = React.useState<GroupWithId | null>(null);
  const [watering, setWatering] = React.useState<GroupWithId | null>(null);
  const offset = React.useRef(0);
  const lastScope = React.useRef('');
  const pendingGarden = React.useRef<string | null>(null);
  const storageKey = `weedgrow.home-garden.v1.${uid || 'device'}`;
  const preferenceWrites = React.useRef(Promise.resolve());
  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => { if (active) { const next = decodeGardenSelection(raw); setSelection(next); if (next) { const view = readGardenListView(uid, next.kind === 'garden' ? next.id : 'all'); setQuery(view.query); setStatus(view.status); setOptions(view.options || DEFAULT_PLANT_LIST_OPTIONS); offset.current = view.offset; } } }).catch(() => {}).finally(() => { if (active) setPreferenceReady(true); });
    return () => { active = false; };
  }, [storageKey, uid]);
  const gardens = React.useMemo(() => [...spaces.groups].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [spaces.groups]);
  const weatherCollection = useGardenWeather();
  React.useEffect(() => {
    if (!preferenceReady || (spaces.status !== 'ready' && spaces.status !== 'refreshing') || spaces.error) return;
    if (selection?.kind === 'garden' && pendingGarden.current === selection.id && !gardens.some(garden => garden.id === selection.id)) return;
    const next = resolveGardenSelection(selection, gardens);
    if (next !== selection) { const view = readGardenListView(uid, next.kind === 'garden' ? next.id : 'all'); setQuery(view.query); setStatus(view.status); setOptions(view.options || DEFAULT_PLANT_LIST_OPTIONS); offset.current = view.offset; setSelection(next); }
  }, [gardens, preferenceReady, spaces.status, spaces.error, selection, uid]);
  const resolved = resolveGardenSelection(selection, gardens);
  const selected = resolved.kind === 'garden' ? gardens.find(item => item.id === resolved.id) || null : null;
  const scopedPlants = React.useMemo(() => plantsInGarden(collection.plants, selected), [collection.plants, selected]);
  const scopedIds = React.useMemo(() => scopedPlants.map(plant => plant.id), [scopedPlants]);
  const care = useCareTasks(!!uid && preferenceReady, scopedIds);
  const due = care.tasks.filter(task => !task.completedToday && !task.skippedToday && task.due <= care.now && !((scopedPlants.find(plant => plant.id === task.plantId)?.careSnoozes?.[task.kind] || 0) > care.now.getTime())).length;
  const counts = React.useMemo(() => Object.fromEntries(gardens.map(garden => [garden.id, plantsInGarden(collection.plants, garden).filter(plant => plant.status === 'active').length])), [gardens, collection.plants]);
  const ready = preferenceReady && !accountLoading && !spaces.loading;
  const choose = (value: GardenSelection) => {
    const nextKey = value.kind === 'garden' ? value.id : 'all';
    const view = readGardenListView(uid, nextKey); lastScope.current = nextKey;
    offset.current = view.offset; setQuery(view.query); setStatus(view.status); setOptions(view.options || DEFAULT_PLANT_LIST_OPTIONS); setSelection(value); setMessage('');
    preferenceWrites.current = preferenceWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(value))).catch(() => setMessage('Your garden is open. This device could not remember the selection.'));
  };
  React.useEffect(() => {
    const id = pendingGarden.current;
    if (id && gardens.some(garden => garden.id === id)) { pendingGarden.current = null; setSelection({ kind: 'garden', id }); }
  }, [gardens]);
  const addPlant = () => router.push({ pathname: '/add-plant', params: selected ? { gardenId: selected.id } : {} });
  const openCreate = () => {
    if (!uid) { router.push('/account'); return; }
    setCreating(true);
  };
  const unassigned = collection.plants.filter(plant => !plant.groupId && !gardens.some(garden => garden.plantIds.includes(plant.id))).length;
  const listKey = selected?.id || 'all';
  React.useLayoutEffect(() => {
    if (lastScope.current === listKey || !preferenceReady) return;
    const view = readGardenListView(uid, listKey);
    lastScope.current = listKey; offset.current = view.offset; setQuery(view.query); setStatus(view.status); setOptions(view.options || DEFAULT_PLANT_LIST_OPTIONS);
  }, [listKey, uid, preferenceReady]);
  const remember = (nextQuery: string, nextStatus: string | null, nextOffset: number, nextOptions = options) => {
    offset.current = nextOffset; saveGardenListView(uid, listKey, { query: nextQuery, status: nextStatus, offset: nextOffset, options: nextOptions });
  };
  const changeQuery = (value: string) => { setQuery(value); remember(value, status, 0); };
  const changeStatus = (value: string | null) => { setStatus(value); remember(query, value, 0); };
  const applyOptions = (nextOptions: PlantListOptions, nextStatus: string) => { setOptions(nextOptions); setStatus(nextStatus); remember(query, nextStatus, 0, nextOptions); };
  const resetOptions = () => applyOptions(DEFAULT_PLANT_LIST_OPTIONS, 'active');
  const choiceCount = plantListChoiceCount(options, status);
  const visibleCount = React.useMemo(() => selectPlantList(scopedPlants, query, status, options).length, [scopedPlants, query, status, options]);
  const stageFilters = plantFilterValues(options.stage);
  const environmentFilters = plantFilterValues(options.environment);
  const summary = [stageFilters.length === 1 ? guideStage(stageFilters[0]).title : stageFilters.length ? `${stageFilters.length} stages` : '', environmentFilters.length === 1 ? environmentFilters[0][0].toUpperCase() + environmentFilters[0].slice(1) : environmentFilters.length ? `${environmentFilters.length} environments` : '', options.sort !== 'newest' ? plantSortOptions.find(item => item.value === options.sort)?.label : '', status !== 'active' ? 'Past plants' : ''].filter(Boolean).join(' · ');
  const refresh = () => { spaces.refresh(); collection.refresh(); };

  return <View style={{ flex: 1, backgroundColor: t.background }}>
    <HomeBackground />
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safeArea}>
      <AppHeader showDate={false} />
      <View style={s.top}>
        <GardenDropdown gardens={gardens} selection={resolved} counts={counts} countsReady={!collection.loading && !collection.error} onSelect={choose} onCreate={openCreate} onActions={setActionsAnchor} actionsOpen={!!actionsAnchor} disabled={!ready} />
        {!uid && !accountLoading && <View style={s.notice}><Text style={s.hint}>Sign in to see your plants, or start a plant draft.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={s.textButton}><Text style={s.link}>Sign in or create an account →</Text></Pressable></View>}
        {!!spaces.error && <Pressable accessibilityRole="button" onPress={refresh} style={s.notice}><Text style={{ color: t.danger }}>{spaces.error} Tap to retry.</Text></Pressable>}
        {!!selected && !!weatherCollection.errors[selected.id] && <Pressable accessibilityRole="button" accessibilityLabel="Retry garden weather collection" onPress={() => void weatherCollection.retry(selected.id)} style={s.notice}><Text style={s.hint}>Weather collection needs attention. {weatherCollection.errors[selected.id]} <Text style={s.link}>Retry →</Text></Text></Pressable>}
        {!!message && <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View testID="input-focus-frame" nativeID="plant-search-field" style={[s.search, { flex: 1, marginBottom: 0 }]}><MaterialCommunityIcons name="magnify" color={t.muted} size={20} /><TextInput nativeID="plant-search-input" accessibilityLabel="Search plants by name or strain" placeholder="Search plants…" placeholderTextColor={t.muted} value={query} onChangeText={changeQuery} returnKeyType="search" style={s.input} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={() => changeQuery('')} style={s.clear}><MaterialCommunityIcons name="close" size={20} color={t.muted} /></Pressable>}</View><View ref={filterTrigger} collapsable={false} style={{ width: 40, height: 40 }}><GrowPress accessibilityRole="button" accessibilityLabel={`Filter and sort plants${choiceCount ? `, ${choiceCount} active ${choiceCount === 1 ? 'choice' : 'choices'}` : ''}`} accessibilityState={{ expanded: !!filterAnchor }} disabled={!ready || collection.loading && !scopedPlants.length} onPress={() => { Keyboard.dismiss(); filterTrigger.current?.measureInWindow((x, y, width, height) => { if (width > 0 && height > 0) setFilterAnchor({ x, y, width, height }); }); }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: choiceCount ? t.accent : t.elevated, backgroundColor: choiceCount ? t.elevated : t.surface }}><MaterialCommunityIcons name="tune-variant" size={21} color={choiceCount ? t.accent : t.muted} />{choiceCount > 0 && <View style={{ position: 'absolute', top: -4, right: -3, alignItems: 'center', justifyContent: 'center' }}><CountBadge value={choiceCount} label={`${choiceCount} active filters`} color={t.onAccent} backgroundColor={t.accent} size={18} fontSize={10} /></View>}</GrowPress></View><GrowPress accessibilityRole="button" accessibilityLabel={selected ? `Add plant to ${selected.name}` : 'Add plant'} disabled={!ready} onPress={addPlant} style={s.add}><MaterialCommunityIcons name="plus" size={19} color={t.onAccent} /><Text style={s.addText}>Add plant</Text></GrowPress></View>
        {!!choiceCount && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={2} style={[s.hint, { flex: 1, fontSize: 12 }]}>{summary}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Reset plant filters and sorting" onPress={resetOptions} style={{ minHeight: 32, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 12 }}>Reset</Text></GrowPress></View>}
        <View style={s.listHeading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={s.section}>{status === 'active' ? 'Your plants' : 'Past plants'}</Text><CountBadge value={collection.loading ? '—' : visibleCount} label={collection.loading ? 'Plant count loading' : `${visibleCount} plants`} color={t.accent} backgroundColor={t.elevated} /></View>
          <View style={s.viewSwitch}>{(['grid', 'list'] as const).map(mode => <GrowPress key={mode} accessibilityRole="button" accessibilityLabel={`Show plants as ${mode}`} accessibilityState={{ selected: viewMode === mode }} onPress={() => setViewMode(mode)} style={[s.viewButton, { backgroundColor: viewMode === mode ? t.elevated : 'transparent' }]}><MaterialCommunityIcons name={mode === 'grid' ? 'view-grid-outline' : 'format-list-bulleted'} size={19} color={viewMode === mode ? t.accent : t.muted} /></GrowPress>)}</View>
        </View>
        {!!uid && status === 'active' && (due > 0 || !!care.error) && <Pressable accessibilityRole="button" accessibilityLabel="Open garden care checklist" onPress={() => router.push({ pathname: '/care', params: selected ? { gardenId: selected.id } : {} })} style={s.careSummary}><MaterialCommunityIcons name={care.error ? 'alert-circle-outline' : 'clock-outline'} size={17} color={due ? t.warm : t.muted} /><Text style={[s.hint, { flex: 1 }]}>{care.error ? 'Care status unavailable · Open checklist' : `${due} ${due === 1 ? 'check' : 'checks'} due`}</Text><MaterialCommunityIcons name="chevron-right" size={18} color={t.muted} /></Pressable>}
      </View>
      {!ready ? <View style={{ paddingHorizontal: 18, paddingTop: 12 }}><PlantListSkeleton label="Opening your garden…" /></View> : <View style={{ flex: 1, position: 'relative', marginTop: 6 }}><PlantListScreen key={listKey}
        viewMode={viewMode} options={options} onResetFilters={resetOptions} garden={selected} searchQuery={query} setSearchQuery={changeQuery} statusFilter={status} setStatusFilter={changeStatus}
        initialOffset={readGardenListView(uid, listKey).offset} onOffsetChange={value => saveGardenScrollOffset(uid, listKey, value)}
        footer={<View style={s.footer}>
          {!gardens.length && <Pressable accessibilityRole="button" onPress={openCreate} style={s.tool}><MaterialCommunityIcons name="sprout-outline" size={22} color={t.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.link}>Make a home for your plants</Text><Text style={s.hint}>Create a garden for your patio, tent or greenhouse.</Text></View><MaterialCommunityIcons name="plus" size={20} color={t.accent} /></Pressable>}
          {!!selected && unassigned > 0 && <Pressable accessibilityRole="button" onPress={() => choose({ kind: 'all' })} style={s.textButton}><Text style={s.hint}>{unassigned} {unassigned === 1 ? 'plant is' : 'plants are'} outside a garden. <Text style={s.link}>View all plants →</Text></Text></Pressable>}
        </View>}
      /><LinearGradient pointerEvents="none" colors={[t.background, `${t.background}00`]} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 1 }} /></View>}
      {filterAnchor && <PlantFilterMenu anchor={filterAnchor} key={listKey} options={options} status={status} plants={scopedPlants} query={query} showEnvironment={!selected} onApply={applyOptions} onClose={() => { setFilterAnchor(null); filterTrigger.current?.focus?.(); }} />}
      {actionsAnchor && <AnchoredActionMenu anchor={actionsAnchor} title={selected?.name || 'Your plants'} horizontal tone="hero" onClose={() => setActionsAnchor(null)} actions={[
        ...(selected ? [
          { label: 'Garden settings', icon: 'tune-variant', onPress: () => setEditing(selected) },
          { label: 'Manage plants', icon: 'sprout-outline', onPress: () => router.push({ pathname: '/group/[id]', params: { id: selected.id } }) },
          { label: 'Log garden watering', icon: 'water-outline', onPress: () => setWatering(selected) },
        ] satisfies MenuAction[] : []),
        { label: status === 'active' ? 'Past plants' : 'Back to active plants', accessibilityLabel: status === 'active' ? 'View past plants' : 'View active plants', icon: status === 'active' ? 'archive-outline' : 'sprout-outline', separate: !!selected, onPress: () => changeStatus(status === 'active' ? 'past' : 'active') },
      ]} />}
      <EditGroupModal visible={!!editing} settingsOnly group={editing} allPlants={collection.plants} onClose={() => setEditing(null)} onSave={async (updated, baseline) => { await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>); setMessage('Garden settings saved.'); }} />
      {watering && <ActionDialog title="Log garden watering" description={`Record completed watering for active plants in ${watering.name}. Already-watered plants are skipped. This action supports gardens of up to ${MAX_ATOMIC_WATERING_PLANTS} plants; use individual watering forms for larger gardens.`} confirmLabel="Save garden watering" onClose={() => setWatering(null)} onConfirm={async () => { const result = await waterGrowingSpace(watering.id); setMessage(`${result.written.length} watering records saved · ${result.skipped} skipped.`); }} />}
      {creating && <CreateGardenSheet onClose={() => setCreating(false)} onCreated={id => {
        pendingGarden.current = id; setSelection({ kind: 'garden', id });
        preferenceWrites.current = preferenceWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ kind: 'garden', id }))).catch(() => setMessage('Garden created. This device could not remember the selection.'));
      }} />}
    </SafeAreaView>
  </View>;
}

const makeStyles = (t: typeof gardenThemes.grove) => StyleSheet.create({
  safeArea: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  top: { paddingHorizontal: 18, paddingTop: 6, gap: 8 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  section: { color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  add: { minHeight: gardenControls.height, borderRadius: gardenControls.radius, backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, gap: 4 },
  addText: { color: t.onAccent, fontWeight: '600', fontSize: gardenControls.labelSize },
  viewSwitch: { flexDirection: 'row', gap: 2, borderRadius: 10, padding: 2, backgroundColor: t.surface },
  viewButton: { width: 34, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: t.surface, paddingLeft: 10, marginBottom: 8 },
  input: { flex: 1, minWidth: 0, minHeight: gardenControls.height, paddingHorizontal: 8, color: t.text, fontSize: 16 },
  clear: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  loading: { padding: 28, alignItems: 'center', gap: 12 },
  hint: { fontSize: 13, color: t.muted, lineHeight: 20 },
  link: { fontSize: 14, color: t.accent, fontWeight: '600' },
  notice: { padding: 14, borderRadius: 14, backgroundColor: t.surface },
  textButton: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  footer: { gap: 8, paddingTop: 8, paddingBottom: 16 },
  tool: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#40523a', flexDirection: 'row', alignItems: 'center', gap: 12 },
  careSummary: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: -8 },
});
