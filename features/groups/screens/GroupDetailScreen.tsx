import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import { gardenThemes } from '@/design-system/tokens/garden';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { useGroupDetail } from '../hooks/useGroupDetail';
import { updateGroup, type GroupWithId } from '../api/groupApi';
import { groupEditValues } from '../groupCollection';
import { MAX_ATOMIC_WATERING_PLANTS } from '../groupPolicy';
import { waterGrowingSpace } from '@/lib/logs/groupWatering';
import AnchoredActionMenu, { OverflowMenuButton, type MenuAnchor } from '@/ui/AnchoredActionMenu';
import ActionDialog from '@/ui/ActionDialog';
import PlantActionButton from '@/features/plants/components/PlantActionButton';
import EditGroupModal from '../components/EditGroupModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import MovePlantDialog from '../components/MovePlantDialog';
import ManagePlantRow from '../components/ManagePlantRow';
import AddExistingPlantsSheet from '../components/AddExistingPlantsSheet';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
type Member = Plant & { id: string };
export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { group, plants, loading, error, refreshGroup, editVisible, setEditVisible, deleting, deleteError, handleDeleteGroup, confirmDeleteVisible, cancelDeleteGroup, confirmDeleteGroup } = useGroupDetail(id);
  const collection = usePlantList();
  const spaces = useOwnedGroups();
  const [query, setQuery] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [moving, setMoving] = React.useState<Member | null>(null);
  const [removing, setRemoving] = React.useState<{ plant: Member; baseline: GroupWithId } | null>(null);
  const [menu, setMenu] = React.useState<MenuAnchor | null>(null);
  const [watering, setWatering] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const shown = plants.filter(plant => `${plant.name} ${plant.strain || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const unavailable = loading || !!error;
  const newPlant = () => router.push({ pathname: '/add-plant', params: { gardenId: id } });
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={s.safe}>
    <View style={s.page}>
      <View style={s.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to garden" onPress={() => router.replace('/')} style={s.back}><MaterialCommunityIcons name="arrow-left" size={22} color={t.text} /><Text style={{ color: t.text, fontSize: 14 }}>Garden</Text></Pressable>
        <Text accessibilityRole="header" style={s.screenTitle}>Manage plants</Text>
        {group && <OverflowMenuButton label={`Garden actions for ${group.name}`} horizontal expanded={!!menu} onOpen={setMenu} />}
      </View>
      {!group ? <View style={s.empty}>{loading ? <ActivityIndicator color={t.accent} /> : <MaterialCommunityIcons name="sprout-outline" size={30} color={t.accent} />}<Text style={s.emptyTitle}>{loading ? 'Opening your garden…' : error || 'Garden not found'}</Text>{!!error && <PlantActionButton label="Try again" icon="refresh" theme={t} onPress={refreshGroup} />}</View> : <>
        {!!error && <Pressable accessibilityRole="button" accessibilityLabel="Retry loading garden plants" onPress={refreshGroup} style={s.error}><Text style={{ color: t.danger, lineHeight: 20 }}>{error} · Tap to retry</Text></Pressable>}
        <FlatList data={shown} keyExtractor={plant => plant.id} showsVerticalScrollIndicator={false} refreshing={loading} onRefresh={refreshGroup} contentContainerStyle={s.list}
          ListHeaderComponent={<View style={{ gap: 14, marginBottom: 12 }}>
            <View style={s.garden}><View style={{ flex: 1, gap: 5 }}><Text accessibilityRole="header" style={s.gardenName}>{group.name}</Text><Text style={s.gardenMeta}>{group.environment.charAt(0).toUpperCase() + group.environment.slice(1)} · {plants.length} {plants.length === 1 ? 'plant' : 'plants'}</Text></View><View style={s.gardenIcon}><MaterialCommunityIcons name="sprout-outline" size={28} color={t.heroText} /></View></View>
            <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><PlantActionButton label="Add existing" compact primary icon="plus" theme={t} disabled={unavailable} onPress={() => setAdding(true)} /></View><View style={{ flex: 1 }}><PlantActionButton label="New plant" compact icon="sprout-outline" theme={t} disabled={unavailable} onPress={newPlant} /></View></View>
            <View style={s.search}><MaterialCommunityIcons name="magnify" color={t.muted} size={21} /><TextInput accessibilityLabel="Search garden plants" placeholder="Search plants…" placeholderTextColor={t.muted} value={query} onChangeText={setQuery} style={s.input} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={() => setQuery('')} style={s.clear}><MaterialCommunityIcons name="close" size={20} color={t.muted} /></Pressable>}</View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={s.listTitle}>Plants in this garden</Text><Text style={s.hint}>{query ? `${shown.length} of ${plants.length}` : plants.length}</Text></View>
          </View>}
          renderItem={({ item }) => <ManagePlantRow plant={item} disabled={unavailable} onOpen={() => router.push({ pathname: '/plant/[id]', params: { id: item.id, fromGroupId: id } })} onMove={unavailable ? undefined : () => setMoving(item)} onRemove={unavailable ? undefined : () => setRemoving({ plant: item, baseline: group })} />}
          ListEmptyComponent={<View style={s.empty}><MaterialCommunityIcons name={query ? 'magnify' : 'sprout-outline'} size={30} color={t.accent} /><Text style={s.emptyTitle}>{query ? 'No matching plants' : 'Ready for your plants'}</Text><Text style={[s.hint, { textAlign: 'center' }]}>{query ? 'Try another name or strain.' : 'Add an existing plant or start a new one above.'}</Text></View>}
          ListFooterComponent={plants.length ? <Text style={[s.hint, { paddingTop: 4, paddingBottom: 12 }]}>Removing a plant from this garden keeps its journal and photos.</Text> : null}
        />
        {menu && <AnchoredActionMenu anchor={menu} title={group.name} horizontal onClose={() => setMenu(null)} actions={[
          { label: 'Garden settings', icon: 'tune-variant', onPress: () => setEditVisible(true) },
          { label: 'Log garden watering', icon: 'water-outline', onPress: () => setWatering(true) },
          { label: 'Delete garden', icon: 'trash-can-outline', danger: true, separate: true, onPress: handleDeleteGroup },
        ]} />}
        {adding && <AddExistingPlantsSheet group={group} plants={collection.plants} gardens={spaces.groups} loading={collection.loading} error={collection.error || ''} onClose={() => setAdding(false)} onSaved={count => { setAdding(false); setMessage(`${count} ${count === 1 ? 'plant added' : 'plants added'} to ${group.name}.`); }} />}
        {moving && <MovePlantDialog plant={moving} gardens={spaces.groups} onClose={() => setMoving(null)} onMoved={name => setMessage(`${moving.name} moved to ${name}.`)} />}
        {removing && <ActionDialog title="Remove from garden?" description={`${removing.plant.name} will no longer belong to ${group.name}. The plant, its journal and photos will stay in your collection.`} confirmLabel="Remove from garden" onClose={() => setRemoving(null)} onConfirm={async () => { await updateGroup(group.id, { plantIds: removing.baseline.plantIds.filter(plantId => plantId !== removing.plant.id) }, removing.baseline as unknown as Record<string, unknown>); setMessage(`${removing.plant.name} removed from ${group.name}.`); }} />}
        {watering && <ActionDialog title="Log garden watering" description={`Confirm you watered the active plants in this garden. Already-recorded plants are skipped. Gardens of up to ${MAX_ATOMIC_WATERING_PLANTS} plants are supported. Use individual watering for larger gardens.`} confirmLabel="Save garden watering" onClose={() => setWatering(false)} onConfirm={async () => { const result = await waterGrowingSpace(String(id)); setMessage(`${result.written.length} watering records saved · ${result.skipped} skipped.`); }} />}
        <EditGroupModal settingsOnly visible={editVisible} group={group} allPlants={collection.plants} onClose={() => setEditVisible(false)} onSave={async (updated, baseline) => { await updateGroup(updated.id, groupEditValues(updated), baseline as unknown as Record<string, unknown>); setEditVisible(false); setMessage('Garden settings saved.'); }} />
        <ConfirmDeleteModal loading={deleting} error={deleteError} visible={confirmDeleteVisible} onCancel={cancelDeleteGroup} onConfirm={confirmDeleteGroup} title="Delete garden" subtitle="This will remove the garden but keep your plants safe." />
      </>}
      <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={6000}>{message}</Snackbar>
    </View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  screenTitle: { flex: 1, color: t.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  list: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20 },
  garden: { padding: 16, borderRadius: 20, backgroundColor: t.hero, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gardenName: { color: t.heroText, fontSize: 25, fontWeight: '700', lineHeight: 31, letterSpacing: -0.6 },
  gardenMeta: { color: '#526344', fontSize: 13, lineHeight: 19 },
  gardenIcon: { width: 48, height: 48, backgroundColor: '#dce6c4', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  hint: { color: t.muted, fontSize: 13, lineHeight: 20 },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: t.surface, paddingLeft: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, color: t.text, fontSize: 16 },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  listTitle: { color: t.text, fontSize: 14, fontWeight: '600' },
  empty: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: t.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  error: { paddingHorizontal: 18, paddingVertical: 10 },
});
