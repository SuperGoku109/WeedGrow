import type { Plant } from '@/firestoreModels';
import { plantAgeLabel } from '@/lib/plants/plantAge';
import { growthPhase } from '@/lib/plants/growthPhase';
import { stageLabel } from '@/lib/plants/growthTracking';
export function matchesPlantStatus(plant: Pick<Plant, 'status'>, status: string | null) {
  return status === 'past' ? plant.status !== 'active' : !status || plant.status === status;
}
export function plantCardFacts(plant: Plant, showEnvironment = true) {
  const strainTypes: Record<string, string> = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid' };
  const strain = plant.strain?.trim() || strainTypes[plant.strainType?.trim().toLowerCase() || ''] || 'Strain unknown';
  return [showEnvironment ? plant.environment.charAt(0).toUpperCase() + plant.environment.slice(1) : '', strain].filter(Boolean);
}
export function plantCardMeta(plant: Plant, showEnvironment = true) {
  return plantCardFacts(plant, showEnvironment).join(' · ');
}
export function plantCardStageLabel(plant: Plant) {
  return plant.status === 'active' ? growthPhase(plant) === 'late_flowering' ? 'Late flowering' : stageLabel(plant.growthStage) : plant.status.charAt(0).toUpperCase() + plant.status.slice(1);
}
export function plantCardAgeLabel(plant: Plant, compact = true) {
  return plantAgeLabel(plant, undefined, compact);
}
export function plantCardStage(plant: Plant, compact = true) {
  return `${plantCardStageLabel(plant)} · ${compact ? '' : 'Plant age: '}${plantCardAgeLabel(plant, compact)}`;
}
