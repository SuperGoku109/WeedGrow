import React from 'react';
import { Text, TextInput, View } from 'react-native';
import ActionDialog from '@/ui/ActionDialog';
import { newLogId, saveJournalEntry } from '@/lib/logs/journalRepository';
import { plantDay } from '@/lib/dates/plantDay';
import { gardenThemes } from '@/design-system/tokens/garden';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
export default function QuickWateringDialog({ plant, onClose, onSaved }: {
  plant: Plant & { id: string }; onClose(): void; onSaved(result: { plantId: string; id: string; mutationId: string }): void;
}) {
  const [amount, setAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [date] = React.useState(() => plantDay(new Date(), plant.locationTimeZone));
  const [requestId] = React.useState(newLogId);
  return <ActionDialog title="Log watering" description={`${plant.name} · ${new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Save only watering you have completed.`} confirmLabel="Save watering" onClose={onClose} onConfirm={async () => {
    const saved = await saveJournalEntry(plant.id, { type: 'watering', category: 'watering', description: notes.trim() || 'Watering recorded.', updatedBy: '', ...(amount.trim() ? { waterMl: Number(amount) } : {}) }, date, undefined, requestId);
    onSaved({ plantId: plant.id, ...saved });
  }}>{busy => <View style={{ gap: 10 }}>
    <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Water amount <Text style={{ color: t.muted, fontWeight: '400' }}>· optional</Text></Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12 }}><TextInput accessibilityLabel="Water amount in millilitres" editable={!busy} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Leave blank if unknown" placeholderTextColor={t.muted} style={{ flex: 1, minWidth: 0, minHeight: 48, padding: 12, color: t.text, fontSize: 16 }} /><Text style={{ paddingRight: 14, color: t.muted }}>ml</Text></View>
    <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', marginTop: 6 }}>Notes <Text style={{ color: t.muted, fontWeight: '400' }}>· optional</Text></Text>
    <TextInput accessibilityLabel="Watering notes" editable={!busy} value={notes} onChangeText={setNotes} multiline maxLength={4000} placeholder="Anything you noticed…" placeholderTextColor={t.muted} style={{ minHeight: 88, padding: 12, textAlignVertical: 'top', borderWidth: 1, borderColor: t.border, borderRadius: 12, color: t.text, fontSize: 16 }} />
  </View>}</ActionDialog>;
}
