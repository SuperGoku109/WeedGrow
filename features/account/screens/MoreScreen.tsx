import React from 'react';
import { Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { savePreferences, usePreferences } from '@/services/preferences';
import { requestReminderPermission } from '@/services/reminders';
import { savePortableFile, chooseBackupFile } from '@/services/portableFiles';
import { prepareRestore, exportGarden, journalCsv, restoreGarden, type RestorePlan } from '@/lib/backup/gardenBackup';
import { validateBackup } from '@/lib/backup/backupFormat';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import { palette, s } from '@/features/addPlant/components/FlowUI';
export default function MoreScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { preferences, error } = usePreferences(user?.uid);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [restoreProgress, setRestoreProgress] = React.useState('');
  const [backup, setBackup] = React.useState<{ raw: string; total: number; plants: number; plan: RestorePlan } | null>(null);
  const lock = React.useRef(false);
  const run = async (job: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setMessage(''); try { await job(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not complete this action.'); } finally { lock.current = false; setBusy(false); } };
  const button = (label: string, action: () => void, disabled = false) => <GrowPress key={label} accessibilityRole="button" disabled={busy || disabled} onPress={action} style={{ paddingVertical: 15, opacity: busy || disabled ? 0.5 : 1 }}><Text style={{ color: palette.accent, fontSize: 16 }}>{label}</Text></GrowPress>;
  return <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    <Text style={s.sectionTitle}>Settings & garden tools</Text>
    {!!(message || error) && <Text accessibilityRole="alert" style={s.hint}>{message || error}</Text>}
    {button(user ? 'Your account' : 'Sign in / create account', () => router.push('/account'))}
    {button('Garden locations', () => router.push('/locations'))}
    {button('Daily care checklist', () => router.push('/care'))}
    {button('Search garden journal', () => router.push('/journal'))}
    {button('Manage sensor profiles', () => router.push('/manage-sensor-profiles'))}
    <Text style={s.sectionTitle}>Device preferences</Text><Text style={s.hint}>Preferences are saved on this device for the current account.</Text>
    <Text style={s.hint}>Default growing environment for new plants</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{(['outdoor', 'indoor', 'greenhouse'] as const).map(environment => button(`${preferences.defaultEnvironment === environment ? '✓ ' : ''}${environment}`, () => void run(async () => { await savePreferences({ ...preferences, defaultEnvironment: environment }, user?.uid); })))}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 16 }}>Device care reminders</Text><Text style={s.hint}>{Platform.OS === 'web' ? 'Use the care checklist in this browser. Scheduled reminders require the installed mobile app.' : 'Schedules up to 50 checks over the next 30 days on this device. Open the app regularly to refresh the schedule.'}</Text></View><Switch accessibilityLabel="Enable device care reminders" value={preferences.reminders} disabled={busy || !user || Platform.OS === 'web'} onValueChange={enabled => void run(async () => { if (enabled) await requestReminderPermission(); await savePreferences({ ...preferences, reminders: enabled }, user?.uid); })} /></View>
    <Text style={s.sectionTitle}>Export & restore</Text><Text style={s.hint}>Backups include plant records, journal entries, compact photos, growing spaces and sensor profiles. Keep downloaded files private. Saved weather history is included; device preferences are excluded. Restore adds copies and never replaces your existing garden.</Text>
    {button('Download garden backup (JSON)', () => void run(async () => { const data = await exportGarden(); await savePortableFile(`weedgrow-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data), 'application/json'); setMessage('Backup export prepared. Save the downloaded file in a safe place. ' + (data.warnings || []).join(' ')); }), !user)}
    {button('Export journal spreadsheet (CSV)', () => void run(async () => { const data = await exportGarden(); await savePortableFile('weedgrow-journal.csv', journalCsv(data), 'text/csv'); setMessage('Journal export prepared.'); }), !user)}
    {button('Choose a backup to restore', () => void run(async () => { const raw = await chooseBackupFile(); if (raw) { const checked = validateBackup(raw); setRestoreProgress(''); setBackup({ raw, total: checked.records.length, plants: checked.records.filter(record => /^plants\/[^/]+$/.test(record.path)).length, plan: await prepareRestore(raw) }); } }), !user)}
    <Text style={s.hint}>Restore validates the whole file before writing. Large restores save in small resumable steps. If interrupted, choose the same file in this account and browser/device to resume without duplicate copies. Partial copies may be visible until complete. Supports backups up to 100 MB / 50,000 records.</Text>
    {busy && <Text style={s.hint}>Working… Keep this screen open.</Text>}
    {!!restoreProgress && <Text accessibilityLiveRegion="polite" style={s.hint}>{restoreProgress}</Text>}
    {backup && <ActionDialog title="Restore garden copies?" description={`${backup.total} records across ${backup.plants} plants passed validation. This creates new copies in the signed-in account. Choosing this same file again on this device resumes the same copies. Keep the file until all records are restored.`} confirmLabel="Restore copies" onClose={() => setBackup(null)} onConfirm={async () => { const count = await restoreGarden(backup.raw, backup.plan, (done, total) => setRestoreProgress(`Restoring ${done} of ${total} records…`)); setMessage(`Restored ${count} garden records with their history.`); }} />}
  </ScrollView>;
}
