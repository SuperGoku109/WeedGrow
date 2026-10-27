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
import { decodeGardenSelection, plantsInGarden, resolveGardenSelection, type GardenSelection } from '../gardenSelection';
import { createGarden, newGardenId } from '../api/createGarden';
import type { Group } from '@/firestoreModels';

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
  const [name, setName] = React.useState('');
  const [environment, setEnvironment] = React.useState<Group['environment']>('outdoor');
  const [requestId, setRequestId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const pendingGarden = React.useRef<string | null>(null);
  const storageKey = `weedgrow.home-garden.v1.${uid || 'device'}`;
  const preferenceWrites = React.useRef(Promise.resolve());
  React.useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => { if (active) setSelection(decodeGardenSelection(raw)); }).catch(() => {}).finally(() => { if (active) setPreferenceReady(true); });
    return () => { active = false; };
  }, [storageKey]);
  const gardens = React.useMemo(() => [...spaces.groups].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [spaces.groups]);
  React.useEffect(() => {
    if (!preferenceReady || spaces.loading || spaces.error) return;
    if (selection?.kind === 'garden' && pendingGarden.current === selection.id && !gardens.some(garden => garden.id === selection.id)) return;
    const next = resolveGardenSelection(selection, gardens);
    if (next !== selection) setSelection(next);
  }, [gardens, preferenceReady, spaces.loading, spaces.error, selection]);
  const resolved = resolveGardenSelection(selection, gardens);
  const selected = resolved.kind === 'garden' ? gardens.find(item => item.id === resolved.id) || null : null;
  const scopedPlants = React.useMemo(() => plantsInGarden(collection.plants, selected), [collection.plants, selected]);
  const counts = React.useMemo(() => Object.fromEntries(gardens.map(garden => [garden.id, plantsInGarden(collection.plants, garden).filter(plant => plant.status === 'active').length])), [gardens, collection.plants]);
  const ready = preferenceReady && !accountLoading && !spaces.loading;
  const choose = (value: GardenSelection) => {
    setSelection(value); setQuery(''); setStatus('active'); setMessage('');
    preferenceWrites.current = preferenceWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify(value))).catch(() => setMessage('Your garden is open. This device could not remember the selection.'));
  };
  React.useEffect(() => {
    const id = pendingGarden.current;
    if (id && gardens.some(garden => garden.id === id)) { pendingGarden.current = null; setSelection({ kind: 'garden', id }); }
  }, [gardens]);
  const addPlant = () => router.push({ pathname: '/add-plant', params: selected ? { gardenId: selected.id } : {} });
  const openCreate = () => {
    if (!uid) { router.push('/account'); return; }
    setName(''); setEnvironment('outdoor'); setRequestId(newGardenId()); setCreating(true);
  };
  const unassigned = collection.plants.filter(plant => !plant.groupId && !gardens.some(garden => garden.plantIds.includes(plant.id))).length;
  const listKey = selected?.id || 'all';
  const refresh = () => { spaces.refresh(); collection.refresh(); };

  return <View style={{ flex: 1, backgroundColor: t.background }}>
    <HomeBackground />
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safeArea}>
      <AppHeader />
      <View style={s.top}>
        <GardenDropdown gardens={gardens} selection={resolved} counts={counts} total={collection.plants.length} countsReady={!collection.loading && !collection.error} onSelect={choose} onCreate={openCreate} disabled={!ready} />
        {!uid && !accountLoading && <View style={s.notice}><Text style={s.hint}>Sign in to see your plants, or start a plant draft.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={s.textButton}><Text style={s.link}>Sign in or create an account →</Text></Pressable></View>}
        {!!spaces.error && <Pressable accessibilityRole="button" onPress={refresh} style={s.notice}><Text style={{ color: t.danger }}>{spaces.error} Tap to retry.</Text></Pressable>}
        {!!message && <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text>}
        <View style={s.listHeading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={s.section}>Your plants</Text><View style={s.count}><Text style={s.countText}>{collection.loading ? '—' : scopedPlants.filter(plant => !status || plant.status === status).length}</Text></View></View>
          <GrowPress accessibilityRole="button" accessibilityLabel={selected ? `Add plant to ${selected.name}` : 'Add plant'} disabled={!ready} onPress={addPlant} style={s.add}><MaterialCommunityIcons name="plus" size={19} color={t.onAccent} /><Text style={s.addText}>Add plant</Text></GrowPress>
        </View>
        <View style={s.search}><MaterialCommunityIcons name="magnify" color={t.muted} size={21} /><TextInput accessibilityLabel="Search plants by name or strain" placeholder={selected ? 'Search this garden…' : 'Search your plants…'} placeholderTextColor={t.muted} value={query} onChangeText={setQuery} returnKeyType="search" style={s.input} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={() => setQuery('')} style={s.clear}><MaterialCommunityIcons name="close" size={20} color={t.muted} /></Pressable>}</View>
      </View>
      {!ready ? <View style={s.loading}><ActivityIndicator color={t.accent} /><Text style={s.hint}>Opening your garden…</Text></View> : <PlantListScreen key={listKey}
        garden={selected} onAddPlant={addPlant} searchQuery={query} setSearchQuery={setQuery} statusFilter={status} setStatusFilter={setStatus}
        envFilter={null} setEnvFilter={() => {}} plantedFilter={null} setPlantedFilter={() => {}} trainingFilter={null} setTrainingFilter={() => {}} filtersVisible={false} setFiltersVisible={() => {}}
        footer={<View style={s.footer}>
          {selected ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/group/[id]', params: { id: selected.id } })} style={s.tool}><MaterialCommunityIcons name="tune-variant" size={20} color={t.accent} /><View style={{ flex: 1, gap: 3 }}><Text style={s.link}>Garden tools</Text><Text style={s.hint}>Manage plants and record garden watering</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={t.muted} /></Pressable> : !gardens.length && <Pressable accessibilityRole="button" onPress={openCreate} style={s.tool}><MaterialCommunityIcons name="sprout-outline" size={22} color={t.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.link}>Make a home for your plants</Text><Text style={s.hint}>Create a garden for your patio, tent or greenhouse.</Text></View><MaterialCommunityIcons name="plus" size={20} color={t.accent} /></Pressable>}
          {!!selected && unassigned > 0 && <Pressable accessibilityRole="button" onPress={() => choose({ kind: 'all' })} style={s.textButton}><Text style={s.hint}>{unassigned} {unassigned === 1 ? 'plant is' : 'plants are'} outside a garden. <Text style={s.link}>View all plants →</Text></Text></Pressable>}
        </View>}
      />}
      {creating && <ActionDialog title="Create a garden" description="A little space of your own. Add its location and other details whenever you're ready." confirmLabel="Create garden" onClose={() => setCreating(false)} onConfirm={async () => {
        const id = await createGarden(requestId, name, environment);
        pendingGarden.current = id; setSelection({ kind: 'garden', id });
        preferenceWrites.current = preferenceWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ kind: 'garden', id }))).catch(() => setMessage('Garden created. This device could not remember the selection.'));
      }}>{busy => <View style={{ gap: 16 }}><Text style={s.label}>Garden name</Text><TextInput accessibilityLabel="Garden name" placeholder="e.g. My garden, Patio, Flower tent" placeholderTextColor={t.muted} maxLength={100} value={name} onChangeText={setName} editable={!busy} style={[s.input, s.nameInput]} /><Text style={s.label}>Growing environment</Text><View style={{ gap: 8 }}>{(['outdoor', 'indoor', 'greenhouse'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: environment === value, disabled: busy }} disabled={busy} onPress={() => setEnvironment(value)} style={[s.environment, environment === value && { borderColor: t.accent, backgroundColor: t.elevated }]}><Text style={{ color: environment === value ? t.accent : t.text, textTransform: 'capitalize', fontSize: 15 }}>{value}</Text>{environment === value && <MaterialCommunityIcons name="check" color={t.accent} size={20} />}</Pressable>)}</View></View>}</ActionDialog>}
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  safeArea: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  top: { paddingHorizontal: 18, paddingTop: 8, gap: 14 },
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
  label: { color: t.text, fontSize: 14, fontWeight: '600' },
  nameInput: { flex: 0, borderWidth: 1, borderColor: t.border, borderRadius: 12 },
  environment: { minHeight: 48, borderWidth: 1, borderColor: '#52684b', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
