import { effectiveSchedule, routineDays } from './reminderSchedules';
import type { Plant, PlantLog } from '@/firestoreModels';
import { plantDay, addDays, zonedTime } from '@/lib/dates/plantDay';
export { routineDays } from './reminderSchedules';
export type CareTask = { id: string; plantId: string; plantName: string; kind: 'watering' | 'feeding'; mode?: 'smart' | 'custom'; reviewReason?: string; due: Date; completedToday: boolean; skippedToday: boolean; customDays?: string[]; time: string; intervalDays: number; timeZone?: string | null };
const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function nextScheduledDay(day: string, customDays: string[]) {
  for (let offset = 0; offset < 7; offset++) {
    const weekday = weekdays[new Date(day + 'T12:00:00Z').getUTCDay()];
    if (customDays.includes(weekday)) break;
    day = addDays(day, 1);
  }
  return day;
}

export function reminderDue(task: CareTask, snoozedUntil = 0, now = new Date()) {
  const due = new Date(Math.max(task.due.getTime(), snoozedUntil));
  if (!task.skippedToday) return due;
  const today = plantDay(now, task.timeZone);
  if (plantDay(due, task.timeZone) > today) return due;
  const tomorrow = addDays(today, 1);
  const day = task.customDays?.length ? nextScheduledDay(tomorrow, task.customDays) : tomorrow;
  return zonedTime(day, task.time, task.timeZone);
}
export function buildCareTasks(plant: Plant & { id: string }, logs: PlantLog[], now = new Date()): CareTask[] {
  if (plant.status !== 'active' || plant.deleting) return [];
  const zone = plant.locationTimeZone;
  const today = plantDay(now, zone);
  return (['watering', 'feeding'] as const).flatMap(kind => {
    const schedule = effectiveSchedule(plant, kind);
    if (kind === 'watering' && schedule.type === 'smart') return [];
    if (schedule?.type === 'none') return [];
    const interval = schedule.type === 'interval' || schedule.type === 'smart' ? schedule.intervalDays : routineDays(kind === 'watering' ? plant.wateringFrequency : plant.feedingFrequency);
    const customDays = schedule.type === 'custom' && Array.isArray(schedule.customDays) ? schedule.customDays.filter(day => weekdays.includes(day)) : undefined;
    if ((!interval || !Number.isInteger(interval) || interval < 1 || interval > 365) && !customDays?.length) return [];
    const logType = kind === 'watering' ? 'watering' : 'fertilizing';
    let latest: Date | undefined;
    let latestLog: PlantLog | undefined;
    for (const log of logs) {
      if (log.type !== logType || (log.calendarDay && log.calendarDay > today)) continue;
      const time = log.timestamp?.toDate?.();
      if (time && Number.isFinite(time.getTime()) && time <= now && (!latest || time > latest)) {
        latest = time;
        latestLog = log;
      }
    }
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule?.timeOfDay || '') ? schedule!.timeOfDay! : '09:00';
    const latestDay = latestLog?.calendarDay || (latest ? plantDay(latest, latestLog?.timeZone || zone) : today);
    let day = latest ? latestDay : plantDay(plant.createdAt?.toDate?.() || now, zone);
    if (customDays?.length) {
      day = nextScheduledDay(latest && latestDay === today ? addDays(today, 1) : today, customDays);
    } else if (latest) day = addDays(day, interval!);
    const due = zonedTime(day, time, zone);
    const completedToday = !!latest && latestDay === today;
    return [{ id: `${plant.id}:${kind}`, plantId: plant.id, plantName: plant.name, kind, mode: schedule.type === 'smart' ? 'smart' as const : 'custom' as const, due, time, timeZone: zone, customDays, intervalDays: interval || 7, completedToday, skippedToday: !completedToday && plant.careSkips?.[kind] === today }];
  });
}
