import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCareTasks } from '@/features/care/useCareTasks';
import { snoozeCare, useCareSnoozes } from '@/services/careSnooze';
import { useSession } from '@/services/session';
import { saveJournalEntry } from '@/lib/logs/journalRepository';
import { skipCareTask } from '@/lib/care/skipCareTask';
import { reminderDue } from '@/lib/care/careTasks';
import { plantDay } from '@/lib/dates/plantDay';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import { palette, s } from '@/features/addPlant/components/FlowUI';
export default function CareScreen() {
  const router = useRouter();
  const { user, loading: accountLoading } = useSession();
  const { tasks, plants, loading, error, refresh, now } = useCareTasks();
  const { snoozes, error: snoozeError, refresh: refreshSnoozes } = useCareSnoozes(user?.uid);
  const [action, setAction] = React.useState<(typeof tasks)[number] | null>(null);
  const [skip, setSkip] = React.useState<(typeof tasks)[number] | null>(null);
  const [amount, setAmount] = React.useState(''); const [ph, setPh] = React.useState(''); const [notes, setNotes] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [feedbackError, setFeedbackError] = React.useState(false);
  const showError = (text: string) => { setFeedbackError(true); setMessage(text); };
  return <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 22, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
    <GrowPress accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 14 }}><Text style={{ color: palette.accent }}>← Back</Text></GrowPress><Text style={s.sectionTitle}>Your care checklist</Text>
    <Text style={s.hint}>Tasks follow your saved routines. Check the plant and its conditions before watering or feeding. Snoozes sync across your signed-in devices. Notification permissions remain device-specific.</Text>
    {!user && !accountLoading && <GrowPress accessibilityRole="button" onPress={() => router.push('/account')}><Text style={{ color: palette.accent }}>Sign in to load your tasks</Text></GrowPress>}
    {loading && <Text style={s.hint}>Loading care history…</Text>}{!!(error || snoozeError || message) && <Text accessibilityRole={error || snoozeError || feedbackError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={error || snoozeError || feedbackError ? s.error : { color: palette.accent }}>{error || snoozeError || message}</Text>}
    <GrowPress accessibilityRole="button" onPress={() => { refresh(); refreshSnoozes(); }} style={{ padding: 12 }}><Text style={{ color: palette.accent }}>Refresh checklist</Text></GrowPress>
    {!loading && !tasks.length && <Text style={s.hint}>No scheduled care yet. Open a plant’s Care plan to choose a watering or feeding routine.</Text>}
    {tasks.sort((a, b) => a.due.getTime() - b.due.getTime()).map(task => {
      const snoozed = (snoozes[task.id] || 0) > now.getTime();
      const due = reminderDue(task, snoozes[task.id] || 0, now);
      return <View key={task.id} style={{ padding: 18, backgroundColor: '#23342a', borderRadius: 18, gap: 10 }}><GrowPress accessibilityRole="button" onPress={() => router.push({ pathname: '/plant/[id]', params: { id: task.plantId } })}><Text style={{ color: '#edf0e3', fontSize: 18, fontWeight: '700' }}>{task.plantName} · {task.kind === 'watering' ? 'Water' : 'Feed'}</Text></GrowPress>
        <Text style={s.hint}>{task.skippedToday ? 'Skipped today · next check ' : snoozed ? 'Snoozed until ' : task.completedToday ? 'Recorded today · next due ' : due <= now ? 'Due · ' : 'Next due · '}{due.toLocaleString()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><GrowPress accessibilityRole="button" disabled={loading || task.completedToday || task.skippedToday} onPress={() => { setAmount(''); setPh(''); setNotes(''); setAction(task); }} style={{ paddingVertical: 12 }}><Text style={{ color: task.completedToday ? '#a9bba1' : palette.accent }}>{task.completedToday ? 'Recorded today' : task.skippedToday ? 'Skipped today' : 'Record completed care'}</Text></GrowPress><GrowPress accessibilityRole="button" disabled={task.completedToday || task.skippedToday} onPress={async () => { if (!user) return; try { await snoozeCare(user.uid, task.id, Date.now() + 3600000); } catch { showError('Could not snooze this task. Try again.'); } }} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>Snooze 1 hour</Text></GrowPress>{!task.completedToday && <GrowPress accessibilityRole="button" onPress={() => { if (task.skippedToday) void skipCareTask(task.plantId, task.kind, false, plantDay(now, task.timeZone)).catch(() => showError('Could not undo this skip.')); else setSkip(task); }} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>{task.skippedToday ? 'Undo skip' : 'Skip today'}</Text></GrowPress>}{snoozed && <GrowPress accessibilityRole="button" onPress={() => { if (user) void snoozeCare(user.uid, task.id, 0).catch(() => showError('Could not clear snooze.')); }} style={{ paddingVertical: 12 }}><Text style={{ color: palette.accent }}>Clear snooze</Text></GrowPress>}</View>
      </View>;
    })}
    {!loading && !!plants.length && <Text style={s.hint}>{plants.filter(plant => plant.status === 'active').length} active {plants.filter(plant => plant.status === 'active').length === 1 ? 'plant' : 'plants'}. Only plants with a routine appear above.</Text>}
    {action && <ActionDialog title={`Record ${action.kind}?`} description={`Confirm you have completed this care for ${action.plantName}. This creates a journal entry.`} confirmLabel="Record care" onClose={() => setAction(null)} onConfirm={async () => { await saveJournalEntry(action.plantId, { type: action.kind === 'watering' ? 'watering' : 'fertilizing', category: action.kind, description: notes.trim() || 'Completed from care checklist.', ...(amount.trim() ? action.kind === 'watering' ? { waterMl: Number(amount) } : { nutrientMlPerL: Number(amount) } : {}), ...(ph.trim() ? { ph: Number(ph) } : {}), updatedBy: '' }, plantDay(new Date(), action.timeZone), undefined, `care_${action.kind}_${plantDay(new Date(), action.timeZone)}`); setFeedbackError(false); setMessage('Care recorded.'); }}>{saving => <><TextInput editable={!saving} accessibilityLabel={action.kind === 'watering' ? 'Water amount in ml' : 'Nutrients in ml per litre'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={action.kind === 'watering' ? 'Water ml (optional)' : 'Nutrients ml/L (optional)'} placeholderTextColor="#95a88e" style={{ padding: 12, borderWidth: 1, borderColor: '#52684d', borderRadius: 10, color: '#edf0e3' }} /><TextInput editable={!saving} accessibilityLabel="Measured pH" value={ph} onChangeText={setPh} keyboardType="decimal-pad" placeholder="Measured pH (optional)" placeholderTextColor="#95a88e" style={{ padding: 12, borderWidth: 1, borderColor: '#52684d', borderRadius: 10, color: '#edf0e3' }} /><TextInput editable={!saving} accessibilityLabel="Care observations" value={notes} onChangeText={setNotes} maxLength={4000} placeholder="Observations (optional)" placeholderTextColor="#95a88e" style={{ padding: 12, borderWidth: 1, borderColor: '#52684d', borderRadius: 10, color: '#edf0e3' }} /></>}</ActionDialog>}
    {skip && <ActionDialog title="Skip this check today?" description={"This records a skipped check for " + skip.plantName + ". It does not record watering or feeding and does not reset the care routine."} confirmLabel="Skip today" onClose={() => setSkip(null)} onConfirm={async () => { await skipCareTask(skip.plantId, skip.kind, true, plantDay(now, skip.timeZone)); setFeedbackError(false); setMessage('Check skipped for today.'); }} />}
  </ScrollView>;
}
