import ActivityDisclosure from './ActivityDisclosure';
import { useRememberedWateringAmount } from '@/hooks/useRememberedWateringAmount';
import { rememberWateringAmount } from '@/services/wateringAmount';
import { stopWateringRoutine } from '@/services/wateringRoutine';
import RepeatWateringFields from './RepeatWateringFields';
import type { WateringRepeat } from '@/lib/logs/wateringRepeat';
import { saveErrorMessage } from '@/lib/errors/saveFeedback';
import { reportError } from '@/lib/diagnostics/reportError';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { plantDay } from '@/lib/dates/plantDay';
import { useSession } from '@/services/session';
import { newLogId, readJournalEntry, type JournalEntry, type LogInput } from '@/lib/logs/journalRepository';
import { measurementFields, measurementKeys, type MeasurementKey } from '@/lib/logs/logMeasurements';
import { journalEntryPayload, journalPayload, journalRevision, journalTargetId, type JournalAttempt } from '@/lib/logs/journalMutation';
import { buildManualPlantLog, journalCategory, type JournalCategory } from '@/lib/logs/plantJournal';
import { GrowPress } from '@/ui/GrowMotion';
import type { PlantTheme } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
import { EditorField } from './PlantEditorFields';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField from './PlantDateField';
import { validateActivityForm, type ActivityErrors } from '../form/activityForm';

