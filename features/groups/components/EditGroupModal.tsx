import { sameLocation } from '@/features/location/locationState';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, View, StyleSheet, TextInput, ScrollView, Pressable, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { GroupWithId } from '../api/groupApi';
import type { PlantWithId } from '../hooks/useGroupDetail';
import { CollectionButton, ink } from './CollectionUI';
import { groupEditValues } from '../groupCollection';
import { useReducedMotion } from '@/ui/GrowMotion';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import LocationPicker from '@/features/location/LocationPicker';

interface EditGroupModalProps {
  visible: boolean;
  group: GroupWithId | null;
  allPlants: PlantWithId[];
  onClose: () => void;
  onSave?: (updatedGroup: GroupWithId, baseline: GroupWithId) => void | Promise<void>;
}

export default function EditGroupModal({ visible, group, allPlants, onClose, onSave }: EditGroupModalProps) {
  const [name, setName] = useState('');
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [location, setLocation] = useState<GroupWithId['location']>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const initial = useRef('');
  const opened = useRef<GroupWithId | null>(null);
  const fingerprint = JSON.stringify({ name, plantIds, source, location, locationLabel });
  const guard = useDiscardGuard(visible && !!initial.current && fingerprint !== initial.current);
  const lock = useRef(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!visible) { opened.current = null; return; }
    if (opened.current?.id === group?.id) return;
    opened.current = group;
    initial.current = JSON.stringify({ name: group?.name || '', plantIds: group?.plantIds || [], source: group?.weatherSourcePlantId || '', location: group?.location || null, locationLabel: group?.locationLabel || '' });
    setName(group?.name || '');
    setPlantIds(group?.plantIds || []);
    setSource(group?.weatherSourcePlantId || '');
    setLocation(group?.location || null); setLocationLabel(group?.locationLabel || '');
    setQuery('');
    setError('');
  }, [group, visible]);

  const choices = useMemo(() => allPlants.filter(p =>
    (plantIds.includes(p.id) || p.environment === group?.environment) &&
    (p.name || '').toLowerCase().includes(query.trim().toLowerCase())
  ), [allPlants, group?.environment, plantIds, query]);
  const memberPlants = useMemo(() => allPlants.filter(p => plantIds.includes(p.id)), [allPlants, plantIds]);

  const save = async () => {
    if (!group || !onSave || lock.current || locating) return;
    if (!name.trim()) { setError('Give your group a name before saving.'); return; }
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const edited = { ...group, name, plantIds, location, locationLabel, weatherSourcePlantId: source };
      await onSave({ ...edited, ...groupEditValues(edited) }, opened.current || group);
      guard.finish(onClose);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save. Your changes are still here; try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  if (!visible || !group) return null;
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { if (!saving) guard.requestClose(onClose); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <View accessibilityViewIsModal style={styles.modal}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
            <Text accessibilityRole="header" style={styles.title}>Edit collection</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close group editor" disabled={saving} onPress={() => guard.requestClose(onClose)} style={styles.close}><MaterialCommunityIcons name="close" size={22} color={ink.text} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <Text style={styles.label}>Group name</Text>
          <TextInput accessibilityLabel="Group name" value={name} onChangeText={setName} editable={!saving} maxLength={40} style={styles.input} placeholder="Give this space a name" placeholderTextColor={ink.muted} />
          <View style={styles.sectionRow}><Text style={styles.label}>Plants in this collection</Text><Text style={styles.count}>{plantIds.length} selected</Text></View>
          <Text style={styles.hint}>Adding a plant moves it from its previous growing space. Removing it keeps the plant and its history in your library.</Text>
          <TextInput accessibilityLabel="Search group members" value={query} onChangeText={setQuery} style={styles.input} placeholder="Find a plant…" placeholderTextColor={ink.muted} />
          {choices.map(plant => {
            const selected = plantIds.includes(plant.id);
            return <Pressable key={plant.id} disabled={saving} accessibilityRole="checkbox" accessibilityLabel={plant.name} accessibilityState={{ checked: selected }}
              onPress={() => setPlantIds(ids => selected ? ids.filter(id => id !== plant.id) : [...ids, plant.id])}
              style={({ pressed }) => [styles.plantRow, selected && styles.selected, pressed && { opacity: 0.75 }]}>
              <MaterialCommunityIcons name="leaf" size={20} color={ink.muted} />
              <Text style={styles.plantName}>{plant.name}</Text>
              <MaterialCommunityIcons name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} color={selected ? ink.lime : ink.muted} />
            </Pressable>;
          })}
          {!choices.length && <Text style={styles.hint}>{query ? 'No plants match that name.' : 'No matching plants are available. You can keep this collection empty.'}</Text>}
          <Text style={[styles.label, { marginTop: 12 }]}>Saved growing-space location</Text>
          <Text style={styles.hint}>This saved location can be reused by other plants. Plants set to follow this space move with it; their earlier weather records stay unchanged.</Text>
          <LocationPicker allowSaved={false} location={location} label={locationLabel} disabled={saving} onBusyChange={setLocating} onChange={(point, label) => { setLocation(point); setLocationLabel(label); }} />
          {!sameLocation(group.location, location) && <View style={{ gap: 8, padding: 12 }}><Text style={styles.label}>Location change preview</Text><Text style={styles.hint}>These plants will move: {memberPlants.filter(p => p.locationMode === 'space').map(p => p.name).join(', ') || 'None'}.</Text><Text style={styles.hint}>These plants keep their own pins: {memberPlants.filter(p => p.locationMode !== 'space').map(p => p.name).join(', ') || 'None'}. Previous days’ weather will stay unchanged.</Text></View>}
          <Text style={styles.label}>Group weather display</Text><Text style={styles.hint}>Display weather for the saved space location, or use a member’s individual location.</Text>
          {[{ id: '', name: 'Use group location' }, ...memberPlants.filter(p => p.location)].map(plant =>
            <Pressable key={plant.id} disabled={saving} accessibilityRole="radio" accessibilityLabel={plant.name === 'Use group location' ? plant.name : 'Use ' + plant.name + ' for weather'} accessibilityState={{ checked: source === plant.id }}
              onPress={() => setSource(plant.id)} style={styles.radio}>
              <MaterialCommunityIcons name={source === plant.id ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={source === plant.id ? ink.lime : ink.muted} />
              <Text style={styles.plantName}>{plant.name}</Text>
            </Pressable>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <CollectionButton label="Cancel" disabled={saving} onPress={() => guard.requestClose(onClose)} />
          <CollectionButton label={saving ? 'Saving…' : locating ? 'Finding location…' : 'Save changes'} primary disabled={saving || locating || !onSave} onPress={save} icon="check" />
        </View>
      </View>
      {guard.dialog}
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,16,11,0.78)', padding: 18, alignItems: 'center', justifyContent: 'center' },
  modal: { width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 28, borderWidth: 1, borderColor: ink.border, backgroundColor: ink.surface, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: ink.border },
  eyebrow: { color: ink.lime, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 7 },
  title: { color: ink.text, fontSize: 27, letterSpacing: -0.8, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 24, gap: 12 },
  label: { color: ink.text, fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: ink.border, backgroundColor: ink.background, color: ink.text, borderRadius: 14, minHeight: 50, paddingHorizontal: 14, fontSize: 15 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  count: { color: ink.lime, fontSize: 12 },
  hint: { color: ink.muted, fontSize: 12, lineHeight: 19 },
  plantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56, borderWidth: 1, borderColor: ink.border, borderRadius: 14 },
  selected: { backgroundColor: '#30442e', borderColor: '#70855a' },
  plantName: { color: ink.text, fontSize: 14, flex: 1 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  error: { color: '#f0b5a0', fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: ink.border },
});
