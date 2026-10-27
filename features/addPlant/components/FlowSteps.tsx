import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { fetchSensorProfiles, sunlightOptions } from '../api/environmentApi';
import { displayValue, protectionOptions, soilOptions, type FormErrors } from '../plantFlowModel';
import { Choices, Disclosure, Field, Icon, palette, PlantIllustration, Press, s, Section, ValidationTarget } from './FlowUI';
import GrowingSpacePicker from './GrowingSpacePicker';
import GrowthStageDropdown from './GrowthStageDropdown';
import FlowDropdown from './FlowDropdown';
import FlowSegmented from './FlowSegmented';
import PotSizeField from './PotSizeField';
import PlantCreationLocation from './PlantCreationLocation';
import { preparePlantPhoto } from '@/lib/plants/preparePlantPhoto';
import { useSession } from '@/services/session';

export type StepProps = { form: PlantForm; setField<K extends keyof PlantForm>(key: K, value: PlantForm[K]): void; errors: FormErrors; onSignIn?: () => void; onBusyChange?: (busy: boolean) => void };

export function IdentityStep({ form, setField, errors }: StepProps) {
  return <View style={{ gap: 24 }}>
    <Field fieldKey="name" label="Plant name" placeholder="e.g. Olive, Sunday, Little one" value={form.name} onChangeText={v => setField('name', v)} error={errors.name} maxLength={100} autoCapitalize="words" />
    <View style={{ zIndex: 1000 }}><ValidationTarget name="growthStage"><Section title="Current growth stage"><GrowthStageDropdown value={form.growthStage} onChange={v => setField('growthStage', v)} />{!!errors.growthStage && <Text accessibilityRole="alert" style={s.error}>{errors.growthStage}</Text>}</Section></ValidationTarget></View>
    <Section title="How old is this plant?" subtitle="Optional · count from when the seed sprouted or the cutting rooted.">
      <FlowSegmented label="Plant age" options={[{ value: 'unknown', label: 'Unknown' }, { value: 'date', label: 'Known date' }, { value: 'estimate', label: 'Estimate' }]} value={form.ageMode || (form.ageDays ? 'estimate' : 'unknown')} onChange={value => { setField('ageMode', value as PlantForm['ageMode']); setField('ageDays', ''); setField('startedOn', ''); }} />
      {form.ageMode === 'date' && <Field fieldKey="startedOn" label="Sprouted or rooted on" placeholder="YYYY-MM-DD" value={form.startedOn || ''} onChangeText={v => setField('startedOn', v)} error={errors.startedOn} maxLength={10} hint="This sets its total age. Growth-stage changes are tracked separately." />}
      {(form.ageMode === 'estimate' || !form.ageMode && !!form.ageDays) && <Field fieldKey="ageDays" label="Estimated age in days" placeholder="e.g. 21" value={form.ageDays} onChangeText={v => setField('ageDays', v)} keyboardType="number-pad" error={errors.ageDays} hint="An estimate is fine. It will be labelled as approximate." maxLength={5} />}
    </Section>
    <Disclosure title="Strain" subtitle="Optional" initiallyOpen={!!form.strain || !!form.strainType && form.strainType !== 'unknown'}>
      <Section title="Strain type"><FlowDropdown label="Strain type" placeholder="Unknown" options={[{ value: 'unknown', label: 'Unknown' }, { value: 'sativa', label: 'Sativa' }, { value: 'indica', label: 'Indica' }, { value: 'hybrid', label: 'Hybrid' }]} value={form.strainType || 'unknown'} onChange={v => setField('strainType', v)} /></Section>
      <Field label="Strain name" placeholder="e.g. Blue Dream" value={form.strain} onChangeText={v => setField('strain', v)} maxLength={120} />
    </Disclosure>
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
  return <View style={{ gap: 24 }}>
    <ValidationTarget name="groupId"><GrowingSpacePicker form={form} setField={setField} errors={errors} onSignIn={onSignIn} /></ValidationTarget>
    <View style={{ zIndex: 1000 }}><ValidationTarget name="environment"><Section title="Growing environment"><FlowDropdown label="Growing environment" placeholder="Select environment" options={[{ value: 'outdoor', label: 'Outdoor', icon: 'weather-sunny' }, { value: 'indoor', label: 'Indoor', icon: 'home-outline' }, { value: 'greenhouse', label: 'Greenhouse', icon: 'greenhouse' }]} value={form.environment} onChange={v => { setField('environment', v); if (v !== form.environment) { setField('groupId', ''); setField('groupName', ''); setField('locationMode', 'custom'); } }} />{!!errors.environment && <Text accessibilityRole="alert" style={s.error}>{errors.environment}</Text>}</Section></ValidationTarget></View>
    <ValidationTarget name="plantedIn"><Section title="Planted in"><FlowSegmented label="Planted in" options={[{ value: 'pot', label: 'A pot', icon: 'flower-tulip-outline' }, { value: 'ground', label: 'The ground', icon: 'shovel' }]} value={form.plantedIn} onChange={v => setField('plantedIn', v)} />{!!errors.plantedIn && <Text accessibilityRole="alert" style={s.error}>{errors.plantedIn}</Text>}</Section></ValidationTarget>
    {form.plantedIn === 'pot' && <PotSizeField value={form.potSize || ''} onChange={v => setField('potSize', v)} />}
    {form.environment !== 'indoor' && <Section title="Sunlight · optional"><FlowDropdown label="Sunlight exposure" placeholder="Not specified" options={[{ value: '', label: 'Not specified' }, ...sunlightOptions]} value={form.sunlightExposure || ''} onChange={v => setField('sunlightExposure', v)} /></Section>}
    {form.environment !== 'outdoor' && user && <Section title="Sensor profile · optional">
      {loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading sensor profiles" /> : failed ? <><Text style={s.error}>Sensor profiles couldn’t load.</Text><Press label="Retry sensor profiles" onPress={() => setAttempt(v => v + 1)} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Retry</Text></Press></> : <><FlowDropdown label="Sensor profile" placeholder="No sensor profile" options={[{ value: '', label: 'No sensor profile' }, ...profiles.map(p => ({ value: p.id, label: p.name }))]} value={form.sensorProfileId || ''} onChange={v => setField('sensorProfileId', v)} />{!profiles.length && <Text style={s.hint}>You can add one later in Profiles.</Text>}</>}
    </Section>}
    <Disclosure title="Soil & extra setup" subtitle="Soil type, pH, protection and companion plants" initiallyOpen={!!(form.soilType || form.soilPh)} forceOpen={!!errors.soilPh}>
      <Section title="Soil type"><FlowDropdown label="Soil type" placeholder="Not specified" options={[{ value: '', label: 'Not specified' }, ...soilOptions]} value={form.soilType || ''} onChange={v => setField('soilType', v)} /></Section>
      <Field fieldKey="soilPh" label="Soil pH" optional placeholder="Only if measured" keyboardType="decimal-pad" value={form.soilPh || ''} onChangeText={v => setField('soilPh', v)} error={errors.soilPh} maxLength={5} />
      <Section title="Permanent protection"><FlowDropdown label="Permanent protection" placeholder="Not specified" options={[{ value: '', label: 'Not specified' }, ...protectionOptions]} value={form.permanentProtection || ''} onChange={v => setField('permanentProtection', v)} /></Section>
      <Field label="Companion plants" optional placeholder="e.g. Basil, Marigold" hint="Separate plant names with commas." value={(form.companionPlants || []).join(',')} onChangeText={v => setField('companionPlants', v.split(','))} maxLength={400} />
      <Field label="Setup notes" optional placeholder="Anything else about this garden" value={form.environmentNotes || ''} onChangeText={v => setField('environmentNotes', v)} multiline maxLength={2000} />
    </Disclosure>
  </View>;
}

export function LocationStep({ form, setField, errors, onBusyChange }: StepProps) {
  return <View style={{ gap: 16 }}>
    <ValidationTarget name="location"><PlantCreationLocation form={form} setField={setField} onBusyChange={onBusyChange} /></ValidationTarget>
    {!!errors.location && <Text accessibilityRole="alert" style={s.error}>{errors.location}</Text>}
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
  return <View style={{ gap: 24 }}>
    <Section title="Plant photo · optional">
      {form.imageUri ? <Image accessibilityLabel="Selected plant photo" source={{ uri: form.imageUri }} style={{ width: '100%', height: 220, borderRadius: 18 }} resizeMode="cover" /> : <Press label="Choose plant photo" disabled={picking} onPress={() => pick(false)} style={{ minHeight: 80, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.input }}><Icon name="camera-plus-outline" size={26} /><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>Add photo</Text><Text style={s.hint}>Cover photo and first progress photo</Text></View><Icon name="plus" size={20} /></Press>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {!!form.imageUri && <Press label="Choose photo" disabled={picking} onPress={() => pick(false)} style={[s.button, s.secondary]}><Icon name="image-outline" size={19} /><Text style={s.secondaryText}>{picking ? 'Opening…' : 'Change photo'}</Text></Press>}
        {Platform.OS !== 'web' && <Press label="Take photo" disabled={picking} onPress={() => pick(true)} style={[s.button, s.secondary]}><Icon name="camera-outline" size={19} /><Text style={s.secondaryText}>Take photo</Text></Press>}
        {!!form.imageUri && <Press label="Remove photo" onPress={() => setField('imageUri', '')} style={{ padding: 14 }}><Text style={s.hint}>Remove</Text></Press>}
      </View>
      {!!photoError && <Text accessibilityLiveRegion="polite" style={s.error}>{photoError}</Text>}
    </Section>
    <Disclosure title="Care routine" subtitle="Recent care, watering and feeding routines" initiallyOpen={!!(form.wateringFrequency || form.fertilizer || form.lastWateredOn || form.lastFedOn)} forceOpen={!!(errors.lastWateredOn || errors.lastFedOn)}>
      <Field fieldKey="lastWateredOn" label="Last watered on" optional placeholder="YYYY-MM-DD, or leave unknown" value={form.lastWateredOn || ''} onChangeText={value => setField('lastWateredOn', value)} maxLength={10} error={errors.lastWateredOn} hint="Only record watering that actually happened. This adds a journal entry." />
      <Field fieldKey="lastFedOn" label="Last fed on" optional placeholder="YYYY-MM-DD, or leave unknown" value={form.lastFedOn || ''} onChangeText={value => setField('lastFedOn', value)} maxLength={10} error={errors.lastFedOn} hint="Leave blank if you have not fed this plant or are unsure." />
      <Section title="Watering frequency" subtitle="Record your current routine. This does not create a reminder."><FlowDropdown label="Watering frequency" placeholder="Not specified" options={[{ value: '', label: 'Not specified' }, ...['Every day', 'Every 2 days', 'Every 3 days', 'Weekly'].map(value => ({ value, label: value }))]} value={form.wateringFrequency || ''} onChange={v => setField('wateringFrequency', v)} /></Section>
      <Field label="Fertilizer" optional placeholder="Name of the fertilizer you use" value={form.fertilizer || ''} onChangeText={v => setField('fertilizer', v)} maxLength={200} />
      <Section title="Feeding routine" subtitle="Optional · a record of your routine, not a recommendation."><FlowDropdown label="Feeding routine" placeholder="Not specified" options={[{ value: '', label: 'Not specified' }, ...['Weekly', 'Every 14 days', 'Monthly', 'As needed'].map(value => ({ value, label: value }))]} value={form.feedingFrequency || ''} onChange={value => setField('feedingFrequency', value)} /></Section>
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
    { title: 'Growing setup', step: 1, rows: [['Garden', form.groupName], ['Environment', form.environment], ['Planted in', form.plantedIn], ...(form.plantedIn === 'pot' ? [['Pot size', form.potSize] as [string, unknown]] : []), ...(form.environment !== 'indoor' ? [['Sunlight', form.sunlightExposure] as [string, unknown]] : []), ...(form.environment !== 'outdoor' ? [['Sensor profile', form.sensorProfileId ? sensorName : ''] as [string, unknown]] : []), ['Soil type', soilOptions.find(item => item.value === form.soilType)?.label || form.soilType], ['Soil pH', form.soilPh], ['Protection', protectionOptions.find(item => item.value === form.permanentProtection)?.label || form.permanentProtection], ['Companion plants', form.companionPlants], ['Setup notes', form.environmentNotes]] },
    { title: 'Location', step: 2, rows: [['Town or area', form.locationLabel], ['Weather', form.location ? 'Location added' : 'Not enabled'], ['Coordinates', form.location ? `${form.location.lat.toFixed(4)}, ${form.location.lng.toFixed(4)}` : '']] },
    { title: 'Care and photos', step: 3, rows: [['Photo', form.imageUri ? 'Cover and first progress photo' : ''], ['Last watered', form.lastWateredOn], ['Watering routine', form.wateringFrequency], ['Last fed', form.lastFedOn], ['Feeding routine', form.feedingFrequency], ['Fertilizer', form.fertilizer], ['Pest history', form.pests], ['Training', form.trainingTags], ['Notes', form.notes]] },
  ];
  const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
  const missing = sections.map(section => ({ ...section, rows: section.rows.filter(([, value]) => !present(value)) })).filter(section => section.rows.length);
  const missingCount = missing.reduce((count, section) => count + section.rows.length, 0);
  return <View style={{ gap: 18 }}>
    <View style={{ backgroundColor: palette.soft, borderRadius: 20, overflow: 'hidden', padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {form.imageUri ? <Image accessibilityLabel="Plant cover preview" source={{ uri: form.imageUri }} style={{ width: 80, height: 90, borderRadius: 14 }} /> : <View style={{ width: 60, height: 90, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}><View style={{ transform: [{ scale: 0.5 }] }}><PlantIllustration stage={form.growthStage} /></View></View>}
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}><Text style={{ color: '#526344', fontSize: 13, letterSpacing: 0.5 }}>READY FOR YOUR GARDEN</Text><Text style={{ color: palette.dark, fontSize: 26, fontWeight: '600' }}>{form.name}</Text><Text style={{ color: '#526344', fontSize: 13 }}>{displayValue(form.growthStage)} · {displayValue(form.environment)}</Text></View>
    </View>
    {sections.map(section => <View key={section.title} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 17, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text style={[s.sectionTitle, { flex: 1 }]}>{section.title}</Text><Press label={`Edit ${section.title}`} onPress={() => edit(section.step)} style={{ padding: 10 }}><Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text></Press></View>
      {section.rows.filter(([, value]) => present(value)).map(([label, value]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}><Text style={[s.hint, { flex: 0.9 }]}>{label}</Text><Text style={{ color: palette.ink, flex: 1.2, textAlign: 'right', fontSize: 14, lineHeight: 21 }}>{displayValue(value)}</Text></View>)}
      {!section.rows.some(([, value]) => present(value)) && <Text style={s.hint}>Nothing added here yet. You can complete this later.</Text>}
    </View>)}
    {missingCount > 0 && <Disclosure title="Optional details" subtitle="Optional fields you can complete now or later">
      {missing.map(section => <View key={section.title} style={{ gap: 8 }}><Text style={s.label}>{section.title}</Text><Text style={s.hint}>{section.rows.map(([label]) => label).join(', ')}</Text><Press label={`Add optional ${section.title} details`} onPress={() => edit(section.step)} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>Add details</Text></Press></View>)}
    </Disclosure>}
    <Text style={s.hint}>Your plant, photos and any recorded care dates will be saved together. Care routines do not enable notifications.</Text>
  </View>;
}
