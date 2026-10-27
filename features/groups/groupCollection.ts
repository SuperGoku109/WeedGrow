import type { Group, Plant } from '@/firestoreModels';

export type CollectionGroup = Group & { id: string };
export type CollectionPlant = Plant & { id: string };
export type GroupSort = 'name' | 'newest' | 'size';
export type GroupEnvironment = Group['environment'] | 'all';

export function selectGroups(groups: CollectionGroup[], plants: Record<string, CollectionPlant[]>, query: string, environment: GroupEnvironment, sort: GroupSort) {
  const term = query.trim().toLocaleLowerCase();
  return groups.filter(group =>
    (environment === 'all' || group.environment === environment) &&
    (!term || group.name.toLocaleLowerCase().includes(term) || (plants[group.id] || []).some(plant =>
      plant.name?.toLocaleLowerCase().includes(term)
    ))
  ).sort((a, b) => {
    if (sort === 'size') {
      const difference = (plants[b.id]?.length || 0) - (plants[a.id]?.length || 0);
      if (difference) return difference;
    }
    if (sort === 'newest') {
      const difference = (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

export function groupEditValues(group: CollectionGroup) {
  const name = group.name.trim();
  if (!name) throw new Error('Give your garden a name before saving.');
  const plantIds = [...new Set(group.plantIds)];
  return {
    name,
    location: group.location || null,
    locationLabel: group.locationLabel || '',
    plantIds,
    // Empty string clears a removed source without sending undefined to Firestore.
    weatherSourcePlantId: group.weatherSourcePlantId && plantIds.includes(group.weatherSourcePlantId) ? group.weatherSourcePlantId : '',
  };
}
