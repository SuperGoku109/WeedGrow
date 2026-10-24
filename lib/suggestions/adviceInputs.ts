import type { PlantSummary } from './wateringSuggestions';
// Only fields actually used by advice belong in its invalidation signature.
// Caption, snooze and lasting-note changes must not refetch historical weather.
export function adviceInput(plant: PlantSummary) {
  return { id: plant.id, name: plant.name, status: plant.status, environment: plant.environment, growthStage: plant.growthStage, potSize: plant.potSize,
    sunlightExposure: plant.sunlightExposure, location: plant.location, locationRevision: plant.locationRevision, locationTimeZone: plant.locationTimeZone,
    locationLabel: plant.locationLabel, currentWeather: plant.currentWeather };
}
