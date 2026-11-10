import type { Plant, PlantReminderSchedule } from '@/firestoreModels';
export function routineDays(value?: string | null): number | null {
  if (value === 'Every day') return 1;
  if (value === 'Weekly') return 7;
  if (value === 'Monthly') return 30;
  const match = typeof value === 'string' ? value.match(/^Every (\d+) days$/) : null;
  return match && Number(match[1]) >= 1 && Number(match[1]) <= 365 ? Number(match[1]) : null;
}
export function effectiveSchedule(plant: Pick<Plant, 'reminderSchedule' | 'feedingReminderSchedule' | 'wateringFrequency' | 'feedingFrequency' | 'environment'>, kind: 'watering' | 'feeding'): PlantReminderSchedule {
  const saved = kind === 'watering' ? plant.reminderSchedule : plant.feedingReminderSchedule;
  if (saved) return saved;
  const interval = routineDays(kind === 'watering' ? plant.wateringFrequency : plant.feedingFrequency);
  if (interval) return { type: 'interval', intervalDays: interval, timeOfDay: '09:00' };
  return { type: kind === 'watering' && plant.environment === 'outdoor' ? 'smart' : 'none' };
}
export function scheduleLabel(schedule: PlantReminderSchedule) {
  return schedule.type === 'none' ? 'Off' : schedule.type === 'smart' ? 'Smart schedule' : schedule.type === 'custom' ? `Selected weekdays: ${schedule.customDays?.join(', ') ?? ''}` : `Every ${schedule.intervalDays} days`;
}
