import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { updatePlant, type UpdatePlantFields } from '../api/plantService';
import { EditorField, EditorSelect } from './PlantEditorFields';
import { GrowPress } from '@/ui/GrowMotion';
import { plantThemes } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
import { localDateKey, validateLogDate } from '@/lib/logs/plantJournal';
import { fetchSensorProfiles } from '@/features/addPlant/api/environmentApi';
import PlantLocationEditor from '@/features/location/PlantLocationEditor';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { validCoordinates } from '@/features/location/locationService';
import { validatePlantFields } from '@/lib/plants/plantValidation';

type Field = { key: string; label: string; options?: string[]; number?: boolean; multiline?: boolean; list?: boolean };
const sections: Record<string, Field[]> = {
  'Basics': [{ key: 'name', label: 'Plant name' }, { key: 'strain', label: 'Strain name' }, { key: 'strainType', label: 'Strain type', options: ['unknown', 'sativa', 'indica', 'hybrid'] }, { key: 'startedOn', label: 'Started growing on (YYYY-MM-DD)' }, { key: 'growthStage', label: 'Growth stage', options: ['germination', 'seedling', 'vegetative', 'flowering', 'clone'] }, { key: 'status', label: 'Status', options: ['active', 'archived', 'harvested', 'dead'] }, { key: 'ageDays', label: 'Age in days (optional estimate)', number: true }, { key: 'height', label: 'Height (cm)', number: true }],
  'Growing setup': [{ key: 'environment', label: 'Environment', options: ['outdoor', 'greenhouse', 'indoor'] }, { key: 'plantedIn', label: 'Planted in', options: ['pot', 'ground'] }, { key: 'potSize', label: 'Pot size' }, { key: 'sensorProfileId', label: 'Sensor profile', options: [] }, { key: 'sunlightExposure', label: 'Sunlight', options: ['', 'Full Sun', 'Partial Sun', 'Mostly Shade', 'Not Sure'] }, { key: 'soilType', label: 'Soil type', options: ['', 'native', 'raised', 'store', 'custom'] }, { key: 'soilPh', label: 'Soil pH' }, { key: 'permanentProtection', label: 'Protection' }, { key: 'companionPlants', label: 'Companion plants (comma separated)', list: true }],
  'Care plan': [{ key: 'wateringFrequency', label: 'Watering routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly'] }, { key: 'feedingFrequency', label: 'Feeding routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly', 'Every 14 days', 'Monthly', 'As needed'] }, { key: 'fertilizer', label: 'Fertilizer' }, { key: 'reminderType', label: 'Reminder', options: ['none', 'interval', 'custom'] }, { key: 'intervalDays', label: 'Reminder interval (days)', number: true }, { key: 'customDays', label: 'Reminder days (Mon, Tue, Wed, Thu, Fri, Sat, Sun)' }, { key: 'timeOfDay', label: 'Reminder time (HH:MM)' }],
  'Location and weather': [{ key: 'locationNickname', label: 'Location nickname (optional)' }, { key: 'locationLabel', label: 'Town or area' }, { key: 'lat', label: 'Latitude', number: true }, { key: 'lng', label: 'Longitude', number: true }],
  'Notes and history': [{ key: 'notes', label: 'Lasting notes', multiline: true }, { key: 'environmentNotes', label: 'Setup notes', multiline: true }, { key: 'trainingTags', label: 'Training (comma separated)', list: true }, { key: 'pests', label: 'Pest history (comma separated)', list: true }],
};
export default function PlantSectionEditor({ plantId, plant, section, onClose, onSaved }: { plantId: string; plant: Plant; section: string; onClose: () => void; onSaved: () => void }) {
  const t = plantThemes.grove;
  const fields = sections[section] || sections.Basics;
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const source = { ...plant, ageDays: plant.ageKnown === false ? '' : plant.ageDays, lat: plant.location?.lat, lng: plant.location?.lng, reminderType: plant.reminderSchedule?.type || 'none', intervalDays: plant.reminderSchedule?.intervalDays, customDays: plant.reminderSchedule?.customDays?.join(', '), timeOfDay: plant.reminderSchedule?.timeOfDay };
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
    const fail = (message: string) => setError(message);
    if (section === 'Basics' && !values.name.trim()) return fail('Enter a plant name.');
    for (const field of fields.filter(item => item.number && !['lat', 'lng'].includes(item.key))) {
      const raw = values[field.key];
      if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) return fail(field.label + ' must be a non-negative number.');
    }
    if (values.ageDays && (!Number.isInteger(Number(values.ageDays)) || Number(values.ageDays) > 36500)) return fail('Age must be a whole number between 0 and 36,500.');
    if (values.soilPh && (!Number.isFinite(Number(values.soilPh)) || Number(values.soilPh) < 0 || Number(values.soilPh) > 14)) return fail('Soil pH must be between 0 and 14.');
    const updates: Record<string, unknown> = {};
    if (section === 'Location and weather') {
      if (!!values.lat.trim() !== !!values.lng.trim()) return fail('Enter both coordinates or leave both blank.');
      if (values.lat.trim() && (!Number.isFinite(Number(values.lat)) || !Number.isFinite(Number(values.lng)) || Math.abs(Number(values.lat)) > 90 || Math.abs(Number(values.lng)) > 180)) return fail('Enter valid latitude and longitude.');
      updates.location = values.lat.trim() ? { lat: Number(values.lat), lng: Number(values.lng) } : null;
      updates.locationNickname = values.locationNickname.trim();
      updates.locationLabel = values.locationLabel.trim();
      updates.locationMode = locationMode;
    } else {
      for (const field of fields.filter(item => !['reminderType', 'intervalDays', 'customDays', 'timeOfDay'].includes(item.key))) {
        const value = values[field.key].trim();
        updates[field.key] = field.list ? value.split(',').map(part => part.trim()).filter(Boolean) : field.number ? value ? Number(value) : null : value;
      }
      if (section === 'Basics') {
        if (values.startedOn && validateLogDate(values.startedOn)) return fail('Use a valid start date, today or earlier (YYYY-MM-DD).');
        const ageChanged = values.ageDays.trim() !== String(plant.ageKnown === false ? '' : plant.ageDays ?? '');
        if (values.startedOn && (!ageChanged || values.startedOn !== (plant.startedOn || ''))) {
          updates.ageDays = Math.floor((Date.parse(localDateKey() + 'T00:00:00Z') - Date.parse(values.startedOn + 'T00:00:00Z')) / 86400000);
          updates.startedOn = values.startedOn; updates.ageKnown = true;
          updates.ageEstimated = values.startedOn === plant.startedOn ? !!plant.ageEstimated : false;
        } else if (values.ageDays.trim()) {
          const date = new Date(); date.setDate(date.getDate() - Number(values.ageDays));
          updates.startedOn = localDateKey(date); updates.ageEstimated = true; updates.ageKnown = true;
        } else { updates.startedOn = null; updates.ageKnown = false; updates.ageEstimated = false; }
      }
      if (section === 'Growing setup') {
        if (values.plantedIn === 'ground') updates.potSize = null;
        if (values.environment === 'indoor') updates.sunlightExposure = null;
        if (values.environment === 'outdoor') updates.sensorProfileId = null;
      }
      if (section === 'Care plan') {
        const type = values.reminderType;
        const days = values.customDays.split(',').map(day => day.trim().slice(0, 3).toLowerCase()).filter(Boolean);
        if (type === 'interval' && (!Number.isInteger(Number(values.intervalDays)) || Number(values.intervalDays) < 1)) return fail('Reminder interval must be a whole number of at least one day.');
        if (type === 'custom' && (!days.length || days.some(day => !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day)))) return fail('Choose valid reminder days, for example Mon, Wed, Fri.');
        if (type !== 'none' && values.timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.timeOfDay)) return fail('Use HH:MM for reminder time.');
        updates.reminderSchedule = { type, ...(type === 'interval' ? { intervalDays: Number(values.intervalDays) } : {}), ...(type === 'custom' ? { customDays: [...new Set(days)] } : {}), ...(type !== 'none' && values.timeOfDay ? { timeOfDay: values.timeOfDay } : {}) };
      }
    }
    const fieldErrors = validatePlantFields(updates);
    if (Object.keys(fieldErrors).length) return fail(Object.values(fieldErrors)[0]);
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
