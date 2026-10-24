import { requireUserId } from '@/services/session';
import { useCallback, useState } from 'react';
import { waterAllPlantsInGroup, type GroupWithId } from '@/features/groups/api/groupApi';
import { usePlantList } from '@/features/plants/hooks/usePlantList';
import { useOwnedGroups } from '@/hooks/useGardenData';
export function useGroupList() {
  const spaces = useOwnedGroups(); const garden = usePlantList();
  const refreshSpaces = spaces.refresh; const refreshGarden = garden.refresh;
  const [editGroup, setEditGroup] = useState<GroupWithId | null>(null);
  const reloadGroups = useCallback(async () => { refreshSpaces(); refreshGarden(); }, [refreshSpaces, refreshGarden]);
  const handleWaterAll = async (id: string) => { await waterAllPlantsInGroup(id, requireUserId()); return true; };
  return { groups: spaces.groups, loading: spaces.loading || garden.loading, error: spaces.error || garden.error, editGroup, setEditGroup,
    reloadGroups, handleWaterAll, allPlants: garden.plants, fetchAllPlants: async () => garden.refresh() };
}
