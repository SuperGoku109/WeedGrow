import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { fetchSensorProfiles, potSizeOptions, sunlightOptions } from '../api/environmentApi';
import { displayValue, protectionOptions, soilOptions, stages, type FormErrors } from '../plantFlowModel';
import { Choices, Disclosure, Field, Icon, palette, PlantIllustration, Press, s, Section } from './FlowUI';

export type StepProps = { form: PlantForm; setField<K extends keyof PlantForm>(key: K, value: PlantForm[K]): void; errors: FormErrors };

export function IdentityStep({ form, setField, errors }: StepProps) {
  return <View style={{ gap: 28 }}>
    <Field label="Plant name" placeholder="e.g. Olive, Sunday, Little one" value={form.name} onChangeText={v => setField('name', v)} error={errors.name} maxLength={100} autoCapitalize="words" />
    <Section title="Where is it in its journey?" subtitle="Choose its current stage. You can update this as it grows."><Choices options={stages} value={form.growthStage} onChange={v => setField('growthStage', v)} /></Section>
    <Field label="Age in days" optional placeholder="Leave blank if unknown" value={form.ageDays} onChangeText={v => setField('ageDays', v)} keyboardType="number-pad" error={errors.ageDays} hint="Count from when this plant started. An estimate is fine." maxLength={6} />
    <Section title="Strain" subtitle="Optional · choose a type or enter a specific strain."><Choices options={['Sativa', 'Indica', 'Hybrid']} value={form.strain} onChange={v => setField('strain', form.strain === v ? '' : v)} /><Field label="Strain name or type" placeholder="e.g. Hybrid, or your own strain name" value={form.strain} onChangeText={v => setField('strain', v)} maxLength={120} /></Section>
  </View>;
}

