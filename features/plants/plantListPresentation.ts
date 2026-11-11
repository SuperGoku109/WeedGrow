import type { Plant } from '@/firestoreModels';
import { plantAgeLabel } from '@/lib/plants/plantAge';
import { stageLabel } from '@/lib/plants/growthTracking';
export function matchesPlantStatus(plant: Pick<Plant, 'status'>, status: string | null) {
  return status === 'past' ? plant.status !== 'active' : !status || plant.status === status;
}
export function plantCardMeta(plant: Plant, showEnvironment = true) {
  const facts = [showEnvironment ? plant.environment.charAt(0).toUpperCase() + plant.environment.slice(1) : '', plant.strain];
  if (!facts.some(Boolean)) facts.push(plant.plantedIn === 'ground' ? 'In the ground' : plant.potSize ? `${plant.potSize} pot` : 'Potted plant');
  return facts.filter(Boolean).join(' · ');
}
export function plantCardStage(plant: Plant, compact = true) {
  const stage = plant.status === 'active' ? stageLabel(plant.growthStage) : plant.status.charAt(0).toUpperCase() + plant.status.slice(1);
  return `${stage} · ${compact ? '' : 'Plant age: '}${plantAgeLabel(plant, undefined, compact)}`;
}
