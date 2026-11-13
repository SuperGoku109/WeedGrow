import type { Plant } from '@/firestoreModels';
import { addDays, isCalendarDay, plantDay, zonedTime } from '@/lib/dates/plantDay';
import { stageTiming, STAGE_DURATION_RANGES, estimatedAgeFields } from './stageAgeDefaults';
import { livingGrowthEnded, POST_HARVEST_STAGES } from './growthLifecycle';
import { plantAgeDays } from './plantAge';

export type FloweringProfile = 'unknown' | 'photoperiod' | 'age_based';
export interface GrowthProfile {
  flowering: FloweringProfile;
  ageCheckDays?: number;
  agePushDays?: number;
  establishedDays?: number;
  floweringMonths?: number[];
  harvestCheckDays?: number;
}
export type StageReviewAction = 'not_yet' | 'snooze' | 'dismiss' | 'early_signs';
export interface StageReview {
  suggestionId: string;
  action: StageReviewAction | 'stage_recorded';
  nextCheckOn: string | null;
  snoozes: number;
}
export interface StagePush { key: string; dueAt: number }
export interface StageSuggestion {
  id: string;
  kind: 'transition' | 'profile' | 'location' | 'harvest' | 'progress';
  prompt: string;
  target?: Plant['growthStage'];
  checkOn: string;
  pushOn?: string;
  repeatDays: number;
}
export const stageLabel = (stage: string) => stage === 'germination' ? 'Germinating' : stage.charAt(0).toUpperCase() + stage.slice(1);
export function daysBetween(from: string, to: string) { return Math.round((Date.parse(to) - Date.parse(from)) / 86400000); }
export function stageInstanceId(plant: Plant, now = new Date()) {
  return `${plant.growthStage}:${stageTiming(plant, now).startedOn}:${plant.stageRevision || 0}`;
}
export function preflowerSuggestionId(plant: Plant, observedOn: string, now = new Date()) { return `${stageInstanceId(plant, now)}:preflower:${observedOn}`; }
/** Selecting a current stage is itself a review. Check the next milestone still ahead of it. */
export function recordedStageReview(plant: Plant, reviewedOn: string): StageReview {
  const now = zonedTime(reviewedOn, '12:00', plant.locationTimeZone);
  const start = stageTiming(plant, now).startedOn;
  const elapsed = Math.max(0, daysBetween(start, reviewedOn));
  const milestones: Partial<Record<Plant['growthStage'], number[]>> = {
    germination: [5, 10], seedling: [14, 21], flowering: [42, plant.growthProfile?.harvestCheckDays ?? 56, 77, STAGE_DURATION_RANGES.flowering.max],
    drying: [7, 14], curing: [14, 28], clone: [STAGE_DURATION_RANGES.clone.min, STAGE_DURATION_RANGES.clone.max],
  };
  const next = milestones[plant.growthStage]?.filter(value => value > elapsed).sort((a, b) => a - b)[0];
  const repeat = ['vegetative', 'flowering'].includes(plant.growthStage) ? 21 : 7;
  return { suggestionId: stageInstanceId(plant, now), action: 'stage_recorded', snoozes: 0,
    nextCheckOn: plant.growthStage === 'harvested' || plant.growthStage === 'completed' ? null : next != null ? addDays(start, next) : addDays(reviewedOn, repeat) };
}
export function daysInStage(plant: Plant, now = new Date()): number {
  const start = stageTiming(plant, now).startedOn;
  const today = plantDay(now, plant.locationTimeZone);
  return Math.max(0, daysBetween(start, today));
}
/** Solar geometry estimate of sunrise-to-sunset duration; no provider request or 12-hour trigger. */
function solarDeclination(day: string) {
  const n = daysBetween(day.slice(0, 4) + '-01-01', day) + 1;
  return 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365.25) * Math.PI / 180;
}
export function daylightHours(latitude: number, day: string): number {
  const declination = solarDeclination(day);
  const lat = Math.max(-89.9, Math.min(89.9, latitude)) * Math.PI / 180;
  const hourAngle = (-Math.sin(0.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  return 24 * Math.acos(Math.max(-1, Math.min(1, hourAngle))) / Math.PI;
}
export function daylightIsShortening(latitude: number, today: string): boolean {
  const before = addDays(today, -7); const after = addDays(today, 7);
  // Require a sustained seasonal trend in this hemisphere; no invented month or latitude window.
  return latitude * (solarDeclination(today) - solarDeclination(before)) < 0
    && latitude * (solarDeclination(after) - solarDeclination(today)) < 0
    && daylightHours(latitude, before) > daylightHours(latitude, today)
    && daylightHours(latitude, today) > daylightHours(latitude, after);
}
/** A single stable suggestion per stage instance. Reviewing never advances the stage. */
export function stageSuggestion(plant: Plant, now = new Date(), includeUpcoming = false): StageSuggestion | null {
  if (plant.deleting || !['active', 'harvested'].includes(plant.status)) return null;
  if (livingGrowthEnded(plant) && !(POST_HARVEST_STAGES as readonly string[]).includes(plant.growthStage)) return null;
  const timing = stageTiming(plant, now);
  const start = timing.startedOn;
  const today = plantDay(now, plant.locationTimeZone);
  if (start > today) return null;
  const id = stageInstanceId(plant, now);
  let suggestion: StageSuggestion | null = null;
  const build = (days: number, prompt: string, target?: Plant['growthStage'], pushDays?: number, repeatDays = 7, kind: StageSuggestion['kind'] = 'transition') => ({ id, prompt, target, kind, checkOn: addDays(start, days), ...(pushDays != null ? { pushOn: addDays(start, pushDays) } : {}), repeatDays });
  switch (plant.growthStage) {
    case 'germination': suggestion = build(5, 'Your seed may have germinated! Has a small seedling emerged above the soil?', 'seedling', 10); break;
    case 'seedling': suggestion = build(14, 'Is your seedling developing several sets of true leaves and showing stronger, faster growth?', 'vegetative', 21); break;
    case 'vegetative': {
      if (plant.preflowerObservedOn && isCalendarDay(plant.preflowerObservedOn) && plant.preflowerObservedOn <= today) {
        suggestion = { ...build(0, 'Early flowering signs were recorded. Have flowers now started developing?', 'flowering', undefined, STAGE_DURATION_RANGES.preflower.max), id: preflowerSuggestionId(plant, plant.preflowerObservedOn, now), checkOn: addDays(plant.preflowerObservedOn, STAGE_DURATION_RANGES.preflower.min) };
        break;
      }
      const profile = plant.growthProfile;
      if (!profile || profile.flowering === 'unknown') {
        suggestion = { ...build(0, 'Choose a flowering profile when you know your plant’s characteristics. Basic stage tracking will continue.', undefined, undefined, 21, 'profile'), id: `${id}:profile` };
      } else if (profile.flowering === 'age_based') {
        const base = plant.germinationStartedOn;
        if (base && isCalendarDay(base)) suggestion = { ...build(0, 'Your plant may be entering its flowering stage. Have you started seeing flowers developing?', 'flowering', undefined, 21), checkOn: addDays(base, profile.ageCheckDays ?? 28), pushOn: addDays(base, profile.agePushDays ?? 35) };
      } else if (plant.environment === 'outdoor') {
        if (!plant.location || !Number.isFinite(plant.location.lat) || Math.abs(plant.location.lat) > 90 || !Number.isFinite(plant.location.lng) || Math.abs(plant.location.lng) > 180) {
          suggestion = { ...build(0, 'Add a plant location to calculate seasonal flowering checks. You can record early flowering signs at any time.', undefined, undefined, 21, 'location'), id: `${id}:location` };
          break;
        }
        const month = Number(today.slice(5, 7));
        const establishedDays = plant.emergedOn && isCalendarDay(plant.emergedOn) ? daysBetween(plant.emergedOn, today) : plantAgeDays(plant, today);
        if (daysBetween(start, today) >= STAGE_DURATION_RANGES.vegetative.min && establishedDays >= (profile.establishedDays ?? 35)
          && (!profile.floweringMonths?.length || profile.floweringMonths.includes(month)) && daylightIsShortening(plant.location.lat, today)) {
          suggestion = { ...build(0, 'Your plant’s timing and shortening daylight suggest a flowering check. Are reproductive structures developing? Confirm from what you see.', 'flowering', undefined, 21), id: `${id}:seasonal` };
        }
      }
      break;
    }
    case 'flowering': {
      const age = daysBetween(start, today);
      const harvestDays = plant.growthProfile?.harvestCheckDays ?? STAGE_DURATION_RANGES.flowering.min;
      suggestion = { ...build(age < harvestDays ? 42 : harvestDays, age < harvestDays ? 'How is flower development progressing? Timing alone cannot establish harvest readiness.' : timing.estimated ? 'Based on the estimated flowering start, it may be time to check harvest readiness. Check flower development, or correct the start date if you know it.' : `Your plant has been flowering for about ${Math.floor(age / 7)} weeks. Have you checked its flower development?`, age < harvestDays ? undefined : 'harvested', age < harvestDays ? undefined : harvestDays, 21, age < harvestDays ? 'progress' : 'harvest'), id: `${id}:${age < harvestDays ? 'progress' : 'harvest'}` };
      break;
    }
    case 'drying': if (plant.postHarvestTracking) suggestion = build(7, 'How is drying progressing? Confirm completion using your processing method, rather than elapsed time alone.', 'curing', 14); break;
    case 'curing': if (plant.postHarvestTracking) suggestion = build(14, 'Review post-drying maturation and storage. Has your chosen process finished?', 'completed', 28); break;
  }
  if (!suggestion) return null;
  const review = plant.stageReview;
  const preflowerCheck = suggestion.id.startsWith(`${id}:preflower:`);
  const setupReview = review?.action === 'stage_recorded' && review.suggestionId === id && !['profile', 'location'].includes(suggestion.kind);
  if (setupReview && review.nextCheckOn) {
    if (review.nextCheckOn > suggestion.checkOn) suggestion.checkOn = review.nextCheckOn;
    if (suggestion.pushOn && suggestion.checkOn > suggestion.pushOn) suggestion.pushOn = suggestion.checkOn;
  } else if (review?.suggestionId === suggestion.id) {
    if (review.action === 'dismiss' || ['profile', 'location'].includes(suggestion.kind)) return null;
    if (review.nextCheckOn) suggestion.checkOn = review.nextCheckOn;
    // A response cancels the original push; only an explicit snooze can request one more.
    suggestion.pushOn = review.action === 'snooze' && review.snoozes <= 1 ? review.nextCheckOn || undefined : undefined;
  } else if (review && review.action !== 'stage_recorded' && plant.lastStageReviewedOn && isCalendarDay(plant.lastStageReviewedOn) && !preflowerCheck && !['profile', 'location'].includes(suggestion.kind)) {
    // A new milestone may follow an earlier progress check, with breathing room after the response.
    const earliest = addDays(plant.lastStageReviewedOn, 7);
    if (earliest > suggestion.checkOn) suggestion.checkOn = earliest;
    if (suggestion.pushOn && earliest > suggestion.pushOn) suggestion.pushOn = earliest;
  }
  return includeUpcoming || suggestion.checkOn <= today ? suggestion : null;
}

/** Plan the known harvest-readiness milestone while progress checks remain in-app only. */
export function stageReminderSuggestion(plant: Plant, now = new Date()): StageSuggestion | null {
  if (plant.growthStage !== 'flowering') return stageSuggestion(plant, now, true);
  const today = plantDay(now, plant.locationTimeZone);
  const readiness = addDays(stageTiming(plant, now).startedOn, plant.growthProfile?.harvestCheckDays ?? STAGE_DURATION_RANGES.flowering.min);
  return stageSuggestion(plant, zonedTime(readiness > today ? readiness : today, '12:00', plant.locationTimeZone), true);
}

/** Optional pushes are separate from weather hazards and always use a quiet-hours-safe local time. */
export function stagePushPlan(plant: Plant, now = new Date()): { key: string; dueAt: number; suggestionId: string } | null {
  if (!plant.stageReminders?.enabled) return null;
  const suggestion = stageReminderSuggestion(plant, now);
  if (!suggestion?.pushOn) return null;
  const snoozes = plant.stageReview?.suggestionId === suggestion.id ? plant.stageReview.snoozes : 0;
  const key = `${suggestion.id}:${snoozes}`;
  if (plant.stagePush?.key === key) return null;
  const zone = plant.locationTimeZone;
  // Use the first daytime hour outside configured quiet hours; defaults: 20:00–08:00.
  const quietStart = plant.stageReminders.quietStartHour ?? 20;
  const quietEnd = plant.stageReminders.quietEndHour ?? 8;
  const quiet = (hour: number) => quietStart === quietEnd ? false : quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd;
  const hour = Array.from({ length: 24 }, (_, i) => (10 + i) % 24).find(h => !quiet(h));
  if (hour == null) return null;
  const time = `${String(hour).padStart(2, '0')}:00`;
  const today = plantDay(now, zone);
  let due = zonedTime(suggestion.pushOn > today ? suggestion.pushOn : today, time, zone);
  const earliest = Math.max(now.getTime() + 60000, (plant.stagePush?.dueAt || 0) + 7 * 86400000);
  while (due.getTime() < earliest) due = zonedTime(addDays(plantDay(due, zone), 1), time, zone);
  return { key, dueAt: due.getTime(), suggestionId: suggestion.id };
}

export function stageChangeFields(plant: Plant, stage: Plant['growthStage'], date: string, reviewedOn = date): Partial<Plant> {
  const fields: Partial<Plant> = { growthStage: stage, ...(!['harvested', 'drying', 'curing', 'completed'].includes(stage) ? { floweringPhase: null, lateFloweringStartedOn: null } : {}), stageStartedOn: date, stageStartedOnEstimated: false, stageTrackingVersion: 1, stageRevision: (plant.stageRevision || 0) + 1,
    ...(stage === plant.growthStage && plant.ageEstimateSource === 'stage' ? estimatedAgeFields(stage, reviewedOn, date) : {}),
    ...(plant.ageEstimated && plant.ageEstimateSource !== 'stage' && plant.startedOn && date < plant.startedOn ? { startedOn: date, ageDays: Math.max(0, daysBetween(date, reviewedOn)), ageKnown: true } : {}),
    ...(stage === 'germination' ? { germinationStartedOn: date } : {}), ...(stage === 'seedling' ? { emergedOn: date } : {}),
    ...(stage === 'flowering' ? { floweringStartedOn: date } : {}), ...(stage === 'harvested' ? { harvestedOn: date } : {}) };
  return { ...fields, lastStageReviewedOn: reviewedOn, stageReview: recordedStageReview({ ...plant, ...fields } as Plant, reviewedOn) };
}
