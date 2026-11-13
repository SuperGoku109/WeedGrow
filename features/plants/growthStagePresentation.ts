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
/** Each stage keeps its hue while shifting brightness for the active surface. */
export const GROWTH_STAGE_COLORS: Record<GrowthGuideStage, { light: string; dark: string }> = {
  germination: { light: '#16694f', dark: '#73d6a6' },
  seedling: { light: '#286b3a', dark: '#86d98a' },
  vegetative: { light: '#4d6f1c', dark: '#b3d96a' },
  preflower: { light: '#806300', dark: '#f1d16a' },
  flowering: { light: '#a33c73', dark: '#f28bbf' },
  late_flowering: { light: '#7f2c5b', dark: '#dc91e8' },
  harvested: { light: '#995518', dark: '#f1ae69' },
  drying: { light: '#376276', dark: '#8fcde6' },
  curing: { light: '#59427c', dark: '#bba6f4' },
  completed: { light: '#30685b', dark: '#7fd2b0' },
  clone: { light: '#236964', dark: '#74d5cf' },
  unknown: { light: '#5d6861', dark: '#d0d6d2' },
};
function isDarkBackground(background: string) {
  const channels = background.match(/[0-9a-f]{2}/gi)?.slice(-3).map(value => parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) return false;
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 < 0.4;
}
export function growthStageColor(stage: string, background = '#fffef8') {
  const colors = GROWTH_STAGE_COLORS[stage as GrowthGuideStage] || GROWTH_STAGE_COLORS.unknown;
  return isDarkBackground(background) ? colors.dark : colors.light;
}
export function growthStageOnColor(background = '#fffef8') { return isDarkBackground(background) ? '#15231c' : '#ffffff'; }
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
