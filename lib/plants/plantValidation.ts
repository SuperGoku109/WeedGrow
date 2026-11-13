import { contextChoices } from '@/lib/care/plantContext';
import { validatePlantDatesAndReminders } from './plantRules';
import { MEDIUMS } from '@/lib/careAlgorithm/setupFacts';
import { isCalendarDay } from '@/lib/dates/plantDay';
/** Field policies shared by forms and the write boundary. Only supplied fields
 * are checked, so an unrelated edit can still repair a legacy record. */
export const PLANT_STAGES = ['unknown', 'germination', 'seedling', 'vegetative', 'flowering', 'clone', 'harvested', 'drying', 'curing', 'completed'] as const;
export const PLANT_ENVIRONMENTS = ['outdoor', 'indoor', 'greenhouse'] as const;
export const MAX_PLANT_AGE_DAYS = 36500;

export function validatePlantFields(fields: Record<string, unknown>, today?: string): Record<string, string> {
  const errors: Record<string, string> = validatePlantDatesAndReminders(fields, today);
  if (fields.stageStartedOnEstimated != null && typeof fields.stageStartedOnEstimated !== 'boolean') errors.stageStartedOnEstimated = 'Choose a valid stage timing source.';
  if (fields.ageEstimateSource != null && fields.ageEstimateSource !== 'stage') errors.ageEstimateSource = 'Choose a valid age estimate source.';
  for (const field of ['stageStartedOn', 'germinationStartedOn', 'emergedOn', 'preflowerObservedOn', 'floweringStartedOn', 'lateFloweringStartedOn', 'harvestedOn', 'lastStageReviewedOn']) {
    if (fields[field] != null) {
      if (typeof fields[field] !== 'string' || !isCalendarDay(fields[field] as string)) errors[field] = 'Use a valid calendar date.';
      Object.assign(errors, Object.fromEntries(Object.entries(validatePlantDatesAndReminders({ startedOn: fields[field] }, today)).map(([, message]) => [field, message])));
    }
  }
  if (fields.floweringPhase != null && fields.floweringPhase !== 'late') errors.floweringPhase = 'Choose a valid flowering phase.';
  for (const field of ['stageRevision'] as const) if (fields[field] != null && (!Number.isSafeInteger(fields[field]) || Number(fields[field]) < 0)) errors[field] = 'Use a valid stage revision.';
  if (fields.postHarvestTracking != null && typeof fields.postHarvestTracking !== 'boolean') errors.postHarvestTracking = 'Choose whether to track processing.';
  if (fields.stagePush != null) {
    const push = fields.stagePush as NonNullable<import('@/firestoreModels').Plant['stagePush']>;
    if (typeof push.key !== 'string' || typeof push.dueAt !== 'number' || !Number.isFinite(push.dueAt) || push.dueAt < 0 || push.dueAt > 253402300799999) errors.stagePush = 'Invalid saved stage reminder.';
  }
  if (fields.stageReview != null) {
    const review = fields.stageReview as NonNullable<import('@/firestoreModels').Plant['stageReview']>;
    if (typeof review.suggestionId !== 'string' || !['not_yet', 'snooze', 'dismiss', 'early_signs', 'stage_recorded'].includes(review.action) || !Number.isSafeInteger(review.snoozes) || review.snoozes < 0 || (review.nextCheckOn != null && (typeof review.nextCheckOn !== 'string' || !isCalendarDay(review.nextCheckOn)))) errors.stageReview = 'Invalid saved stage review.';
  }
  if (fields.growthProfile != null) {
    const profile = fields.growthProfile as NonNullable<import('@/firestoreModels').Plant['growthProfile']>;
    if (!['unknown', 'photoperiod', 'age_based'].includes(profile.flowering)) errors.growthProfile = 'Choose a supported flowering profile.';
    for (const key of ['ageCheckDays', 'agePushDays', 'establishedDays', 'harvestCheckDays'] as const) if (profile[key] != null && (!Number.isInteger(profile[key]) || profile[key]! < 1 || profile[key]! > 730)) errors.growthProfile = 'Profile milestone days must be whole numbers from 1 to 730.';
    if ((profile.agePushDays ?? 35) < (profile.ageCheckDays ?? 28)) errors.growthProfile = 'The flowering reminder must follow the first check.';
    if (profile.floweringMonths != null && (!Array.isArray(profile.floweringMonths) || profile.floweringMonths.some(m => !Number.isInteger(m) || m < 1 || m > 12))) errors.growthProfile = 'Use calendar months from 1 to 12.';
  }
  if (fields.stageReminders != null) {
    const settings = fields.stageReminders as NonNullable<import('@/firestoreModels').Plant['stageReminders']>;
    if (typeof settings.enabled !== 'boolean' || [settings.quietStartHour, settings.quietEndHour].some(h => h != null && (!Number.isInteger(h) || h < 0 || h > 23))) errors.stageReminders = 'Use valid notification settings and quiet hours from 0 to 23.';
  }
  for (const [key, choices] of Object.entries(contextChoices)) if (fields[key] != null && fields[key] !== '' && !(choices as readonly unknown[]).includes(fields[key])) errors[key] = `Choose a supported ${key.replace(/[A-Z]/g, letter => ' ' + letter.toLowerCase())}.`;
  if (fields.careMedium != null && !MEDIUMS.includes(fields.careMedium as typeof MEDIUMS[number])) errors.careMedium = 'Choose a supported growing medium or leave it unknown.';
  if (fields.rainReception != null) {
    const rain = fields.rainReception as { soil?: unknown; canopy?: unknown };
    if (typeof rain !== 'object' || Array.isArray(rain) || typeof rain.soil !== 'string' || typeof rain.canopy !== 'string'
      || !['yes', 'no', 'partial', 'unknown'].includes(rain.soil)
      || !['yes', 'no', 'partial', 'unknown'].includes(rain.canopy)) errors.rainReception = 'Choose a valid rain exposure.';
  }
  if ('name' in fields && (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 100)) errors.name = 'Use a plant name of 1–100 characters.';
  const choices: Record<string, readonly string[]> = { growthStage: PLANT_STAGES, environment: PLANT_ENVIRONMENTS, plantedIn: ['pot', 'ground'], status: ['active', 'archived', 'harvested', 'dead'], strainType: ['unknown', 'sativa', 'indica', 'hybrid'], locationMode: ['custom', 'space'] };
  for (const [field, values] of Object.entries(choices)) if (field in fields && !values.includes(fields[field] as string)) errors[field] = `Choose a valid ${field === 'growthStage' ? 'growth stage' : field === 'strainType' ? 'strain type' : field === 'locationMode' ? 'location mode' : field}.`;
  for (const [field, max, label, integer] of [['ageDays', MAX_PLANT_AGE_DAYS, 'Age in days', true], ['height', 10000, 'Height in centimetres', false]] as const) {
    const value = fields[field];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value)))) errors[field] = `${label} must be ${integer ? 'a whole number' : 'a number'} between 0 and ${max.toLocaleString('en-US')}.`;
  }
  if (fields.soilPh != null && fields.soilPh !== '') {
    const raw = fields.soilPh;
    if (!['string', 'number'].includes(typeof raw) || !/^\d+(\.\d+)?$/.test(String(raw).trim()) || Number(raw) > 14) errors.soilPh = 'Enter a pH between 0 and 14, or leave it blank.';
  }
  if (fields.location != null) {
    const location = fields.location as { lat?: unknown; lng?: unknown };
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) errors.location = 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).';
  }
  return errors;
}
export class PlantValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) { super(Object.values(fields)[0]); this.name = 'PlantValidationError'; }
}
export function assertValidPlantFields(fields: Record<string, unknown>, today?: string) {
  const errors = validatePlantFields(fields, today);
  if (Object.keys(errors).length) throw new PlantValidationError(errors);
}