export const logChoices: { key: JournalCategory | 'harvest'; label: string; title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; hint: string; detail: string }[] = [
  { key: 'watering', label: 'Watering', title: 'watering', icon: 'water-outline', detail: '', hint: 'Soil condition or anything you noticed…' },
  { key: 'feeding', label: 'Feeding', title: 'feeding', icon: 'flask-outline', detail: 'Nutrients & dosage', hint: 'Nutrient mix or anything you noticed…' },
  { key: 'health', label: 'Health', title: 'health check', icon: 'heart-pulse', detail: '', hint: 'What you checked, symptoms, or recovery…' },
  { key: 'notes', label: 'Note', title: 'note', icon: 'notebook-outline', detail: '', hint: 'What happened in your grow space?' },
  { key: 'pests', label: 'Pests', title: 'pest observation', icon: 'ladybug', detail: 'Sightings & treatment', hint: 'What you spotted and any treatment…' },
  { key: 'training', label: 'Training', title: 'training', icon: 'content-cut', detail: 'Pruning & adjustments', hint: 'Method, branches, or adjustments…' },
  { key: 'measurements', label: 'Measurements', title: 'measurements', icon: 'ruler', detail: 'pH · height · moisture', hint: 'Anything about these readings…' },
  { key: 'repotting', label: 'Repotting', title: 'repotting', icon: 'shovel', detail: '', hint: 'New pot, medium, or anything you noticed…' },
  { key: 'flushing', label: 'Flushing', title: 'flushing', icon: 'water-sync', detail: '', hint: 'Anything about this flush…' },
  { key: 'harvest', label: 'Harvesting', title: 'harvest', icon: 'basket-outline', detail: 'Harvest & finish this grow', hint: '' },
];
export interface ActivitySaveOptions { entry?: JournalEntry; baseline?: string }
export interface ActivitySaveResult { id: string; mutationId: string }
interface Props { wateringRepeat?: WateringRepeat | null; configuration?: string; timeZone?: string | null; plantId: string; entry?: JournalEntry; theme: PlantTheme; name: string; initialDate: string; initialCategory?: JournalCategory; initialContext?: 'soil-check'; knownWaterings?: Record<string, JournalEntry>; onHarvest?(date: string): void; onClose(): void; onViewDay?(date: string): void; onOpenEntry?(entry: JournalEntry): void; onSave(category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string, options?: ActivitySaveOptions): Promise<ActivitySaveResult>; onSaved(result: ActivitySaveResult, category: JournalCategory, date: string, edited: boolean): void }
const initialMeasurements = (entry?: JournalEntry) => Object.fromEntries([...measurementKeys.map(key => [key, String(entry?.[key] ?? '')]), ['moistureState', entry?.moistureState ?? ''], ['moistureConfiguration', entry?.moistureConfiguration ?? ''], ['inspectionFeedback', entry?.inspectionFeedback ?? ''], ['rainfallObservation', entry?.rainfallObservation ?? '']]);
export default function PlantLogComposer({ wateringRepeat, configuration, timeZone, plantId, entry, theme: t, initialDate, initialCategory, initialContext, knownWaterings = {}, onHarvest, onClose, onViewDay, onOpenEntry, onSave, onSaved }: Props) {
  const [editingEntry, setEditingEntry] = React.useState(entry);
  const editingRef = React.useRef(entry);
  const baseline = React.useRef(entry ? journalRevision(entry) : undefined);
  const attempt = React.useRef<JournalAttempt | undefined>(undefined);
  const [context, setContext] = React.useState(initialContext);
  const [category, setCategory] = React.useState(initialCategory);
  const [choosingType, setChoosingType] = React.useState(false);
  const [date, setDate] = React.useState(initialDate);
  const [description, setDescription] = React.useState(entry?.description || '');
  // Keep legacy watering text when editing, without adding new notes to watering.
  const wateringDescription = React.useRef(entry && journalCategory(entry) === 'watering' ? entry.description || '' : '');
  const activityDescription = category === 'watering' ? wateringDescription.current : description;
  const repeatDefaults = { repeatEnabled: wateringRepeat ? '1' : '', repeatEveryDays: String(wateringRepeat?.everyDays || ''), repeatTime: wateringRepeat?.time || '08:00', repeatWaterMl: String(wateringRepeat?.waterMl || ''), repeatTimeZone: wateringRepeat?.timeZone || timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
  const [measurements, setMeasurements] = React.useState<Record<string, string>>(() => ({ ...initialMeasurements(entry), ...repeatDefaults }));
  const [stoppingRepeat, setStoppingRepeat] = React.useState(false);
  const [repeatStopped, setRepeatStopped] = React.useState(false);
  const [amountOpen, setAmountOpen] = React.useState(entry?.waterMl != null);
  const { user } = useSession();
  const rememberedAmount = useRememberedWateringAmount(plantId, entry ? undefined : user?.uid);
  const amountTouched = React.useRef(!!entry);
  const autoAmount = React.useRef('');
  const requestId = React.useRef('');
  if (!requestId.current) requestId.current = newLogId();
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState('');
  const [errors, setErrors] = React.useState<ActivityErrors>({});
  const scroll = React.useRef<ScrollView>(null);
  const inputs = React.useRef<Partial<Record<MeasurementKey | 'description', TextInput | null>>>({});
  const fieldY = React.useRef<Record<string, number>>({});
  const pendingField = React.useRef('');
  const rememberField = (key: string, y: number) => { fieldY.current[key] = y; if (pendingField.current === key) { scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }); inputs.current[key as keyof typeof inputs.current]?.focus(); pendingField.current = ''; } };
  const meaningful = measurements.repeatChanged === '1' || !!attempt.current || activityDescription.trim() !== (editingEntry?.description || '').trim() || (measurements.rainfallObservation || '') !== (editingEntry?.rainfallObservation || '') || (measurements.inspectionFeedback || '') !== (editingEntry?.inspectionFeedback || '') || (measurements.moistureState || '') !== (editingEntry?.moistureState || '') || measurementKeys.some(key => (measurements[key] || '') !== String(editingEntry?.[key] ?? (key === 'waterMl' ? autoAmount.current : ''))) || (!!category && (date !== (editingEntry?.calendarDay || initialDate) || !!editingEntry && category !== (editingEntry.category || initialCategory)));
  const selected = logChoices.find(choice => choice.key === category);
  const today = plantDay(new Date(), timeZone);
  const blocked = saving || stoppingRepeat || !user;
  React.useEffect(() => {
    if (!entry && category === 'watering' && !saving && !amountTouched.current && rememberedAmount) {
      autoAmount.current = rememberedAmount;
      setMeasurements(previous => previous.waterMl ? previous : { ...previous, waterMl: rememberedAmount });
    }
  }, [entry, category, saving, rememberedAmount]);
  const changeMeasurement = (key: MeasurementKey, value: string) => { if (key === 'waterMl') amountTouched.current = true; setMeasurements(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined })); setError(''); };
  const close = () => { if (!savingRef.current && !stoppingRepeat) onClose(); };
  const viewDay = (targetDate: string) => { if (!savingRef.current) onViewDay?.(targetDate); };
  const submit = async () => {
    if (savingRef.current || blocked || !category || editingEntry && !meaningful) return;
    const result = validateActivityForm(category, activityDescription, date, measurements, today, editingEntry && journalCategory(editingEntry) === category ? editingEntry : undefined);
    setErrors(result.errors); setError('');
    const first = Object.keys(result.errors)[0];
    if (first) { if (first === 'waterMl') setAmountOpen(true); pendingField.current = first; scroll.current?.scrollTo({ y: Math.max(0, (fieldY.current[first] || 0) - 12), animated: true }); inputs.current[first as keyof typeof inputs.current]?.focus(); return; }
    savingRef.current = true; setSaving(true);
    try {
      const desired = { ...buildManualPlantLog(category, result.description), ...result.values };
      let saved: ActivitySaveResult | undefined;
      let edited = !!editingRef.current;
      // An uncertain write is acknowledged with exactly its original payload first.
      // Revised fields are then applied as a separate conflict-checked edit.
      if (attempt.current) {
        const previous = attempt.current;
        const previousCategory = previous.input.category || category;
        saved = await onSave(previousCategory, previous.input.description || '', previous.date, previous.input, previous.requestId, { entry: editingRef.current, baseline: previous.baseline });
        if (journalPayload(desired, date) !== journalPayload(previous.input, previous.date)) {
          const committed = await readJournalEntry(plantId, saved.id);
          if (!committed || committed.mutationId !== previous.requestId || journalEntryPayload(committed) !== journalPayload(previous.input, previous.date)) throw new Error('This entry changed after the previous save. View its journal before editing.');
          editingRef.current = committed; setEditingEntry(committed); baseline.current = journalRevision(committed); requestId.current = newLogId(); saved = undefined; edited = true;
        }
      }
      if (!saved) {
        const submitted: JournalAttempt = { requestId: requestId.current, targetId: journalTargetId(desired, date, requestId.current, editingRef.current), date, input: desired, ...(editingRef.current ? { sourceId: editingRef.current.id, baseline: baseline.current } : {}) };
        attempt.current = submitted;
        saved = await onSave(category, result.description, date, result.values, submitted.requestId, { entry: editingRef.current, baseline: baseline.current });
      }
      if (category === 'watering' && user) await rememberWateringAmount(user.uid, plantId, result.values.waterMl).catch(() => {});
      onSaved(saved, category, date, edited);
    } catch (failure) { reportError(failure, 'save'); setError(saveErrorMessage(failure, 'Could not save. Check your connection and try again.')); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const renderMeasurement = (key: MeasurementKey) => { const field = measurementFields[key]; return <View key={key} onLayout={event => { rememberField(key, event.nativeEvent.layout.y); }}><EditorField inputRef={node => { inputs.current[key] = node; }} label={field.label} hideLabel={key === 'waterMl'} suffix={field.unit} error={errors[key]} keyboardType="decimal-pad" editable={!blocked} value={measurements[key] || ''} placeholder={key === 'waterMl' ? 'e.g. 500' : key === 'nutrientMlPerL' ? 'e.g. 2.5' : 'Optional'} onChangeText={value => changeMeasurement(key, value)} /></View>; };
  const existingWatering = category === 'watering' ? knownWaterings[date] : undefined;
  const duplicateKnown = !!existingWatering && existingWatering.id !== editingEntry?.id;
  const openExisting = () => { if (!savingRef.current && existingWatering) onOpenEntry?.(existingWatering); };
  const duplicate = /watering already/i.test(error);
  const footerStatus = !user ? 'Sign in to save an activity.' : Object.values(errors).some(Boolean) ? 'Review the highlighted fields above.' : editingEntry && !meaningful && !choosingType ? 'No changes to save' : '';
  const showSave = !!selected && !choosingType && !duplicateKnown;
  const renderObservation = () => (<View onLayout={event => { rememberField('description', event.nativeEvent.layout.y); }}><EditorField inputRef={node => { inputs.current.description = node; }} label={category === 'notes' ? 'Note' : category === 'measurements' ? 'Observation (optional)' : ['feeding', 'repotting', 'flushing'].includes(category || '') ? 'Observation (optional)' : 'Observation'} error={errors.description} helper={category === 'health' ? context === 'soil-check' ? 'Choose a soil condition or describe the soil.' : 'Describe the check, or choose a soil condition.' : category === 'notes' ? 'Describe what you noticed.' : undefined} editable={!blocked} value={description} onChangeText={value => { setDescription(value); setErrors(previous => ({ ...previous, description: undefined })); setError(''); }} multiline maxLength={4000} placeholder={selected?.hint} style={{ minHeight: 92, textAlignVertical: 'top' }} />{description.length > 3500 && <Text style={{ color: t.muted, fontSize: 12, textAlign: 'right', marginTop: 6 }}>{description.length.toLocaleString('en-GB')} / 4,000</Text>}</View>);
  return <PlantEditorSheet title={editingEntry ? 'Edit activity' : context === 'soil-check' ? 'Record soil check' : 'Add activity'} theme={t} busy={saving || stoppingRepeat} onClose={close} scrollRef={scroll} footer={!showSave && !error && !footerStatus ? undefined : <View style={{ gap: 10 }}>
    {!!error && <View accessibilityLiveRegion="polite" style={{ backgroundColor: t.surface, padding: 12, borderRadius: 12, borderLeftWidth: 3, borderColor: t.danger }}><Text accessibilityRole="alert" style={{ color: t.danger, fontWeight: '600' }}>{duplicate ? 'Watering is already recorded for this day' : 'Activity wasn’t saved'}</Text><Text style={{ color: t.text, lineHeight: 20, marginTop: 5 }}>{duplicate ? 'Edit the existing watering to update its details, or choose another date.' : error}</Text>{onViewDay && /watering already|entry changed|reload.*entry/i.test(error) && <GrowPress accessibilityRole="button" onPress={() => void viewDay(date)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>View this day’s journal</Text></GrowPress>}</View>}
    {selected && !choosingType && !duplicateKnown && <GrowPress accessibilityRole="button" accessibilityLabel={editingEntry ? 'Save activity changes' : context === 'soil-check' && category === 'health' ? 'Save soil check' : `Save ${selected.title}`} disabled={blocked || !!editingEntry && !meaningful} onPress={submit} style={[ds.button, { backgroundColor: t.accent, opacity: blocked || editingEntry && !meaningful ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color={t.onAccent} /> : <MaterialCommunityIcons name="check" size={20} color={t.onAccent} />}<Text style={{ color: t.onAccent, fontSize: 15, fontWeight: '700' }}>{saving ? `Saving ${selected.title}…` : editingEntry ? 'Save changes' : context === 'soil-check' && category === 'health' ? 'Save soil check' : `Save ${selected.title}`}</Text></GrowPress>}
    {!!footerStatus && !saving && <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>{footerStatus}</Text>}
  </View>}>
    {(!category || choosingType) ? <>
      {selected && <GrowPress accessibilityRole="button" accessibilityLabel="Back to activity details" disabled={blocked} onPress={() => setChoosingType(false)} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.accent }}>Back to details</Text></GrowPress>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{logChoices.filter(choice => choice.key !== 'harvest').map(choice => <View key={choice.key} style={{ width: '46%', flexGrow: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel={`Log ${choice.label}`} accessibilityState={{ selected: category === choice.key }} disabled={blocked} onPress={async () => { if (choice.key === 'harvest') { onHarvest?.(date); return; } setCategory(choice.key); if (choice.key !== category) { setContext(undefined); if (choice.key !== 'measurements') setMeasurements(previous => ({ ...previous, ph: '', heightCm: '', soilMoisture: '', moistureState: '', rainfallObservation: '', inspectionFeedback: '' })); } setChoosingType(false); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ flex: 1, minHeight: 56, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: category === choice.key ? t.elevated : t.surface, borderWidth: 1, borderColor: category === choice.key ? t.accent : t.elevated }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><MaterialCommunityIcons name={choice.icon} size={20} color={choice.key === 'watering' ? t.water : t.accent} /><Text style={{ color: t.text, flex: 1, fontSize: 13, fontWeight: '600' }}>{choice.label}</Text></View></GrowPress></View>)}</View>
      {!!onHarvest && !editingEntry && <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingTop: 12 }}>
        <GrowPress accessibilityRole="button" accessibilityLabel="Log Harvesting" disabled={blocked} onPress={() => onHarvest(date)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: t.surface }}>
          <MaterialCommunityIcons name="basket-outline" size={20} color={t.muted} />
          <View style={{ flex: 1, gap: 3 }}><Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>Harvesting</Text><Text style={{ color: t.muted, fontSize: 11 }}>Finish this grow</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={t.muted} />
        </GrowPress>
      </View>}
    </> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.border }}><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated }}><MaterialCommunityIcons name={selected?.icon || 'notebook-outline'} color={category === 'watering' ? t.water : t.accent} size={22} /></View><Text style={{ color: t.text, flex: 1, fontSize: 18, fontWeight: '600' }}>{context === 'soil-check' ? 'Soil check' : selected?.label}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Change activity type" disabled={blocked} onPress={() => { setChoosingType(true); setErrors({}); setError(''); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: t.accent }}>Change</Text></GrowPress></View>
      <View onLayout={event => { rememberField('date', event.nativeEvent.layout.y); }}><PlantDateField label="Activity date" value={date} onChange={value => { setDate(value); setErrors(previous => ({ ...previous, date: undefined })); setError(''); }} today={today} disabled={blocked} />{errors.date && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 6 }}>{errors.date}</Text>}</View>
      {category === 'watering' && !!wateringRepeat && !repeatStopped && <View style={{ backgroundColor: t.surface, borderRadius: 14, padding: 14, gap: 6 }}><Text style={{ color: t.text }}>Repeats every {wateringRepeat.everyDays} {wateringRepeat.everyDays === 1 ? 'day' : 'days'} at {wateringRepeat.time} · {wateringRepeat.waterMl} ml</Text><GrowPress accessibilityRole="button" accessibilityLabel="Stop repeating watering" disabled={blocked} onPress={async () => { setStoppingRepeat(true); try { await stopWateringRoutine(plantId); setRepeatStopped(true); setMeasurements(previous => ({ ...previous, repeatEnabled: '', repeatChanged: '' })); } catch (failure) { setError(saveErrorMessage(failure, 'Could not stop repeating watering. Try again.')); } finally { setStoppingRepeat(false); } }} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: t.accent }}>{stoppingRepeat ? 'Stopping…' : 'Stop repeating'}</Text></GrowPress></View>}
      {duplicateKnown ? <View style={{ backgroundColor: t.surface, padding: 16, borderRadius: 14, gap: 10 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Watering is already recorded</Text><Text style={{ color: t.muted, lineHeight: 21 }}>Edit that entry to update its details, or choose another date above.</Text>{onOpenEntry && <GrowPress accessibilityRole="button" accessibilityLabel="Edit existing watering" onPress={() => void openExisting()} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent, fontWeight: '600' }}>Edit existing watering</Text></GrowPress>}</View> : <>
      {context === 'soil-check' && category === 'health' && <View style={{ gap: 10 }}><Text style={{ color: t.muted, lineHeight: 21 }}>Check the soil without recording a watering.</Text></View>}
      {category === 'health' && <View style={{ gap: 8 }}><Text style={{ color: t.text }}>How does the soil feel?</Text><Text style={{ color: t.muted }}>User-reported root-zone check</Text><View style={{ flexDirection: 'row', gap: 8 }}>{(['DRY', 'MOIST', 'WET'] as const).map(state => <GrowPress key={state} accessibilityRole="button" accessibilityLabel={`Soil feels ${state.toLowerCase()}`} accessibilityState={{ selected: measurements.moistureState === state }} disabled={blocked} onPress={() => setMeasurements(previous => ({ ...previous, moistureState: previous.moistureState === state ? '' : state, moistureConfiguration: editingEntry ? editingEntry.moistureConfiguration ?? '' : configuration ?? '' }))} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderColor: measurements.moistureState === state ? t.accent : t.border, borderRadius: 12 }}><Text style={{ color: t.accent }}>{state[0] + state.slice(1).toLowerCase()}</Text></GrowPress>)}</View></View>}
      {category === 'health' && context !== 'soil-check' && <View style={{ gap: 8 }}><Text style={{ color: t.text }}>Rain observed here (optional)</Text><Text style={{ color: t.muted }}>User-confirmed rainfall, recorded separately from watering.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['LIGHT', 'MODERATE', 'HEAVY'] as const).map(value => <GrowPress key={value} accessibilityRole="button" accessibilityLabel={`Reported ${value.toLowerCase()} rain`} accessibilityState={{ selected: measurements.rainfallObservation === value }} disabled={blocked} onPress={() => setMeasurements(previous => ({ ...previous, rainfallObservation: previous.rainfallObservation === value ? '' : value }))} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderColor: measurements.rainfallObservation === value ? t.accent : t.border, borderRadius: 12 }}><Text style={{ color: t.accent }}>{value[0] + value.slice(1).toLowerCase()}</Text></GrowPress>)}</View></View>}
      {context === 'soil-check' && !!measurements.moistureState && <View style={{ gap: 8 }}><Text style={{ color: t.muted }}>Was this check well timed? (optional)</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([{ value: 'useful', label: 'Useful' }, { value: 'too_early', label: 'Too early' }, { value: 'too_late', label: 'Too late' }] as const).map(option => <GrowPress key={option.value} accessibilityRole="button" accessibilityState={{ selected: measurements.inspectionFeedback === option.value }} disabled={blocked} onPress={() => setMeasurements(previous => ({ ...previous, inspectionFeedback: previous.inspectionFeedback === option.value ? '' : option.value }))} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: t.accent }}>{option.label}</Text></GrowPress>)}</View></View>}
      {category === 'watering' && <ActivityDisclosure label="Water amount" hint={!editingEntry && !!measurements.waterMl && measurements.waterMl === rememberedAmount ? 'Using last amount · optional' : 'Optional'} value={measurements.waterMl ? `${measurements.waterMl} ml` : undefined} expanded={amountOpen} disabled={blocked} onToggle={() => setAmountOpen(!amountOpen)} theme={t}>
        {renderMeasurement('waterMl')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[250, 500, 1000].map(amount => <GrowPress key={amount} accessibilityRole="button" accessibilityLabel={`Set water amount to ${amount} ml`} accessibilityState={{ selected: measurements.waterMl === String(amount) }} disabled={blocked} onPress={() => changeMeasurement('waterMl', String(amount))} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: measurements.waterMl === String(amount) ? t.accent : t.elevated }}><Text style={{ color: measurements.waterMl === String(amount) ? t.onAccent : t.muted, fontSize: 13 }}>{amount.toLocaleString('en-GB')} ml</Text></GrowPress>)}</View>
        {!!measurements.waterMl && <GrowPress accessibilityRole="button" accessibilityLabel="Remove water amount" disabled={blocked} onPress={() => changeMeasurement('waterMl', '')} style={{ minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: t.border, paddingHorizontal: 10 }}><MaterialCommunityIcons name="close-circle-outline" size={16} color={t.muted} /><Text style={{ color: t.muted, fontSize: 13 }}>Remove amount</Text></GrowPress>}
      </ActivityDisclosure>}
      {category === 'watering' && !editingEntry && (!wateringRepeat || repeatStopped) && <RepeatWateringFields theme={t} values={measurements} errors={errors} disabled={blocked} onChange={(key, value) => { setMeasurements(previous => ({ ...previous, [key]: value, repeatChanged: '1' })); setErrors(previous => ({ ...previous, [key]: undefined })); setError(''); }} />}
      {category === 'feeding' && renderMeasurement('nutrientMlPerL')}
      {category !== 'watering' && category !== 'measurements' && renderObservation()}
      {category === 'measurements' && (['ph', 'heightCm', 'soilMoisture'] as MeasurementKey[]).map(renderMeasurement)}
      {category === 'measurements' && renderObservation()}
      </>}
    </>}
  </PlantEditorSheet>;
}
