import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { updatePlant, type UpdatePlantFields } from '../api/plantService';
import { EditorField, EditorSelect } from './PlantEditorFields';
import { GrowPress } from '@/ui/GrowMotion';
import { plantThemes } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
import { fetchSensorProfiles } from '@/features/addPlant/api/environmentApi';
import PlantLocationEditor from '@/features/location/PlantLocationEditor';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { validCoordinates } from '@/features/location/locationService';
import { sections, buildSectionUpdates } from '../form/plantSectionForm';

export default function PlantSectionEditor({ plantId, plant, section, onClose, onSaved }: { plantId: string; plant: Plant; section: string; onClose: () => void; onSaved: () => void }) {
  const t = plantThemes.grove;
  const fields = sections[section] || sections.Basics;
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const source = { ...plant, strainType: plant.strainType || 'unknown', ageDays: plant.ageKnown === false ? '' : plant.ageDays, lat: plant.location?.lat, lng: plant.location?.lng, reminderType: plant.reminderSchedule?.type || 'none', intervalDays: plant.reminderSchedule?.intervalDays, customDays: plant.reminderSchedule?.customDays?.join(', '), timeOfDay: plant.reminderSchedule?.timeOfDay };
    return Object.fromEntries(fields.map(field => { const value = source[field.key as keyof typeof source]; return [field.key, Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)]; }));
  });
  const [locationMode, setLocationMode] = React.useState<'custom' | 'space'>(plant.locationMode || 'custom');
  const initial = React.useRef(JSON.stringify({ values, locationMode }));
  const dirty = JSON.stringify({ values, locationMode }) !== initial.current;
  const draft = useEditDraft(`plant.${plantId}.section.${section}`, { values, locationMode }, plant as unknown as Record<string, unknown>, dirty);
  const close = () => { void draft.clear().catch(() => {}); onClose(); };
  const guard = useDiscardGuard(dirty, () => draft.clear());
  const [busy, setBusy] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [profiles, setProfiles] = React.useState<{ id: string; name: string }[]>([]);
  const [profileError, setProfileError] = React.useState('');
  React.useEffect(() => {
    if (section !== 'Growing setup' || values.environment === 'outdoor') return;
    let active = true;
    fetchSensorProfiles().then(items => { if (active) { setProfiles(items); setProfileError(''); } }).catch(() => { if (active) setProfileError('Sensor profiles could not be loaded. Keep the current selection and try again later.'); });
    return () => { active = false; };
  }, [section, values.environment]);
  const lock = React.useRef(false);
  const save = async () => {
    if (lock.current || locating || !draft.ready || draft.saved) return;
    let updates: Record<string, unknown>;
    try { updates = buildSectionUpdates(section, values, locationMode, plant); }
    catch (error) { setError(error instanceof Error ? error.message : 'Review the entered details.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { await updatePlant(plantId, updates as UpdatePlantFields, draft.baseline.current); await draft.clear().catch(() => {}); guard.finish(onSaved); }
    catch (err) { setError(err instanceof Error ? err.message : 'Changes could not be saved.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (!busy) guard.requestClose(close); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}><View style={{ width: '100%', maxWidth: 620, maxHeight: '94%', padding: 20, borderRadius: 20, backgroundColor: t.background }}>
    <View style={[ds.row, { justifyContent: 'space-between', marginBottom: 16 }]}><Text style={[ds.title, { color: t.text, flex: 1 }]}>{section}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close section editor" disabled={busy} onPress={() => guard.requestClose(close)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Cancel</Text></GrowPress></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18, paddingBottom: 16 }}>
      <DraftRecovery draft={draft} apply={value => { setValues(value.values); setLocationMode(value.locationMode); }} />
      {!!profileError && <Text style={{ color: t.danger }}>{profileError}</Text>}
      {section === 'Care plan' && <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Routines estimate when care is due. Enable device care reminders in Settings in the installed mobile app. The browser provides the care checklist.</Text>}
      {section === 'Location and weather' && <PlantLocationEditor groupId={plant.groupId} mode={locationMode} onModeChange={setLocationMode} location={values.lat?.trim() && values.lng?.trim() && validCoordinates({ lat: Number(values.lat), lng: Number(values.lng) }) ? { lat: Number(values.lat), lng: Number(values.lng) } : null} label={values.locationLabel} disabled={busy} onBusyChange={setLocating} onChange={(coords, name) => setValues(previous => ({ ...previous, lat: coords ? String(coords.lat) : '', lng: coords ? String(coords.lng) : '', locationLabel: name }))} />}
      {fields.filter(field => !(section === 'Location and weather' && ['lat', 'lng', 'locationLabel'].includes(field.key)) && !(field.key === 'potSize' && values.plantedIn === 'ground') && !(field.key === 'sensorProfileId' && values.environment === 'outdoor') && !(field.key === 'intervalDays' && values.reminderType !== 'interval') && !(field.key === 'customDays' && values.reminderType !== 'custom') && !(field.key === 'timeOfDay' && values.reminderType === 'none')).map(field => field.options ? <EditorSelect key={field.key} label={field.label} value={values[field.key]} options={field.key === 'sensorProfileId' ? [{ value: '', label: 'No sensor profile' }, ...profiles.map(profile => ({ value: profile.id, label: profile.name })), ...(!profiles.some(profile => profile.id === values.sensorProfileId) && values.sensorProfileId ? [{ value: values.sensorProfileId, label: 'Current profile' }] : [])] : field.options.map(value => ({ value, label: value || 'Not set' }))} onSelect={value => setValues(previous => ({ ...previous, [field.key]: value }))} /> : <EditorField key={field.key} label={field.label} value={values[field.key]} editable={!busy} multiline={field.multiline} keyboardType={field.number ? 'numbers-and-punctuation' : 'default'} onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))} />)}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginVertical: 12 }}>{error}</Text>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save section changes" disabled={busy || locating || !draft.ready || !!draft.saved} onPress={save} style={[ds.button, { backgroundColor: t.accent, marginTop: 12 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save changes'}</Text></GrowPress>
    {guard.dialog}
  </View></KeyboardAvoidingView></Modal>;
}
