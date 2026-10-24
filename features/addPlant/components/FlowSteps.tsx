import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { fetchSensorProfiles, potSizeOptions, sunlightOptions } from '../api/environmentApi';
import { displayValue, protectionOptions, soilOptions, stages, type FormErrors } from '../plantFlowModel';
import { Choices, Disclosure, Field, Icon, palette, PlantIllustration, Press, s, Section, ValidationTarget } from './FlowUI';
import GrowingSpacePicker from './GrowingSpacePicker';
import PlantLocationEditor from '@/features/location/PlantLocationEditor';
import { preparePlantPhoto } from '@/lib/plants/preparePlantPhoto';
import { useSession } from '@/services/session';

export type StepProps = { form: PlantForm; setField<K extends keyof PlantForm>(key: K, value: PlantForm[K]): void; errors: FormErrors; onSignIn?: () => void; onBusyChange?: (busy: boolean) => void; onSkip?: () => void };

export function IdentityStep({ form, setField, errors }: StepProps) {
  return <View style={{ gap: 28 }}>
    <Field fieldKey="name" label="Plant name" placeholder="e.g. Olive, Sunday, Little one" value={form.name} onChangeText={v => setField('name', v)} error={errors.name} maxLength={100} autoCapitalize="words" />
    <ValidationTarget name="growthStage"><Section title="Where is it in its journey?" subtitle="Choose its current stage. You can update this as it grows."><Choices options={stages} value={form.growthStage} onChange={v => setField('growthStage', v)} />{!!errors.growthStage && <Text accessibilityRole="alert" style={s.error}>{errors.growthStage}</Text>}</Section></ValidationTarget>
    <Section title="When did it start?" subtitle="Optional · choose a known date, estimate its age, or leave it unknown.">
      <Choices options={[{ value: 'unknown', label: 'Unknown' }, { value: 'date', label: 'Start date' }, { value: 'estimate', label: 'Estimated age' }]} value={form.ageMode || (form.ageDays ? 'estimate' : 'unknown')} onChange={value => { setField('ageMode', value as PlantForm['ageMode']); setField('ageDays', ''); setField('startedOn', ''); }} />
      {form.ageMode === 'date' && <Field fieldKey="startedOn" label="Started growing on" placeholder="YYYY-MM-DD" value={form.startedOn || ''} onChangeText={v => setField('startedOn', v)} error={errors.startedOn} maxLength={10} hint="Use the date this plant began growing. Your added-to-garden date is recorded separately." />}
      {(form.ageMode === 'estimate' || !form.ageMode && !!form.ageDays) && <Field fieldKey="ageDays" label="Estimated age in days" placeholder="e.g. 21" value={form.ageDays} onChangeText={v => setField('ageDays', v)} keyboardType="number-pad" error={errors.ageDays} hint="An estimate is fine. It will be labelled as approximate." maxLength={5} />}
    </Section>
    <Section title="Strain" subtitle="Optional · keep the strain’s name separate from its type."><Choices options={[{ value: 'sativa', label: 'Sativa' }, { value: 'indica', label: 'Indica' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'unknown', label: 'Unknown type' }]} value={form.strainType || 'unknown'} onChange={v => setField('strainType', v)} /><Field label="Strain name" placeholder="e.g. Blue Dream, or leave blank" value={form.strain} onChangeText={v => setField('strain', v)} maxLength={120} /></Section>
  </View>;
}

