import type { Plant } from '@/firestoreModels';
export const POST_HARVEST_STAGES = ['harvested', 'drying', 'curing', 'completed'] as const;
export function livingGrowthEnded(plant: Partial<Plant>): boolean {
  return plant.status === 'harvested' || !!plant.harvest || !!plant.harvestedOn || (POST_HARVEST_STAGES as readonly string[]).includes(plant.growthStage || '');
}
export function assertLivingGrowthChange(plant: Partial<Plant>, updates: Partial<Plant>) {
  if (!livingGrowthEnded(plant)) return;
  if (updates.status === 'active' || updates.growthStage && !(POST_HARVEST_STAGES as readonly string[]).includes(updates.growthStage)) {
    throw new Error('Harvest ended this plant’s living growth. You can edit its dates and track drying or curing, but cannot restart growing it.');
  }
}
