import { useAppTheme } from '@/hooks/useAppTheme';
import { PendingStatus } from '@/ui/LoadingFeedback';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import LocationPicker from '@/features/location/LocationPicker';
import { useSavedLocations } from '@/features/location/SavedLocations';
import type { Coordinates } from '@/features/location/locationService';
import { saveGrowingSpace } from '@/features/groups/api/membership';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import EditGroupModal from '@/features/groups/components/EditGroupModal';
import { groupEditValues } from '@/features/groups/groupCollection';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import type { Group } from '@/firestoreModels';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
export default function GardenLocations() {
  const t = useAppTheme();
  const router = useRouter(); const { spaces, loading, error, retry } = useSavedLocations();
  const { plants } = usePlantList();
  const [creating, setCreating] = React.useState(false); const [name, setName] = React.useState('');
  const [environment, setEnvironment] = React.useState<Group['environment']>('outdoor');
  const [location, setLocation] = React.useState<Coordinates | null>(null); const [label, setLabel] = React.useState('');
  const [edit, setEdit] = React.useState<(Group & { id: string }) | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState(''); const lock = React.useRef(false);
  const guard = useDiscardGuard(creating && (!!name.trim() || !!location || environment !== 'outdoor'));
  const resetCreation = () => { setCreating(false); setName(''); setLocation(null); setLabel(''); setEnvironment('outdoor'); };
  const action = (text: string, onPress: () => void, disabled = false) => <Pressable key={text} accessibilityRole="button" disabled={busy || disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', padding: 10 }}><Text style={{ color: t.accent, fontWeight: '600' }}>{text}</Text></Pressable>;
  return <KeyboardAwareScrollView bottomOffset={24} style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, gap: 18 }}>
    {action('← Back', () => router.back())}<Text style={{ color: t.text, fontSize: 26, fontWeight: '700' }}>Garden locations</Text><Text style={{ color: t.muted, lineHeight: 22 }}>Home, Patio and Greenhouse are gardens with reusable locations. Plants can follow their space or keep their own pin.</Text>
    {!!(message || error) && <Text accessibilityRole="alert" style={{ color: t.danger }}>{message || error}</Text>}{loading && <PendingStatus label="Loading saved locations…" />}{!!error && action('Retry locations', retry)}
    {spaces.map(space => <View key={space.id} style={{ padding: 16, borderRadius: 14, backgroundColor: t.surface, gap: 8 }}><Text style={{ color: t.text, fontWeight: '700', fontSize: 18 }}>{space.name}</Text><Text style={{ color: t.muted }}>{space.environment} · {space.plantIds.length} plants · {space.location ? space.locationLabel || `${space.location.lat.toFixed(5)}, ${space.location.lng.toFixed(5)}` : 'No location saved'}</Text>{action(`Edit ${space.name}`, () => guard.requestClose(() => { resetCreation(); setEdit(space); }))}</View>)}
    {!creating ? action('Add a saved garden location', () => setCreating(true)) : <View style={{ padding: 16, backgroundColor: t.surface, borderRadius: 16, gap: 14 }}><TextInput accessibilityLabel="Saved location name" value={name} onChangeText={setName} placeholder="Home, Patio, Greenhouse…" placeholderTextColor={t.muted} maxLength={100} style={{ color: t.text, borderWidth: 1, borderColor: t.border, padding: 12, borderRadius: 10, fontSize: 16 }} /><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(['outdoor', 'indoor', 'greenhouse'] as const).map(value => action(`${environment === value ? '✓ ' : ''}${value}`, () => setEnvironment(value)))}</View><LocationPicker location={location} label={label} allowSaved={false} disabled={busy} onBusyChange={setLocating} onChange={(coords, text) => { setLocation(coords); setLabel(text); }} />{action(busy ? 'Saving…' : locating ? 'Finding your location…' : 'Save garden location', () => { if (lock.current || locating) return; if (!name.trim() || !location) { setMessage('Enter a name and choose a map pin.'); return; } lock.current = true; setBusy(true); void saveGrowingSpace(undefined, { name, environment, location, locationLabel: label, plantIds: [] }).then(() => { guard.finish(() => { resetCreation(); setMessage('Garden location saved.'); }); }).catch(error => setMessage(error instanceof Error ? error.message : 'Could not save this location.')).finally(() => { lock.current = false; setBusy(false); }); }, locating)}{action('Cancel new location', () => guard.requestClose(resetCreation))}</View>}
    {guard.dialog}
    <EditGroupModal settingsOnly visible={!!edit} group={edit} allPlants={plants} onClose={() => setEdit(null)} onSave={async (group, baseline) => { await saveGrowingSpace(group.id, groupEditValues(group), false, baseline as unknown as Record<string, unknown>); }} />
  </KeyboardAwareScrollView>;
}
