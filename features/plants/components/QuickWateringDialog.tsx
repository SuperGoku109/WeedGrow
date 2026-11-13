import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';
import { useRememberedWateringAmount } from '@/hooks/useRememberedWateringAmount';
import { rememberWateringAmount } from '@/services/wateringAmount';
import ActivityDisclosure from './ActivityDisclosure';
import ActionDialog from '@/ui/ActionDialog';
import { GrowPress } from '@/ui/GrowMotion';
import { newLogId, saveJournalEntry } from '@/lib/logs/journalRepository';
import { measurementError } from '@/lib/logs/logMeasurements';
import { plantDay } from '@/lib/dates/plantDay';
import { useSession } from '@/services/session';
import { gardenThemes } from '@/design-system/tokens/garden';
import type { Plant } from '@/firestoreModels';

const t = { ...gardenThemes.grove, surface: '#29413b', elevated: '#36534a', border: '#6c8b7c', accent: '#b4dee3', onAccent: '#17363a', water: '#b4dee3', muted: '#b6ccc4' };
export default function QuickWateringDialog({ plant, onClose, onSaved }: {
  plant: Plant & { id: string }; onClose(): void; onSaved(result: { plantId: string; id: string; mutationId: string }): void;
}) {
  const { user } = useSession();
  const [amount, setAmount] = React.useState('');
  const lastAmount = useRememberedWateringAmount(plant.id, user?.uid);
  const [amountOpen, setAmountOpen] = React.useState(false);
  const touched = React.useRef(false);
  const [date] = React.useState(() => plantDay(new Date(), plant.locationTimeZone));
  const [requestId] = React.useState(newLogId);
  React.useEffect(() => { if (lastAmount && !touched.current) setAmount(lastAmount); }, [lastAmount]);
  const changeAmount = (value: string) => { touched.current = true; setAmount(value); };
  const numericAmount = Number(amount.trim().replace(',', '.'));
  return <ActionDialog title="Log watering" tone="water" singleAction description={
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }}>{plant.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: '#b4dee30c' }}><MaterialCommunityIcons name="calendar-blank-outline" size={13} color={t.muted} /><Text style={{ color: t.muted, fontSize: 12 }}>{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text></View>
    </View>
  } confirmLabel="Save watering" onClose={onClose} onConfirm={async () => {
    if (amount.trim()) {
      const error = measurementError('waterMl', numericAmount);
      if (error || !/^\d+(\.\d+)?$|^\.\d+$/.test(amount.trim().replace(',', '.'))) { setAmountOpen(true); throw new Error(error || 'Enter a water amount in millilitres.'); }
    }
    touched.current = true;
    const saved = await saveJournalEntry(plant.id, { type: 'watering', category: 'watering', description: 'Watering recorded.', updatedBy: '', ...(amount.trim() ? { waterMl: numericAmount } : {}) }, date, undefined, requestId);
    if (user) await rememberWateringAmount(user.uid, plant.id, amount.trim() ? numericAmount : undefined).catch(() => {});
    onSaved({ plantId: plant.id, ...saved });
  }}>{busy => <View style={{ gap: 10, paddingTop: 6, paddingBottom: 4 }}>
    <ActivityDisclosure label="Water amount" hint={amount && amount === lastAmount ? 'Using last amount · optional' : 'Optional'} value={amount ? `${amount} ml` : undefined} expanded={amountOpen} disabled={busy} onToggle={() => { touched.current = true; setAmountOpen(!amountOpen); }} theme={t}>
    <View testID="input-focus-frame" style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, gap: 10 }}>
      <TextInput accessibilityLabel="Water amount in millilitres" editable={!busy} value={amount} onChangeText={changeAmount} keyboardType="decimal-pad" placeholder="Not measured" placeholderTextColor={t.muted} selectTextOnFocus style={{ flex: 1, minWidth: 0, minHeight: 56, padding: 0, color: t.text, fontSize: 18 }} />
      <Text style={{ color: t.muted, fontSize: 14 }}>ml</Text>
    </View>
    {!!amount && <GrowPress accessibilityRole="button" accessibilityLabel="Remove water amount" disabled={busy} onPress={() => changeAmount('')} style={{ minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 10 }}><Text style={{ color: t.muted, fontSize: 13 }}>Remove amount</Text></GrowPress>}
    </ActivityDisclosure>
  </View>}</ActionDialog>;
}
