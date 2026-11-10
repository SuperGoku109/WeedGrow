import AsyncStorage from '@react-native-async-storage/async-storage';
import { planCareNotifications } from '@/lib/careAlgorithm/careNotifications';
import { recommendationSignature, type CareRecommendation } from '@/lib/careAlgorithm/outdoorIntelligence';
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
      await Notifications.scheduleNotificationAsync({ identifier: `weedgrow:${uid}:${task.id}:${due.getTime()}`, content: { title: 'Plant care reminder', body: task.kind === 'feeding' && task.mode === 'smart' ? `${task.plantName}: ${task.reviewReason || 'Review your fertilizer label and recent feeding before deciding to fertilize.'}` : `${task.plantName}: your ${task.kind === 'watering' ? 'watering' : 'feeding'} routine is scheduled. This reminder does not measure plant need.`, data: { plantId: task.plantId, ownerUid: uid } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, channelId: 'care' } });
      count++;
    }
  });
  queue = job;
  return job;
}

let intelligenceQueue = Promise.resolve();
let intelligenceRequest = 0;
export function syncCareRecommendations(uid: string | undefined, recommendations: readonly CareRecommendation[], enabled: boolean, resolvedIds?: readonly string[]) {
  const request = ++intelligenceRequest;
  const job = intelligenceQueue.catch(() => {}).then(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled.filter(item => item.identifier.startsWith('weedgrow-intelligence:'))) await Notifications.cancelScheduledNotificationAsync(item.identifier);
    if (!uid || !enabled || !(await Notifications.getPermissionsAsync()).granted) return;
    const key = `weedgrow.intelligence.v1.${uid}`;
    const saved = await AsyncStorage.getItem(key);
    const checkKey = key + '.planned-checks';
    let previousChecks: Record<string, number> = {};
    try { previousChecks = JSON.parse(await AsyncStorage.getItem(checkKey) || '{}') || {}; } catch { /* Missing planning state does not invent completed delivery. */ }
    let previous: Record<string, string> = {};
    try { const parsed = JSON.parse(saved || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) previous = parsed; } catch { /* Corrupted state falls back to a fresh set. */ }
    if (request !== intelligenceRequest) return;
    const now = Date.now() / 1000;
    // An OS-delivered planned check must not immediately be duplicated when the
    // app resumes. Still-pending checks are cancelled above and can notify now.
    for (const r of recommendations) {
      const due = previousChecks[r.id];
      if (typeof due === 'number' && due <= now && now - due < 1800
        && !scheduled.some(item => item.identifier === `weedgrow-intelligence:${uid}:${r.id}:planned-check`)) previous[r.id] = recommendationSignature(r);
    }
    const plan = planCareNotifications(recommendations, previous, now, resolvedIds);
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Plant care', importance: Notifications.AndroidImportance.DEFAULT });
    const delivered = { ...plan.signatures };
    for (const r of plan.send) delete delivered[r.id];
    for (const r of plan.send) {
      if (request !== intelligenceRequest) return;
      await Notifications.scheduleNotificationAsync({ identifier: `weedgrow-intelligence:${uid}:${r.id}`,
      content: { title: r.title, body: r.description, data: { plantId: r.plantId, ownerUid: uid } }, trigger: null });
      delivered[r.id] = recommendationSignature(r);
      await AsyncStorage.setItem(key, JSON.stringify(delivered));
    }
    await AsyncStorage.setItem(key, JSON.stringify(delivered));
    // Soil-check timing is known while the app is open, so reuse the existing
    // native date trigger. No background weather fetch or watering assertion.
    const upcoming = recommendations.filter(r => r.status === 'active' && r.type === 'watering' && r.expiresAt > now
      && r.dataQuality !== 'INSUFFICIENT' && typeof r.evidence.nextCheckUtc === 'number' && r.evidence.nextCheckUtc > now + 60)
      .sort((a, b) => (a.evidence.nextCheckUtc as number) - (b.evidence.nextCheckUtc as number)).slice(0, 10);
    const plannedChecks: Record<string, number> = {};
    for (const r of upcoming) {
      if (request !== intelligenceRequest) return;
      const due = r.evidence.nextCheckUtc as number;
      await Notifications.scheduleNotificationAsync({ identifier: `weedgrow-intelligence:${uid}:${r.id}:planned-check`,
        content: { title: 'Check soil moisture', body: 'A soil check was planned from your previous care information. Check the root-zone soil before deciding whether to water.', data: { plantId: r.plantId, ownerUid: uid } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(due * 1000), channelId: 'care' } });
      plannedChecks[r.id] = due;
    }
    await AsyncStorage.setItem(checkKey, JSON.stringify(plannedChecks));
  });
  intelligenceQueue = job; return job;
}
