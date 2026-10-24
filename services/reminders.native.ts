import { plantDay, addDays, zonedTime } from '@/lib/dates/plantDay';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { CareTask } from '@/lib/care/careTasks';
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
export async function requestReminderPermission() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Plant care', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are disabled. Enable them in device settings to receive care reminders.');
}
let queue = Promise.resolve();
export function syncReminders(uid: string | undefined, tasks: CareTask[], enabled: boolean) {
  const job = queue.catch(() => {}).then(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled.filter(item => item.identifier.startsWith('weedgrow:'))) await Notifications.cancelScheduledNotificationAsync(item.identifier);
    if (!uid || !enabled) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Plant care', importance: Notifications.AndroidImportance.DEFAULT });
    if (!(await Notifications.getPermissionsAsync()).granted) throw new Error('Enable notifications in device settings.');
    // Maintain a rolling month of checks. Fairly order occurrences across all
    // plants and stay below the iOS pending-notification limit.
    const upcoming: { task: CareTask; due: Date }[] = [];
    for (const task of tasks) {
      const due = new Date(task.due);
      const horizon = Date.now() + 30 * 86400000;
      if (due.getTime() < Date.now()) due.setTime(Date.now() + 60000);
      while (due.getTime() <= horizon) {
        upcoming.push({ task, due: new Date(due) });
        let nextDay = addDays(plantDay(due, task.timeZone), task.customDays?.length ? 1 : task.intervalDays);
        if (task.customDays?.length) while (!task.customDays.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(nextDay + 'T12:00:00Z').getUTCDay()])) nextDay = addDays(nextDay, 1);
        due.setTime(zonedTime(nextDay, task.time, task.timeZone).getTime());
      }
    }
    upcoming.sort((a, b) => a.due.getTime() - b.due.getTime());
    let count = 0;
    for (const { task, due } of upcoming) {
      if (count >= 50) break;
      await Notifications.scheduleNotificationAsync({ identifier: `weedgrow:${uid}:${task.id}:${due.getTime()}`, content: { title: 'Plant care check', body: `Check ${task.plantName}: ${task.kind === 'watering' ? 'watering' : 'feeding'} is due. Confirm conditions before acting.`, data: { plantId: task.plantId, ownerUid: uid } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, channelId: 'care' } });
      count++;
    }
  });
  queue = job;
  return job;
}
