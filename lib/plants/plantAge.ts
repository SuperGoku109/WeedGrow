import type { Plant } from '@/firestoreModels';
import { plantDay, isCalendarDay } from '@/lib/dates/plantDay';
export function plantAgeDays(plant: Plant, today = plantDay(new Date(), plant.locationTimeZone)): number | null {
  if (plant.ageKnown === false) return null;
  if (plant.startedOn) {
    const parsed = new Date(`${plant.startedOn}T00:00:00Z`);
    if (!isCalendarDay(plant.startedOn)) return null;
    const days = (Date.parse(`${today}T00:00:00Z`) - parsed.getTime()) / 86400000;
    return Number.isInteger(days) && days >= 0 ? days : null;
  }
  return Number.isInteger(plant.ageDays) && plant.ageDays! >= 0 ? plant.ageDays! : null;
}
export function plantAgeLabel(plant: Plant, today?: string) {
  const days = plantAgeDays(plant, today);
  if (days == null) return 'Unknown';
  return plant.startedOn ? `${plant.ageEstimated ? 'About ' : ''}${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} (recorded)`;
}
