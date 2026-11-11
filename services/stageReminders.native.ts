import type { Plant } from '@/firestoreModels';
import { stagePushPlan, stageReminderSuggestion } from '@/lib/plants/growthTracking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { claimStageNotification, postponeStageNotification } from './stageNotificationClaims';
import { plantDay } from '@/lib/dates/plantDay';

const prefix = 'weedgrow-stage:';
const settingsSignature = (plant: Plant) => JSON.stringify([plant.stageReminders, plant.growthProfile, plant.locationTimeZone, plant.location]);
let queue = Promise.resolve();
export function syncStageReminders(uid: string | undefined, plants: readonly (Plant & { id: string })[], enabled: boolean, busyUntil = 0) {
  const job = queue.catch(() => {}).then(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const now = new Date();
    // A review, stage change, preference change or sign-out cancels the pending stage check.
    for (const item of scheduled.filter(item => item.identifier.startsWith(prefix))) {
      const data = item.content.data;
      const plant = plants.find(p => p.id === data?.plantId);
      const suggestion = plant ? stageReminderSuggestion(plant, now) : null;
      const key = suggestion ? `${suggestion.id}:${plant?.stageReview?.suggestionId === suggestion.id ? plant.stageReview.snoozes : 0}` : null;
      const dueAt = typeof data?.stageDueAt === 'number' ? data.stageDueAt : plant?.stagePush?.dueAt;
      const nowTooEarly = suggestion?.pushOn && plant && typeof dueAt === 'number' && plantDay(new Date(dueAt), plant.locationTimeZone) < suggestion.pushOn;
      if (!uid || !enabled || data?.ownerUid !== uid || !plant?.stageReminders?.enabled || !suggestion?.pushOn || data.stageKey !== key || data.stageSettings !== settingsSignature(plant)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      else if (nowTooEarly && typeof dueAt === 'number') {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
        if (!(await Notifications.getPermissionsAsync()).granted) continue;
        const replacement = await postponeStageNotification(plant.id, uid, { key: String(data.stageKey), dueAt });
        if (replacement && replacement.dueAt <= now.getTime() + 30 * 86400000 && replacement.dueAt >= busyUntil + 3600000) {
          await Notifications.scheduleNotificationAsync({ identifier: item.identifier,
            content: { title: 'Review growth stage', body: `${plant.name}: check physical signs before confirming the next stage.`, data: { ...data, stageDueAt: replacement.dueAt } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(replacement.dueAt), channelId: 'care' } });
        }
      }
    }
    if (!uid || !enabled || !(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Plant care', importance: Notifications.AndroidImportance.DEFAULT });
    const candidates = plants.flatMap(plant => {
      const plan = stagePushPlan(plant, now);
      if (!plan || plan.dueAt > now.getTime() + 30 * 86400000) return [];
      // Leave care/weather alerts priority and at least an hour of breathing room.
      if (plan.dueAt < busyUntil + 3600000) return [];
      return [{ plant, plan }];
    }).sort((a, b) => a.plan.dueAt - b.plan.dueAt);
    let capacity = Math.min(3, Math.max(0, 63 - scheduled.length));
    for (const { plant, plan } of candidates) {
      if (capacity <= 0) break;
      const identifier = `${prefix}${uid}:${plant.id}:${plan.key}`;
      if (scheduled.some(item => item.identifier === identifier)) continue;
      if (!await claimStageNotification(plant.id, uid, { key: plan.key, dueAt: plan.dueAt })) continue;
      // Claim before scheduling: a crash may omit an optional reminder, but cannot duplicate one.
      await Notifications.scheduleNotificationAsync({ identifier,
        content: { title: 'Review growth stage', body: `${plant.name}: check physical signs before confirming the next stage.`, data: { plantId: plant.id, ownerUid: uid, stageKey: plan.key, stageDueAt: plan.dueAt, stageSettings: settingsSignature(plant) } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(plan.dueAt), channelId: 'care' } });
      capacity--;
    }
  });
  queue = job;
  return job;
}
