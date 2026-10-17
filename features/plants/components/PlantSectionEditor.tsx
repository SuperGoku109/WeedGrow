import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { updatePlant, type UpdatePlantFields } from '../api/plantService';
import { EditorField, EditorSelect } from './PlantEditorFields';
import { GrowPress } from '@/ui/GrowMotion';
import { plantThemes } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';

type Field = { key: string; label: string; options?: string[]; number?: boolean; multiline?: boolean; list?: boolean };
const sections: Record<string, Field[]> = {
  'Basics': [{ key: 'name', label: 'Plant name' }, { key: 'strain', label: 'Strain' }, { key: 'growthStage', label: 'Growth stage', options: ['germination', 'seedling', 'vegetative', 'flowering', 'clone'] }, { key: 'status', label: 'Status', options: ['active', 'archived', 'harvested', 'dead'] }, { key: 'ageDays', label: 'Recorded age (days)', number: true }, { key: 'height', label: 'Height (cm)', number: true }],
  'Growing setup': [{ key: 'environment', label: 'Environment', options: ['outdoor', 'greenhouse', 'indoor'] }, { key: 'plantedIn', label: 'Planted in', options: ['pot', 'ground'] }, { key: 'potSize', label: 'Pot size' }, { key: 'sunlightExposure', label: 'Sunlight', options: ['', 'Full sun', 'Partial shade', 'Shade'] }, { key: 'soilType', label: 'Soil type', options: ['', 'native', 'raised', 'store', 'custom'] }, { key: 'soilPh', label: 'Soil pH' }, { key: 'permanentProtection', label: 'Protection' }, { key: 'companionPlants', label: 'Companion plants (comma separated)', list: true }],
  'Care plan': [{ key: 'wateringFrequency', label: 'Watering routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly'] }, { key: 'feedingFrequency', label: 'Feeding routine', options: ['', 'Every day', 'Every 2 days', 'Every 3 days', 'Weekly', 'Every 14 days'] }, { key: 'fertilizer', label: 'Fertilizer' }, { key: 'reminderType', label: 'Reminder', options: ['none', 'interval', 'custom'] }, { key: 'intervalDays', label: 'Reminder interval (days)', number: true }, { key: 'customDays', label: 'Reminder days (Mon, Tue, Wed, Thu, Fri, Sat, Sun)' }, { key: 'timeOfDay', label: 'Reminder time (HH:MM)' }],
  'Location and weather': [{ key: 'locationNickname', label: 'Location name' }, { key: 'lat', label: 'Latitude', number: true }, { key: 'lng', label: 'Longitude', number: true }],
  'Notes and history': [{ key: 'notes', label: 'Lasting notes', multiline: true }, { key: 'environmentNotes', label: 'Setup notes', multiline: true }, { key: 'trainingTags', label: 'Training (comma separated)', list: true }, { key: 'pests', label: 'Pest history (comma separated)', list: true }],
};
export default function PlantSectionEditor({ plantId, plant, section, onClose, onSaved }: { plantId: string; plant: Plant; section: string; onClose: () => void; onSaved: () => void }) {
  const t = plantThemes.grove;
  const fields = sections[section] || sections.Basics;
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const source = { ...plant, ageDays: plant.ageKnown === false ? '' : plant.ageDays, lat: plant.location?.lat, lng: plant.location?.lng, reminderType: plant.reminderSchedule?.type || 'none', intervalDays: plant.reminderSchedule?.intervalDays, customDays: plant.reminderSchedule?.customDays?.join(', '), timeOfDay: plant.reminderSchedule?.timeOfDay };
    return Object.fromEntries(fields.map(field => { const value = source[field.key as keyof typeof source]; return [field.key, Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)]; }));
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const save = async () => {
    if (lock.current) return;
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
    } else {
      for (const field of fields.filter(item => !['reminderType', 'intervalDays', 'customDays', 'timeOfDay'].includes(item.key))) {
        const value = values[field.key].trim();
        updates[field.key] = field.list ? value.split(',').map(part => part.trim()).filter(Boolean) : field.number ? value ? Number(value) : null : value;
      }
      if (section === 'Basics') updates.ageKnown = !!values.ageDays.trim();
      if (section === 'Care plan') {
        const type = values.reminderType;
        const days = values.customDays.split(',').map(day => day.trim().slice(0, 3).toLowerCase()).filter(Boolean);
        if (type === 'interval' && (!Number.isInteger(Number(values.intervalDays)) || Number(values.intervalDays) < 1)) return fail('Reminder interval must be a whole number of at least one day.');
        if (type === 'custom' && (!days.length || days.some(day => !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day)))) return fail('Choose valid reminder days, for example Mon, Wed, Fri.');
        if (type !== 'none' && values.timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.timeOfDay)) return fail('Use HH:MM for reminder time.');
        updates.reminderSchedule = { type, ...(type === 'interval' ? { intervalDays: Number(values.intervalDays) } : {}), ...(type === 'custom' ? { customDays: [...new Set(days)] } : {}), ...(type !== 'none' && values.timeOfDay ? { timeOfDay: values.timeOfDay } : {}) };
      }
    }
    lock.current = true; setBusy(true); setError('');
    try { await updatePlant(plantId, updates as UpdatePlantFields); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Changes could not be saved.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}><View style={{ width: '100%', maxWidth: 620, maxHeight: '94%', padding: 20, borderRadius: 20, backgroundColor: t.background }}>
    <View style={[ds.row, { justifyContent: 'space-between', marginBottom: 16 }]}><Text style={[ds.title, { color: t.text, flex: 1 }]}>{section}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close section editor" disabled={busy} onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Cancel</Text></GrowPress></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18, paddingBottom: 16 }}>
      {section === 'Care plan' && <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Routines estimate when care is due. Reminder preferences are saved here; they do not enable push notifications.</Text>}
      {fields.filter(field => !(field.key === 'potSize' && values.plantedIn === 'ground') && !(field.key === 'intervalDays' && values.reminderType !== 'interval') && !(field.key === 'customDays' && values.reminderType !== 'custom') && !(field.key === 'timeOfDay' && values.reminderType === 'none')).map(field => field.options ? <EditorSelect key={field.key} label={field.label} value={values[field.key]} options={field.options.map(value => ({ value, label: value || 'Not set' }))} onSelect={value => setValues(previous => ({ ...previous, [field.key]: value }))} /> : <EditorField key={field.key} label={field.label} value={values[field.key]} editable={!busy} multiline={field.multiline} keyboardType={field.number ? 'numbers-and-punctuation' : 'default'} onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))} />)}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginVertical: 12 }}>{error}</Text>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save section changes" disabled={busy} onPress={save} style={[ds.button, { backgroundColor: t.accent, marginTop: 12 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save changes'}</Text></GrowPress>
  </View></KeyboardAvoidingView></Modal>;
}
