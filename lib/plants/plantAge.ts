import type { Plant } from '@/firestoreModels';
import { plantDay, isCalendarDay } from '@/lib/dates/plantDay';
import { ageReferenceDay, stageAgeDefault } from './stageAgeDefaults';
export function plantAgeDays(plant: Plant, today = plantDay(new Date(), plant.locationTimeZone)): number {
  if (plant.ageKnown !== false && plant.startedOn && isCalendarDay(plant.startedOn)) {
    const parsed = new Date(`${plant.startedOn}T00:00:00Z`);
    const days = (Date.parse(`${today}T00:00:00Z`) - parsed.getTime()) / 86400000;
    if (Number.isInteger(days) && days >= 0) return days;
  }
  const recordedAge = plant.ageKnown !== false && Number.isInteger(plant.ageDays) && plant.ageDays! >= 0 ? plant.ageDays! : stageAgeDefault(plant.growthStage).ageDays;
  const elapsed = Math.max(0, Math.round((Date.parse(today) - Date.parse(ageReferenceDay(plant, today))) / 86400000));
  return recordedAge + elapsed;
}
export function plantAgeLabel(plant: Plant, today?: string, compact = false) {
  const days = plantAgeDays(plant, today);
  const validStart = plant.startedOn && isCalendarDay(plant.startedOn) && plant.startedOn <= (today || plantDay(new Date(), plant.locationTimeZone));
  if ((plant.ageEstimateSource === 'stage' || plant.ageKnown === false || !validStart && plant.ageDays == null) && stageAgeDefault(plant.growthStage).trackingOnly) return compact ? `${days} ${days === 1 ? 'day' : 'days'} tracked` : `${days} ${days === 1 ? 'day' : 'days'} tracked (age not supplied)`;
  if (plant.ageEstimateSource === 'stage' || plant.ageKnown === false || (!validStart && !(Number.isInteger(plant.ageDays) && plant.ageDays! >= 0))) return compact ? `~${days} ${days === 1 ? 'day' : 'days'}` : `About ${days} ${days === 1 ? 'day' : 'days'} (stage estimate)`;
  if (compact) return `${validStart && plant.ageEstimated ? '~' : ''}${days} ${days === 1 ? 'day' : 'days'}`;
  return validStart ? `${plant.ageEstimated ? 'About ' : ''}${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} (recorded)`;
}
