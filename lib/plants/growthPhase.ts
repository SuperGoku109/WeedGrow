import type { Plant } from '@/firestoreModels';
import { addDays, plantDay } from '../dates/plantDay';
import { plantAgeDays } from './plantAge';

/** User-supplied weeks after planting. Week 1 is days 0–6.
 * Flowering continues through the unassigned weeks 12–14 until late flowering. */
export const GROWTH_PHASES = [
  { key: 'germination', label: 'Germination', startWeek: 1, endWeek: 1 },
  { key: 'seedling', label: 'Seedling', startWeek: 2, endWeek: 3 },
  { key: 'vegetative', label: 'Vegetative', startWeek: 4, endWeek: 9 },
  { key: 'flowering', label: 'Flowering', startWeek: 10, endWeek: 14 },
  { key: 'late_flowering', label: 'Late flowering', startWeek: 15, endWeek: 18 },
  { key: 'harvested', label: 'Harvest', startWeek: 19, endWeek: 20 },
  { key: 'drying', label: 'Drying', startWeek: 21, endWeek: 22 },
  { key: 'curing', label: 'Curing', startWeek: 23, endWeek: 32 },
] as const;
export type GrowthPhase = Plant['growthStage'] | 'late_flowering';
export function growthPhase(plant: Pick<Plant, 'growthStage' | 'floweringPhase'>): GrowthPhase {
  return plant.growthStage === 'flowering' && plant.floweringPhase === 'late' ? 'late_flowering' : plant.growthStage;
}
export function phaseWindow(phase: string) { return GROWTH_PHASES.find(item => item.key === phase); }
export function phaseWindowLabel(phase: string) {
  const window = phaseWindow(phase);
  return window ? `${window.startWeek === window.endWeek ? 'Week' : 'Weeks'} ${window.startWeek}${window.startWeek === window.endWeek ? '' : `–${window.endWeek}`}` : null;
}
/** Inclusive day numbers since planting, using planting day as day 1. */
export function phaseDayWindowLabel(phase: string) {
  const window = phaseWindow(phase);
  return window ? `Days ${(window.startWeek - 1) * 7 + 1}–${window.endWeek * 7}` : null;
}
export function growthPhaseProgress(plant: Plant, now = new Date()) {
  const phase = growthPhase(plant), window = phaseWindow(phase);
  const age = plantAgeDays(plant, plantDay(now, plant.locationTimeZone));
  const start = window ? (window.startWeek - 1) * 7 : 0;
  const end = window ? window.endWeek * 7 : 0;
  const fraction = window ? Math.max(0, Math.min(1, (age - start) / (end - start))) : null;
  const canReview = !plant.deleting && ['active', 'harvested'].includes(plant.status);
  return { phase, window, age, week: Math.floor(age / 7) + 1, fraction,
    phaseDay: window ? Math.max(0, age - start + 1) : null,
    phaseDays: window ? end - start : null,
    estimated: plant.ageEstimated === true || plant.ageEstimateSource === 'stage' || plant.ageKnown === false || !plant.startedOn,
    attention: canReview && fraction != null && fraction >= .85,
    checkOn: window ? addDays(plantDay(now, plant.locationTimeZone), Math.ceil(start + (end - start) * .85) - age) : undefined,
    next: window ? GROWTH_PHASES[GROWTH_PHASES.findIndex(item => item.key === phase) + 1]?.key || 'completed' : undefined };
}
