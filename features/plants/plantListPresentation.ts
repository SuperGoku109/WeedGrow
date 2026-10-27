import type { Plant } from '@/firestoreModels';
import { plantAgeLabel } from '@/lib/plants/plantAge';
export function matchesPlantStatus(plant: Pick<Plant, 'status'>, status: string | null) {
  return status === 'past' ? plant.status !== 'active' : !status || plant.status === status;
}
export function plantCardMeta(plant: Plant, showEnvironment = true) {
  const age = plantAgeLabel(plant);
  const facts = [showEnvironment ? plant.environment.charAt(0).toUpperCase() + plant.environment.slice(1) : '', plant.strain, age === 'Unknown' ? '' : age];
  if (!facts.some(Boolean)) facts.push(plant.plantedIn === 'ground' ? 'In the ground' : plant.potSize ? `${plant.potSize} pot` : 'Potted plant');
  return facts.filter(Boolean).join(' · ');
}
