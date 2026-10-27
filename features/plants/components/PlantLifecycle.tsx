import PlantActionButton from './PlantActionButton';
import React from 'react';
import { Text, View } from 'react-native';
import { recordHarvest } from '../api/plantLifecycle';
import { newLogId } from '@/lib/logs/journalRepository';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { plantDay } from '@/lib/dates/plantDay';
import { deletePlantAndSubcollections, updatePlant } from '../api/plantService';
import type { Plant } from '@/firestoreModels';
import type { PlantTheme } from './plantDetailTheme';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField from './PlantDateField';
import { EditorField } from './PlantEditorFields';
import { detailStyles as ds } from './PlantDetailPanels';

export default function PlantLifecycle({ plantId, plant, theme: t, onDeleted, onSaved, open = false, onClose }: { plantId: string; plant: Plant; theme: PlantTheme; onDeleted(): void; onSaved(message: string): void; open?: boolean; onClose(): void }) {
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => { if (open) setExpanded(true); }, [open]);
  const today = plantDay(new Date(), plant.locationTimeZone);
  const [date, setDate] = React.useState(today);
  const [weight, setWeight] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [requestId, setRequestId] = React.useState(newLogId);
  const [harvesting, setHarvesting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [action, setAction] = React.useState<'archive' | 'restore' | 'harvest' | 'dead' | 'delete' | null>(null);
  const [error, setError] = React.useState('');
  const initial = React.useRef('');
  const dirty = harvesting && JSON.stringify({ date, weight, notes }) !== initial.current;
  const draft = useEditDraft(`plant.${plantId}.harvest`, { date, weight, notes, requestId }, plant as unknown as Record<string, unknown>, dirty, harvesting);
  const guard = useDiscardGuard(dirty, () => draft.clear());
  const closeHarvest = () => guard.requestClose(() => { void draft.clear().catch(() => {}); setHarvesting(false); });
  const titles = { archive: 'Archive this plant?', restore: 'Restore this plant?', harvest: 'Finish this grow?', dead: 'Mark this plant as dead?', delete: 'Permanently delete this plant?' };
  const confirm = async () => {
    if (!action || busy) return;
    setBusy(true);
    try {
      if (action === 'delete') { await deletePlantAndSubcollections(plantId); onDeleted(); return; }
      if (action === 'harvest') {
        await recordHarvest(plantId, date, weight ? Number(weight) : undefined, notes, requestId);
        await draft.clear().catch(() => {});
        guard.finish(() => { setHarvesting(false); setWeight(''); setNotes(''); setRequestId(newLogId()); });
        onSaved('Harvest recorded. Grow marked as harvested.');
      } else {
        await updatePlant(plantId, { status: action === 'archive' ? 'archived' : action === 'dead' ? 'dead' : 'active' }, { status: plant.status });
        onSaved(action === 'restore' ? 'Plant restored to your active garden.' : action === 'dead' ? 'Plant marked as dead. History retained.' : 'Plant archived. History retained.');
      }
      setAction(null);
    } finally { setBusy(false); }
  };
  const button = (label: string, handler: () => void, danger = false) => <View style={{ marginTop: 8 }}><PlantActionButton label={label} theme={t} disabled={busy} danger={danger} icon={danger ? 'trash-can-outline' : /harvest/i.test(label) ? 'basket-outline' : /restore/i.test(label) ? 'restore' : /archive/i.test(label) ? 'archive-outline' : 'leaf-off'} onPress={handler} /></View>;
  return <View style={{ marginVertical: 12, gap: 12 }}>
    <GrowPress accessibilityRole="button" accessibilityLabel="Manage plant" accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); onClose(); }} style={{ minHeight: 48, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Manage plant</Text><Text style={{ color: t.muted }}>{expanded ? '−' : '+'}</Text></GrowPress>
    {expanded && <><Text style={{ color: t.muted, lineHeight: 21 }}>Status: {plant.status}. Archiving or finishing a grow keeps its journal and photos.</Text>
      {plant.status === 'active' ? <>{button('Record harvest', () => { setDate(today); setWeight(''); setNotes(''); setRequestId(newLogId()); initial.current = JSON.stringify({ date: today, weight: '', notes: '' }); setHarvesting(true); setError(''); })}{button('Archive plant', () => setAction('archive'))}{button('Mark as dead', () => setAction('dead'))}</> : button('Restore to active garden', () => setAction('restore'))}
      {button('Permanently delete plant', () => setAction('delete'), true)}
    </>}
    {harvesting && <PlantEditorSheet title="Record harvest" subtitle={plant.name} theme={t} busy={busy} onClose={closeHarvest} footer={<View style={{ gap: 10 }}>{!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}<GrowPress accessibilityRole="button" disabled={busy || !draft.ready || !!draft.saved} onPress={() => { const invalid = validateLogDate(date, today); if (invalid || weight && (!Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 10000000)) { setError(invalid || 'Enter a valid weight in grams.'); return; } setAction('harvest'); }} style={[ds.button, { backgroundColor: t.accent }]}><Text style={{ color: t.onAccent, fontWeight: '700' }}>Save harvest and finish grow</Text></GrowPress></View>}>
      <DraftRecovery theme={t} draft={draft} apply={value => { setDate(value.date); setWeight(value.weight); setNotes(value.notes); setRequestId(value.requestId); }} />
      <PlantDateField label="Harvest date" value={date} onChange={setDate} today={today} disabled={busy || !!draft.saved} />
      <EditorField label="Harvest weight (grams, optional)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" editable={!busy && !draft.saved} />
      <EditorField label="Harvest notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={4000} editable={!busy && !draft.saved} />
      <Text style={{ color: t.muted, lineHeight: 21 }}>Saving records this harvest in the journal and changes the plant to Harvested. You can restore it later.</Text>
      {guard.dialog}
    </PlantEditorSheet>}
    {action && <ActionDialog title={titles[action]} description={action === 'delete' ? 'Permanently removes this plant, its journal, photos and saved conditions. This cannot be undone.' : action === 'harvest' ? 'Save the dated harvest and move this plant out of the active garden. Its history is kept.' : 'Your journal and photos will be kept. You can restore the plant later.'} confirmLabel={action === 'delete' ? 'Delete permanently' : action === 'harvest' ? 'Save harvest' : action === 'dead' ? 'Mark as dead' : action === 'archive' ? 'Archive' : 'Restore'} onClose={() => setAction(null)} onConfirm={confirm} />}
  </View>;
}
