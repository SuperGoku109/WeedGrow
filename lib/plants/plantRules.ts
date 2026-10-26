import type { Plant } from '@/firestoreModels';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';
/** Apply only rules made relevant by this edit. Unrelated legacy fields stay
 * untouched, while setup changes cannot retain incompatible hidden values. */
export function normalizePlantSetup(updates: Partial<Plant>, current?: Pick<Plant, 'environment' | 'plantedIn'>): Partial<Plant> {
  const result = { ...updates };
  if ('plantedIn' in updates || 'potSize' in updates) if ((updates.plantedIn || current?.plantedIn) === 'ground') result.potSize = null;
  if ('environment' in updates || 'sunlightExposure' in updates) if ((updates.environment || current?.environment) === 'indoor') result.sunlightExposure = null;
  if ('environment' in updates || 'sensorProfileId' in updates) if ((updates.environment || current?.environment) === 'outdoor') result.sensorProfileId = null;
  return result;
}
export function validatePlantDatesAndReminders(fields: Record<string, unknown>, today = plantDay()): Record<string, string> {
  const errors: Record<string, string> = {};
  if (fields.startedOn) {
    if (typeof fields.startedOn !== 'string' || !isCalendarDay(fields.startedOn) || fields.startedOn > today || Date.parse(today) - Date.parse(fields.startedOn) > 36500 * 86400000) errors.startedOn = 'Use a valid start date within the last 100 years, today or earlier.';
  }
  if (fields.reminderSchedule != null) {
    const schedule = fields.reminderSchedule as Partial<NonNullable<Plant['reminderSchedule']>>;
    if (!['none', 'interval', 'custom'].includes(schedule.type || '')) errors.reminderSchedule = 'Choose a valid reminder type.';
    else if (schedule.type === 'interval' && (!Number.isInteger(schedule.intervalDays) || schedule.intervalDays! < 1 || schedule.intervalDays! > 365)) errors.reminderSchedule = 'Reminder interval must be a whole number between 1 and 365 days.';
    else if (schedule.type === 'custom' && (!Array.isArray(schedule.customDays) || !schedule.customDays.length || schedule.customDays.some(day => !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day)))) errors.reminderSchedule = 'Choose valid reminder days, for example Mon, Wed, Fri.';
    if (schedule.type !== 'none' && schedule.timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.timeOfDay)) errors.reminderSchedule = 'Use HH:MM for reminder time.';
  }
  return errors;
}
