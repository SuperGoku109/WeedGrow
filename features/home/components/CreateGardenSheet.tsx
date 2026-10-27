import React from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import PlantEditorSheet from '@/features/plants/components/PlantEditorSheet';
import LocationPicker from '@/features/location/LocationPicker';
import { validCoordinates, type Coordinates } from '@/features/location/locationService';
import { gardenThemes } from '@/design-system/tokens/garden';
import { GrowPress } from '@/ui/GrowMotion';
import type { Group } from '@/firestoreModels';
import { createGarden, newGardenId } from '../api/createGarden';
import GardenEnvironmentDropdown from './GardenEnvironmentDropdown';

const t = gardenThemes.grove;
export default function CreateGardenSheet({ onClose, onCreated }: { onClose(): void; onCreated(id: string): void }) {
  const [requestId] = React.useState(newGardenId);
  const [name, setName] = React.useState('');
  const [environment, setEnvironment] = React.useState<Group['environment']>('outdoor');
  const [location, setLocation] = React.useState<Coordinates | null>(null);
  const [label, setLabel] = React.useState('');
  const [locating, setLocating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const disabled = busy || locating || !name.trim() || !validCoordinates(location);
  const save = async () => {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const id = await createGarden(requestId, name, environment, location!, label); onCreated(id); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create your garden. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <PlantEditorSheet title="Create a garden" theme={t} busy={busy} onClose={onClose}
    footer={<View style={{ gap: 10 }}>{!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}<GrowPress accessibilityRole="button" accessibilityLabel="Create garden" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => void save()} style={[s.create, disabled && { opacity: 0.5 }]}><Text style={s.createText}>{busy ? 'Creating garden…' : 'Create garden'}</Text></GrowPress></View>}>
    <View style={s.field}><Text style={s.label}>Garden name</Text><TextInput accessibilityLabel="Garden name" value={name} onChangeText={setName} placeholder="e.g. Patio garden" placeholderTextColor={t.muted} maxLength={100} editable={!busy} returnKeyType="done" style={s.input} /></View>
    <View style={[s.field, { zIndex: 1000 }]}><Text style={s.label}>Growing environment</Text><GardenEnvironmentDropdown value={environment} onChange={setEnvironment} disabled={busy} /></View>
    <View style={s.field}><Text style={s.label}>Location</Text><Text style={s.hint}>{environment === 'indoor' ? 'For local outdoor weather. Sensors track indoor conditions.' : 'We’ll start collecting local weather here.'}</Text><LocationPicker minimal compactFlow saveContext="garden" location={location} label={label} disabled={busy} onBusyChange={setLocating} onChange={(coords, nextLabel) => { setLocation(coords); setLabel(nextLabel); if (validCoordinates(coords)) Keyboard.dismiss(); }} /></View>
  </PlantEditorSheet>;
}
const s = StyleSheet.create({
  field: { gap: 8 }, label: { color: t.text, fontSize: 14, fontWeight: '600' },
  hint: { color: t.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border, borderRadius: 12, color: t.text, fontSize: 16, backgroundColor: t.surface },
  create: { minHeight: 52, borderRadius: 14, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
  createText: { color: t.onAccent, fontSize: 16, fontWeight: '700' },
});
