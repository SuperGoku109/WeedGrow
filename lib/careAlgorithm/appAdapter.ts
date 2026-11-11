import type { Plant } from '@/firestoreModels';
import { parseVolumeL } from './profiles';
import { evaluateCare } from './evaluate';
import type { Setup } from './types';
import { windPlantContext } from './windPolicy';

export function plantSetup(plant: Plant): Setup {
  return { windPlant: windPlantContext(plant), status: plant.status, deleting: plant.deleting, environment: plant.environment, plantedIn: plant.plantedIn ?? null,
    stage: plant.growthStage ?? null, sun: plant.sunlightExposure || null, medium: plant.careMedium || null,
    potVolumeL: parseVolumeL(plant.potSize), soilRain: plant.rainReception?.soil ?? 'unknown',
    canopyRain: plant.rainReception?.canopy ?? 'unknown', locationRevision: plant.locationRevision ?? 0 };
}
/** Daily legacy caches do not establish ET0, hourly integrals, state anchors or source approval. */
export function evaluatePlantCare(plant: Plant, at: Date) {
  return evaluateCare({ setup: plantSetup(plant), evaluationUtc: at.getTime() / 1000, profile: null,
    policyVersion: 'hops-unreleased-8.4', nextEvaluationUtc: null, warningWindows: [] });
}