export function SetupStep({ form, setField, errors, onSignIn }: StepProps) {
  const { user } = useSession();
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (form.environment === 'outdoor' || !user) return;
    let active = true;
    setLoading(true); setFailed(false);
    fetchSensorProfiles().then(items => { if (active) setProfiles(items); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form.environment, attempt, user]);
  return <View style={{ gap: 28 }}>
    <ValidationTarget name="groupId"><GrowingSpacePicker form={form} setField={setField} errors={errors} onSignIn={onSignIn} /></ValidationTarget>
    <Section title="Growing environment"><Choices options={[{ value: 'outdoor', label: 'Outdoor', icon: 'weather-sunny' }, { value: 'indoor', label: 'Indoor', icon: 'home-outline' }, { value: 'greenhouse', label: 'Greenhouse', icon: 'greenhouse' }]} value={form.environment} onChange={v => { setField('environment', v); if (v !== form.environment) { setField('groupId', ''); setField('groupName', ''); setField('locationMode', 'custom'); } }} /></Section>
    <Section title="A place to put down roots"><Choices options={[{ value: 'pot', label: 'In a pot', icon: 'flower-tulip-outline' }, { value: 'ground', label: 'In the ground', icon: 'shovel' }]} value={form.plantedIn} onChange={v => setField('plantedIn', v)} />
      {form.plantedIn === 'pot' && <><Text style={s.hint}>Pot size · optional</Text><Choices options={potSizeOptions} value={form.potSize || ''} onChange={v => setField('potSize', form.potSize === v ? '' : v)} /><Field label="Pot size" optional placeholder="Or enter another size, e.g. 15L" value={form.potSize || ''} onChangeText={v => setField('potSize', v)} maxLength={40} /></>}
    </Section>
    {form.environment !== 'indoor' && <Section title="Sunlight exposure" subtitle="Optional · record the light this spot receives."><Choices options={sunlightOptions} value={form.sunlightExposure || ''} onChange={v => setField('sunlightExposure', form.sunlightExposure === v ? '' : v)} /></Section>}
    {form.environment !== 'outdoor' && user && <Section title="Connect a sensor profile" subtitle="Optional · link an existing profile for this growing space.">
      {loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading sensor profiles" /> : failed ? <><Text style={s.error}>Sensor profiles couldn’t load. You can retry or add one later.</Text><Press label="Retry sensor profiles" onPress={() => setAttempt(v => v + 1)} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Retry</Text></Press></> : <><Choices options={[{ value: '', label: 'No sensor profile' }, ...profiles.map(p => ({ value: p.id, label: p.name }))]} value={form.sensorProfileId || ''} onChange={v => setField('sensorProfileId', v)} />{!profiles.length && <Text style={s.hint}>No profiles yet. You can create one in Profiles after adding your plant.</Text>}</>}
    </Section>}
    <Disclosure title="Soil & extra setup" subtitle="Soil type, pH, protection and companion plants" initiallyOpen={!!(form.soilType || form.soilPh)} forceOpen={!!errors.soilPh}>
      <Section title="Soil type"><Choices options={soilOptions} value={form.soilType || ''} onChange={v => setField('soilType', form.soilType === v ? '' : v)} /></Section>
      <Field fieldKey="soilPh" label="Soil pH" optional placeholder="Only if measured" keyboardType="decimal-pad" value={form.soilPh || ''} onChangeText={v => setField('soilPh', v)} error={errors.soilPh} maxLength={5} />
      <Section title="Permanent protection"><Choices options={protectionOptions} value={form.permanentProtection || ''} onChange={v => setField('permanentProtection', form.permanentProtection === v ? '' : v)} /></Section>
      <Field label="Companion plants" optional placeholder="e.g. Basil, Marigold" hint="Separate plant names with commas." value={(form.companionPlants || []).join(',')} onChangeText={v => setField('companionPlants', v.split(','))} maxLength={400} />
      <Field label="Setup notes" optional placeholder="Anything else about this growing space" value={form.environmentNotes || ''} onChangeText={v => setField('environmentNotes', v)} multiline maxLength={2000} />
    </Disclosure>
  </View>;
}

export function LocationStep({ form, setField, errors, onSkip, onBusyChange }: StepProps) {
  return <View style={{ gap: 24 }}>
    <Field label="Location nickname" optional placeholder="e.g. Back patio, Tent one" value={form.locationNickname || ''} onChangeText={v => setField('locationNickname', v)} maxLength={120} />
    <ValidationTarget name="location"><PlantLocationEditor groupId={form.groupId} mode={form.locationMode || 'custom'} onModeChange={value => setField('locationMode', value)} location={form.location} label={form.locationLabel} onBusyChange={onBusyChange} onChange={(coords, name) => {
      setField('location', coords); setField('locationLabel', name);
      setField('latitudeInput', coords ? String(coords.lat) : ''); setField('longitudeInput', coords ? String(coords.lng) : '');
    }} /></ValidationTarget>
    {!!errors.location && <Text accessibilityRole="alert" style={s.error}>{errors.location}</Text>}
    <Text style={s.hint}>Location is optional. For local weather, a nearby town is enough. Outdoor weather does not describe conditions inside an indoor growing space.</Text>
    {onSkip && <Press label="Continue without weather" onPress={() => { setField('locationMode', 'custom'); setField('location', null); setField('locationLabel', ''); setField('latitudeInput', ''); setField('longitudeInput', ''); onSkip(); }} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Continue without weather</Text></Press>}
  </View>;
}

export function DetailsStep({ form, setField, errors, onBusyChange }: StepProps) {
  const [photoError, setPhotoError] = useState('');
  const [picking, setPicking] = useState(false);
  const pick = async (camera: boolean) => {
    if (picking) return;
    setPicking(true); onBusyChange?.(true); setPhotoError('');
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error('Camera access is off. Choose a photo instead, or add one later.'); }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        const photo = await preparePlantPhoto(result.assets[0].uri);
        setField('imageUri', photo.image);
      }
    } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Couldn’t open your photos. Please try again.'); }
    finally { setPicking(false); onBusyChange?.(false); }
  };
  const toggle = (key: 'pests' | 'trainingTags', value: string) => { const current = form[key] || []; setField(key, current.includes(value) ? current.filter(v => v !== value) : [...current, value]); };
  return <View style={{ gap: 28 }}>
    <Section title="Give it a familiar face" subtitle="Optional · this becomes the cover and the first photo in your progress gallery. Photos are resized for your journal; keep the original on your device.">
      {form.imageUri ? <Image accessibilityLabel="Selected plant photo" source={{ uri: form.imageUri }} style={{ width: '100%', height: 220, borderRadius: 18 }} resizeMode="cover" /> : <Press label="Choose plant photo" disabled={picking} onPress={() => pick(false)} style={{ borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border, padding: 24, alignItems: 'center', gap: 12, backgroundColor: palette.input }}><Icon name="camera-plus-outline" size={36} /><Text style={s.label}>Add your first photo</Text><Text style={s.hint}>A small beginning, worth remembering.</Text></Press>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Press label="Choose photo" disabled={picking} onPress={() => pick(false)} style={[s.button, s.secondary]}><Icon name="image-outline" size={19} /><Text style={s.secondaryText}>{picking ? 'Opening…' : form.imageUri ? 'Change photo' : 'Choose photo'}</Text></Press>
        {Platform.OS !== 'web' && <Press label="Take photo" disabled={picking} onPress={() => pick(true)} style={[s.button, s.secondary]}><Icon name="camera-outline" size={19} /><Text style={s.secondaryText}>Take photo</Text></Press>}
        {!!form.imageUri && <Press label="Remove photo" onPress={() => setField('imageUri', '')} style={{ padding: 14 }}><Text style={s.hint}>Remove</Text></Press>}
      </View>
      {!!photoError && <Text accessibilityLiveRegion="polite" style={s.error}>{photoError}</Text>}
    </Section>
    <Disclosure title="Care routine" subtitle="Recent care, watering and feeding routines" initiallyOpen={!!(form.wateringFrequency || form.fertilizer || form.lastWateredOn || form.lastFedOn)} forceOpen={!!(errors.lastWateredOn || errors.lastFedOn)}>
      <Field fieldKey="lastWateredOn" label="Last watered on" optional placeholder="YYYY-MM-DD, or leave unknown" value={form.lastWateredOn || ''} onChangeText={value => setField('lastWateredOn', value)} maxLength={10} error={errors.lastWateredOn} hint="Only record watering that actually happened. This adds a journal entry." />
      <Field fieldKey="lastFedOn" label="Last fed on" optional placeholder="YYYY-MM-DD, or leave unknown" value={form.lastFedOn || ''} onChangeText={value => setField('lastFedOn', value)} maxLength={10} error={errors.lastFedOn} hint="Leave blank if you have not fed this plant or are unsure." />
      <Section title="Watering frequency" subtitle="Record your current routine. This does not create a reminder."><Choices options={['Every day', 'Every 2 days', 'Every 3 days', 'Weekly']} value={form.wateringFrequency || ''} onChange={v => setField('wateringFrequency', form.wateringFrequency === v ? '' : v)} /></Section>
      <Field label="Fertilizer" optional placeholder="Name of the fertilizer you use" value={form.fertilizer || ''} onChangeText={v => setField('fertilizer', v)} maxLength={200} />
      <Section title="Feeding routine" subtitle="Optional · a record of your routine, not a recommendation."><Choices options={['Weekly', 'Every 14 days', 'Monthly', 'As needed']} value={form.feedingFrequency || ''} onChange={value => setField('feedingFrequency', form.feedingFrequency === value ? '' : value)} /></Section>
      <Text style={s.hint}>Saving a routine does not enable push notifications or schedule reminders.</Text>
    </Disclosure>
    <Disclosure title="Plant history" subtitle="Pests and training techniques" initiallyOpen={!!(form.pests?.length || form.trainingTags?.length)}>
      <Section title="Pest history" subtitle="Select any that apply."><Choices options={['Spider Mites', 'Powdery Mildew', 'Aphids']} multiple value={form.pests || []} onChange={v => toggle('pests', v)} /></Section>
      <Section title="Training techniques"><Choices options={['LST', 'Topping', 'SCROG']} multiple value={form.trainingTags || []} onChange={v => toggle('trainingTags', v)} /></Section>
    </Disclosure>
    <Field label="Plant notes" optional placeholder="Its story so far, or anything you want to remember…" value={form.notes || ''} onChangeText={v => setField('notes', v)} multiline maxLength={4000} />
  </View>;
}

