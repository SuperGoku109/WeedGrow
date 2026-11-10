import type { PlantSummary } from './wateringSuggestions';
// Only fields actually used by advice belong in its invalidation signature.
// Caption, snooze and lasting-note changes must not refetch historical weather.
export function adviceInput(plant: PlantSummary) {
  return { id: plant.id, owners: plant.owners, name: plant.name, status: plant.status, environment: plant.environment, growthStage: plant.growthStage, potSize: plant.potSize, potMaterial: plant.potMaterial, potType: plant.potType, potDrainage: plant.potDrainage, growingSite: plant.growingSite,
    sunlightExposure: plant.sunlightExposure, plantedIn: plant.plantedIn, careMedium: plant.careMedium, soilType: plant.soilType, permanentProtection: plant.permanentProtection, rainReception: plant.rainReception,
    deleting: plant.deleting, careRevision: plant.careRevision, waterLedgerRevision: plant.waterLedgerRevision, setupLedgerRevision: plant.setupLedgerRevision, careEvaluationRevision: plant.careEvaluationRevision, location: plant.location, locationRevision: plant.locationRevision, locationTimeZone: plant.locationTimeZone,
    locationLabel: plant.locationLabel, locationChangedAt: plant.locationChangedAt, currentWeather: plant.currentWeather };
}
