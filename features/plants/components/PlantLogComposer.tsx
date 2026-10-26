import { plantDay } from '@/lib/dates/plantDay';
import React from 'react';
import { useSession } from '@/services/session';
import { newLogId, validateMeasurements, type JournalEntry, type LogInput } from '@/lib/logs/journalRepository';
import { clearJournalDraft, journalDraftKey, readJournalDraft, writeJournalDraft } from '@/lib/logs/journalDraft';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrowPress, useReducedMotion } from '@/ui/GrowMotion';
import { validateLogDate, type JournalCategory } from '@/lib/logs/plantJournal';
import type { PlantTheme } from './plantDetailTheme';
import { detailStyles as ds } from './PlantDetailPanels';
export const logChoices: { key: JournalCategory; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; hint: string }[] = [
  { key: 'watering', label: 'Water', icon: 'water-outline', hint: 'Amount, soil moisture, or anything you noticed…' },
  { key: 'feeding', label: 'Feed', icon: 'flask-outline', hint: 'Nutrients, dosage, dilution, or pH…' },
  { key: 'pests', label: 'Pests', icon: 'ladybug', hint: 'What you spotted, affected leaves, treatment…' },
  { key: 'training', label: 'Training', icon: 'content-cut', hint: 'Training method, branches, or adjustments…' },
  { key: 'health', label: 'Health', icon: 'heart-pulse', hint: 'Leaf colour, stress, recovery, or symptoms…' },
  { key: 'notes', label: 'Note', icon: 'notebook-outline', hint: 'What happened in your grow space today?' },
];
interface Props { timeZone?: string | null; plantId: string; entry?: JournalEntry; theme: PlantTheme; name: string; initialDate: string; initialCategory?: JournalCategory; onClose: () => void; onSave: (category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string) => Promise<void> }
export default function PlantLogComposer({ timeZone, plantId, entry, theme: t, name, initialDate, initialCategory, onClose, onSave }: Props) {
  const [category, setCategory] = React.useState<JournalCategory | undefined>(initialCategory);
  const [date, setDate] = React.useState(initialDate);
  const [description, setDescription] = React.useState(entry?.description || '');
  const [measurements, setMeasurements] = React.useState<Record<string, string>>(Object.fromEntries(['waterMl', 'nutrientMlPerL', 'ph', 'heightCm', 'soilMoisture'].map(key => [key, String((entry as unknown as Record<string, unknown>)?.[key] ?? '')])));
  const { user } = useSession();
  const requestId = React.useRef(newLogId());
  const [ready, setReady] = React.useState(false);
  const [draftStatus, setDraftStatus] = React.useState('');
  const draftKey = user ? journalDraftKey(user.uid, plantId, entry?.id) : '';
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    if (!draftKey) return;
    readJournalDraft(draftKey).then(draft => {
      if (!active) return;
      if (draft) { setCategory(draft.category); setDate(draft.date); setDescription(draft.description); setMeasurements(draft.measurements); requestId.current = draft.requestId; setDraftStatus('Restored your unfinished entry.'); }
      setReady(true);
    }).catch(() => { if (active) { setReady(true); setDraftStatus('Could not read the local draft.'); } });
    return () => { active = false; };
  }, [draftKey]);
  React.useEffect(() => {
    if (!ready || !draftKey || savingRef.current) return;
    void writeJournalDraft(draftKey, { version: 1, requestId: requestId.current, category, date, description, measurements }).catch(() => setDraftStatus('Could not save the draft on this device. Keep this form open until saved.'));
  }, [ready, draftKey, category, date, description, measurements]);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const selected = logChoices.find(choice => choice.key === category);
  const submit = async () => {
    if (savingRef.current || !category || !ready) return;
    const dateError = validateLogDate(date, plantDay(new Date(), timeZone));
    if (dateError) { setError(dateError); return; }
    if (['notes', 'pests', 'health', 'training'].includes(category) && !description.trim()) { setError('Add a short description so this entry is useful later.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try { const values = Object.fromEntries(Object.entries(measurements).filter(([key, value]) => value.trim() !== '' && (key !== 'waterMl' || category === 'watering') && (key !== 'nutrientMlPerL' || category === 'feeding')).map(([key, value]) => [key, Number(value)])) as Partial<LogInput>;
      validateMeasurements({ type: 'note', updatedBy: '', ...values });
      await onSave(category, description, date, values, requestId.current);
      await clearJournalDraft(draftKey); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Your entry is still here; please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => { if (!saving) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
      <View style={[s.sheet, { backgroundColor: t.background, borderColor: t.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={{ width: 38, height: 4, backgroundColor: t.border, borderRadius: 3, alignSelf: 'center', marginBottom: 17 }} />
        <View style={[ds.row, { marginBottom: 18 }]}><View style={{ flex: 1 }}><Text style={[ds.eyebrow, { color: t.muted }]}>{entry ? 'Edit activity' : 'Record an activity'}</Text><Text style={{ color: t.text, fontSize: 22, fontWeight: '700', marginTop: 7 }}>{name}’s journal</Text></View><GrowPress accessibilityRole="button" accessibilityLabel="Close log form" disabled={saving || !ready} onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={23} color={t.muted} /></GrowPress></View>
        {!!draftStatus && <Text style={{ color: t.muted, marginBottom: 12 }}>{draftStatus}</Text>}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{logChoices.map(choice => <View key={choice.key} style={{ width: '30.8%', flexGrow: 1 }}><GrowPress disabled={saving || !ready} accessibilityRole="button" accessibilityState={{ selected: category === choice.key }} accessibilityLabel={`Log ${choice.label}`} onPress={() => { setCategory(choice.key); setError(''); }} style={{ backgroundColor: category === choice.key ? t.accent : t.surface, borderColor: category === choice.key ? t.accent : t.border, borderWidth: 1, borderRadius: 17, paddingVertical: 14, gap: 6, alignItems: 'center' }}><MaterialCommunityIcons name={choice.icon} size={23} color={category === choice.key ? t.onAccent : t.muted} /><Text style={{ color: category === choice.key ? t.onAccent : t.text, fontSize: 14, fontWeight: '600' }}>{choice.label}</Text></GrowPress></View>)}</View>
          {!!category && <><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 21, marginBottom: 8 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Activity date</Text><GrowPress accessibilityRole="button" disabled={saving || !ready} onPress={() => setDate(plantDay(new Date(), timeZone))}><Text style={{ color: t.accent, fontSize: 14, padding: 12 }}>Use today</Text></GrowPress></View>
          <TextInput accessibilityLabel="Activity date YYYY-MM-DD" editable={!saving && ready} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.muted} maxLength={10} style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]} />
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', marginTop: 19, marginBottom: 9 }}>Observations {['watering', 'feeding'].includes(category) ? '(optional)' : ''}</Text>
          <TextInput accessibilityLabel="Log observations" editable={!saving && ready} value={description} onChangeText={setDescription} multiline maxLength={4000} placeholder={selected?.hint} placeholderTextColor={t.muted} style={[s.input, { minHeight: 112, textAlignVertical: 'top', color: t.text, borderColor: t.border, backgroundColor: t.surface }]} />
          {(['waterMl', 'nutrientMlPerL', 'ph', 'heightCm', 'soilMoisture'] as const).filter(key => key === 'waterMl' ? category === 'watering' : key === 'nutrientMlPerL' ? category === 'feeding' : true).map(key => <View key={key}><Text style={{ color: t.text, marginTop: 12, marginBottom: 7 }}>{{ waterMl: 'Water amount (ml)', nutrientMlPerL: 'Nutrient dose (ml/L)', ph: 'pH (0–14)', heightCm: 'Height (cm)', soilMoisture: 'Soil moisture (%)' }[key]} · optional</Text><TextInput accessibilityLabel={key} keyboardType="decimal-pad" editable={!saving && ready} value={measurements[key] || ''} onChangeText={value => setMeasurements(previous => ({ ...previous, [key]: value }))} style={[s.input, { color: t.text, borderColor: t.border }]} /></View>)}
          <Text style={{ color: t.muted, fontSize: 14, marginTop: 9, lineHeight: 21 }}>This records a completed activity. Past dates are welcome; future dates are for planning.</Text>
          {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 13, fontSize: 14, lineHeight: 18 }}>{error}</Text>}
          </>}
        </ScrollView>
        <GrowPress accessibilityRole="button" disabled={saving || !ready} onPress={async () => { try { await clearJournalDraft(draftKey); onClose(); } catch { setError('Could not discard this draft. Try again.'); } }} style={{ padding: 14 }}><Text style={{ color: t.muted }}>Discard local draft</Text></GrowPress>
        {!!category && <GrowPress accessibilityRole="button" accessibilityLabel="Save journal entry" disabled={saving || !ready} onPress={submit} style={[ds.button, { backgroundColor: t.accent, marginTop: 15, opacity: saving ? 0.65 : 1 }]}>{saving ? <ActivityIndicator color={t.onAccent} /> : <MaterialCommunityIcons name="check" size={20} color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{saving ? 'Saving entry…' : 'Save journal entry'}</Text></GrowPress>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 620, maxHeight: '94%', borderTopLeftRadius: 29, borderTopRightRadius: 29, borderWidth: 1, padding: 20 }, close: { minWidth: 48, minHeight: 48, padding: 10 }, input: { borderWidth: 1, borderRadius: 15, padding: 14, fontSize: 16 } });
