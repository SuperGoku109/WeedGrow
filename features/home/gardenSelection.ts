import type { Group, Plant } from '@/firestoreModels';

export type HomeGarden = Group & { id: string };
export type GardenSelection = { kind: 'garden'; id: string } | { kind: 'all' };

export function decodeGardenSelection(raw: string | null): GardenSelection | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (value?.kind === 'all') return { kind: 'all' };
    if (value?.kind === 'garden' && typeof value.id === 'string' && value.id && !value.id.includes('/')) return { kind: 'garden', id: value.id };
  } catch { /* A corrupt preference must never hide the plant collection. */ }
  return null;
}

export function resolveGardenSelection(selection: GardenSelection | null, gardens: HomeGarden[]): GardenSelection {
  if (selection?.kind === 'all' || (selection?.kind === 'garden' && gardens.some(garden => garden.id === selection.id))) return selection;
  return gardens[0] ? { kind: 'garden', id: gardens[0].id } : { kind: 'all' };
}

export function plantsInGarden<T extends Plant & { id: string }>(plants: T[], garden: HomeGarden | null): T[] {
  // Retain legacy array-only members, without showing plants assigned elsewhere.
  if (!garden) return plants;
  const legacyIds = new Set(garden.plantIds);
  return plants.filter(plant => plant.groupId === garden.id || (!plant.groupId && legacyIds.has(plant.id)));
}
