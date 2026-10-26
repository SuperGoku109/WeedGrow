import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useSession } from '@/services/session';
import { usePreferences } from '@/hooks/usePreferences';
import { useCareSnoozes } from '@/hooks/useCareSnoozes';
import { syncReminders } from '@/services/reminders';
import { reminderDue } from '@/lib/care/careTasks';
import { useCareTasks } from './useCareTasks';
export default function ReminderCoordinator() {
  const { user } = useSession();
  const { preferences } = usePreferences(user?.uid);
  React.useEffect(() => { if (!user || !preferences.reminders) void syncReminders(undefined, [], false).catch(() => {}); }, [user, preferences.reminders]);
  return user && preferences.reminders && Platform.OS !== 'web' ? <ActiveReminders /> : null;
}
function ActiveReminders() {
  const { user } = useSession();
  const { preferences } = usePreferences(user?.uid);
  const { snoozes } = useCareSnoozes(user?.uid);
  const { tasks, loading, error } = useCareTasks();
  const [message, setMessage] = React.useState('');
  // Serialize only meaningful task changes, not the once-per-minute clock.
  const signature = JSON.stringify(tasks.map(task => ({ ...task, due: reminderDue(task, snoozes[task.id] || 0).toISOString() })));
  React.useEffect(() => {
    if (user && loading && !error && preferences.reminders) return;
    let active = true;
    const adjusted = JSON.parse(signature).map((task: { due: string }) => ({ ...task, due: new Date(task.due) }));
    void syncReminders(user?.uid, error ? [] : adjusted, preferences.reminders).then(() => { if (active) setMessage(''); }).catch(() => { if (active) setMessage('Device reminders could not be updated. Open Settings to check permissions.'); });
    return () => { active = false; };
  }, [user, preferences.reminders, loading, error, signature]);
  return message ? <View style={{ backgroundColor: '#392b1e', padding: 10 }}><Text accessibilityRole="alert" style={{ color: '#ffe0a3' }}>{message}</Text></View> : null;
}
