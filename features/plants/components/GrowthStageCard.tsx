import React from 'react';
import { Linking, Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { daysInStage, stageLabel, stageSuggestion, stageReminderSuggestion, type GrowthProfile, type StageReviewAction } from '@/lib/plants/growthTracking';
import { plantDay } from '@/lib/dates/plantDay';
import { PLANT_STAGES } from '@/lib/plants/plantValidation';
import { confirmGrowthStage, reviewGrowthSuggestion, recordPreflowerObservation } from '../api/growthTracking';
import { updatePlant } from '../api/plantService';
import PlantActionButton from './PlantActionButton';
import PlantDateField from './PlantDateField';
import { EditorField, EditorSelect, EditorTheme } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';
import { stageTiming, stageDurationLabel } from '@/lib/plants/stageAgeDefaults';
import { livingGrowthEnded, POST_HARVEST_STAGES } from '@/lib/plants/growthLifecycle';

export default function GrowthStageCard({ plantId, plant, theme: t, onHarvest, onSaved, onEditPlant }: { plantId: string; plant: Plant; theme: PlantTheme; onHarvest(): void; onSaved(message: string): void; onEditPlant?(): void }) {
  const now = useMinuteClock();
  const today = plantDay(now, plant.locationTimeZone);
  const suggestion = stageSuggestion(plant, now);
  let upcoming = stageSuggestion(plant, now, true);
  const harvestCheck = plant.growthStage === 'flowering' ? stageReminderSuggestion(plant, now) : null;
  if (!suggestion && harvestCheck && harvestCheck.checkOn > today && (!upcoming || harvestCheck.checkOn < upcoming.checkOn)) upcoming = harvestCheck;
  const elapsed = daysInStage(plant, now);
  const timing = stageTiming(plant, now);
  const [editing, setEditing] = React.useState(false);
  const [settings, setSettings] = React.useState(false);
  const [stage, setStage] = React.useState(plant.growthStage);
  const [date, setDate] = React.useState(plant.stageStartedOn || today);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [profile, setProfile] = React.useState<GrowthProfile>(plant.growthProfile || { flowering: 'unknown' });
  const [germination, setGermination] = React.useState(plant.germinationStartedOn || '');
  const [push, setPush] = React.useState(!!plant.stageReminders?.enabled);
  const [quietStart, setQuietStart] = React.useState(String(plant.stageReminders?.quietStartHour ?? 20));
  const [quietEnd, setQuietEnd] = React.useState(String(plant.stageReminders?.quietEndHour ?? 8));
  const [guide, setGuide] = React.useState(false);
  const [observing, setObserving] = React.useState(false);
  const [observationDate, setObservationDate] = React.useState(today);
  const inFlight = React.useRef(false);
  const run = async (work: () => Promise<void>, message: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try { await work(); setEditing(false); setSettings(false); setObserving(false); onSaved(message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the stage. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const change = (target: Plant['growthStage']) => { setStage(target); setDate(today); setEditing(true); setSettings(false); setObserving(false); setError(''); };
  const review = (action: StageReviewAction) => { if (suggestion) void run(() => reviewGrowthSuggestion(plantId, suggestion.id, action), action === 'early_signs' ? 'Early signs recorded. Stage remains vegetative.' : 'Stage review saved.'); };
  const button = (label: string, onPress: () => void, icon: React.ComponentProps<typeof PlantActionButton>['icon'] = 'sprout-outline') => <PlantActionButton key={label} label={label} icon={icon} theme={t} disabled={busy} onPress={onPress} />;
  const mutable = !plant.deleting && ['active', 'harvested'].includes(plant.status);
  return <EditorTheme.Provider value={t}><View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, marginBottom: 14 }}>
    <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>Growth stage · {stageLabel(plant.growthStage)}</Text>
    {stageDurationLabel(plant.growthStage) && <Text style={{ color: t.muted, fontSize: 12 }}>Estimated stage duration: {stageDurationLabel(plant.growthStage)}</Text>}
    <Text style={{ color: t.muted, lineHeight: 21 }}>{`${timing.estimated ? 'About ' : ''}${elapsed} ${elapsed === 1 ? 'day' : 'days'} in this stage · ${timing.estimated ? 'Estimated start' : 'Started'} ${timing.startedOn}`}</Text>
    {timing.estimated && <Text style={{ color: t.muted, lineHeight: 21 }}>This stage’s timing is estimated. Record the actual start date whenever you know it.</Text>}
    {upcoming && upcoming.checkOn > today && <Text style={{ color: t.muted }}>Next estimated stage check: {upcoming.checkOn}. Confirm from physical signs.</Text>}
    {plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.accent }}>Signs of pre-flowering · Observed {plant.preflowerObservedOn}</Text>}
    {plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.muted, fontSize: 12 }}>Transition window: {stageDurationLabel('preflower')} · Within vegetative growth</Text>}
    {suggestion && <><Text style={{ color: t.text, lineHeight: 22 }}>{suggestion.prompt}</Text>
      {suggestion.target && suggestion.kind !== 'progress' && button(suggestion.target === 'harvested' ? 'Mark as harvested' : `Confirm ${stageLabel(suggestion.target).toLowerCase()}`, () => suggestion.target === 'harvested' ? onHarvest() : change(suggestion.target!))}
      {suggestion.kind === 'profile' ? button('Choose flowering profile', () => setSettings(true), 'tune') : suggestion.kind === 'location' ? onEditPlant && button('Edit plant location', onEditPlant, 'map-marker-outline') : <>
        {plant.growthStage === 'vegetative' && button('Only early signs', () => review('early_signs'))}
        {button('Not yet', () => review('not_yet'), 'clock-outline')}
        {button(suggestion.kind === 'progress' ? 'Check again in 7 days' : 'Remind me in 7 days', () => review('snooze'), 'bell-sleep-outline')}
      </>}
      {button('Dismiss suggestion', () => review('dismiss'), 'close')}
    </>}
    {plant.growthStage === 'flowering' && <>{button(guide ? 'Hide harvest guide' : 'Check harvest guide', () => setGuide(!guide), 'book-open-outline')}{guide && <View style={{ gap: 8 }}><Text style={{ color: t.muted, lineHeight: 21 }}>Check several cones: mature hops often feel dry and papery, with golden yellow lupulin and a characteristic hoppy aroma. Variety and growing conditions affect maturity; weeks in flower alone cannot confirm readiness.</Text><PlantActionButton label="Read Oregon State Extension guide" icon="open-in-new" theme={t} onPress={() => { void Linking.openURL('https://extension.oregonstate.edu/catalog/em-9115-growing-hops-home-garden').catch(() => setError('Could not open the guide. Try again.')); }} /></View>}</>}
    {mutable && <>
      {plant.growthStage === 'flowering' && !livingGrowthEnded(plant) && suggestion?.target !== 'harvested' && button('Record harvest', onHarvest, 'basket-outline')}
      {plant.growthStage === 'vegetative' && !livingGrowthEnded(plant) && <>
        {button(observing ? 'Cancel early signs' : 'Record early flowering signs', () => { setObservationDate(plant.preflowerObservedOn || today); setObserving(!observing); setEditing(false); setSettings(false); }, 'flower-outline')}
        {observing && <View style={{ gap: 12 }}><PlantDateField label="Early flowering signs observed on" value={observationDate} today={today} onChange={setObservationDate} disabled={busy} />
          {button('Save early signs', () => { void run(() => recordPreflowerObservation(plantId, observationDate, plant.stageRevision || 0), 'Early signs recorded. Stage remains vegetative.'); }, 'check')}
        </View>}
        {!suggestion && !upcoming && plant.growthProfile?.flowering === 'photoperiod' && <Text style={{ color: t.muted, lineHeight: 21 }}>Seasonal flowering checks wait for the stage timing and shortening daylight to line up. You can record physical signs at any time.</Text>}
      </>}
      {plant.growthStage === 'harvested' && <><Text style={{ color: t.muted, lineHeight: 21 }}>Post-harvest tracking is optional. You can finish here, or record drying and maturation milestones.</Text>{button('Start drying tracking', () => change('drying'))}{button('Finish tracking', () => change('completed'), 'check')}</>}
      {button(editing ? 'Cancel stage edit' : 'Record or change stage', () => { if (editing) setEditing(false); else { setStage(plant.growthStage); setDate(plant.stageStartedOn || today); setEditing(true); setSettings(false); } }, 'pencil-outline')}
      {editing && <View style={{ gap: 12 }}>
        <EditorSelect label="Confirmed growth stage" value={stage} disabled={busy} options={PLANT_STAGES.filter(value => livingGrowthEnded(plant) ? (POST_HARVEST_STAGES as readonly string[]).includes(value) : value !== 'harvested').map(value => ({ value, label: stageLabel(value) }))} onSelect={value => setStage(value as Plant['growthStage'])} />
        <PlantDateField label={stage === 'seedling' ? 'Actual emergence date' : 'Actual stage start date'} value={date} today={today} onChange={setDate} disabled={busy} />
        <Text style={{ color: t.muted, lineHeight: 20 }}>Choose the date you observed this stage. This change will be recorded in the journal.</Text>
        {button('Save confirmed stage', () => { void run(() => confirmGrowthStage(plantId, stage, date, plant.stageRevision || 0), 'Growth stage saved.'); }, 'check')}
      </View>}
      {button(settings ? 'Close stage settings' : 'Stage settings', () => { if (!settings) { setProfile(plant.growthProfile || { flowering: 'unknown' }); setGermination(plant.germinationStartedOn || ''); setPush(!!plant.stageReminders?.enabled); setQuietStart(String(plant.stageReminders?.quietStartHour ?? 20)); setQuietEnd(String(plant.stageReminders?.quietEndHour ?? 8)); } setSettings(!settings); setEditing(false); }, 'tune')}
      {settings && <View style={{ gap: 12 }}>
        <EditorSelect label="Flowering response" value={profile.flowering} disabled={busy} options={[{ value: 'unknown', label: 'Unknown' }, { value: 'photoperiod', label: 'Photoperiod-sensitive' }, { value: 'age_based', label: 'Age-based (only if verified for this variety)' }]} onSelect={value => setProfile({ ...profile, flowering: value as GrowthProfile['flowering'] })} />
        {profile.flowering === 'age_based' && <><EditorField label="First flowering check (days from germination)" keyboardType="number-pad" value={String(profile.ageCheckDays ?? 28)} onChangeText={value => setProfile({ ...profile, ageCheckDays: Number(value) })} /><EditorField label="Flowering reminder (days from germination)" keyboardType="number-pad" value={String(profile.agePushDays ?? 35)} onChangeText={value => setProfile({ ...profile, agePushDays: Number(value) })} /></>}
        {profile.flowering === 'age_based' && <PlantDateField label="Known germination start (optional)" value={germination} today={today} optional disabled={busy} onChange={setGermination} />}
        {profile.flowering === 'photoperiod' && <EditorField label="Flowering months (optional variety setting)" placeholder="Comma-separated months, 1–12" helper="Leave blank to use daylight trends without a fixed month restriction." value={profile.floweringMonths?.join(',') || ''} onChangeText={value => setProfile({ ...profile, ...(value ? { floweringMonths: value.split(',').map(Number) } : { floweringMonths: undefined }) })} />}
        <EditorField label="Harvest review (days of flowering)" keyboardType="number-pad" value={String(profile.harvestCheckDays ?? 56)} onChangeText={value => setProfile({ ...profile, harvestCheckDays: Number(value) })} />
        <EditorSelect label="Optional stage notifications" value={push ? 'on' : 'off'} disabled={busy} options={[{ value: 'off', label: 'In-app suggestions only' }, { value: 'on', label: 'Enable rare device reminders' }]} onSelect={value => setPush(value === 'on')} />
        {push && <><EditorField label="Quiet hours start (0–23)" value={quietStart} keyboardType="number-pad" onChangeText={setQuietStart} /><EditorField label="Quiet hours end (0–23)" value={quietEnd} keyboardType="number-pad" onChangeText={setQuietEnd} /><Text style={{ color: t.muted }}>Also enable device reminders in Settings. Equal start and end hours disable quiet hours.</Text></>}
        <Text style={{ color: t.muted, lineHeight: 21 }}>Timing windows are provisional. Seasonal checks need an outdoor location and known establishment date. Age-based checks need a recorded germination date.</Text>
        {button('Save stage settings', () => { const clean = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined)) as unknown as GrowthProfile; void run(() => updatePlant(plantId, { growthProfile: clean, ...(profile.flowering === 'age_based' ? { germinationStartedOn: germination || null } : {}), stageReminders: { enabled: push, quietStartHour: Number(quietStart), quietEndHour: Number(quietEnd) } }, { growthProfile: plant.growthProfile, germinationStartedOn: plant.germinationStartedOn, stageReminders: plant.stageReminders, locationMode: plant.locationMode }), 'Stage settings saved.'); }, 'check')}
        {button('Reset dismissed checks', () => { void run(() => updatePlant(plantId, { stageReview: null, stageRevision: (plant.stageRevision || 0) + 1 }, { stageRevision: plant.stageRevision, stageReview: plant.stageReview }), 'Stage checks reset.'); }, 'refresh')}
      </View>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
  </View></EditorTheme.Provider>;
}
