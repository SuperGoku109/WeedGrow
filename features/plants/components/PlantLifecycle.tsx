import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { recordHarvest } from '../api/plantLifecycle';
import { newLogId } from '@/lib/logs/journalRepository';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { plantDay } from '@/lib/dates/plantDay';
import { updatePlant } from '../api/plantService';
import type { Plant } from '@/firestoreModels';
import type { PlantTheme } from './plantDetailTheme';
import { GrowPress } from '@/ui/GrowMotion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ActionDialog from '@/ui/ActionDialog';
export default function PlantLifecycle({ plantId, plant, theme: t }: { plantId: string; plant: Plant; theme: PlantTheme }) {
  const requestId = React.useRef(newLogId());
  const [expanded, setExpanded] = React.useState(false);
  const [date, setDate] = React.useState(() => plantDay(new Date(), plant.locationTimeZone));
  const [weight, setWeight] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [harvesting, setHarvesting] = React.useState(false);
  const [action, setAction] = React.useState<'archive' | 'restore' | 'harvest' | null>(null);
  const [error, setError] = React.useState('');
  return <View style={{ marginTop: 8, marginBottom: 8, gap: 12, padding: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 20 }}>
    <GrowPress accessibilityRole="button" accessibilityLabel="Manage plant" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}><MaterialCommunityIcons name="tune-variant" size={22} color={t.muted} /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Manage plant</Text><Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>Archive, restore or record a harvest</Text></View><MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={t.muted} /></GrowPress>
    {expanded && <><Text style={{ color: t.muted, fontSize: 14, lineHeight: 22 }}>Status: {plant.status ? plant.status.charAt(0).toUpperCase() + plant.status.slice(1) : 'Active'}. Your journal and photos are kept when you archive or finish a grow.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><GrowPress accessibilityRole="button" onPress={() => setAction(plant.status === 'active' ? 'archive' : 'restore')} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent }}>{plant.status === 'active' ? 'Archive plant' : 'Restore to active garden'}</Text></GrowPress>{plant.status === 'active' && <GrowPress accessibilityRole="button" onPress={() => setHarvesting(value => !value)} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent }}>Record harvest</Text></GrowPress>}</View>
    {harvesting && <><Text style={{ color: t.muted }}>Harvest date, measured weight in grams (optional), and notes. The harvest remains in this plant’s journal.</Text>{[['Harvest date YYYY-MM-DD', date, setDate], ['Harvest weight (grams)', weight, setWeight], ['Harvest notes', notes, setNotes]].map(([label, value, change]) => <TextInput accessibilityLabel={label as string} key={label as string} placeholder={label as string} value={value as string} onChangeText={change as (value: string) => void} maxLength={label === 'Harvest notes' ? 4000 : 20} placeholderTextColor={t.muted} style={{ color: t.text, padding: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12 }} />)}<GrowPress accessibilityRole="button" onPress={() => { const invalid = validateLogDate(date, plantDay(new Date(), plant.locationTimeZone)); if (invalid || weight && (!Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 10000000)) { setError(invalid || 'Enter a valid weight in grams.'); return; } setError(''); setAction('harvest'); }} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent }}>Save harvest and finish grow</Text></GrowPress></>}
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    {action && <ActionDialog title={action === 'harvest' ? 'Finish this grow?' : action === 'archive' ? 'Archive this plant?' : 'Restore this plant?'} description={action === 'harvest' ? 'This saves the harvest in the journal and changes the plant to harvested. You can restore it later.' : 'Your journal and photos will be kept.'} confirmLabel={action === 'harvest' ? 'Save harvest' : action === 'archive' ? 'Archive' : 'Restore'} onClose={() => setAction(null)} onConfirm={async () => {
      if (action !== 'harvest') { await updatePlant(plantId, { status: action === 'archive' ? 'archived' : 'active' }); return; }
      await recordHarvest(plantId, date, weight ? Number(weight) : undefined, notes, requestId.current);
      requestId.current = newLogId();
      setHarvesting(false); setWeight(''); setNotes('');
    }} />}
    </>}
  </View>;
}
