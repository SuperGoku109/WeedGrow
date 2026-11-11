import CareScheduleEditor from './CareScheduleEditor';
import { effectiveSchedule } from '@/lib/care/reminderSchedules';
import { contextLabel, contextChoices } from '@/lib/care/plantContext';
import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import React from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import type { Plant, PlantReminderSchedule } from '@/firestoreModels';
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
import PlantEditorPage from './PlantEditorPage';
import PlantDateField, { displayDay } from './PlantDateField';
import { plantDay, addDays, isCalendarDay } from '@/lib/dates/plantDay';
import EditorGroup from './EditorGroup';
import EditorRow from './EditorRow';
import EditorPotSize from './EditorPotSize';
import EditorHeight from './EditorHeight';
import EditorListField from './EditorListField';
import { sections, buildSectionUpdates, buildAllSectionUpdates } from '../form/plantSectionForm';
import { rainExposure } from '@/lib/careAlgorithm/setupFacts';

export default function PlantSectionEditor({ plantId, plant, section, onClose, onSaved, onDeleted, theme, presentation = 'sheet', portrait }: { plantId: string; plant: Plant; section: string; onClose: () => void; onSaved: () => void; onDeleted?: () => void; theme?: PlantTheme; presentation?: 'sheet' | 'page'; portrait?: React.ReactNode }) {
  const t = theme || plantThemes.grove;
  const page = presentation === 'page';
  const { width, fontScale } = useWindowDimensions();
  const stackPortrait = width < 360 || fontScale > 1.2;
  const Shell = page ? PlantEditorPage : PlantEditorSheet;
  const title = ({ 'Basics': 'Plant profile', 'Care plan': 'Care routine', 'Location and weather': 'Location', 'Notes and history': 'Profile notes' } as Record<string, string>)[section] || section;
  const [ageMode, setAgeMode] = React.useState(plant.startedOn && !plant.ageEstimated ? 'date' : 'estimate');
  const all = section === 'All';
  const includes = (key: string) => all || section === key;
  const fields = React.useMemo(() => all ? Object.values(sections).flat() : sections[section] || sections.Basics, [all, section]);
  const fieldsByKey = React.useMemo(() => new Map(fields.map(field => [field.key, field])), [fields]);
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const water = effectiveSchedule(plant, 'watering'), feed = effectiveSchedule(plant, 'feeding');
    const source = { ...plant, feedingReminderType: feed.type, feedingIntervalDays: feed.intervalDays, feedingCustomDays: feed.customDays?.join(', '), feedingTimeOfDay: feed.timeOfDay, rainExposure: rainExposure(plant), strainType: plant.strainType || 'unknown', ageDays: plant.ageKnown === false ? '' : plant.ageDays, lat: plant.location?.lat, lng: plant.location?.lng, reminderType: water.type, intervalDays: water.intervalDays, customDays: water.customDays?.join(', '), timeOfDay: water.timeOfDay };
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
  const friendly = (value: string) => ({ unknown: 'Unknown', none: 'No reminders', interval: 'Every few days', custom: 'Custom mix', native: 'Native soil', raised: 'Raised bed', store: 'Store-bought mix', customSoil: 'Custom mix', pot: 'A pot', ground: 'The ground',
    exposed: 'Rain reaches soil and leaves', sheltered: 'Protected from direct rain', partial: 'Partly exposed to rain', soil_sheltered: 'Leaves exposed, soil sheltered', soilless_mix: 'Soilless potting mix', coco: 'Coco coir' } as Record<string, string>)[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not set');
  const change = (key: string, value: string) => { setValues(previous => ({ ...previous, [key]: value })); setError(''); };
  const today = plantDay(new Date(), plant.locationTimeZone);
  const disabled = busy || deleteOpen || locating || !draft.ready || !!draft.saved;
  const careSchedule = (kind: 'watering' | 'feeding'): PlantReminderSchedule => kind === 'watering' ? {
    type: (values.reminderType || 'none') as PlantReminderSchedule['type'], intervalDays: values.intervalDays ? Number(values.intervalDays) : undefined, customDays: (values.customDays || '').split(',').map(v => v.trim()).filter(Boolean), timeOfDay: values.timeOfDay || '09:00',
  } : { type: (values.feedingReminderType || 'none') as PlantReminderSchedule['type'], intervalDays: values.feedingIntervalDays ? Number(values.feedingIntervalDays) : undefined, customDays: (values.feedingCustomDays || '').split(',').map(v => v.trim()).filter(Boolean), timeOfDay: values.feedingTimeOfDay || '09:00' };
  const changeSchedule = (kind: 'watering' | 'feeding', value: PlantReminderSchedule) => setValues(previous => ({ ...previous,
    ...(kind === 'watering' ? { reminderType: value.type, intervalDays: String(value.intervalDays ?? ''), customDays: value.customDays?.join(', ') || '', timeOfDay: value.timeOfDay || '' }
      : { feedingReminderType: value.type, feedingIntervalDays: String(value.intervalDays ?? ''), feedingCustomDays: value.customDays?.join(', ') || '', feedingTimeOfDay: value.timeOfDay || '' }),
  }));
  const renderField = (key: string) => {
    const field = fieldsByKey.get(key);
    if (!field || key === 'potSize' && values.plantedIn === 'ground' || key === 'sensorProfileId' && values.environment === 'outdoor' || key === 'sunlightExposure' && values.environment === 'indoor') return null;
    if (key === 'height') return <EditorHeight key={key} value={values.height || ''} disabled={disabled} theme={t} onChange={value => change('height', value)} />;
    if (key === 'potSize') return <EditorPotSize key={key} value={values.potSize} disabled={disabled} onChange={value => change(key, value)} />;
    const label = ({ ageDays: 'Estimated age', height: 'Height', environment: 'Growing environment', trainingTags: 'Training methods', pests: 'Pests recorded', companionPlants: 'Companion plants', soilPh: 'Soil pH', intervalDays: 'Repeat every', permanentProtection: 'Cover or protection', locationNickname: locationMode === 'space' ? 'Spot within this garden' : 'Location label' } as Record<string, string>)[key] || field.label;
    if (field.list) return <EditorListField key={key} label={label} value={values[key] || ''} disabled={disabled} theme={t} onChange={value => change(key, value)} />;
    if (field.options) {
      const options = key === 'sensorProfileId' ? [{ value: '', label: 'No sensor profile' }, ...profiles.map(profile => ({ value: profile.id, label: profile.name })), ...(!profiles.some(profile => profile.id === values.sensorProfileId) && values.sensorProfileId ? [{ value: values.sensorProfileId, label: 'Current profile' }] : [])] : field.options.map(value => ({ value, label: key in contextChoices ? contextLabel(value) : value === 'custom' ? key === 'soilType' ? 'Custom mix' : 'Selected weekdays' : !value ? 'Not set' : friendly(value) }));
      if (values[key] && !options.some(option => option.value === values[key])) options.push({ value: values[key], label: values[key] });
      return <EditorSelect key={key} disabled={disabled} label={label} value={values[key]} options={options} onSelect={value => change(key, value)} />;
    }
    return <EditorField key={key} testID={`plant-editor-${key}`} label={label} value={values[key]} editable={!disabled} multiline={field.multiline} style={field.multiline ? { minHeight: values[key]?.trim() ? 88 : 48, height: values[key]?.trim() ? undefined : 48, textAlignVertical: 'top' } : undefined} suffix={key === 'height' ? 'cm' : ['ageDays', 'intervalDays'].includes(key) ? 'days' : undefined} maxLength={key === 'name' ? 100 : field.multiline ? 4000 : undefined} keyboardType={['ageDays', 'intervalDays'].includes(key) ? 'number-pad' : field.number || key === 'soilPh' ? 'decimal-pad' : 'default'} onChangeText={value => change(key, value)} />;
  };
  return <Shell title={all ? 'Edit plant' : 'Edit ' + title.toLowerCase()} subtitle={plant.name} contentGap={16} theme={t} busy={busy || deleteOpen} pending={busy} onClose={() => guard.requestClose(close)} footer={<View style={{ gap: 12 }}>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, lineHeight: 21 }}>{error}</Text>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save section changes" disabled={disabled} onPress={save} style={[ds.button, { backgroundColor: t.accent, opacity: disabled ? 0.5 : 1 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save changes'}</Text></GrowPress>
  </View>}>
    <DraftRecovery theme={t} draft={draft} apply={value => { setValues(previous => ({ ...previous, ...value.values })); setLocationMode(value.locationMode); setAgeMode(value.ageMode || (value.values.startedOn ? 'date' : 'estimate')); }} />
    {!!profileError && <Text style={{ color: t.danger }}>{profileError}</Text>}
    {includes('Basics') && <EditPanel title="Plant details" theme={t} page={page}>
      {page && portrait ? <View style={{ flexDirection: stackPortrait ? 'column' : 'row', alignItems: 'flex-start', gap: 14 }}>
        <View style={{ width: stackPortrait ? '100%' : 100, height: stackPortrait ? 180 : 148, borderRadius: 14, overflow: 'hidden', backgroundColor: t.elevated }}>{portrait}</View>
        <View style={{ flex: stackPortrait ? undefined : 1, width: stackPortrait ? '100%' : undefined, minWidth: 0, gap: 12 }}>{renderField('name')}{renderField('growthStage')}</View>
      </View> : <>{renderField('name')}{renderField('growthStage')}</>}
      <EditorRow>{renderField('height')}{renderField('strainType')}</EditorRow>
      {renderField('strain')}
      <EditorGroup title="Age and timeline" hint="Since sprouting or rooting. Leave blank if unknown.">
        <EditorRow>
          <EditorSelect label="Age based on" value={ageMode} disabled={disabled} options={[{ value: 'date', label: 'Start date' }, { value: 'estimate', label: 'Estimate' }]} onSelect={setAgeMode} />
          {ageMode === 'estimate' && renderField('ageDays')}
        </EditorRow>
        {ageMode === 'date' && <PlantDateField label="Sprouted or rooted on" value={values.startedOn || ''} onChange={value => change('startedOn', value)} today={today} optional disabled={disabled} />}
        {ageMode === 'date' && isCalendarDay(values.startedOn || '') && <Text style={{ color: t.muted, fontSize: 13 }}>Growing for {Math.max(0, Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(values.startedOn + 'T12:00:00Z')) / 86400000))} days.</Text>}
        {ageMode === 'estimate' && values.ageDays?.trim() && Number.isInteger(Number(values.ageDays)) && Number(values.ageDays) >= 0 && Number(values.ageDays) <= 36500 && <Text style={{ color: t.muted, fontSize: 13 }}>{!plant.startedOn && values.ageDays === String(plant.ageDays) ? 'Recorded age: ' + values.ageDays + ' days. Start date unknown.' : 'Estimated start: ' + displayDay(plant.ageEstimated && values.ageDays === String(plant.ageDays) && plant.startedOn ? plant.startedOn : addDays(today, -Number(values.ageDays)))}</Text>}
      </EditorGroup>
    </EditPanel>}
    {includes('Growing setup') && <EditPanel title="Container and soil" theme={t} page={page}>
      <EditorRow>{renderField('plantedIn')}{renderField('potSize')}</EditorRow>
      {values.plantedIn === 'pot' && <><EditorRow>{renderField('potMaterial')}{renderField('potType')}</EditorRow>{renderField('potDrainage')}</>}
      {renderField('careMedium')}
      <EditorRow>{renderField('soilType')}{renderField('soilPh')}</EditorRow>
      {!all && renderField('companionPlants')}
    </EditPanel>}
    {(includes('Growing setup') || includes('Location and weather')) && <EditPanel title="Location and site" theme={t} page={page}>
      {includes('Growing setup') && <>
        <EditorRow>{renderField('environment')}{renderField('growingSite')}</EditorRow>
        <EditorRow>{renderField('sunlightExposure')}{renderField('sensorProfileId')}</EditorRow>
        {renderField('rainExposure')}{renderField('permanentProtection')}
      </>}
      {includes('Location and weather') && <>
        <PlantLocationEditor displayName={values.locationNickname} theme={t} groupId={plant.groupId} mode={locationMode} onModeChange={setLocationMode} location={values.lat?.trim() && values.lng?.trim() && validCoordinates({ lat: Number(values.lat), lng: Number(values.lng) }) ? { lat: Number(values.lat), lng: Number(values.lng) } : null} label={values.locationLabel} disabled={disabled} onBusyChange={setLocating} onChange={(coords, name) => setValues(previous => ({ ...previous, lat: coords ? String(coords.lat) : '', lng: coords ? String(coords.lng) : '', locationLabel: name }))} />
        {renderField('locationNickname')}
      </>}
    </EditPanel>}
    {includes('Care plan') && <EditPanel title="Care and reminders" theme={t} page={page}>
      <CareScheduleEditor kind="watering" value={careSchedule('watering')} onChange={value => changeSchedule('watering', value)} allowSmart={(values.environment || plant.environment) === 'outdoor'} disabled={disabled} theme={t} />
      <View style={{ height: 1, backgroundColor: t.border, marginVertical: 4 }} />
      <CareScheduleEditor kind="feeding" value={careSchedule('feeding')} onChange={value => changeSchedule('feeding', value)} disabled={disabled} theme={t} />
      <EditorRow>{renderField('fertilizer')}{renderField('fertilizerForm')}</EditorRow>
      <EditorGroup title="Saved routines" hint="Optional routine notes. Reminder settings above control alerts." collapsible>
        <EditorRow>{renderField('wateringFrequency')}{renderField('feedingFrequency')}</EditorRow>
      </EditorGroup>
    </EditPanel>}
    {includes('Notes and history') && <EditPanel title="Notes and history" theme={t} page={page}>
      {renderField('notes')}{renderField('environmentNotes')}
      {all && renderField('companionPlants')}
      {renderField('trainingTags')}{renderField('pests')}
    </EditPanel>}
    {all && onDeleted && <EditPanel title="Manage plant" theme={t} page={page}>
      <PlantActionButton label="Delete plant" icon="trash-can-outline" theme={t} danger disabled={disabled} onPress={() => setDeleteOpen(true)} />
      <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>Permanently removes this plant and its history.</Text>
    </EditPanel>}
    {deleteOpen && <ActionDialog danger title="Delete this plant?" description={'Permanently delete ' + plant.name + ', including its journal, photos and saved conditions. This cannot be undone.' + (dirty ? ' Your unsaved edits will also be discarded.' : '')} confirmLabel="Delete permanently" onClose={() => setDeleteOpen(false)} onConfirm={deletePlant} />}
    {guard.dialog}
  </Shell>;
}
function EditPanel({ title, theme: t, page, children }: { title: string; theme: PlantTheme; page: boolean; children: React.ReactNode }) {
  return <View style={{ backgroundColor: page ? t.surface : 'transparent', borderRadius: page ? 20 : 0, padding: page ? 18 : 0, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '600', lineHeight: 25 }}>{title}</Text>
    {children}
  </View>;
}
