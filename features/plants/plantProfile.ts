import type { Plant } from '@/firestoreModels';
import { isCalendarDay } from '@/lib/dates/plantDay';
import { plantAgeLabel } from '@/lib/plants/plantAge';

export interface ProfileField { label: string; value: string; wide?: boolean }
const words = (value?: string | null) => value?.replace(/_/g, ' ').replace(/^\w/, letter => letter.toUpperCase());
export function profileDate(value?: string | null) {
  return value && isCalendarDay(value) ? new Date(value + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;
}
function recordDate(value: Plant['createdAt'], zone?: string | null) {
  const date = value?.toDate?.();
  if (!date || !Number.isFinite(date.getTime())) return undefined;
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  try { return date.toLocaleDateString('en-GB', { ...options, timeZone: zone || undefined }); }
  catch { return date.toLocaleDateString('en-GB', options); }
}
function fields(values: [string, unknown, boolean?][]): ProfileField[] {
  return values.filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '').map(([label, value, wide]) => ({ label, value: String(value), wide }));
}
export function reminderLabel(schedule: Plant['reminderSchedule']) {
  if (!schedule) return undefined;
  if (schedule.type === 'none') return 'Reminders off';
  const days = schedule.type === 'interval' ? schedule.intervalDays === 1 ? 'Every day' : schedule.intervalDays ? `Every ${schedule.intervalDays} days` : 'Interval reminder' : schedule.customDays?.map(day => words(day)).join(', ') || 'Custom reminder';
  return days + (schedule.timeOfDay ? ` at ${schedule.timeOfDay}` : '');
}
export function plantProfile(plant: Plant) {
  const age = plantAgeLabel(plant);
  return {
    basics: fields([['Growth stage', words(plant.growthStage)], ['Status', words(plant.status)], ['Strain', plant.strain, true], ['Strain type', words(plant.strainType)], ['Growing for', age === 'Unknown' ? undefined : age], ['Started growing', profileDate(plant.startedOn)], ['Height', plant.height != null ? `${plant.height} cm` : undefined]]),
    setup: fields([['Environment', words(plant.environment)], ['Planted in', plant.plantedIn === 'ground' ? 'In the ground' : plant.plantedIn === 'pot' ? 'Pot' : words(plant.plantedIn)], ['Pot size', plant.potSize], ['Soil', words(plant.soilType === 'native' ? 'Native soil' : plant.soilType === 'raised' ? 'Raised bed soil' : plant.soilType === 'store' ? 'Potting soil' : plant.soilType)], ['Soil pH', plant.soilPh], ['Sunlight', plant.sunlightExposure, true], ['Protection', words(plant.permanentProtection), true], ['Companion plants', plant.companionPlants?.join(', '), true]]),
    care: fields([['Watering', plant.wateringFrequency], ['Feeding', plant.feedingFrequency], ['Fertilizer', plant.fertilizer], ['Reminders', reminderLabel(plant.reminderSchedule)]]),
    technical: fields([['Coordinates', plant.location ? `${plant.location.lat.toFixed(4)}, ${plant.location.lng.toFixed(4)}` : undefined, true], ['Sensor profile', plant.sensorProfileId, true], ['Time zone', plant.locationTimeZone, true]]),
    notes: fields([['Plant notes', plant.notes, true], ['Growing notes', plant.environmentNotes, true], ['Training', plant.trainingTags?.join(', '), true], ['Pests recorded', plant.pests?.join(', '), true]]),
    record: fields([['Added to garden', recordDate(plant.createdAt, plant.locationTimeZone)], ['Last updated', recordDate(plant.updatedAt, plant.locationTimeZone)]]),
  };
}
