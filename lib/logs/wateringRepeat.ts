import { addDays, isCalendarDay, plantDay, zonedTime } from '../dates/plantDay';

export type WateringRepeatChange = { enabled: false } | {
  enabled: true; everyDays: number; time: string; waterMl: number; timeZone: string; startOn: string;
};
export type WateringRepeat = Extract<WateringRepeatChange, { enabled: true }> & { nextAt: number };

export function validWateringRepeat(value: WateringRepeatChange): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value.enabled === false) return true;
  if (value.enabled !== true || !Number.isInteger(value.everyDays) || value.everyDays < 1 || value.everyDays > 365
    || !Number.isFinite(value.waterMl) || value.waterMl <= 0 || value.waterMl > 1000000
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || !isCalendarDay(value.startOn)) return false;
  try { return !!value.timeZone && !!new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { return false; }
}

/** Calendar-day intervals keep the chosen local time through daylight saving changes. */
export function nextWateringRepeat(value: Extract<WateringRepeatChange, { enabled: true }>, after: number): number {
  if (!validWateringRepeat(value) || !Number.isFinite(after)) throw new Error('Invalid repeating watering settings.');
  const today = plantDay(new Date(after), value.timeZone);
  const elapsed = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${value.startOn}T12:00:00Z`)) / 86400000);
  let cycles = Math.max(1, Math.floor(elapsed / value.everyDays));
  let next = zonedTime(addDays(value.startOn, cycles * value.everyDays), value.time, value.timeZone).getTime();
  while (next <= after) { cycles++; next = zonedTime(addDays(value.startOn, cycles * value.everyDays), value.time, value.timeZone).getTime(); }
  return next;
}
