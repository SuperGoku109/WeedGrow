import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { type UpdatePlantFields } from '../api/plantService';
import { usePlantEditorMutations } from '../hooks/usePlantEditorMutations';
import ActionDialog from '@/ui/ActionDialog';
import PlantActionButton from './PlantActionButton';
import { EditorField, EditorSelect } from './PlantEditorFields';
import { GrowPress } from '@/ui/GrowMotion';
import { plantThemes, type PlantTheme } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
import { fetchSensorProfiles } from '@/features/addPlant/api/environmentApi';
import PlantLocationEditor from '@/features/location/PlantLocationEditor';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { validCoordinates } from '@/features/location/locationService';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField, { displayDay } from './PlantDateField';
import { plantDay, addDays, isCalendarDay } from '@/lib/dates/plantDay';
import EditorGroup from './EditorGroup';
import EditorRow from './EditorRow';
import EditorPotSize from './EditorPotSize';
import { sections, buildSectionUpdates, buildAllSectionUpdates } from '../form/plantSectionForm';

export default function PlantSectionEditor({ plantId, plant, section, onClose, onSaved, onDeleted, theme }: { plantId: string; plant: Plant; section: string; onClose: () => void; onSaved: () => void; onDeleted?: () => void; theme?: PlantTheme }) {
  const t = theme || plantThemes.grove;
  const title = ({ 'Basics': 'Plant profile', 'Care plan': 'Care routine', 'Location and weather': 'Location', 'Notes and history': 'Profile notes' } as Record<string, string>)[section] || section;
  const [ageMode, setAgeMode] = React.useState(plant.startedOn && !plant.ageEstimated ? 'date' : 'estimate');
  const all = section === 'All';
  const includes = (key: string) => all || section === key;
  const fields = React.useMemo(() => all ? Object.values(sections).flat() : sections[section] || sections.Basics, [all, section]);
  const fieldsByKey = React.useMemo(() => new Map(fields.map(field => [field.key, field])), [fields]);
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const source = { ...plant, strainType: plant.strainType || 'unknown', ageDays: plant.ageKnown === false ? '' : plant.ageDays, lat: plant.location?.lat, lng: plant.location?.lng, reminderType: plant.reminderSchedule?.type || 'none', intervalDays: plant.reminderSchedule?.intervalDays, customDays: plant.reminderSchedule?.customDays?.join(', '), timeOfDay: plant.reminderSchedule?.timeOfDay };
    return Object.fromEntries(fields.map(field => { const value = source[field.key as keyof typeof source]; return [field.key, Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)]; }));
  });
  const [locationMode, setLocationMode] = React.useState<'custom' | 'space'>(plant.locationMode || 'custom');
  const initial = React.useRef(JSON.stringify({ values, locationMode, ageMode }));
  const dirty = JSON.stringify({ values, locationMode, ageMode }) !== initial.current;
  const draft = useEditDraft(`plant.${plantId}.section.${section}`, { values, locationMode, ageMode }, plant as unknown as Record<string, unknown>, dirty);
  const close = () => { void draft.clear().catch(() => {}); onClose(); };
  const guard = useDiscardGuard(dirty, () => draft.clear());
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [profiles, setProfiles] = React.useState<{ id: string; name: string }[]>([]);
  const [profileError, setProfileError] = React.useState('');
  React.useEffect(() => {
    if (!['All', 'Growing setup'].includes(section) || values.environment === 'outdoor') return;
    let active = true;
    fetchSensorProfiles().then(items => { if (active) { setProfiles(items); setProfileError(''); } }).catch(() => { if (active) setProfileError('Sensor profiles could not be loaded. Keep the current selection and try again later.'); });
    return () => { active = false; };
  }, [section, values.environment]);
  const { busy, error, setError, save, deletePlant } = usePlantEditorMutations({
    plantId, draft, guard, blocked: locating, onSaved, onDeleted,
    buildUpdates: () => (all
      ? buildAllSectionUpdates(values, JSON.parse(initial.current), locationMode, plant, plantDay(new Date(), plant.locationTimeZone), ageMode as 'date' | 'estimate')
      : buildSectionUpdates(section, includes('Care plan') && values.reminderType !== 'none' ? { ...values, timeOfDay: values.timeOfDay || '09:00' } : values, locationMode, plant, plantDay(new Date(), plant.locationTimeZone), ageMode as 'date' | 'estimate')) as UpdatePlantFields,
  });
  const friendly = (value: string) => ({ unknown: 'Unknown', none: 'No reminders', interval: 'Every few days', custom: 'Custom mix', native: 'Native soil', raised: 'Raised bed', store: 'Store-bought mix', customSoil: 'Custom mix', pot: 'A pot', ground: 'The ground' } as Record<string, string>)[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not set');
  const change = (key: string, value: string) => { setValues(previous => ({ ...previous, [key]: value })); setError(''); };
  const today = plantDay(new Date(), plant.locationTimeZone);
  const disabled = busy || deleteOpen || locating || !draft.ready || !!draft.saved;
  const selectedDays = values.customDays?.split(',').map(day => day.trim().slice(0, 3).toLowerCase()).filter(Boolean) || [];
  const schedule = values.reminderType === 'interval' ? `Every ${values.intervalDays || '…'} days` : values.reminderType === 'custom' ? selectedDays.map(friendly).join(', ') || 'Choose reminder days' : 'No reminders';
  const renderField = (key: string) => {
    const field = fieldsByKey.get(key);
    if (!field || key === 'potSize' && values.plantedIn === 'ground' || key === 'sensorProfileId' && values.environment === 'outdoor' || key === 'sunlightExposure' && values.environment === 'indoor') return null;
    if (key === 'potSize') return <EditorPotSize key={key} value={values.potSize} disabled={disabled} onChange={value => change(key, value)} />;
    const label = ({ ageDays: 'Estimated age', height: 'Height', environment: 'Growing environment', locationNickname: 'Place label', trainingTags: 'Training methods', pests: 'Pests recorded', companionPlants: 'Companion plants', soilPh: 'Soil pH' } as Record<string, string>)[key] || field.label;
    if (field.options) {
      const options = key === 'sensorProfileId' ? [{ value: '', label: 'No sensor profile' }, ...profiles.map(profile => ({ value: profile.id, label: profile.name })), ...(!profiles.some(profile => profile.id === values.sensorProfileId) && values.sensorProfileId ? [{ value: values.sensorProfileId, label: 'Current profile' }] : [])] : field.options.map(value => ({ value, label: value === 'custom' ? key === 'soilType' ? 'Custom mix' : 'Selected weekdays' : !value ? 'Not set' : friendly(value) }));
      if (values[key] && !options.some(option => option.value === values[key])) options.push({ value: values[key], label: values[key] });
      return <EditorSelect key={key} disabled={disabled} label={label} value={values[key]} options={options} onSelect={value => change(key, value)} />;
    }
    return <EditorField key={key} testID={`plant-editor-${key}`} label={label} value={values[key]} editable={!disabled} multiline={field.multiline} style={field.multiline ? { minHeight: 88, textAlignVertical: 'top' } : undefined} suffix={key === 'height' ? 'cm' : key === 'ageDays' ? 'days' : undefined} helper={field.list ? 'Separate items with commas.' : key === 'locationNickname' ? 'Optional · e.g. Balcony or Back patio.' : undefined} keyboardType={field.number || key === 'soilPh' ? 'decimal-pad' : 'default'} onChangeText={value => change(key, value)} />;
  };
  return <PlantEditorSheet title={all ? 'Edit plant' : `Edit ${title.toLowerCase()}`} subtitle={plant.name} contentGap={12} theme={t} busy={busy || deleteOpen} pending={busy} onClose={() => guard.requestClose(close)} footer={<View style={{ gap: 12 }}>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save section changes" disabled={disabled} onPress={save} style={[ds.button, { backgroundColor: t.accent, opacity: disabled ? 0.5 : 1 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save changes'}</Text></GrowPress>
  </View>}>
    <DraftRecovery theme={t} draft={draft} apply={value => { setValues(value.values); setLocationMode(value.locationMode); setAgeMode(value.ageMode || (value.values.startedOn ? 'date' : 'estimate')); }} />
    {!!profileError && <Text style={{ color: t.danger }}>{profileError}</Text>}
    {includes('Basics') && <>
      {all && <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Plant profile</Text>}
      {renderField('name')}<EditorRow>{renderField('growthStage')}{renderField('height')}</EditorRow>
      <EditorRow>{renderField('strain')}{renderField('strainType')}</EditorRow>
      <EditorGroup title="Plant age" hint="Since sprouting or rooting. Leave blank if unknown.">
        <EditorRow>
        <EditorSelect label="Age based on" value={ageMode} disabled={disabled} options={[{ value: 'date', label: 'Start date' }, { value: 'estimate', label: 'Estimate' }]} onSelect={setAgeMode} />
        {ageMode === 'estimate' && renderField('ageDays')}
        </EditorRow>
        {ageMode === 'date' && <PlantDateField label="Sprouted or rooted on" value={values.startedOn || ''} onChange={value => change('startedOn', value)} today={today} optional disabled={disabled} />}
    {includes('Basics') && ageMode === 'date' && isCalendarDay(values.startedOn || '') && <Text style={{ color: t.muted }}>Growing for {Math.max(0, Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(values.startedOn + 'T12:00:00Z')) / 86400000))} days.</Text>}
    {includes('Basics') && ageMode === 'estimate' && values.ageDays?.trim() && Number.isInteger(Number(values.ageDays)) && Number(values.ageDays) >= 0 && Number(values.ageDays) <= 36500 && <Text style={{ color: t.muted }}>{!plant.startedOn && values.ageDays === String(plant.ageDays) ? `Recorded age: ${values.ageDays} days. Start date unknown.` : 'Estimated start: ' + displayDay(plant.ageEstimated && values.ageDays === String(plant.ageDays) && plant.startedOn ? plant.startedOn : addDays(today, -Number(values.ageDays)))}</Text>}
      </EditorGroup>
    </>}
    {includes('Growing setup') && <>
      {all && <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Growing setup</Text>}
      <EditorRow>{renderField('environment')}{renderField('plantedIn')}</EditorRow>
      <EditorRow>{renderField('potSize')}{renderField('sunlightExposure')}{renderField('sensorProfileId')}</EditorRow>
      <EditorGroup title="Soil & extras" flat={all} collapsible={!all}><EditorRow>{renderField('soilType')}{renderField('soilPh')}</EditorRow>{renderField('permanentProtection')}{renderField('companionPlants')}</EditorGroup>
    </>}
    {includes('Care plan') && <>
      {all && <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Care routine</Text>}
      <EditorRow>{renderField('wateringFrequency')}{renderField('feedingFrequency')}</EditorRow>{renderField('fertilizer')}
      <EditorGroup title="Reminders" flat={all}>
        {renderField('reminderType')}{values.reminderType === 'interval' && renderField('intervalDays')}
      {values.reminderType === 'custom' && <View style={{ gap: 8 }}><Text style={{ color: t.muted }}>Reminder days</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => <GrowPress key={day} accessibilityRole="checkbox" accessibilityLabel={friendly(day)} accessibilityState={{ checked: selectedDays.includes(day) }} disabled={disabled} onPress={() => change('customDays', (selectedDays.includes(day) ? selectedDays.filter(item => item !== day) : [...selectedDays, day]).join(', '))} style={{ minHeight: 48, minWidth: 44, padding: 10, borderRadius: 10, backgroundColor: selectedDays.includes(day) ? t.accent : t.surface }}><Text style={{ color: selectedDays.includes(day) ? t.onAccent : t.text }}>{friendly(day)}</Text></GrowPress>)}</View></View>}
      {values.reminderType !== 'none' && <><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><EditorSelect disabled={disabled} label="Hour" value={(values.timeOfDay || '09:00').split(':')[0]} options={Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }))} onSelect={hour => change('timeOfDay', hour + ':' + (values.timeOfDay || '09:00').split(':')[1])} /></View><View style={{ flex: 1 }}><EditorSelect disabled={disabled} label="Minute" value={(values.timeOfDay || '09:00').split(':')[1]} options={Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }))} onSelect={minute => change('timeOfDay', (values.timeOfDay || '09:00').split(':')[0] + ':' + minute)} /></View></View><Text style={{ color: t.muted, lineHeight: 21 }}>Care reminders prompt you to check this plant. Enable device care reminders in Settings in the installed app to receive notifications. Times use the device time zone.</Text></>}
      {values.reminderType !== 'none' && <Text accessibilityLiveRegion="polite" style={{ color: t.text }}>{schedule} at {values.timeOfDay || '09:00'}</Text>}
      </EditorGroup>
    </>}
    {all && <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Location</Text>}
    {includes('Location and weather') && <PlantLocationEditor displayName={values.locationNickname} theme={t} groupId={plant.groupId} mode={locationMode} onModeChange={setLocationMode} location={values.lat?.trim() && values.lng?.trim() && validCoordinates({ lat: Number(values.lat), lng: Number(values.lng) }) ? { lat: Number(values.lat), lng: Number(values.lng) } : null} label={values.locationLabel} disabled={busy || !draft.ready || !!draft.saved} onBusyChange={setLocating} onChange={(coords, name) => setValues(previous => ({ ...previous, lat: coords ? String(coords.lat) : '', lng: coords ? String(coords.lng) : '', locationLabel: name }))} />}
    {includes('Location and weather') && <EditorGroup flat={all} title="Place label" hint={values.locationNickname || 'Optional name for this spot'} collapsible={!all}>{renderField('locationNickname')}</EditorGroup>}
    {includes('Notes and history') && <>
      {all && <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Profile notes</Text>}
      <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Keep lasting information here. Add dated observations in the Journal.</Text>
      {renderField('notes')}{renderField('environmentNotes')}
      <EditorGroup title="Training & pest history" flat={all} collapsible={!all}>{renderField('trainingTags')}{renderField('pests')}</EditorGroup>
    </>}
    {all && onDeleted && <View style={{ borderTopWidth: 1, borderColor: t.border, marginTop: 12, paddingTop: 16, gap: 8 }}>
      <PlantActionButton label="Delete plant" icon="trash-can-outline" theme={t} danger disabled={disabled} onPress={() => setDeleteOpen(true)} />
      <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Permanently removes this plant and its history.</Text>
    </View>}
    {deleteOpen && <ActionDialog danger title="Delete this plant?" description={`Permanently delete ${plant.name}, including its journal, photos and saved conditions. This cannot be undone.${dirty ? ' Your unsaved edits will also be discarded.' : ''}`} confirmLabel="Delete permanently" onClose={() => setDeleteOpen(false)} onConfirm={deletePlant} />}
    {guard.dialog}
  </PlantEditorSheet>;
}
