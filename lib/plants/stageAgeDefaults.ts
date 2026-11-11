import type { Plant } from '@/firestoreModels';
import { addDays, isCalendarDay, plantDay } from '@/lib/dates/plantDay';

/** User-supplied growing ranges; drying/curing retain the supplied implementation spec. */
export const STAGE_DURATION_RANGES = {
  germination: { min: 3, max: 10, openEnded: false },
  seedling: { min: 14, max: 21, openEnded: false },
  vegetative: { min: 60, max: 150, openEnded: true },
  preflower: { min: 7, max: 14, openEnded: false },
  flowering: { min: 56, max: 84, openEnded: true },
  clone: { min: 7, max: 21, openEnded: false }, // User-supplied rooting window only; no broader clone profile.
  drying: { min: 7, max: 14, openEnded: false },
  curing: { min: 14, max: 28, openEnded: true },
} as const;
export const durationMidpoint = (stage: keyof typeof STAGE_DURATION_RANGES) => Math.round((STAGE_DURATION_RANGES[stage].min + STAGE_DURATION_RANGES[stage].max) / 2);
export function stageDurationLabel(stage: string) {
  if (!Object.prototype.hasOwnProperty.call(STAGE_DURATION_RANGES, stage)) return null;
  const range = STAGE_DURATION_RANGES[stage as keyof typeof STAGE_DURATION_RANGES];
  return `${range.min}–${range.max}${range.openEnded ? '+' : ''} days`;
}
const germination = durationMidpoint('germination');
const seedling = germination + durationMidpoint('seedling');
const vegetative = seedling + durationMidpoint('vegetative');
// Pre-flowering is observed within vegetative, so its duration is never added twice.
const flowering = vegetative + durationMidpoint('flowering');
const drying = flowering + durationMidpoint('drying');
const curing = drying + durationMidpoint('curing');
const DEFAULTS: Record<Plant['growthStage'], { ageDays: number; stageDays: number; trackingOnly?: boolean }> = {
  germination: { ageDays: germination, stageDays: durationMidpoint('germination') },
  seedling: { ageDays: seedling, stageDays: durationMidpoint('seedling') },
  vegetative: { ageDays: vegetative, stageDays: durationMidpoint('vegetative') },
  flowering: { ageDays: flowering, stageDays: durationMidpoint('flowering') },
  clone: { ageDays: durationMidpoint('clone'), stageDays: durationMidpoint('clone') },
  harvested: { ageDays: flowering, stageDays: 0 },
  drying: { ageDays: drying, stageDays: durationMidpoint('drying') },
  curing: { ageDays: curing, stageDays: durationMidpoint('curing') },
  completed: { ageDays: curing, stageDays: 0 },
  unknown: { ageDays: 0, stageDays: 0, trackingOnly: true },
};
export function stageAgeDefault(stage: string) { return Object.prototype.hasOwnProperty.call(DEFAULTS, stage) ? DEFAULTS[stage as Plant['growthStage']] : DEFAULTS.unknown; }
export function estimatedAgeFields(stage: string, today: string, actualStageStartedOn?: string) {
  const defaults = stageAgeDefault(stage);
  const ageDays = actualStageStartedOn && isCalendarDay(actualStageStartedOn) && actualStageStartedOn <= today
    ? defaults.ageDays - defaults.stageDays + Math.round((Date.parse(today) - Date.parse(actualStageStartedOn)) / 86400000) : defaults.ageDays;
  return { ageDays, startedOn: addDays(today, -ageDays), ageKnown: true, ageEstimated: true, ageEstimateSource: 'stage' as const };
}
/** Anchor legacy estimates once to their saved recording/creation date, never rebase every day. */
export function ageReferenceDay(plant: Plant, fallback: string) {
  const recorded = plant.ageRecordedAt?.toDate?.() || plant.createdAt?.toDate?.();
  return recorded && Number.isFinite(recorded.getTime()) ? plantDay(recorded, plant.locationTimeZone) : fallback;
}
export function stageTiming(plant: Plant, now = new Date()): { startedOn: string; estimated: boolean } {
  const today = plantDay(now, plant.locationTimeZone);
  if (plant.stageStartedOn && isCalendarDay(plant.stageStartedOn) && plant.stageStartedOn <= today) return { startedOn: plant.stageStartedOn, estimated: !!plant.stageStartedOnEstimated };
  const created = plant.createdAt?.toDate?.();
  const reference = created && Number.isFinite(created.getTime()) ? plantDay(created, plant.locationTimeZone) : ageReferenceDay(plant, today);
  return { startedOn: addDays(reference, -stageAgeDefault(plant.growthStage).stageDays), estimated: true };
}
