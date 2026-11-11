import React from 'react';
import { Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionDialog from '@/ui/ActionDialog';
import { GrowPress } from '@/ui/GrowMotion';
import { newLogId, saveJournalEntry } from '@/lib/logs/journalRepository';
import { measurementError } from '@/lib/logs/logMeasurements';
import { plantDay } from '@/lib/dates/plantDay';
import { useSession } from '@/services/session';
import { gardenThemes } from '@/design-system/tokens/garden';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
export default function QuickWateringDialog({ plant, onClose, onSaved }: {
  plant: Plant & { id: string }; onClose(): void; onSaved(result: { plantId: string; id: string; mutationId: string }): void;
}) {
  const { user } = useSession();
  const [amount, setAmount] = React.useState('');
  const [lastAmount, setLastAmount] = React.useState('');
  const touched = React.useRef(false);
  const [date] = React.useState(() => plantDay(new Date(), plant.locationTimeZone));
  const [requestId] = React.useState(newLogId);
  const preferenceKey = user ? `weedgrow.quick-water.v1.${user.uid}.${plant.id}` : '';
  React.useEffect(() => {
    let active = true;
    if (preferenceKey) void AsyncStorage.getItem(preferenceKey).then(value => {
      if (active && value && /^\d+(\.\d+)?$/.test(value) && !measurementError('waterMl', Number(value))) {
        setLastAmount(value);
        if (!touched.current) setAmount(value);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [preferenceKey]);
  const changeAmount = (value: string) => { touched.current = true; setAmount(value); };
  const numericAmount = Number(amount.trim().replace(',', '.'));
  return <ActionDialog title="Log watering" singleAction description={
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
      <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: '500' }}>{plant.name}</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
    </View>
  } confirmLabel="Save watering" onClose={onClose} onConfirm={async () => {
    if (amount.trim()) {
      const error = measurementError('waterMl', numericAmount);
      if (error || !/^\d+(\.\d+)?$|^\.\d+$/.test(amount.trim().replace(',', '.'))) throw new Error(error || 'Enter a water amount in millilitres.');
    }
    touched.current = true;
    const saved = await saveJournalEntry(plant.id, { type: 'watering', category: 'watering', description: 'Watering recorded.', updatedBy: '', ...(amount.trim() ? { waterMl: numericAmount } : {}) }, date, undefined, requestId);
    // A device-local convenience, saved only after a successful journal write.
    // Preference storage cannot turn a completed journal save into an error.
    if (preferenceKey) {
      try { if (amount.trim()) await AsyncStorage.setItem(preferenceKey, String(numericAmount)); else await AsyncStorage.removeItem(preferenceKey); } catch {}
    }
    onSaved({ plantId: plant.id, ...saved });
  }}>{busy => <View style={{ gap: 10, paddingTop: 6, paddingBottom: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '500' }}>Amount</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>Optional</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, gap: 10 }}>
      <TextInput accessibilityLabel="Water amount in millilitres" editable={!busy} value={amount} onChangeText={changeAmount} keyboardType="decimal-pad" placeholder="Not measured" placeholderTextColor={t.muted} selectTextOnFocus style={{ flex: 1, minWidth: 0, minHeight: 56, padding: 0, color: t.text, fontSize: 18 }} />
      <Text style={{ color: t.muted, fontSize: 14 }}>ml</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <Text style={{ flex: 1, color: t.muted, fontSize: 12, lineHeight: 18 }}>{lastAmount && amount === lastAmount ? 'Last used for this plant.' : 'Leave blank if not measured.'}</Text>
      {!!amount && <GrowPress accessibilityRole="button" accessibilityLabel="Log without an amount" disabled={busy} onPress={() => changeAmount('')} style={{ minHeight: 44, paddingLeft: 8, justifyContent: 'center' }}><Text style={{ color: t.accent, fontSize: 13 }}>Clear</Text></GrowPress>}
    </View>
  </View>}</ActionDialog>;
}
