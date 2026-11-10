import { effectiveSchedule, routineDays } from './reminderSchedules';
import type { Plant, PlantLog } from '@/firestoreModels';
import { plantDay, addDays, zonedTime } from '@/lib/dates/plantDay';
export { routineDays } from './reminderSchedules';
export type CareTask = { id: string; plantId: string; plantName: string; kind: 'watering' | 'feeding'; mode?: 'smart' | 'custom'; reviewReason?: string; due: Date; completedToday: boolean; skippedToday: boolean; customDays?: string[]; time: string; intervalDays: number; timeZone?: string | null };
export function reminderDue(task: CareTask, snoozedUntil = 0, now = new Date()) {
  const due = new Date(Math.max(task.due.getTime(), snoozedUntil));
  if (task.skippedToday && plantDay(due, task.timeZone) <= plantDay(now, task.timeZone)) {
    let day = addDays(plantDay(now, task.timeZone), 1);
    if (task.customDays?.length) for (let offset = 0; offset < 7; offset++) { if (task.customDays.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(day + 'T12:00:00Z').getUTCDay()])) break; day = addDays(day, 1); }
    due.setTime(zonedTime(day, task.time, task.timeZone).getTime());
  }
  return due;
}
export function buildCareTasks(plant: Plant & { id: string }, logs: PlantLog[], now = new Date()): CareTask[] {
  if (plant.status !== 'active' || plant.deleting) return [];
  return (['watering', 'feeding'] as const).flatMap(kind => {
    const schedule = effectiveSchedule(plant, kind);
    if (kind === 'watering' && schedule.type === 'smart') return [];
    if (schedule?.type === 'none') return [];
    const interval = schedule.type === 'interval' || schedule.type === 'smart' ? schedule.intervalDays : routineDays(kind === 'watering' ? plant.wateringFrequency : plant.feedingFrequency);
    const customDays = schedule?.type === 'custom' && Array.isArray(schedule.customDays) ? schedule.customDays.filter(day => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(day)) : undefined;
    if ((!interval || !Number.isInteger(interval) || interval < 1 || interval > 365) && !customDays?.length) return [];
    const latestLog = logs.filter(log => log.type === (kind === 'watering' ? 'watering' : 'fertilizing') && log.timestamp?.toDate?.()
      && Number.isFinite(log.timestamp.toDate().getTime()) && log.timestamp.toDate() <= now
      && (!log.calendarDay || log.calendarDay <= plantDay(now, plant.locationTimeZone))).sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    const latest = latestLog?.timestamp.toDate();
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule?.timeOfDay || '') ? schedule!.timeOfDay! : '09:00';
    const zone = plant.locationTimeZone;
    const today = plantDay(now, zone);
    const latestDay = latestLog?.calendarDay || plantDay(latest || now, latestLog?.timeZone || zone);
    let day = latest ? latestDay : plantDay(plant.createdAt?.toDate?.() || now, zone);
    if (customDays?.length) {
      day = latest && latestDay === today ? addDays(today, 1) : today;
      for (let offset = 0; offset < 7; offset++) { if (customDays.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(day + 'T12:00:00Z').getUTCDay()])) break; day = addDays(day, 1); }
    } else if (latest) day = addDays(day, interval!);
    const due = zonedTime(day, time, zone);
    const completedToday = !!latest && latestDay === today;
    return [{ id: `${plant.id}:${kind}`, plantId: plant.id, plantName: plant.name, kind, mode: schedule.type === 'smart' ? 'smart' as const : 'custom' as const, due, time, timeZone: zone, customDays, intervalDays: interval || 7, completedToday, skippedToday: !completedToday && plant.careSkips?.[kind] === today }];
  });
}