export function SetupStep({ form, setField, errors }: StepProps) {
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (form.environment === 'outdoor') return;
    let active = true;
    setLoading(true); setFailed(false);
    fetchSensorProfiles().then(items => { if (active) setProfiles(items); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form.environment, attempt]);
  return <View style={{ gap: 28 }}>
    <Section title="Growing environment"><Choices options={[{ value: 'outdoor', label: 'Outdoor', icon: 'weather-sunny' }, { value: 'indoor', label: 'Indoor', icon: 'home-outline' }, { value: 'greenhouse', label: 'Greenhouse', icon: 'greenhouse' }]} value={form.environment} onChange={v => setField('environment', v)} /></Section>
    <Section title="A place to put down roots"><Choices options={[{ value: 'pot', label: 'In a pot', icon: 'flower-tulip-outline' }, { value: 'ground', label: 'In the ground', icon: 'shovel' }]} value={form.plantedIn} onChange={v => setField('plantedIn', v)} />
      {form.plantedIn === 'pot' && <><Text style={s.hint}>Pot size · optional</Text><Choices options={potSizeOptions} value={form.potSize || ''} onChange={v => setField('potSize', form.potSize === v ? '' : v)} /><Field label="Pot size" optional placeholder="Or enter another size, e.g. 15L" value={form.potSize || ''} onChangeText={v => setField('potSize', v)} maxLength={40} /></>}
    </Section>
    {form.environment !== 'indoor' && <Section title="Sunlight exposure" subtitle="Optional · record the light this spot receives."><Choices options={sunlightOptions} value={form.sunlightExposure || ''} onChange={v => setField('sunlightExposure', form.sunlightExposure === v ? '' : v)} /></Section>}
    {form.environment !== 'outdoor' && <Section title="Connect a sensor profile" subtitle="Optional · link an existing profile for this growing space.">
      {loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading sensor profiles" /> : failed ? <><Text style={s.error}>Sensor profiles couldn’t load. You can retry or add one later.</Text><Press label="Retry sensor profiles" onPress={() => setAttempt(v => v + 1)} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Retry</Text></Press></> : <><Choices options={[{ value: '', label: 'No sensor profile' }, ...profiles.map(p => ({ value: p.id, label: p.name }))]} value={form.sensorProfileId || ''} onChange={v => setField('sensorProfileId', v)} />{!profiles.length && <Text style={s.hint}>No profiles yet. You can create one in Profiles after adding your plant.</Text>}</>}
    </Section>}
    <Disclosure title="Soil & extra setup" subtitle="Soil type, pH, protection and companion plants" initiallyOpen={!!(form.soilType || form.soilPh || errors.soilPh)}>
      <Section title="Soil type"><Choices options={soilOptions} value={form.soilType || ''} onChange={v => setField('soilType', form.soilType === v ? '' : v)} /></Section>
      <Field label="Soil pH" optional placeholder="Only if measured" keyboardType="decimal-pad" value={form.soilPh || ''} onChangeText={v => setField('soilPh', v)} error={errors.soilPh} maxLength={5} />
      <Section title="Permanent protection"><Choices options={protectionOptions} value={form.permanentProtection || ''} onChange={v => setField('permanentProtection', form.permanentProtection === v ? '' : v)} /></Section>
      <Field label="Companion plants" optional placeholder="e.g. Basil, Marigold" hint="Separate plant names with commas." value={(form.companionPlants || []).join(',')} onChangeText={v => setField('companionPlants', v.split(','))} maxLength={400} />
      <Field label="Setup notes" optional placeholder="Anything else about this growing space" value={form.environmentNotes || ''} onChangeText={v => setField('environmentNotes', v)} multiline maxLength={2000} />
    </Disclosure>
  </View>;
}

export function LocationStep({ form, setField, errors }: StepProps) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [lat, setLat] = useState(form.location ? String(form.location.lat) : '');
  const [lng, setLng] = useState(form.location ? String(form.location.lng) : '');
  const updateCoordinates = (latitude: string, longitude: string) => {
    setLat(latitude); setLng(longitude); setMessage('');
    // Keep edits in the shared form so Continue cannot silently drop a new pin.
    setField('location', !latitude.trim() && !longitude.trim() ? null : {
      lat: latitude.trim() ? Number(latitude) : NaN,
      lng: longitude.trim() ? Number(longitude) : NaN,
    });
  };
  const hasPin = !!form.location && Number.isFinite(form.location.lat) && Number.isFinite(form.location.lng) && Math.abs(form.location.lat) <= 90 && Math.abs(form.location.lng) <= 180;
  const apply = () => {
    if (!lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) { setMessage('Enter both coordinates: latitude −90 to 90, longitude −180 to 180.'); return; }
    setField('location', { lat: Number(lat), lng: Number(lng) }); setMessage('');
  };
  const locate = async () => {
    if (locating) return;
    setLocating(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location access is off. Enter coordinates below or continue without a location.');
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setField('location', { lat: result.coords.latitude, lng: result.coords.longitude });
      setLat(String(result.coords.latitude)); setLng(String(result.coords.longitude));
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith('Location access') ? error.message : 'Couldn’t find your location. Try again, enter coordinates, or continue without it.'); }
    finally { setLocating(false); }
  };
  return <View style={{ gap: 26 }}>
    <Field label="Location nickname" optional placeholder="e.g. Back patio, Tent one" value={form.locationNickname || ''} onChangeText={v => setField('locationNickname', v)} maxLength={120} />
    <View style={{ backgroundColor: '#263b2b', borderRadius: 20, padding: 24, gap: 16 }}>
      <Icon name={hasPin ? 'map-marker-check-outline' : 'map-marker-radius-outline'} size={36} /><Text style={s.sectionTitle}>{hasPin ? 'Your spot is pinned.' : 'A little local context.'}</Text>
      <Text style={s.hint}>Add a location to connect this plant with local weather. This is optional, and you can change it later.</Text>
      {hasPin && form.location && <Text style={{ color: palette.accent, fontSize: 16 }}>{form.location.lat.toFixed(5)}, {form.location.lng.toFixed(5)}</Text>}
      <Press label="Use my location" disabled={locating} onPress={locate} style={[s.button, s.secondary]}>{locating ? <ActivityIndicator color={palette.accent} /> : <Icon name="crosshairs-gps" size={19} />}<Text style={s.secondaryText}>{locating ? 'Finding your location…' : 'Use my location'}</Text></Press>
      {form.location && <Press label="Remove location" onPress={() => { setField('location', null); setLat(''); setLng(''); }} style={{ paddingVertical: 10 }}><Text style={{ color: palette.muted, textAlign: 'center' }}>Remove location</Text></Press>}
    </View>
    {(message || errors.location) && <Text accessibilityLiveRegion="polite" style={s.error}>{message || errors.location}</Text>}
    <Disclosure title="Enter coordinates" subtitle="For a growing space somewhere else">
      <Field label="Latitude" value={lat} onChangeText={value => updateCoordinates(value, lng)} placeholder="−90 to 90" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} />
      <Field label="Longitude" value={lng} onChangeText={value => updateCoordinates(lat, value)} placeholder="−180 to 180" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} />
      <Press label="Apply coordinates" onPress={apply} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Apply coordinates</Text></Press>
      {hasPin && <Text style={s.hint}>These coordinates will be included with your plant.</Text>}
    </Disclosure>
    <Text style={s.hint}>No location to add? Continue to the next step.</Text>
  </View>;
}

