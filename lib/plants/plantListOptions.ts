import type { Plant } from '@/firestoreModels';
import { growthPhase } from './growthPhase';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';

// Single values remain readable for existing in-memory garden preferences.
export type PlantFilterSelection<T extends string> = 'all' | T | T[];
export type PlantListStage = Plant['growthStage'] | 'preflower' | 'late_flowering';
export type PlantListOptions = { sort: 'newest' | 'oldest' | 'nameAsc' | 'nameDesc'; stage: PlantFilterSelection<PlantListStage>; environment: PlantFilterSelection<Plant['environment']> };
export function plantFilterValues<T extends string>(selection: PlantFilterSelection<T>): T[] {
  return selection === 'all' ? [] : Array.isArray(selection) ? [...new Set(selection)] : [selection as T];
}
export const DEFAULT_PLANT_LIST_OPTIONS: PlantListOptions = { sort: 'newest', stage: 'all', environment: 'all' };
export const plantSortOptions = [
  { value: 'newest', label: 'Newest added' }, { value: 'oldest', label: 'Oldest added' },
  { value: 'nameAsc', label: 'Name A–Z' }, { value: 'nameDesc', label: 'Name Z–A' },
] as const;
export function plantListChoiceCount(options: PlantListOptions, status: string | null) {
  return plantFilterValues(options.stage).length + plantFilterValues(options.environment).length + Number(options.sort !== 'newest') + Number(status !== 'active');
}
export function selectPlantList<T extends Plant & { id: string }>(plants: readonly T[], query: string, status: string | null, options = DEFAULT_PLANT_LIST_OPTIONS): T[] {
  const search = query.trim().toLocaleLowerCase();
  const stages = plantFilterValues<PlantListStage>(options.stage);
  const environments = plantFilterValues<Plant['environment']>(options.environment);
  const nameOrder = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);
  const added = (plant: T) => {
    const value = typeof plant.createdAt?.toMillis === 'function' ? plant.createdAt.toMillis() : null;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  return plants.filter(plant => (
    (status === 'past' || !status ? plant.status !== 'active' : plant.status === status)
    && (!stages.length || stages.includes(growthPhase(plant))
      // Pre-flowering is an observed phase within vegetative growth, not a stored plant stage.
      || stages.includes('preflower') && plant.growthStage === 'vegetative' && isCalendarDay(plant.preflowerObservedOn || '') && plant.preflowerObservedOn! <= plantDay(new Date(), plant.locationTimeZone))
    && (!environments.length || environments.includes(plant.environment))
    && `${plant.name} ${plant.strain || ''}`.toLocaleLowerCase().includes(search)
  )).sort((a, b) => {
    if (options.sort === 'nameAsc') return nameOrder(a, b);
    if (options.sort === 'nameDesc') return -nameOrder(a, b);
    const first = added(a); const second = added(b);
    // Pending/legacy timestamps stay at the end in either direction.
    if (first === null || second === null) return first === second ? nameOrder(a, b) : first === null ? 1 : -1;
    return (options.sort === 'newest' ? second - first : first - second) || nameOrder(a, b);
  });
}
