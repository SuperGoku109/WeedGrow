import React from 'react';
import { Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { daysInStage, stageLabel, stageSuggestion, stageReminderSuggestion, type GrowthProfile, type StageReviewAction } from '@/lib/plants/growthTracking';
import { plantDay } from '@/lib/dates/plantDay';
import { PLANT_STAGES } from '@/lib/plants/plantValidation';
import { confirmGrowthStage, reviewGrowthSuggestion, recordPreflowerObservation } from '../api/growthTracking';
import { updatePlant } from '../api/plantService';
import PlantActionButton from './PlantActionButton';
import PlantDateField, { displayDay } from './PlantDateField';
import { EditorField, EditorSelect, EditorTheme } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';
import { stageTiming, stageDurationLabel } from '@/lib/plants/stageAgeDefaults';
import { livingGrowthEnded, POST_HARVEST_STAGES } from '@/lib/plants/growthLifecycle';

export default function GrowthStageCard({ plantId, plant, theme: t, onHarvest, onSaved, onEditPlant, controlsOnly = false, onBusyChange }: { plantId: string; plant: Plant; theme: PlantTheme; onHarvest(): void; onSaved(message: string): void; onEditPlant?(): void; controlsOnly?: boolean; onBusyChange?(busy: boolean): void }) {
  const now = useMinuteClock();
  const today = plantDay(now, plant.locationTimeZone);
  const suggestion = stageSuggestion(plant, now);
  let upcoming = stageSuggestion(plant, now, true);
  const harvestCheck = plant.growthStage === 'flowering' ? stageReminderSuggestion(plant, now) : null;
  if (!suggestion && harvestCheck && harvestCheck.checkOn > today && (!upcoming || harvestCheck.checkOn < upcoming.checkOn)) upcoming = harvestCheck;
  const elapsed = daysInStage(plant, now);
  const timing = stageTiming(plant, now);
  const [editing, setEditing] = React.useState(controlsOnly && !suggestion);
  const [optionsOpen, setOptionsOpen] = React.useState(controlsOnly && (!suggestion || suggestion.kind === 'profile'));
  const [settings, setSettings] = React.useState(controlsOnly && suggestion?.kind === 'profile');
  const [stage, setStage] = React.useState(plant.growthStage);
  const [date, setDate] = React.useState(plant.stageStartedOn || today);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [profile, setProfile] = React.useState<GrowthProfile>(plant.growthProfile || { flowering: 'unknown' });
  const [germination, setGermination] = React.useState(plant.germinationStartedOn || '');
  const [push, setPush] = React.useState(!!plant.stageReminders?.enabled);
  const [quietStart, setQuietStart] = React.useState(String(plant.stageReminders?.quietStartHour ?? 20));
  const [quietEnd, setQuietEnd] = React.useState(String(plant.stageReminders?.quietEndHour ?? 8));
  const [observing, setObserving] = React.useState(false);
  const [observationDate, setObservationDate] = React.useState(today);
  const inFlight = React.useRef(false);
  const stageRevision = React.useRef(plant.stageRevision || 0);
  const observationRevision = React.useRef(plant.stageRevision || 0);
  const settingsBaseline = React.useRef({ growthProfile: plant.growthProfile, germinationStartedOn: plant.germinationStartedOn, stageReminders: plant.stageReminders, locationMode: plant.locationMode });
  const run = async (work: () => Promise<void>, message: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); onBusyChange?.(true); setError('');
    try { await work(); setEditing(false); setSettings(false); setObserving(false); setOptionsOpen(false); onSaved(message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the stage. Try again.'); }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const change = (target: Plant['growthStage']) => { stageRevision.current = plant.stageRevision || 0; setStage(target); setDate(today); setOptionsOpen(true); setEditing(true); setSettings(false); setObserving(false); setError(''); };
  const openSettings = () => {
    settingsBaseline.current = { growthProfile: plant.growthProfile, germinationStartedOn: plant.germinationStartedOn, stageReminders: plant.stageReminders, locationMode: plant.locationMode };
    setProfile(plant.growthProfile || { flowering: 'unknown' }); setGermination(plant.germinationStartedOn || ''); setPush(!!plant.stageReminders?.enabled);
    setQuietStart(String(plant.stageReminders?.quietStartHour ?? 20)); setQuietEnd(String(plant.stageReminders?.quietEndHour ?? 8));
    setOptionsOpen(true); setSettings(true); setEditing(false); setObserving(false); setError('');
  };
  const saveSettings = () => {
    if (inFlight.current) return;
    if (push && ![quietStart, quietEnd].every(value => /^(?:[01]?\d|2[0-3])$/.test(value.trim()))) { setError('Enter a whole hour from 0 to 23 for both quiet-hour fields.'); return; }
    const clean = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined)) as unknown as GrowthProfile;
    void run(() => updatePlant(plantId, { growthProfile: clean, ...(profile.flowering === 'age_based' ? { germinationStartedOn: germination || null } : {}), stageReminders: {
      enabled: push, quietStartHour: push ? Number(quietStart) : settingsBaseline.current.stageReminders?.quietStartHour ?? 20,
      quietEndHour: push ? Number(quietEnd) : settingsBaseline.current.stageReminders?.quietEndHour ?? 8,
    } }, settingsBaseline.current), 'Stage settings saved.');
  };
  const review = (action: StageReviewAction) => {
    if (!suggestion) return;
    const message = action === 'early_signs' ? 'Early signs recorded. Next check in 7 days.' : action === 'dismiss' ? 'Suggestion dismissed. You can reset checks in stage settings.' : action === 'snooze' ? 'Next check in 7 days.' : suggestion.kind === 'progress' ? 'Still flowering recorded. We’ll check again at the next milestone.' : `Stage unchanged. Next check in ${suggestion.repeatDays} days.`;
    void run(() => reviewGrowthSuggestion(plantId, suggestion.id, action), message);
  };
  const button = (label: string, onPress: () => void, icon: React.ComponentProps<typeof PlantActionButton>['icon'] = 'sprout-outline', primary = false) => <PlantActionButton key={label} label={label} icon={icon} primary={primary} theme={t} disabled={busy} onPress={onPress} />;
  const mutable = !plant.deleting && ['active', 'harvested'].includes(plant.status);
  const observingHere = observing && plant.growthStage === 'vegetative';
  const responding = !editing && !settings && !observingHere;
  const notYetLabel = suggestion?.kind === 'harvest' ? 'Not ready yet' : plant.growthStage === 'seedling' ? 'Still a seedling' : plant.growthStage === 'vegetative' ? 'Not flowering yet' : plant.growthStage === 'flowering' ? 'Still flowering' : plant.growthStage === 'drying' ? 'Still drying' : plant.growthStage === 'curing' ? 'Still curing' : 'Not yet';
  return <EditorTheme.Provider value={t}><View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: controlsOnly ? 0 : 1, borderRadius: 16, padding: controlsOnly ? 0 : 16, gap: 12, marginBottom: controlsOnly ? 0 : 14 }}>
    {!controlsOnly && <><Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>Growth stage · {stageLabel(plant.growthStage)}</Text>
    {stageDurationLabel(plant.growthStage) && <Text style={{ color: t.muted, fontSize: 12 }}>Stage window: {stageDurationLabel(plant.growthStage)}</Text>}
    <Text style={{ color: t.muted, lineHeight: 21 }}>{`${timing.estimated ? 'About ' : ''}${elapsed} ${elapsed === 1 ? 'day' : 'days'} in this stage · ${timing.estimated ? 'Estimated start' : 'Started'} ${displayDay(timing.startedOn)}`}</Text>
    {upcoming && upcoming.checkOn > today && <Text style={{ color: t.muted }}>Next check: {displayDay(upcoming.checkOn)}</Text>}
    {plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.accent }}>Signs of pre-flowering · Observed {displayDay(plant.preflowerObservedOn)}</Text>}
    {plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.muted, fontSize: 12 }}>Transition window: {stageDurationLabel('preflower')} · Within vegetative growth</Text>}</>}
    {suggestion && <><Text style={{ color: t.text, lineHeight: 22 }}>{suggestion.prompt}</Text>
      {responding && <>{suggestion.target && suggestion.kind !== 'progress' && button(suggestion.target === 'harvested' ? 'Mark as harvested' : `Confirm ${stageLabel(suggestion.target).toLowerCase()}`, () => suggestion.target === 'harvested' ? onHarvest() : change(suggestion.target!), 'sprout-outline', true)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{suggestion.kind === 'profile' ? button('Choose flowering profile', openSettings, 'tune') : suggestion.kind === 'location' ? onEditPlant && button('Edit plant location', onEditPlant, 'map-marker-outline') : <>
        {plant.growthStage === 'vegetative' && button('Only early signs', () => review('early_signs'))}
        {button(notYetLabel, () => review('not_yet'), 'clock-outline')}
        {button(suggestion.kind === 'progress' ? 'Check again in 7 days' : 'Remind me in 7 days', () => review('snooze'), 'bell-sleep-outline')}
      </>}
      {button('Dismiss suggestion', () => review('dismiss'), 'close')}</View></>}
    </>}
    {mutable && <>
      {plant.growthStage === 'flowering' && !livingGrowthEnded(plant) && suggestion?.target !== 'harvested' && button('Record harvest', onHarvest, 'basket-outline')}
      {plant.growthStage === 'vegetative' && !livingGrowthEnded(plant) && <>
        {(!suggestion?.target || optionsOpen || observingHere) && button(observingHere ? 'Cancel early signs' : plant.preflowerObservedOn ? 'Edit early signs date' : suggestion?.target ? 'Record dated early signs' : 'Record early flowering signs', () => { observationRevision.current = plant.stageRevision || 0; setObservationDate(plant.preflowerObservedOn || today); setObserving(!observingHere); setEditing(false); setSettings(false); setError(''); }, 'flower-outline')}
        {observing && <View style={{ gap: 12 }}><PlantDateField label="Early flowering signs observed on" value={observationDate} today={today} onChange={setObservationDate} disabled={busy} />
          {button('Save early signs', () => { void run(() => recordPreflowerObservation(plantId, observationDate, observationRevision.current), 'Early signs recorded. Next check in 7 days.'); }, 'check', true)}
        </View>}
        {!suggestion && !upcoming && plant.growthProfile?.flowering === 'photoperiod' && <Text style={{ color: t.muted, lineHeight: 21 }}>{plant.environment === 'outdoor' ? 'Seasonal checks wait for the stage timing and shortening daylight to line up. You can record signs at any time.' : 'Seasonal checks apply to outdoor plants. You can record signs or update the stage manually.'}</Text>}
      </>}
      {plant.growthStage === 'harvested' && <><Text style={{ color: t.muted, lineHeight: 21 }}>Post-harvest tracking is optional. You can finish here, or record drying and maturation milestones.</Text>{button('Start drying tracking', () => change('drying'))}{button('Finish tracking', () => change('completed'), 'check')}</>}
      <PlantActionButton label={optionsOpen ? 'Hide stage options' : 'Stage options'} icon="tune" theme={t} disabled={busy} expanded={optionsOpen} onPress={() => { setOptionsOpen(!optionsOpen); setEditing(false); setSettings(false); setObserving(false); setError(''); }} />
      {optionsOpen && <>
      {button(editing ? 'Cancel stage edit' : 'Record or change stage', () => { setError(''); if (editing) setEditing(false); else { stageRevision.current = plant.stageRevision || 0; setStage(plant.growthStage); setDate(plant.stageStartedOn || today); setEditing(true); setSettings(false); setObserving(false); } }, 'pencil-outline')}
      {editing && <View style={{ gap: 12 }}>
        <EditorSelect label="Confirmed growth stage" value={stage} disabled={busy} options={PLANT_STAGES.filter(value => livingGrowthEnded(plant) ? (POST_HARVEST_STAGES as readonly string[]).includes(value) : value !== 'harvested').map(value => ({ value, label: stageLabel(value) }))} onSelect={value => { if (value !== stage) { setStage(value as Plant['growthStage']); setDate(value === plant.growthStage ? plant.stageStartedOn || today : today); setError(''); } }} />
        <PlantDateField label={stage === 'seedling' ? 'Actual emergence date' : 'Actual stage start date'} value={date} today={today} onChange={setDate} disabled={busy} />
        <Text style={{ color: t.muted, lineHeight: 20 }}>Choose the date you observed this stage. This change will be recorded in the journal.</Text>
        {button('Save confirmed stage', () => { void run(() => confirmGrowthStage(plantId, stage, date, stageRevision.current), 'Growth stage saved.'); }, 'check', true)}
      </View>}
      {button(settings ? 'Close stage settings' : 'Stage settings', () => { if (settings) { setSettings(false); setError(''); } else openSettings(); }, 'tune')}
      {settings && <View style={{ gap: 12 }}>
        <EditorSelect label="Flowering response" value={profile.flowering} disabled={busy} options={[{ value: 'unknown', label: 'Unknown' }, { value: 'photoperiod', label: 'Photoperiod-sensitive' }, { value: 'age_based', label: 'Age-based (only if verified for this variety)' }]} onSelect={value => setProfile({ ...profile, flowering: value as GrowthProfile['flowering'] })} />
        {profile.flowering === 'age_based' && <><EditorField editable={!busy} label="First flowering check (days from germination)" keyboardType="number-pad" value={String(profile.ageCheckDays ?? 28)} onChangeText={value => setProfile({ ...profile, ageCheckDays: Number(value) })} /><EditorField editable={!busy} label="Flowering reminder (days from germination)" keyboardType="number-pad" value={String(profile.agePushDays ?? 35)} onChangeText={value => setProfile({ ...profile, agePushDays: Number(value) })} /></>}
        {profile.flowering === 'age_based' && <PlantDateField label="Known germination start (optional)" value={germination} today={today} optional disabled={busy} onChange={setGermination} />}
        {profile.flowering === 'photoperiod' && <EditorField editable={!busy} label="Flowering months (optional variety setting)" placeholder="Comma-separated months, 1–12" helper="Leave blank to use daylight trends without a fixed month restriction." value={profile.floweringMonths?.join(',') || ''} onChangeText={value => setProfile({ ...profile, ...(value ? { floweringMonths: value.split(',').map(Number) } : { floweringMonths: undefined }) })} />}
        <EditorField editable={!busy} label="Harvest review (days of flowering)" keyboardType="number-pad" value={String(profile.harvestCheckDays ?? 56)} onChangeText={value => setProfile({ ...profile, harvestCheckDays: Number(value) })} />
        <EditorSelect label="Optional stage notifications" value={push ? 'on' : 'off'} disabled={busy} options={[{ value: 'off', label: 'In-app suggestions only' }, { value: 'on', label: 'Enable rare device reminders' }]} onSelect={value => setPush(value === 'on')} />
        {push && <><EditorField editable={!busy} label="Quiet hours start (0–23)" value={quietStart} keyboardType="number-pad" onChangeText={setQuietStart} /><EditorField editable={!busy} label="Quiet hours end (0–23)" value={quietEnd} keyboardType="number-pad" onChangeText={setQuietEnd} /><Text style={{ color: t.muted }}>Also enable device reminders in Settings. Equal start and end hours disable quiet hours.</Text></>}
        <Text style={{ color: t.muted, lineHeight: 21 }}>Timing windows are provisional. Seasonal checks need an outdoor location and known establishment date. Age-based checks need a recorded germination date.</Text>
        {button('Save stage settings', saveSettings, 'check', true)}
        {button('Reset dismissed checks', () => { void run(() => updatePlant(plantId, { stageReview: null, stageRevision: (plant.stageRevision || 0) + 1 }, { stageRevision: plant.stageRevision, stageReview: plant.stageReview }), 'Stage checks reset.'); }, 'refresh')}
      </View>}
      </>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    {busy && <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 12 }}>Saving…</Text>}
  </View></EditorTheme.Provider>;
}
