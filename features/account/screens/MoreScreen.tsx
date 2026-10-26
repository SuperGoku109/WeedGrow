import { useAsyncTask, type TaskContext } from '@/hooks/useAsyncTask';
import Feedback from '@/ui/Feedback';
import React from 'react';
import { Platform, ScrollView, Switch, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsRow from '@/ui/SettingsRow';
import { AppHeader } from '@/ui/AppHeader';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { savePreferences } from '@/services/preferences';
import { usePreferences } from '@/hooks/usePreferences';
import { requestReminderPermission } from '@/services/reminders';
import { savePortableFile, chooseBackupFile } from '@/services/portableFiles';
import { prepareRestore, exportGarden, exportJournalCsv, restoreGarden, type RestorePlan } from '@/lib/backup/gardenBackup';
import { validateBackup } from '@/lib/backup/backupFormat';
import { GrowPress } from '@/ui/GrowMotion';
import ActionDialog from '@/ui/ActionDialog';
import { palette, s } from '@/features/addPlant/components/FlowUI';
function MoreContent() {
  const router = useRouter();
  const { user } = useSession();
  const { preferences, error } = usePreferences(user?.uid);
  const operation = useAsyncTask(user?.uid || 'device');
  const busy = operation.status === 'running';
  const [message, setMessage] = React.useState('');
  const [restoreProgress, setRestoreProgress] = React.useState('');
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [backup, setBackup] = React.useState<{ raw: string; total: number; plants: number; plan: RestorePlan } | null>(null);
  const run = (job: (context: TaskContext) => Promise<void>) => { setMessage(''); setRestoreProgress(''); return operation.run(job); };
  const button = (label: string, action: () => void, disabled = false) => <SettingsRow key={label} label={label} disabled={busy || disabled} onPress={action} icon={label.includes('account') ? 'account-outline' : label.includes('locations') ? 'map-marker-outline' : label.includes('checklist') ? 'checkbox-marked-circle-outline' : label.includes('journal') ? 'notebook-outline' : label.includes('profiles') ? 'tune-variant' : label.includes('restore') ? 'backup-restore' : 'download-outline'} />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.bg }}><AppHeader /><ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 28, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
    <Text accessibilityRole="header" style={{ color: palette.ink, fontSize: 28, lineHeight: 34, fontWeight: '700', marginBottom: 8 }}>Garden tools</Text>
    {!!(message || error || operation.error) && <Feedback message={operation.error || error || message} tone={operation.error || error ? 'error' : 'info'} />}
    {button(user ? 'Your account' : 'Sign in / create account', () => router.push('/account'))}
    {button('Garden locations', () => router.push('/locations'))}
    {button('Daily care checklist', () => router.push('/care'))}
    {button('Search garden journal', () => router.push('/journal'))}
    {button('Manage sensor profiles', () => router.push('/manage-sensor-profiles'))}
    <View style={{ backgroundColor: palette.panel, padding: 16, borderRadius: 18, gap: 14, marginTop: 12 }}><Text accessibilityRole="header" style={s.sectionTitle}>Device preferences</Text><Text style={s.hint}>Saved on this device for your account.</Text>
    <Text style={s.hint}>Default growing environment for new plants</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['outdoor', 'indoor', 'greenhouse'] as const).map(environment => <Pressable key={environment} accessibilityRole="radio" accessibilityState={{ checked: preferences.defaultEnvironment === environment, disabled: busy }} disabled={busy} onPress={() => void run(async () => { await savePreferences({ ...preferences, defaultEnvironment: environment }, user?.uid); })} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 24, backgroundColor: preferences.defaultEnvironment === environment ? palette.accent : palette.bg }}><Text style={{ fontSize: 14, textTransform: 'capitalize', color: preferences.defaultEnvironment === environment ? palette.dark : palette.ink }}>{preferences.defaultEnvironment === environment ? '✓ ' : ''}{environment}</Text></Pressable>)}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 16 }}>Device care reminders</Text><Text style={s.hint}>{Platform.OS === 'web' ? 'Use the care checklist in this browser. Scheduled reminders require the installed mobile app.' : 'Schedules up to 50 checks over the next 30 days on this device. Open the app regularly to refresh the schedule.'}</Text></View><Switch accessibilityLabel="Enable device care reminders" value={preferences.reminders} disabled={busy || !user || Platform.OS === 'web'} onValueChange={enabled => void run(async () => { if (enabled) await requestReminderPermission(); await savePreferences({ ...preferences, reminders: enabled }, user?.uid); })} /></View>
    </View><Text accessibilityRole="header" style={[s.sectionTitle, { marginTop: 12 }]}>Backups & exports</Text><Text style={s.hint}>Keep a copy of your garden and history. Restore adds copies without replacing your current plants.</Text>
    {button('Download garden backup (JSON)', () => void run(async context => { const data = await exportGarden({ signal: context.signal, onProgress: count => context.publish(() => setRestoreProgress(`Exporting ${count} records…`)) }); if (!context.isCurrent()) return; await savePortableFile(`weedgrow-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data), 'application/json'); setMessage('Backup export prepared. Save the downloaded file in a safe place. ' + (data.warnings || []).join(' ')); }), !user)}
    {button('Export journal spreadsheet (CSV)', () => void run(async context => { const csv = await exportJournalCsv({ signal: context.signal }); if (!context.isCurrent()) return; await savePortableFile('weedgrow-journal.csv', csv, 'text/csv'); setMessage('Journal export prepared.'); }), !user)}
    {button('Choose a backup to restore', () => void run(async context => { const raw = await chooseBackupFile(); if (!context.isCurrent()) return; if (raw) { const checked = validateBackup(raw); setRestoreProgress(''); setBackup({ raw, total: checked.records.length, plants: checked.records.filter(record => /^plants\/[^/]+$/.test(record.path)).length, plan: await prepareRestore(raw) }); } }), !user)}
    {!user && <Text style={s.hint}>Sign in to export or restore your garden.</Text>}
    {busy && <Text style={s.hint}>Working… Keep this screen open.</Text>}
    {!!restoreProgress && <Text accessibilityLiveRegion="polite" style={s.hint}>{restoreProgress}</Text>}
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: palette.accent, fontSize: 15 }}>{helpOpen ? 'Hide backup details −' : 'What’s included and how restore works +'}</Text></GrowPress>
    {helpOpen && <View style={{ backgroundColor: palette.panel, padding: 16, borderRadius: 14, gap: 12 }}><Text style={s.hint}>Includes plants, journal entries, compact photos, growing spaces, profiles and saved weather. Device preferences are excluded. Keep downloaded files private.</Text><Text style={s.hint}>Up to 30 MB / 50,000 records. The whole file is validated before writing. If interrupted, choose the same file in the same account and browser/device to resume without duplicate copies. Partial copies may be visible until complete.</Text></View>}
    {backup && <ActionDialog title="Restore garden copies?" description={`${backup.total} records across ${backup.plants} plants passed validation. This creates new copies in the signed-in account. Choosing this same file again on this device resumes the same copies. Keep the file until all records are restored.`} confirmLabel="Restore copies" onClose={() => setBackup(null)} onConfirm={async () => { const outcome = await operation.run(async context => restoreGarden(backup.raw, backup.plan, (done, total) => context.publish(() => setRestoreProgress(`Restoring ${done} of ${total} records…`)), context.signal)); if (!outcome.ok) throw new Error(outcome.error || 'Restore paused. Choose the same backup to resume.'); setMessage(`Restored ${outcome.value} garden records with their history.`); }} />}
  </ScrollView></SafeAreaView>;
}

export default function MoreScreen() { const { user } = useSession(); return <MoreContent key={user?.uid || 'device'} />; }