export function DetailsStep({ form, setField }: StepProps) {
  const [photoError, setPhotoError] = useState('');
  const [picking, setPicking] = useState(false);
  const pick = async (camera: boolean) => {
    if (picking) return;
    setPicking(true); setPhotoError('');
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error('Camera access is off. Choose a photo instead, or add one later.'); }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setField('imageUri', result.assets[0].uri);
    } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Couldn’t open your photos. Please try again.'); }
    finally { setPicking(false); }
  };
  const toggle = (key: 'pests' | 'trainingTags', value: string) => { const current = form[key] || []; setField(key, current.includes(value) ? current.filter(v => v !== value) : [...current, value]); };
  return <View style={{ gap: 28 }}>
    <Section title="Give it a familiar face" subtitle="Optional · a photo makes your plant easy to find.">
      {form.imageUri ? <Image accessibilityLabel="Selected plant photo" source={{ uri: form.imageUri }} style={{ width: '100%', height: 220, borderRadius: 18 }} resizeMode="cover" /> : <Press label="Choose plant photo" disabled={picking} onPress={() => pick(false)} style={{ borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border, padding: 24, alignItems: 'center', gap: 12, backgroundColor: palette.input }}><Icon name="camera-plus-outline" size={36} /><Text style={s.label}>Add your first photo</Text><Text style={s.hint}>A small beginning, worth remembering.</Text></Press>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Press label="Choose photo" disabled={picking} onPress={() => pick(false)} style={[s.button, s.secondary]}><Icon name="image-outline" size={19} /><Text style={s.secondaryText}>{picking ? 'Opening…' : form.imageUri ? 'Change photo' : 'Choose photo'}</Text></Press>
        {Platform.OS !== 'web' && <Press label="Take photo" disabled={picking} onPress={() => pick(true)} style={[s.button, s.secondary]}><Icon name="camera-outline" size={19} /><Text style={s.secondaryText}>Take photo</Text></Press>}
        {!!form.imageUri && <Press label="Remove photo" onPress={() => setField('imageUri', '')} style={{ padding: 14 }}><Text style={s.hint}>Remove</Text></Press>}
      </View>
      {!!photoError && <Text accessibilityLiveRegion="polite" style={s.error}>{photoError}</Text>}
    </Section>
    <Disclosure title="Care routine" subtitle="Watering frequency and fertilizer" initiallyOpen={!!(form.wateringFrequency || form.fertilizer)}>
      <Section title="Watering frequency" subtitle="Record your current routine. This does not create a reminder."><Choices options={['Every day', 'Every 2 days', 'Every 3 days', 'Weekly']} value={form.wateringFrequency || ''} onChange={v => setField('wateringFrequency', form.wateringFrequency === v ? '' : v)} /></Section>
      <Field label="Fertilizer" optional placeholder="Name of the fertilizer you use" value={form.fertilizer || ''} onChangeText={v => setField('fertilizer', v)} maxLength={200} />
    </Disclosure>
    <Disclosure title="Plant history" subtitle="Pests and training techniques" initiallyOpen={!!(form.pests?.length || form.trainingTags?.length)}>
      <Section title="Pest history" subtitle="Select any that apply."><Choices options={['Spider Mites', 'Powdery Mildew', 'Aphids']} multiple value={form.pests || []} onChange={v => toggle('pests', v)} /></Section>
      <Section title="Training techniques"><Choices options={['LST', 'Topping', 'SCROG']} multiple value={form.trainingTags || []} onChange={v => toggle('trainingTags', v)} /></Section>
    </Disclosure>
    <Field label="Plant notes" optional placeholder="Its story so far, or anything you want to remember…" value={form.notes || ''} onChangeText={v => setField('notes', v)} multiline maxLength={4000} />
  </View>;
}

