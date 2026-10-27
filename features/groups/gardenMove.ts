import type { Group } from '@/firestoreModels';
export function gardenMoveSignature(garden: Group) {
  return JSON.stringify([garden.name, garden.environment, garden.location || null, garden.locationLabel || '', garden.sensorProfileId || null]);
}
