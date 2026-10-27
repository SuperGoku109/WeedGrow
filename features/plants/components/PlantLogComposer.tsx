import React from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { plantDay } from '@/lib/dates/plantDay';
import { useSession } from '@/services/session';
import { newLogId, readJournalEntry, type JournalEntry, type LogInput } from '@/lib/logs/journalRepository';
import { measurementFields, measurementKeys, type MeasurementKey } from '@/lib/logs/logMeasurements';
import { clearJournalDraft, journalDraftKey, readJournalDraft, writeJournalDraft, type JournalDraft } from '@/lib/logs/journalDraft';
import { journalEntryPayload, journalPayload, journalRevision, journalTargetId, type JournalAttempt } from '@/lib/logs/journalMutation';
import { inspectJournalDraft, type JournalRecovery } from '@/lib/logs/journalRecovery';
import { buildManualPlantLog, journalCategory, type JournalCategory } from '@/lib/logs/plantJournal';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import type { PlantTheme } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
import { EditorField } from './PlantEditorFields';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField, { displayDay } from './PlantDateField';
import { validateActivityForm, type ActivityErrors } from '../form/activityForm';

export const logChoices: { key: JournalCategory; label: string; title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; hint: string; detail: string }[] = [
  { key: 'watering', label: 'Watering', title: 'watering', icon: 'water-outline', detail: 'Water & amount', hint: 'Soil condition or anything you noticed…' },
  { key: 'feeding', label: 'Feeding', title: 'feeding', icon: 'flask-outline', detail: 'Nutrients & dosage', hint: 'Nutrient mix or anything you noticed…' },
  { key: 'pests', label: 'Pests', title: 'pest observation', icon: 'ladybug', detail: 'Sightings & treatment', hint: 'What you spotted and any treatment…' },
  { key: 'training', label: 'Training', title: 'training', icon: 'content-cut', detail: 'Pruning & adjustments', hint: 'Method, branches, or adjustments…' },
  { key: 'health', label: 'Health', title: 'health check', icon: 'heart-pulse', detail: 'Growth & measurements', hint: 'What you checked, symptoms, or recovery…' },
  { key: 'notes', label: 'Observation', title: 'observation', icon: 'notebook-outline', detail: 'A dated journal note', hint: 'What happened in your grow space?' },
];
export interface ActivitySaveOptions { entry?: JournalEntry; baseline?: string }
export interface ActivitySaveResult { id: string; mutationId: string }
interface Props { timeZone?: string | null; plantId: string; entry?: JournalEntry; theme: PlantTheme; name: string; initialDate: string; initialCategory?: JournalCategory; initialContext?: 'soil-check'; knownWaterings?: Record<string, JournalEntry>; onClose(): void; onViewDay?(date: string, draftKept?: boolean): void; onOpenEntry?(entry: JournalEntry): void; onSave(category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string, options?: ActivitySaveOptions): Promise<ActivitySaveResult>; onSaved(result: ActivitySaveResult, category: JournalCategory, date: string, edited: boolean, cleanupPending: boolean): void }
const initialMeasurements = (entry?: JournalEntry) => Object.fromEntries(measurementKeys.map(key => [key, String(entry?.[key] ?? '')]));
const hasAdditional = (values: Record<string, string>) => ['ph', 'heightCm', 'soilMoisture'].some(key => !!values[key]?.trim());
export default function PlantLogComposer({ timeZone, plantId, entry, theme: t, initialDate, initialCategory, initialContext, knownWaterings = {}, onClose, onViewDay, onOpenEntry, onSave, onSaved }: Props) {
  const [editingEntry, setEditingEntry] = React.useState(entry);
  const editingRef = React.useRef(entry);
  const baseline = React.useRef(entry ? journalRevision(entry) : undefined);
  const attempt = React.useRef<JournalAttempt | undefined>(undefined);
  const [context, setContext] = React.useState(initialContext);
  const [recoveryState, setRecoveryState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [recovery, setRecovery] = React.useState<JournalRecovery | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [recoveryNotice, setRecoveryNotice] = React.useState('');
  const [category, setCategory] = React.useState(initialCategory);
  const [choosingType, setChoosingType] = React.useState(false);
  const [date, setDate] = React.useState(initialDate);
  const [description, setDescription] = React.useState(entry?.description || '');
  const [measurements, setMeasurements] = React.useState<Record<string, string>>(() => initialMeasurements(entry));
  const [additional, setAdditional] = React.useState(initialContext === 'soil-check' ? ['ph', 'heightCm'].some(key => !!initialMeasurements(entry)[key]) : hasAdditional(initialMeasurements(entry)));
  const { user } = useSession();
  const requestId = React.useRef('');
  if (!requestId.current) requestId.current = newLogId();
  const [ready, setReady] = React.useState(false);
  const [pending, setPending] = React.useState<JournalDraft | null>(null);
  const [draftStatus, setDraftStatus] = React.useState<'saved' | 'error' | ''>('');
  const [draftError, setDraftError] = React.useState('');
  const draftKey = user ? journalDraftKey(user.uid, plantId, entry?.id) : '';
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState('');
  const [errors, setErrors] = React.useState<ActivityErrors>({});
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const draftSequence = React.useRef(0);
  const scroll = React.useRef<ScrollView>(null);
  const inputs = React.useRef<Partial<Record<MeasurementKey | 'description', TextInput | null>>>({});
  const fieldY = React.useRef<Record<string, number>>({});
  const pendingField = React.useRef('');
  const rememberField = (key: string, y: number) => { fieldY.current[key] = y; if (pendingField.current === key) { scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }); inputs.current[key as keyof typeof inputs.current]?.focus(); pendingField.current = ''; } };
  const meaningful = !!attempt.current || description.trim() !== (editingEntry?.description || '').trim() || measurementKeys.some(key => (measurements[key] || '') !== String(editingEntry?.[key] ?? '')) || (!!category && (date !== (editingEntry?.calendarDay || initialDate) || !!editingEntry && category !== (editingEntry.category || initialCategory)));
  const draftValue = (submitted = attempt.current): JournalDraft => ({ version: 1, requestId: requestId.current, category, date, description, measurements, ...(context ? { context } : {}), ...(editingRef.current ? { entryId: editingRef.current.id, entryBaseline: baseline.current } : {}), ...(submitted ? { attempt: submitted } : {}) });
  const draftPayload = (draft: JournalDraft) => { if (!draft.category) return undefined; const value = validateActivityForm(draft.category, draft.description, draft.date, draft.measurements, [draft.date, plantDay(new Date(), timeZone)].sort().at(-1)!); return Object.keys(value.errors).length ? undefined : journalPayload({ ...buildManualPlantLog(draft.category, value.description), ...value.values }, draft.date); };
  const loadDraft = async () => {
    setRecoveryState('loading'); setReady(false);
    try {
      const draft = draftKey ? await readJournalDraft(draftKey) : null;
      const result = draft ? await inspectJournalDraft(plantId, draft, draftPayload(draft), entry?.id) : null;
      setPending(draft); setRecovery(result); setRecoveryState('ready'); setReady(true); setDraftError('');
      if (draft && result?.kind === 'saved') {
        try { await clearJournalDraft(draftKey); setPending(null); setRecovery(null); setRecoveryNotice('Your previous activity was confirmed saved.'); }
        catch { setDraftError('The activity is saved. Its local draft could not be cleared yet.'); }
      }
    } catch (failure) { setRecoveryState('error'); setReady(true); setDraftStatus('error'); setDraftError(failure instanceof Error ? failure.message : 'Draft recovery is unavailable. The saved draft has been kept. Retry recovery.'); }
  };
  React.useEffect(() => { void loadDraft();
    // The composer is keyed to its plant/entry; changing form values must not reload storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  React.useEffect(() => {
    if (!ready || recoveryState !== 'ready' || !draftKey || pending || savingRef.current) return;
    let active = true;
    const sequence = ++draftSequence.current;
    const job = meaningful ? writeJournalDraft(draftKey, draftValue()) : clearJournalDraft(draftKey);
    void job.then(() => { if (active && sequence === draftSequence.current) { setDraftStatus(meaningful ? 'saved' : ''); setDraftError(''); } }).catch(() => { if (active && sequence === draftSequence.current) { setDraftStatus('error'); setDraftError('Could not keep this draft on your device. Keep the form open until saved.'); } });
    return () => { active = false; };
    // Draft identity and revision refs change only through recovery/submit, which persist explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, recoveryState, draftKey, pending, meaningful, category, date, description, measurements, context]);
  const selected = logChoices.find(choice => choice.key === category);
  const today = plantDay(new Date(), timeZone);
  const blocked = saving || !ready || recoveryState !== 'ready' || !!pending || !user;
  const changeMeasurement = (key: MeasurementKey, value: string) => { setMeasurements(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined })); setError(''); };
  const close = async () => { if (savingRef.current) return; if (meaningful && !pending && recoveryState === 'ready' && draftKey) { try { await writeJournalDraft(draftKey, draftValue()); } catch { setDraftStatus('error'); setDraftError('Could not keep this draft. Keep the form open, retry, or explicitly discard it.'); return; } } onClose(); };
  const viewDay = async (targetDate: string) => { if (meaningful && !pending && recoveryState === 'ready') { try { await writeJournalDraft(draftKey, draftValue()); } catch { setError('Could not keep the draft. Retry before leaving this form.'); return; } } onViewDay?.(targetDate, recovery?.kind !== 'saved'); };
  const applyRecoveredDraft = () => {
    if (!pending) return;
    const current = recovery?.entry;
    editingRef.current = current; setEditingEntry(current); baseline.current = current ? journalRevision(current) : undefined;
    const resetAttempt = !!recovery?.confirmedAttempt || recovery?.kind === 'conflict' || recovery?.kind === 'deleted';
    requestId.current = resetAttempt ? newLogId() : pending.requestId;
    attempt.current = resetAttempt ? undefined : pending.attempt;
    setCategory(pending.category); setDate(pending.date); setDescription(pending.description); setMeasurements(pending.measurements); setContext(pending.context); setAdditional(pending.context === 'soil-check' ? ['ph', 'heightCm'].some(key => !!pending.measurements[key]) : hasAdditional(pending.measurements)); setPending(null); setRecovery(null); setReviewing(false);
  };
  const submit = async () => {
    if (savingRef.current || blocked || !category || editingEntry && !meaningful) return;
    const result = validateActivityForm(category, description, date, measurements, today);
    setErrors(result.errors); setError('');
    const first = Object.keys(result.errors)[0];
    if (first) { pendingField.current = first; if (['ph', 'heightCm', 'soilMoisture'].includes(first)) setAdditional(true); scroll.current?.scrollTo({ y: Math.max(0, (fieldY.current[first] || 0) - 12), animated: true }); inputs.current[first as keyof typeof inputs.current]?.focus(); return; }
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
        await writeJournalDraft(draftKey, draftValue(submitted));
        saved = await onSave(category, result.description, date, result.values, submitted.requestId, { entry: editingRef.current, baseline: baseline.current });
      }
      draftSequence.current++;
      let cleanupPending = false;
      try { await clearJournalDraft(draftKey); } catch { cleanupPending = true; }
      onSaved(saved, category, date, edited, cleanupPending);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Check your connection and try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const additionalKeys: MeasurementKey[] = context === 'soil-check' ? ['ph', 'heightCm'] : ['ph', 'heightCm', 'soilMoisture'];
  const filledAdditional = additionalKeys.filter(key => measurements[key]?.trim()).length;
  const renderMeasurement = (key: MeasurementKey) => { const field = measurementFields[key]; return <View key={key} onLayout={event => { rememberField(key, event.nativeEvent.layout.y); }}><EditorField inputRef={node => { inputs.current[key] = node; }} label={field.label} suffix={field.unit} error={errors[key]} keyboardType="decimal-pad" editable={!blocked} value={measurements[key] || ''} placeholder={key === 'waterMl' ? 'e.g. 500' : key === 'nutrientMlPerL' ? 'e.g. 2.5' : 'Optional'} onChangeText={value => changeMeasurement(key, value)} /></View>; };
  const existingWatering = category === 'watering' ? knownWaterings[date] : undefined;
  const duplicateKnown = !!existingWatering && existingWatering.id !== editingEntry?.id;
  const startNew = async () => {
    try {
      await clearJournalDraft(draftKey);
      const current = entry && recovery?.kind !== 'deleted' ? recovery?.entry || entry : undefined;
      editingRef.current = current; setEditingEntry(current); baseline.current = current ? journalRevision(current) : undefined;
      requestId.current = newLogId(); attempt.current = undefined;
      setCategory(current ? journalCategory(current) as JournalCategory : initialCategory); setDate(current?.calendarDay || initialDate); setDescription(current?.description || ''); setMeasurements(initialMeasurements(current)); setContext(initialContext); setAdditional(hasAdditional(initialMeasurements(current))); setPending(null); setRecovery(null); setReviewing(false); setDraftStatus(''); setDraftError('');
    } catch { setDraftError('Could not clear the saved draft. Try again.'); }
  };
  const openExisting = async () => { if (!existingWatering) return; if (meaningful) { try { await writeJournalDraft(draftKey, draftValue()); } catch { setError('Could not keep your draft. Retry before opening another entry.'); return; } } onOpenEntry?.(existingWatering); };
  const duplicate = /watering already/i.test(error);
  const footerStatus = !user ? 'Sign in to save an activity.' : draftStatus === 'error' ? draftError : Object.values(errors).some(Boolean) ? 'Review the highlighted fields above.' : editingEntry && !meaningful && !choosingType ? 'No changes to save' : draftStatus === 'saved' ? 'Draft saved on this device' : '';
  const showSave = !!selected && !choosingType && !duplicateKnown;
  return <PlantEditorSheet title={editingEntry ? 'Edit activity' : context === 'soil-check' ? 'Record soil check' : 'Add activity'} theme={t} busy={saving} onClose={close} scrollRef={scroll} footer={pending || recoveryState !== 'ready' || !showSave && !error && !footerStatus ? undefined : <View style={{ gap: 10 }}>
    {!!error && <View accessibilityLiveRegion="polite" style={{ backgroundColor: t.surface, padding: 12, borderRadius: 12, borderLeftWidth: 3, borderColor: t.danger }}><Text accessibilityRole="alert" style={{ color: t.danger, fontWeight: '600' }}>{duplicate ? 'Watering is already recorded for this day' : 'Activity wasn’t saved'}</Text><Text style={{ color: t.text, lineHeight: 20, marginTop: 5 }}>{duplicate ? 'Edit the existing watering to update its details, or choose another date. Your draft is kept.' : error}</Text>{onViewDay && /watering already|entry changed|reload.*entry/i.test(error) && <GrowPress accessibilityRole="button" onPress={() => void viewDay(date)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>View this day’s journal</Text></GrowPress>}</View>}
    {selected && !choosingType && !duplicateKnown && <GrowPress accessibilityRole="button" accessibilityLabel={editingEntry ? 'Save activity changes' : context === 'soil-check' && category === 'health' ? 'Save soil check' : `Save ${selected.title}`} disabled={blocked || !!editingEntry && !meaningful} onPress={submit} style={[ds.button, { backgroundColor: t.accent, opacity: blocked || editingEntry && !meaningful ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color={t.onAccent} /> : <MaterialCommunityIcons name="check" size={20} color={t.onAccent} />}<Text style={{ color: t.onAccent, fontSize: 15, fontWeight: '700' }}>{saving ? `Saving ${selected.title}…` : editingEntry ? 'Save changes' : context === 'soil-check' && category === 'health' ? 'Save soil check' : `Save ${selected.title}`}</Text></GrowPress>}
    {!!footerStatus && !saving && <Text accessibilityLiveRegion="polite" style={{ color: draftStatus === 'error' ? t.danger : t.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>{footerStatus}</Text>}
  </View>}>
    {!!recoveryNotice && <Text accessibilityLiveRegion="polite" style={{ color: t.accent, lineHeight: 21 }}>{recoveryNotice}</Text>}
    {recoveryState === 'loading' ? <View style={{ paddingVertical: 22, gap: 12 }}><ActivityIndicator color={t.accent} /><Text style={{ color: t.muted }}>Checking saved drafts…</Text></View> : recoveryState === 'error' ? <View style={{ padding: 18, backgroundColor: t.surface, borderRadius: 16, gap: 12 }}><Text accessibilityRole="alert" style={{ color: t.danger }}>{draftError}</Text><Text style={{ color: t.muted, lineHeight: 21 }}>The saved draft has not been changed. Retry recovery before editing.</Text><GrowPress accessibilityRole="button" accessibilityLabel="Retry draft recovery" onPress={() => void loadDraft()} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent }}>Retry recovery</Text></GrowPress><GrowPress accessibilityRole="button" onPress={() => setDiscardOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.muted }}>Discard the saved draft</Text></GrowPress></View> : pending ? <View style={{ padding: 18, backgroundColor: t.surface, borderRadius: 16, gap: 12 }}>
      <MaterialCommunityIcons name={recovery?.kind === 'saved' ? 'check-circle-outline' : 'file-document-edit-outline'} color={t.accent} size={28} />
      <Text style={{ color: t.text, fontSize: 19, fontWeight: '600' }}>{recovery?.kind === 'saved' ? 'This activity is already saved' : recovery?.kind === 'conflict' ? 'The saved activity has changed' : recovery?.kind === 'deleted' ? 'The original activity was deleted' : 'Continue your unfinished activity?'}</Text>
      <Text style={{ color: t.muted, lineHeight: 22 }}>{logChoices.find(choice => choice.key === pending.category)?.label || 'Activity'} · {displayDay(pending.date)}. {recovery?.kind === 'saved' ? 'Its submission was confirmed in the journal. Only local draft cleanup is pending.' : recovery?.kind === 'conflict' ? 'Review the current record and your draft before deciding which details to use.' : recovery?.kind === 'deleted' ? 'Your draft is kept. Review it before explicitly creating a new activity.' : 'Your draft is on this device. Any earlier save attempt will be checked before retrying.'}</Text>
      {reviewing && <View style={{ gap: 12 }}>
        {recovery?.entry && <View style={{ padding: 12, backgroundColor: t.background, borderRadius: 10, gap: 6 }}><Text style={{ color: t.accent, fontWeight: '600' }}>Current saved activity</Text><Text style={{ color: t.text }}>{displayDay(recovery.entry.calendarDay || plantDay(recovery.entry.timestamp.toDate(), recovery.entry.timeZone))} · {journalCategory(recovery.entry)}</Text><Text style={{ color: t.text }}>{recovery.entry.description || 'No observation'}</Text>{measurementKeys.filter(key => recovery.entry?.[key] != null).map(key => <Text key={key} style={{ color: t.muted }}>{measurementFields[key].label}: {recovery.entry?.[key]} {measurementFields[key].unit}</Text>)}</View>}
        <View style={{ padding: 12, backgroundColor: t.background, borderRadius: 10, gap: 6 }}><Text style={{ color: t.accent, fontWeight: '600' }}>Your draft</Text><Text style={{ color: t.text }}>{pending.description || 'No observation'}</Text>{measurementKeys.filter(key => pending.measurements[key]?.trim()).map(key => <Text key={key} style={{ color: t.muted }}>{measurementFields[key].label}: {pending.measurements[key]} {measurementFields[key].unit}</Text>)}</View>
      </View>}
      {recovery?.kind === 'saved' ? <><GrowPress accessibilityRole="button" onPress={() => void viewDay(pending.date)} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent }}>View saved activity</Text></GrowPress><GrowPress accessibilityRole="button" onPress={() => void loadDraft()} style={[ds.button, { backgroundColor: t.elevated }]}><Text style={{ color: t.text }}>Retry local cleanup</Text></GrowPress></> : <>
        <GrowPress accessibilityRole="button" onPress={() => { if ((recovery?.kind === 'conflict' || recovery?.kind === 'deleted') && !reviewing) setReviewing(true); else applyRecoveredDraft(); }} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent, fontWeight: '700' }}>{recovery?.kind === 'conflict' ? reviewing ? 'Use draft on current version' : 'Review changes' : recovery?.kind === 'deleted' ? reviewing ? 'Save draft as a new activity' : 'Review deleted activity draft' : 'Resume activity'}</Text></GrowPress>
        <GrowPress accessibilityRole="button" onPress={() => void startNew()} style={[ds.button, { backgroundColor: t.elevated }]}><Text style={{ color: t.text }}>Start new</Text></GrowPress>
      </>}
      {!!draftError && <Text accessibilityRole="alert" style={{ color: t.danger }}>{draftError}</Text>}
    </View> : (!category || choosingType) ? <>
      {selected && <GrowPress accessibilityRole="button" accessibilityLabel="Back to activity details" disabled={blocked} onPress={() => setChoosingType(false)} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.accent }}>Back to details</Text></GrowPress>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{logChoices.map(choice => <View key={choice.key} style={{ width: '46%', flexGrow: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel={`Log ${choice.label}`} accessibilityState={{ selected: category === choice.key }} disabled={blocked} onPress={() => { setCategory(choice.key); if (choice.key !== category) setContext(undefined); setChoosingType(false); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ minHeight: 102, padding: 14, gap: 10, borderRadius: 16, backgroundColor: category === choice.key ? t.elevated : t.surface, borderWidth: 1, borderColor: category === choice.key ? t.accent : t.border }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><MaterialCommunityIcons name={choice.icon} size={22} color={choice.key === 'watering' ? t.water : t.accent} /><Text style={{ color: t.text, flex: 1, fontSize: 15, fontWeight: '600' }}>{choice.label}</Text>{category === choice.key && <MaterialCommunityIcons name="check" size={16} color={t.accent} />}</View><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{choice.detail}</Text></GrowPress></View>)}</View>
    </> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.border }}><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated }}><MaterialCommunityIcons name={selected?.icon || 'notebook-outline'} color={category === 'watering' ? t.water : t.accent} size={22} /></View><Text style={{ color: t.text, flex: 1, fontSize: 18, fontWeight: '600' }}>{context === 'soil-check' ? 'Soil check' : selected?.label}</Text><GrowPress accessibilityRole="button" accessibilityLabel="Change activity type" disabled={blocked} onPress={() => { setChoosingType(true); setErrors({}); setError(''); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: t.accent }}>Change</Text></GrowPress></View>
      <View onLayout={event => { rememberField('date', event.nativeEvent.layout.y); }}><PlantDateField label="Activity date" value={date} onChange={value => { setDate(value); setErrors(previous => ({ ...previous, date: undefined })); setError(''); }} today={today} disabled={blocked} />{errors.date && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 6 }}>{errors.date}</Text>}</View>
      {duplicateKnown ? <View style={{ backgroundColor: t.surface, padding: 16, borderRadius: 14, gap: 10 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Watering is already recorded</Text><Text style={{ color: t.muted, lineHeight: 21 }}>Edit that entry to update its amount or observations, or choose another date above.</Text>{onOpenEntry && <GrowPress accessibilityRole="button" accessibilityLabel="Edit existing watering" onPress={() => void openExisting()} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent, fontWeight: '600' }}>Edit existing watering</Text></GrowPress>}</View> : <>
      {context === 'soil-check' && category === 'health' && <View style={{ gap: 10 }}><Text style={{ color: t.muted, lineHeight: 21 }}>Check the soil without recording a watering.</Text>{renderMeasurement('soilMoisture')}</View>}
      {category === 'watering' && <View style={{ gap: 10 }}>{renderMeasurement('waterMl')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[250, 500, 1000].map(amount => <GrowPress key={amount} accessibilityRole="button" accessibilityLabel={`Set water amount to ${amount} ml`} accessibilityState={{ selected: measurements.waterMl === String(amount) }} disabled={blocked} onPress={() => changeMeasurement('waterMl', String(amount))} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: measurements.waterMl === String(amount) ? t.elevated : t.surface, borderWidth: measurements.waterMl === String(amount) ? 1 : 0, borderColor: t.accent }}><Text style={{ color: t.accent, fontSize: 13 }}>{amount.toLocaleString('en-GB')} ml</Text></GrowPress>)}</View><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>Water amount is optional.</Text></View>}
      {category === 'feeding' && renderMeasurement('nutrientMlPerL')}
      <View onLayout={event => { rememberField('description', event.nativeEvent.layout.y); }}><EditorField inputRef={node => { inputs.current.description = node; }} label={['watering', 'feeding'].includes(category) ? 'Observation (optional)' : 'Observation'} error={errors.description} helper={category === 'health' ? context === 'soil-check' ? 'Enter a moisture reading or describe the soil.' : 'Describe the check, or add a measurement below.' : category === 'notes' ? 'Describe what you noticed.' : undefined} editable={!blocked} value={description} onChangeText={value => { setDescription(value); setErrors(previous => ({ ...previous, description: undefined })); setError(''); }} multiline maxLength={4000} placeholder={selected?.hint} style={{ minHeight: 92, textAlignVertical: 'top' }} />{description.length > 3500 && <Text style={{ color: t.muted, fontSize: 12, textAlign: 'right', marginTop: 6 }}>{description.length.toLocaleString('en-GB')} / 4,000</Text>}</View>
      <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 14 }}><GrowPress accessibilityRole="button" accessibilityLabel="Additional measurements" accessibilityState={{ expanded: additional }} disabled={blocked} onPress={() => setAdditional(!additional)} style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: t.accent, fontWeight: '600' }}>{additional ? 'Measurements' : 'Add measurements'}{filledAdditional ? ` · ${filledAdditional} added` : ''}</Text>{!additional && <Text style={{ color: t.muted, fontSize: 12 }}>{context === 'soil-check' ? 'pH & height · optional' : 'pH, height & soil moisture · optional'}</Text>}</View><MaterialCommunityIcons name={additional ? 'chevron-up' : 'chevron-down'} color={t.accent} size={20} /></GrowPress></View>
      {additional && additionalKeys.map(renderMeasurement)}
      {meaningful && <GrowPress accessibilityRole="button" disabled={blocked} onPress={() => setDiscardOpen(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.muted, fontSize: 13 }}>Discard draft</Text></GrowPress>}
      </>}
    </>}
    {discardOpen && <ActionDialog title="Discard this draft?" description="This removes the unfinished activity from this device. Your saved journal entries are kept." confirmLabel="Discard draft" onClose={() => setDiscardOpen(false)} onConfirm={async () => { draftSequence.current++; await clearJournalDraft(draftKey); onClose(); }} />}
  </PlantEditorSheet>;
}