export function ReviewStep({ form, edit }: { form: PlantForm; edit(step: number): void }) {
  const [sensorName, setSensorName] = useState('Linked profile');
  useEffect(() => {
    let active = true;
    if (form.sensorProfileId) fetchSensorProfiles().then(profiles => { if (active) setSensorName(profiles.find(p => p.id === form.sensorProfileId)?.name || 'Linked profile'); }).catch(() => {});
    return () => { active = false; };
  }, [form.sensorProfileId]);
  const sections: { title: string; step: number; rows: [string, unknown][] }[] = [
    { title: 'The plant', step: 0, rows: [['Name', form.name], ['Growth stage', form.growthStage], ['Age', form.ageDays ? `${form.ageDays} days` : 'Unknown'], ['Strain', form.strain]] },
    { title: 'Growing setup', step: 1, rows: [['Environment', form.environment], ['Planted in', form.plantedIn], ...(form.plantedIn === 'pot' ? [['Pot size', form.potSize] as [string, unknown]] : []), ...(form.environment !== 'indoor' ? [['Sunlight', form.sunlightExposure] as [string, unknown]] : []), ...(form.environment !== 'outdoor' ? [['Sensor profile', form.sensorProfileId ? sensorName : 'Not linked'] as [string, unknown]] : []), ['Soil type', soilOptions.find(s => s.value === form.soilType)?.label || form.soilType], ['Soil pH', form.soilPh], ['Protection', protectionOptions.find(p => p.value === form.permanentProtection)?.label || form.permanentProtection], ['Companion plants', form.companionPlants], ['Setup notes', form.environmentNotes]] },
    { title: 'Location', step: 2, rows: [['Nickname', form.locationNickname], ['Coordinates', form.location ? `${form.location.lat.toFixed(5)}, ${form.location.lng.toFixed(5)}` : 'Not added']] },
    { title: 'Care & memories', step: 3, rows: [['Photo', form.imageUri ? 'Photo added' : 'Not added'], ['Watering', form.wateringFrequency], ['Fertilizer', form.fertilizer], ['Pest history', form.pests], ['Training', form.trainingTags], ['Notes', form.notes]] },
  ];
  return <View style={{ gap: 18 }}>
    <View style={{ backgroundColor: palette.soft, borderRadius: 20, overflow: 'hidden', padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      {form.imageUri ? <Image source={{ uri: form.imageUri }} style={{ width: 90, height: 100, borderRadius: 14 }} /> : <View style={{ width: 85, height: 110, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}><View style={{ transform: [{ scale: 0.65 }] }}><PlantIllustration stage={form.growthStage} /></View></View>}
      <View style={{ flex: 1, gap: 7 }}><Text style={{ color: '#526344', fontSize: 10, letterSpacing: 2 }}>READY TO JOIN YOUR GARDEN</Text><Text style={{ color: palette.dark, fontSize: 26, fontWeight: '600' }}>{form.name}</Text><Text style={{ color: '#526344', fontSize: 13 }}>{displayValue(form.growthStage)} · {displayValue(form.environment)}</Text></View>
    </View>
    {sections.map(section => <View key={section.title} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 17, padding: 18, gap: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={s.sectionTitle}>{section.title}</Text><Press label={`Edit ${section.title}`} onPress={() => edit(section.step)} style={{ padding: 10 }}><Text style={{ color: palette.accent, fontWeight: '600' }}>Edit</Text></Press></View>{section.rows.map(([label, value]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 }}><Text style={[s.hint, { flex: 0.9 }]}>{label}</Text><Text style={{ color: palette.ink, flex: 1.2, textAlign: 'right', fontSize: 14, lineHeight: 21 }}>{displayValue(value)}</Text></View>)}</View>)}
  </View>;
}
