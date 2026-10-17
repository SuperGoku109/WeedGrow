import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrowPress, useReducedMotion } from '@/ui/GrowMotion';
import { localDateKey, validateLogDate, type JournalCategory } from '@/lib/logs/plantJournal';
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
interface Props { theme: PlantTheme; name: string; initialDate: string; initialCategory?: JournalCategory; onClose: () => void; onSave: (category: JournalCategory, description: string, date: string) => Promise<void> }
export default function PlantLogComposer({ theme: t, name, initialDate, initialCategory, onClose, onSave }: Props) {
  const [category, setCategory] = React.useState<JournalCategory | undefined>(initialCategory);
  const [date, setDate] = React.useState(initialDate);
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState('');
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const selected = logChoices.find(choice => choice.key === category);
  const submit = async () => {
    if (savingRef.current || !category) return;
    const dateError = validateLogDate(date);
    if (dateError) { setError(dateError); return; }
    if (['notes', 'pests', 'health', 'training'].includes(category) && !description.trim()) { setError('Add a short description so this entry is useful later.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try { await onSave(category, description, date); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Your entry is still here; please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => { if (!saving) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
      <View style={[s.sheet, { backgroundColor: t.background, borderColor: t.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={{ width: 38, height: 4, backgroundColor: t.border, borderRadius: 3, alignSelf: 'center', marginBottom: 17 }} />
        <View style={[ds.row, { marginBottom: 18 }]}><View style={{ flex: 1 }}><Text style={[ds.eyebrow, { color: t.muted }]}>Record an activity</Text><Text style={{ color: t.text, fontSize: 22, fontWeight: '700', marginTop: 7 }}>{name}’s journal</Text></View><GrowPress accessibilityRole="button" accessibilityLabel="Close log form" disabled={saving} onPress={onClose} style={s.close}><MaterialCommunityIcons name="close" size={23} color={t.muted} /></GrowPress></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{logChoices.map(choice => <View key={choice.key} style={{ width: '30.8%', flexGrow: 1 }}><GrowPress disabled={saving} accessibilityRole="button" accessibilityState={{ selected: category === choice.key }} accessibilityLabel={`Log ${choice.label}`} onPress={() => { setCategory(choice.key); setError(''); }} style={{ backgroundColor: category === choice.key ? t.accent : t.surface, borderColor: category === choice.key ? t.accent : t.border, borderWidth: 1, borderRadius: 17, paddingVertical: 14, gap: 6, alignItems: 'center' }}><MaterialCommunityIcons name={choice.icon} size={23} color={category === choice.key ? t.onAccent : t.muted} /><Text style={{ color: category === choice.key ? t.onAccent : t.text, fontSize: 14, fontWeight: '600' }}>{choice.label}</Text></GrowPress></View>)}</View>
          {!!category && <><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 21, marginBottom: 8 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Activity date</Text><GrowPress accessibilityRole="button" disabled={saving} onPress={() => setDate(localDateKey())}><Text style={{ color: t.accent, fontSize: 14, padding: 12 }}>Use today</Text></GrowPress></View>
          <TextInput accessibilityLabel="Activity date YYYY-MM-DD" editable={!saving} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={t.muted} maxLength={10} style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]} />
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', marginTop: 19, marginBottom: 9 }}>Observations {['watering', 'feeding'].includes(category) ? '(optional)' : ''}</Text>
          <TextInput accessibilityLabel="Log observations" editable={!saving} value={description} onChangeText={setDescription} multiline maxLength={4000} placeholder={selected?.hint} placeholderTextColor={t.muted} style={[s.input, { minHeight: 112, textAlignVertical: 'top', color: t.text, borderColor: t.border, backgroundColor: t.surface }]} />
          <Text style={{ color: t.muted, fontSize: 14, marginTop: 9, lineHeight: 16 }}>This records a completed activity. Past dates are welcome; future dates are for planning.</Text>
          {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 13, fontSize: 14, lineHeight: 18 }}>{error}</Text>}
          </>}
        </ScrollView>
        {!!category && <GrowPress accessibilityRole="button" accessibilityLabel="Save journal entry" disabled={saving} onPress={submit} style={[ds.button, { backgroundColor: t.accent, marginTop: 15, opacity: saving ? 0.65 : 1 }]}>{saving ? <ActivityIndicator color={t.onAccent} /> : <MaterialCommunityIcons name="check" size={20} color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{saving ? 'Saving entry…' : 'Save journal entry'}</Text></GrowPress>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 620, maxHeight: '94%', borderTopLeftRadius: 29, borderTopRightRadius: 29, borderWidth: 1, padding: 20 }, close: { minWidth: 44, minHeight: 44, padding: 10 }, input: { borderWidth: 1, borderRadius: 15, padding: 14, fontSize: 14 } });
