import React from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PlantEditorSheet from '@/features/plants/components/PlantEditorSheet';
import PlantActionButton from '@/features/plants/components/PlantActionButton';
import { gardenThemes } from '@/design-system/tokens/garden';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { updateGroup, type GroupWithId } from '../api/groupApi';
import { assertSpaceCapacity } from '../groupPolicy';
import type { Plant } from '@/firestoreModels';
import ManagePlantRow from './ManagePlantRow';

const t = gardenThemes.grove;
export default function AddExistingPlantsSheet({ group, plants, gardens, loading, error, onClose, onSaved }: { group: GroupWithId; plants: (Plant & { id: string })[]; gardens: GroupWithId[]; loading: boolean; error: string; onClose(): void; onSaved(count: number): void }) {
  const baseline = React.useRef(group).current;
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const lock = React.useRef(false);
  const guard = useDiscardGuard(selected.length > 0);
  const available = plants.filter(plant => plant.environment === group.environment && plant.groupId !== group.id && !group.plantIds.includes(plant.id));
  const shown = available.filter(plant => `${plant.name} ${plant.strain || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const save = async () => {
    if (lock.current || !selected.length || loading || error) return;
    lock.current = true; setBusy(true); setSaveError('');
    try {
      if (selected.some(id => !available.some(plant => plant.id === id))) throw new Error('Some selected plants changed. Close and reopen this list to review them.');
      const ids = [...new Set([...baseline.plantIds, ...selected])];
      assertSpaceCapacity(ids);
      await updateGroup(group.id, { plantIds: ids }, baseline as unknown as Record<string, unknown>);
      guard.finish(() => onSaved(selected.length));
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not add these plants. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <PlantEditorSheet title="Add existing plants" subtitle={group.name} theme={t} busy={busy} onClose={() => guard.requestClose(onClose)} contentGap={12} footer={<View style={{ gap: 10 }}>{!!saveError && <Text accessibilityRole="alert" style={{ color: t.danger }}>{saveError}</Text>}<PlantActionButton label={busy ? 'Adding plants…' : selected.length ? `Add ${selected.length} ${selected.length === 1 ? 'plant' : 'plants'}` : 'Select plants to add'} icon="plus" primary theme={t} busy={busy} disabled={!selected.length || loading || !!error} onPress={save} /></View>}>
    <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Choose {group.environment} plants. Plants in another garden will move here with their journal and photos.</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12 }}><MaterialCommunityIcons name="magnify" size={21} color={t.muted} /><TextInput accessibilityLabel="Search existing plants" placeholder="Search plants…" placeholderTextColor={t.muted} value={query} onChangeText={setQuery} editable={!busy} style={{ flex: 1, minWidth: 0, minHeight: 48, color: t.text, fontSize: 16 }} /></View>
    {loading ? <ActivityIndicator color={t.accent} accessibilityLabel="Loading existing plants" /> : error ? <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text> : !shown.length ? <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21, paddingVertical: 16 }}>{query ? 'No plants match this search.' : `No other ${group.environment} plants are available. Create a new plant to grow this garden.`}</Text> : <View>{shown.map(plant => {
      const source = gardens.find(garden => plant.groupId ? garden.id === plant.groupId : garden.plantIds.includes(plant.id));
      return <ManagePlantRow key={plant.id} plant={plant} selected={selected.includes(plant.id)} disabled={busy} subtitle={source ? `Currently in ${source.name}` : 'Not in a garden'} onToggle={() => { setSaveError(''); setSelected(previous => previous.includes(plant.id) ? previous.filter(id => id !== plant.id) : [...previous, plant.id]); }} />;
    })}</View>}
    {guard.dialog}
  </PlantEditorSheet>;
}
