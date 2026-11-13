import type { Plant } from '@/firestoreModels';
import { isCalendarDay } from '@/lib/dates/plantDay';
import { STAGE_DURATION_RANGES } from '@/lib/plants/stageAgeDefaults';

export const GROWTH_GUIDE_STAGES = [
  { key: 'germination', title: 'Germination', icon: 'seed-outline' },
  { key: 'seedling', title: 'Seedling', icon: 'sprout' },
  { key: 'vegetative', title: 'Vegetative', icon: 'leaf' },
  { key: 'preflower', title: 'Pre-flowering', icon: 'flower-outline' },
  { key: 'flowering', title: 'Flowering', icon: 'flower' },
  { key: 'late_flowering', title: 'Late flowering', icon: 'flower-tulip' },
  { key: 'harvested', title: 'Harvest', icon: 'basket-outline' },
  { key: 'drying', title: 'Drying', icon: 'weather-windy' },
  { key: 'curing', title: 'Curing', icon: 'archive-outline' },
  { key: 'completed', title: 'Completed', icon: 'check-circle-outline' },
  { key: 'clone', title: 'Rooting', icon: 'content-cut' },
  { key: 'unknown', title: 'Not recorded', icon: 'help-circle-outline' },
] as const;
export type GrowthGuideStage = typeof GROWTH_GUIDE_STAGES[number]['key'];
export function guideStage(stage: string) { return GROWTH_GUIDE_STAGES.find(item => item.key === stage) || GROWTH_GUIDE_STAGES[GROWTH_GUIDE_STAGES.length - 1]; }
export function guideTabs(plant: Plant) { return GROWTH_GUIDE_STAGES.filter(item => !['clone', 'unknown'].includes(item.key) || item.key === plant.growthStage); }
export function growthDuration(stage: GrowthGuideStage) {
  if (!Object.prototype.hasOwnProperty.call(STAGE_DURATION_RANGES, stage)) return null;
  const range = STAGE_DURATION_RANGES[stage as keyof typeof STAGE_DURATION_RANGES];
  const divisor = stage === 'flowering' || stage === 'curing' ? 7 : 1;
  return { value: `${range.min / divisor}–${range.max / divisor}${range.openEnded ? '+' : ''}`, unit: divisor === 7 ? 'weeks' : 'days' };
}
export function growthDate(day: string, year = true) {
  return isCalendarDay(day) ? new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' as const } : {}) }) : 'Not recorded';
}
export const GUIDE_PLACEHOLDERS = [
  { title: 'What to look for', icon: 'eye-outline', note: 'Stage signs and reference images will appear here.' },
  { title: 'Care in this stage', icon: 'water-outline', note: 'The stage-specific care guide will appear here.' },
  { title: 'Moving to the next stage', icon: 'arrow-right', note: 'Transition details and practical checks will appear here.' },
] as const;
