import type { Plant } from '@/firestoreModels';
import { plantAgeLabel } from '@/lib/plants/plantAge';
import { stageLabel } from '@/lib/plants/growthTracking';
export function matchesPlantStatus(plant: Pick<Plant, 'status'>, status: string | null) {
  return status === 'past' ? plant.status !== 'active' : !status || plant.status === status;
}
export function plantCardMeta(plant: Plant, showEnvironment = true) {
  const strainTypes: Record<string, string> = { indica: 'Indica', sativa: 'Sativa', hybrid: 'Hybrid' };
  const strain = plant.strain?.trim() || strainTypes[plant.strainType?.trim().toLowerCase() || ''] || 'Strain unknown';
  const facts = [showEnvironment ? plant.environment.charAt(0).toUpperCase() + plant.environment.slice(1) : '', strain];
  return facts.filter(Boolean).join(' · ');
}
export function plantCardStage(plant: Plant, compact = true) {
  const stage = plant.status === 'active' ? stageLabel(plant.growthStage) : plant.status.charAt(0).toUpperCase() + plant.status.slice(1);
  return `${stage} · ${compact ? '' : 'Plant age: '}${plantAgeLabel(plant, undefined, compact)}`;
}
