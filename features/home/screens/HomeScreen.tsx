import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import PlantListScreen from '@/features/plants/screens/PlantListScreen';
import { gardenThemes } from '@/design-system/tokens/garden';
import { AppHeader } from '@/ui/AppHeader';
import ActionDialog from '@/ui/ActionDialog';
import { GrowPress } from '@/ui/GrowMotion';
import HomeBackground from '../components/HomeBackground';
import GardenDropdown from '../components/GardenDropdown';
import CreateGardenSheet from '../components/CreateGardenSheet';
import { decodeGardenSelection, plantsInGarden, resolveGardenSelection, type GardenSelection } from '../gardenSelection';
import type { Plant } from '@/firestoreModels';
import { useCareTasks } from '@/features/care/useCareTasks';
import { readGardenListView, saveGardenListView, saveGardenScrollOffset } from '@/services/homeGardenView';
import { matchesPlantStatus } from '@/features/plants/plantListPresentation';
import PlantEditorSheet from '@/features/plants/components/PlantEditorSheet';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import MovePlantDialog from '@/features/groups/components/MovePlantDialog';
import { updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { groupEditValues } from '@/features/groups/groupCollection';
import { waterGrowingSpace } from '@/lib/logs/groupWatering';
import { useGardenWeatherCollection } from '../useGardenWeatherCollection';
import { MAX_ATOMIC_WATERING_PLANTS } from '@/features/groups/groupPolicy';

const t = gardenThemes.grove;
export default function HomeScreen(_props: { initialTabIndex?: number }) {
  const { user, loading } = useSession();
  // Reset viewing preferences synchronously when the account changes.
  return <GardenHome key={user?.uid || 'signed-out'} uid={user?.uid} accountLoading={loading} />;
}

function GardenHome({ uid, accountLoading }: { uid?: string; accountLoading: boolean }) {
  const router = useRouter();
  const spaces = useOwnedGroups();
  const collection = usePlantList();
  const [selection, setSelection] = React.useState<GardenSelection | null>(null);
  const [preferenceReady, setPreferenceReady] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<string | null>('active');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GroupWithId | null>(null);
  const [watering, setWatering] = React.useState<GroupWithId | null>(null);
  const [moving, setMoving] = React.useState<(Plant & { id: string }) | null>(null);
  const offset = React.useRef(0);
  const lastScope = React.useRef('');
  const pendingGarden = React.useRef<string | null>(null);
  const storageKey = `weedgrow.home-garden.v1.${uid || 'device'}`;
  const preferenceWrites = React.useRef(Promise.resolve());
  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => { if (active) { const next = decodeGardenSelection(raw); setSelection(next); if (next) { const view = readGardenListView(uid, next.kind === 'garden' ? next.id : 'all'); setQuery(view.query); setStatus(view.status); offset.current = view.offset; } } }).catch(() => {}).finally(() => { if (active) setPreferenceReady(true); });
    return () => { active = false; };
  }, [storageKey, uid]);
  const gardens = React.useMemo(() => [...spaces.groups].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [spaces.groups]);
  const weatherCollection = useGardenWeatherCollection(gardens, uid);
  React.useEffect(() => {
    if (!preferenceReady || (spaces.status !== 'ready' && spaces.status !== 'refreshing') || spaces.error) return;
    if (selection?.kind === 'garden' && pendingGarden.current === selection.id && !gardens.some(garden => garden.id === selection.id)) return;
    const next = resolveGardenSelection(selection, gardens);
    if (next !== selection) { const view = readGardenListView(uid, next.kind === 'garden' ? next.id : 'all'); setQuery(view.query); setStatus(view.status); offset.current = view.offset; setSelection(next); }
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
    offset.current = view.offset; setQuery(view.query); setStatus(view.status); setSelection(value); setMessage('');
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
    lastScope.current = listKey; offset.current = view.offset; setQuery(view.query); setStatus(view.status);
  }, [listKey, uid, preferenceReady]);
  const remember = (nextQuery: string, nextStatus: string | null, nextOffset: number) => {
    offset.current = nextOffset; saveGardenListView(uid, listKey, { query: nextQuery, status: nextStatus, offset: nextOffset });
  };
  const changeQuery = (value: string) => { setQuery(value); remember(value, status, 0); };
  const changeStatus = (value: string | null) => { setStatus(value); remember(query, value, 0); };
  const refresh = () => { spaces.refresh(); collection.refresh(); };

  return <View style={{ flex: 1, backgroundColor: t.background }}>
    <HomeBackground />
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safeArea}>
      <AppHeader />
      <View style={s.top}>
        <GardenDropdown gardens={gardens} selection={resolved} counts={counts} total={collection.plants.length} countsReady={!collection.loading && !collection.error} onSelect={choose} onCreate={openCreate} onActions={() => setActionsOpen(true)} disabled={!ready} />
        {!uid && !accountLoading && <View style={s.notice}><Text style={s.hint}>Sign in to see your plants, or start a plant draft.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={s.textButton}><Text style={s.link}>Sign in or create an account →</Text></Pressable></View>}
        {!!spaces.error && <Pressable accessibilityRole="button" onPress={refresh} style={s.notice}><Text style={{ color: t.danger }}>{spaces.error} Tap to retry.</Text></Pressable>}
        {!!selected && !!weatherCollection.errors[selected.id] && <Pressable accessibilityRole="button" accessibilityLabel="Retry garden weather collection" onPress={() => void weatherCollection.retry(selected.id)} style={s.notice}><Text style={s.hint}>Weather collection needs attention. {weatherCollection.errors[selected.id]} <Text style={s.link}>Retry →</Text></Text></Pressable>}
        {!!message && <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text>}
        <View style={s.listHeading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={s.section}>{status === 'active' ? 'Your plants' : 'Past plants'}</Text><View style={s.count}><Text style={s.countText}>{collection.loading ? '—' : scopedPlants.filter(plant => matchesPlantStatus(plant, status || 'past')).length}</Text></View></View>
          <GrowPress accessibilityRole="button" accessibilityLabel={selected ? `Add plant to ${selected.name}` : 'Add plant'} disabled={!ready} onPress={addPlant} style={s.add}><MaterialCommunityIcons name="plus" size={19} color={t.onAccent} /><Text style={s.addText}>Add plant</Text></GrowPress>
        </View>
        {!!uid && status === 'active' && (due > 0 || !!care.error) && <Pressable accessibilityRole="button" accessibilityLabel="Open garden care checklist" onPress={() => router.push({ pathname: '/care', params: selected ? { gardenId: selected.id } : {} })} style={s.careSummary}><MaterialCommunityIcons name={care.error ? 'alert-circle-outline' : 'clock-outline'} size={17} color={due ? t.warm : t.muted} /><Text style={[s.hint, { flex: 1 }]}>{care.error ? 'Care status unavailable · Open checklist' : `${due} ${due === 1 ? 'check' : 'checks'} due`}</Text><MaterialCommunityIcons name="chevron-right" size={18} color={t.muted} /></Pressable>}
        <View style={s.search}><MaterialCommunityIcons name="magnify" color={t.muted} size={21} /><TextInput accessibilityLabel="Search plants by name or strain" placeholder={selected ? 'Search this garden…' : 'Search your plants…'} placeholderTextColor={t.muted} value={query} onChangeText={changeQuery} returnKeyType="search" style={s.input} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={() => changeQuery('')} style={s.clear}><MaterialCommunityIcons name="close" size={20} color={t.muted} /></Pressable>}</View>
      </View>
      {!ready ? <View style={s.loading}><ActivityIndicator color={t.accent} /><Text style={s.hint}>Opening your garden…</Text></View> : <PlantListScreen key={listKey}
        garden={selected} searchQuery={query} setSearchQuery={changeQuery} statusFilter={status} setStatusFilter={changeStatus} onMovePlant={setMoving}
        initialOffset={readGardenListView(uid, listKey).offset} onOffsetChange={value => saveGardenScrollOffset(uid, listKey, value)}
        footer={<View style={s.footer}>
          {!gardens.length && <Pressable accessibilityRole="button" onPress={openCreate} style={s.tool}><MaterialCommunityIcons name="sprout-outline" size={22} color={t.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.link}>Make a home for your plants</Text><Text style={s.hint}>Create a garden for your patio, tent or greenhouse.</Text></View><MaterialCommunityIcons name="plus" size={20} color={t.accent} /></Pressable>}
          {!!selected && unassigned > 0 && <Pressable accessibilityRole="button" onPress={() => choose({ kind: 'all' })} style={s.textButton}><Text style={s.hint}>{unassigned} {unassigned === 1 ? 'plant is' : 'plants are'} outside a garden. <Text style={s.link}>View all plants →</Text></Text></Pressable>}
        </View>}
      />}
      {actionsOpen && <PlantEditorSheet title={selected?.name || 'Your plants'} subtitle={selected ? 'Garden actions' : 'Plant collection'} theme={t} onClose={() => setActionsOpen(false)}>
        {selected && [{ label: 'Garden settings', icon: 'tune-variant', action: () => setEditing(selected) }, { label: 'Manage plants', icon: 'sprout-outline', action: () => router.push({ pathname: '/group/[id]', params: { id: selected.id } }) }, { label: 'Log garden watering', icon: 'water-outline', action: () => setWatering(selected) }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => { setActionsOpen(false); item.action(); }} style={s.menuRow}><MaterialCommunityIcons name={item.icon as 'tune-variant' | 'sprout-outline' | 'water-outline'} size={22} color={t.accent} /><Text style={s.menuText}>{item.label}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={t.muted} /></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel={status === 'active' ? 'View past plants' : 'View active plants'} onPress={() => { changeStatus(status === 'active' ? 'past' : 'active'); setActionsOpen(false); }} style={[s.menuRow, { marginTop: selected ? 12 : 0 }]}><MaterialCommunityIcons name={status === 'active' ? 'archive-outline' : 'sprout-outline'} size={21} color={t.muted} /><Text style={[s.menuText, { color: t.muted }]}>{status === 'active' ? 'Past plants' : 'Back to active plants'}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={t.muted} /></Pressable>
      </PlantEditorSheet>}
      <EditGroupModal visible={!!editing} settingsOnly group={editing} allPlants={collection.plants} onClose={() => setEditing(null)} onSave={async (updated, baseline) => { await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>); setMessage('Garden settings saved.'); }} />
      {watering && <ActionDialog title="Log garden watering" description={`Record completed watering for active plants in ${watering.name}. Already-watered plants are skipped. This action supports gardens of up to ${MAX_ATOMIC_WATERING_PLANTS} plants; use individual watering forms for larger gardens.`} confirmLabel="Save garden watering" onClose={() => setWatering(null)} onConfirm={async () => { const result = await waterGrowingSpace(watering.id); setMessage(`${result.written.length} watering records saved · ${result.skipped} skipped.`); }} />}
      {moving && <MovePlantDialog plant={moving} gardens={gardens} onClose={() => setMoving(null)} onMoved={destination => setMessage(`${moving.name} moved to ${destination}.`)} />}
      {creating && <CreateGardenSheet onClose={() => setCreating(false)} onCreated={id => {
        pendingGarden.current = id; setSelection({ kind: 'garden', id });
        preferenceWrites.current = preferenceWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ kind: 'garden', id }))).catch(() => setMessage('Garden created. This device could not remember the selection.'));
      }} />}
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  safeArea: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  top: { paddingHorizontal: 18, paddingTop: 8, gap: 10 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 4 },
  section: { color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  count: { minWidth: 26, paddingHorizontal: 7, minHeight: 26, borderRadius: 9, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' },
  countText: { color: t.accent, fontSize: 12, fontWeight: '700' },
  add: { borderRadius: 14, backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, gap: 6 },
  addText: { color: t.onAccent, fontWeight: '700', fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: t.surface, paddingLeft: 14, marginBottom: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, color: t.text, fontSize: 15 },
  clear: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center' },
  loading: { padding: 28, alignItems: 'center', gap: 12 },
  hint: { fontSize: 13, color: t.muted, lineHeight: 20 },
  link: { fontSize: 14, color: t.accent, fontWeight: '600' },
  notice: { padding: 14, borderRadius: 14, backgroundColor: t.surface },
  textButton: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  footer: { gap: 8, paddingTop: 8, paddingBottom: 16 },
  tool: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#40523a', flexDirection: 'row', alignItems: 'center', gap: 12 },
  careSummary: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: -8 },
  menuRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: '#344735' },
  menuText: { color: t.text, fontSize: 16, flex: 1 },
});
