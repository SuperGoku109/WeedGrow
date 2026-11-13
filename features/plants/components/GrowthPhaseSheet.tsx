import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import { plantDay } from '@/lib/dates/plantDay';
import { GROWTH_PHASES, growthPhase, phaseWindowLabel, type GrowthPhase } from '@/lib/plants/growthPhase';
import { stageTiming } from '@/lib/plants/stageAgeDefaults';
import { livingGrowthEnded } from '@/lib/plants/growthLifecycle';
import { POT_MATERIALS, contextLabel } from '@/lib/care/plantContext';
import { newLogId } from '@/lib/logs/journalRepository';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import { confirmGrowthStage, type GrowthPhaseDetails } from '../api/growthTracking';
import { validateActivityForm, type ActivityErrors } from '../form/activityForm';
import ActivityDisclosure from './ActivityDisclosure';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField from './PlantDateField';
import { EditorField, EditorSelect } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';

export default function GrowthPhaseSheet({ plantId, plant, theme: t, onClose, onSaved, onGuide, onBusyChange }: {
  plantId: string; plant: Plant; theme: PlantTheme; onClose(): void; onSaved(message: string): void; onGuide?(): void; onBusyChange?(busy: boolean): void;
}) {
  const baseline = React.useRef(plant);
  const current = growthPhase(baseline.current);
  const today = plantDay(new Date(), plant.locationTimeZone);
  const start = current === 'late_flowering' ? baseline.current.lateFloweringStartedOn || stageTiming(baseline.current).startedOn : stageTiming(baseline.current).startedOn;
  const dateEstimated = current === 'late_flowering' ? !baseline.current.lateFloweringStartedOn : stageTiming(baseline.current).estimated;
  const [phase, setPhase] = React.useState<GrowthPhase>(current);
  const [date, setDate] = React.useState(start);
  const [readings, setReadings] = React.useState({ ph: '', heightCm: '', soilMoisture: '' });
  const initialSetup = React.useRef({ environment: plant.environment, plantedIn: plant.plantedIn, potSize: plant.potSize || '', potMaterial: plant.potMaterial || 'unknown', careMedium: plant.careMedium || '', sunlightExposure: plant.sunlightExposure || '' });
  const [setup, setSetup] = React.useState(initialSetup.current);
  const [measurementsOpen, setMeasurementsOpen] = React.useState(false);
  const [potOpen, setPotOpen] = React.useState(false);
  const [environmentOpen, setEnvironmentOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const [requestId] = React.useState(newLogId);
  const [error, setError] = React.useState('');
  const [errors, setErrors] = React.useState<ActivityErrors>({});
  const [harvestConfirm, setHarvestConfirm] = React.useState(false);
  const ended = livingGrowthEnded(plant);
  const options = [...GROWTH_PHASES.map(item => ({ value: item.key as GrowthPhase, label: item.label })), { value: 'completed' as const, label: 'Completed' }, ...(['clone', 'unknown'].includes(current) ? [{ value: current, label: current === 'clone' ? 'Rooting' : 'Not recorded' }] : [])]
    .filter(item => !ended || ['harvested', 'drying', 'curing', 'completed'].includes(item.value));
  const hasReadings = Object.values(readings).some(value => value.trim());
  const changedSetup = Object.fromEntries(Object.entries(setup).filter(([key, value]) => value !== initialSetup.current[key as keyof typeof setup])) as GrowthPhaseDetails['setup'];
  const changed = phase !== current || date !== start || hasReadings || !!Object.keys(changedSetup || {}).length;
  const save = async () => {
    if (lock.current) return;
    const result = validateActivityForm(hasReadings ? 'measurements' : 'watering', '', date, readings, today);
    setErrors(result.errors); setError('');
    if (Object.keys(result.errors).length) { if (hasReadings) setMeasurementsOpen(true); return; }
    lock.current = true; setBusy(true); onBusyChange?.(true);
    try {
      await confirmGrowthStage(plantId, phase === 'late_flowering' ? 'flowering' : phase, date, baseline.current.stageRevision || 0, requestId, {
        lateFlowering: phase === 'late_flowering', harvest: phase === 'harvested' && !ended,
        setup: changedSetup, measurements: Object.fromEntries(Object.entries(result.values).filter(([key]) => ['ph', 'heightCm', 'soilMoisture'].includes(key))), baseline: baseline.current,
      });
      setHarvestConfirm(false); onSaved('Growth phase updated.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update the phase. Try again.'); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const readingCount = Object.values(readings).filter(value => value.trim()).length;
  return <PlantEditorSheet title="Update growth phase" subtitle={plant.name} theme={t} busy={busy} onClose={onClose} footer={<View style={{ gap: 10 }}>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, lineHeight: 20 }}>{error}</Text>}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save growth phase" disabled={busy || !changed} onPress={() => phase === 'harvested' && !ended ? setHarvestConfirm(true) : void save()} style={[ds.button, { backgroundColor: t.accent, opacity: busy || !changed ? .5 : 1 }]}>{busy ? <ActivityIndicator color={t.onAccent} /> : <MaterialCommunityIcons name="check" size={19} color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Saving…' : phase === 'harvested' && !ended ? 'Save harvest & finish grow' : 'Save changes'}</Text></GrowPress>
  </View>}>
    <EditorSelect label="Growth phase" value={phase} options={options} disabled={busy} onSelect={value => { setPhase(value as GrowthPhase); setDate(value === current ? start : today); setError(''); }} />
    <PlantDateField label={phase === current && date === start && dateEstimated ? "Phase started · estimated" : "Phase started"} value={date} onChange={value => { setDate(value); setErrors({}); }} today={today} disabled={busy} />
    {!!errors.date && <Text accessibilityRole="alert" style={{ color: t.danger }}>{errors.date}</Text>}
    {!!phaseWindowLabel(phase) && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{phaseWindowLabel(phase)}</Text>}
    <ActivityDisclosure label="Measurements" expanded={measurementsOpen} onToggle={() => setMeasurementsOpen(!measurementsOpen)} disabled={busy} theme={t} value={readingCount ? `${readingCount} added` : undefined}>
      {([{ key: 'heightCm', label: 'Height', unit: 'cm' }, { key: 'ph', label: 'pH', unit: 'pH' }, { key: 'soilMoisture', label: 'Soil moisture', unit: '%' }] as const).map(field => <EditorField key={field.key} label={field.label} suffix={field.unit} value={readings[field.key]} editable={!busy} keyboardType="decimal-pad" error={errors[field.key]} placeholder="Not measured" onChangeText={value => setReadings(previous => ({ ...previous, [field.key]: value }))} />)}
    </ActivityDisclosure>
    <ActivityDisclosure label="Pot & growing medium" expanded={potOpen} onToggle={() => setPotOpen(!potOpen)} disabled={busy} theme={t}>
      <EditorSelect label="Planted in" value={setup.plantedIn} options={[{ value: 'pot', label: 'A pot' }, { value: 'ground', label: 'The ground' }]} disabled={busy} onSelect={value => setSetup(previous => ({ ...previous, plantedIn: value as Plant['plantedIn'] }))} />
      {setup.plantedIn === 'pot' && <><EditorField label="Pot size" value={setup.potSize} editable={!busy} placeholder="e.g. 20 L" onChangeText={value => setSetup(previous => ({ ...previous, potSize: value }))} /><EditorSelect label="Pot material" value={setup.potMaterial} options={POT_MATERIALS.map(value => ({ value, label: contextLabel(value) }))} disabled={busy} onSelect={value => setSetup(previous => ({ ...previous, potMaterial: value as NonNullable<Plant['potMaterial']> }))} /></>}
      <EditorSelect label="Growing medium" value={setup.careMedium} options={[{ value: '', label: 'Not sure' }, { value: 'soil', label: 'Soil' }, { value: 'soilless_mix', label: 'Soilless mix' }, { value: 'coco', label: 'Coco' }, { value: 'other', label: 'Other' }]} disabled={busy} onSelect={value => setSetup(previous => ({ ...previous, careMedium: value }))} />
    </ActivityDisclosure>
    <ActivityDisclosure label="Environment" expanded={environmentOpen} onToggle={() => setEnvironmentOpen(!environmentOpen)} disabled={busy} theme={t}>
      <EditorSelect label="Growing environment" value={setup.environment} options={['outdoor', 'indoor', 'greenhouse'].map(value => ({ value, label: contextLabel(value) }))} disabled={busy} onSelect={value => setSetup(previous => ({ ...previous, environment: value as Plant['environment'] }))} />
      {setup.environment !== 'indoor' && <EditorSelect label="Sunlight" value={setup.sunlightExposure} options={['', 'Full Sun', 'Partial Sun', 'Mostly Shade', 'Not Sure'].map(value => ({ value, label: value || 'Not recorded' }))} disabled={busy} onSelect={value => setSetup(previous => ({ ...previous, sunlightExposure: value }))} />}
      {!!plant.groupId && setup.environment !== plant.environment && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>Changing environment moves this plant out of its current garden.</Text>}
    </ActivityDisclosure>
    {onGuide && <GrowPress accessibilityRole="button" accessibilityLabel="Open growth stage guide" disabled={busy} onPress={onGuide} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name="book-open-outline" size={17} color={t.muted} /><Text style={{ color: t.muted, fontSize: 13 }}>Explore the stage guide</Text></GrowPress>}
    {harvestConfirm && <ActionDialog title="Finish this grow?" description="This records the harvest and ends living growth. The journal is kept, and repeating watering stops." confirmLabel="Save harvest" onClose={() => setHarvestConfirm(false)} onConfirm={save} />}
  </PlantEditorSheet>;
}
