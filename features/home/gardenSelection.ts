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

/** Count direct and legacy memberships without scanning the collection per garden. */
export function summarizeGardenCollection(plants: (Plant & { id: string })[], gardens: HomeGarden[]) {
  const byId = new Map(plants.map(plant => [plant.id, plant]));
  const assignedCounts = new Map<string, number>();
  for (const plant of plants) {
    if (plant.groupId && plant.status === 'active') assignedCounts.set(plant.groupId, (assignedCounts.get(plant.groupId) || 0) + 1);
  }
  const legacyIds = new Set<string>();
  const counts = Object.fromEntries(gardens.map(garden => {
    let count = assignedCounts.get(garden.id) || 0;
    for (const id of new Set(garden.plantIds)) {
      legacyIds.add(id);
      const plant = byId.get(id);
      if (plant && !plant.groupId && plant.status === 'active') count++;
    }
    return [garden.id, count];
  }));
  const unassigned = plants.filter(plant => !plant.groupId && !legacyIds.has(plant.id)).length;
  return { counts, unassigned };
}