export function ReviewStep({ form, edit }: { form: PlantForm; edit(step: number): void }) {
  const { user } = useSession();
  const [sensorName, setSensorName] = useState('Linked profile');
  useEffect(() => {
    if (!form.sensorProfileId || !user) return;
    let active = true;
    fetchSensorProfiles().then(profiles => { if (active) setSensorName(profiles.find(profile => profile.id === form.sensorProfileId)?.name || 'Linked profile'); }).catch(() => {});
    return () => { active = false; };
  }, [form.sensorProfileId, user]);
  const sections: { title: string; step: number; rows: [string, unknown][] }[] = [
    { title: 'Your plant', step: 0, rows: [['Name', form.name], ['Growth stage', form.growthStage], ['Age', form.ageDays ? `${form.ageEstimated ? 'About ' : ''}${form.ageDays} ${form.ageDays === '1' ? 'day' : 'days'}` : 'Unknown'], ['Started growing', form.startedOn], ['Strain name', form.strain], ['Strain type', form.strainType === 'unknown' ? '' : form.strainType]] },
    { title: 'Growing setup', step: 1, rows: [['Growing space', form.groupName], ['Environment', form.environment], ['Planted in', form.plantedIn], ...(form.plantedIn === 'pot' ? [['Pot size', form.potSize] as [string, unknown]] : []), ...(form.environment !== 'indoor' ? [['Sunlight', form.sunlightExposure] as [string, unknown]] : []), ...(form.environment !== 'outdoor' ? [['Sensor profile', form.sensorProfileId ? sensorName : ''] as [string, unknown]] : []), ['Soil type', soilOptions.find(item => item.value === form.soilType)?.label || form.soilType], ['Soil pH', form.soilPh], ['Protection', protectionOptions.find(item => item.value === form.permanentProtection)?.label || form.permanentProtection], ['Companion plants', form.companionPlants], ['Setup notes', form.environmentNotes]] },
    { title: 'Location', step: 2, rows: [['Nickname', form.locationNickname], ['Town or area', form.locationLabel], ['Weather', form.location ? 'Location added' : 'Not enabled'], ['Coordinates', form.location ? `${form.location.lat.toFixed(4)}, ${form.location.lng.toFixed(4)}` : '']] },
    { title: 'Care and photos', step: 3, rows: [['Photo', form.imageUri ? 'Cover and first progress photo' : ''], ['Last watered', form.lastWateredOn], ['Watering routine', form.wateringFrequency], ['Last fed', form.lastFedOn], ['Feeding routine', form.feedingFrequency], ['Fertilizer', form.fertilizer], ['Pest history', form.pests], ['Training', form.trainingTags], ['Notes', form.notes]] },
  ];
  const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
  const missing = sections.map(section => ({ ...section, rows: section.rows.filter(([, value]) => !present(value)) })).filter(section => section.rows.length);
  const missingCount = missing.reduce((count, section) => count + section.rows.length, 0);
  return <View style={{ gap: 18 }}>
    <View style={{ backgroundColor: palette.soft, borderRadius: 20, overflow: 'hidden', padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {form.imageUri ? <Image accessibilityLabel="Plant cover preview" source={{ uri: form.imageUri }} style={{ width: 80, height: 90, borderRadius: 14 }} /> : <View style={{ width: 60, height: 90, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}><View style={{ transform: [{ scale: 0.5 }] }}><PlantIllustration stage={form.growthStage} /></View></View>}
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}><Text style={{ color: '#526344', fontSize: 10, letterSpacing: 1 }}>READY FOR YOUR GARDEN</Text><Text style={{ color: palette.dark, fontSize: 26, fontWeight: '600' }}>{form.name}</Text><Text style={{ color: '#526344', fontSize: 13 }}>{displayValue(form.growthStage)} · {displayValue(form.environment)}</Text></View>
    </View>
    {sections.map(section => <View key={section.title} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 17, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text style={[s.sectionTitle, { flex: 1 }]}>{section.title}</Text><Press label={`Edit ${section.title}`} onPress={() => edit(section.step)} style={{ padding: 10 }}><Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text></Press></View>
      {section.rows.filter(([, value]) => present(value)).map(([label, value]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}><Text style={[s.hint, { flex: 0.9 }]}>{label}</Text><Text style={{ color: palette.ink, flex: 1.2, textAlign: 'right', fontSize: 14, lineHeight: 21 }}>{displayValue(value)}</Text></View>)}
      {!section.rows.some(([, value]) => present(value)) && <Text style={s.hint}>Nothing added here yet. You can complete this later.</Text>}
    </View>)}
    {missingCount > 0 && <Disclosure title={`Additional details (${missingCount} not provided)`} subtitle="Optional fields you can complete now or later">
      {missing.map(section => <View key={section.title} style={{ gap: 8 }}><Text style={s.label}>{section.title}</Text><Text style={s.hint}>{section.rows.map(([label]) => label).join(', ')}</Text><Press label={`Add optional ${section.title} details`} onPress={() => edit(section.step)} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>Add details</Text></Press></View>)}
    </Disclosure>}
    <Text style={s.hint}>Your plant, photos and any recorded care dates will be saved together. Care routines do not enable notifications.</Text>
  </View>;
}
