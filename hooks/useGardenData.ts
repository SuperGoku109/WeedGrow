import { useSession } from '@/services/session';
import { groupsStore, plantsStore } from '@/services/gardenData';
import { useLiveResource } from './useLiveResource';
export function useOwnedGroups() {
  const { user, loading } = useSession();
  const snapshot = useLiveResource(groupsStore, user?.uid || null, loading);
  return { groups: snapshot.data, status: snapshot.status, loading: snapshot.loading, error: snapshot.error, refresh: snapshot.refresh };
}
export function useOwnedPlants() {
  const { user, loading } = useSession();
  const snapshot = useLiveResource(plantsStore, user?.uid || null, loading);
  return { ownerId: user?.uid, plants: snapshot.data, status: snapshot.status, loading: snapshot.loading, error: snapshot.error || null, refresh: snapshot.refresh, isDataReady: snapshot.status === 'ready' && snapshot.data.length > 0 };
}
