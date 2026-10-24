import { useCallback, useSyncExternalStore } from 'react';
import { useSession } from '@/services/session';
import { groupsStore, plantsStore } from '@/services/gardenData';
const signedOutGroups = { data: [], loading: false, error: '' };
export function useOwnedGroups() {
  const { user, loading } = useSession(); const uid = user?.uid;
  const subscribe = useCallback((notify: () => void) => uid ? groupsStore.subscribe(uid, notify) : () => {}, [uid]);
  const get = useCallback(() => uid ? groupsStore.get(uid) : loading ? groupsStore.initial : signedOutGroups, [uid, loading]);
  const snapshot = useSyncExternalStore(subscribe, get, () => groupsStore.initial);
  const refresh = useCallback(() => { if (uid) groupsStore.refresh(uid); }, [uid]);
  return { groups: snapshot.data, loading: snapshot.loading, error: snapshot.error, refresh };
}

const signedOutPlants = { data: [], loading: false, error: '' };
export function useOwnedPlants() {
  const { user, loading: accountLoading } = useSession(); const uid = user?.uid;
  const subscribe = useCallback((notify: () => void) => uid ? plantsStore.subscribe(uid, notify) : () => {}, [uid]);
  const get = useCallback(() => uid ? plantsStore.get(uid) : accountLoading ? plantsStore.initial : signedOutPlants, [uid, accountLoading]);
  const snapshot = useSyncExternalStore(subscribe, get, () => plantsStore.initial);
  const refresh = useCallback(() => { if (uid) plantsStore.refresh(uid); }, [uid]);
  return { ownerId: uid, plants: snapshot.data, loading: snapshot.loading, error: snapshot.error || null, refresh, isDataReady: !snapshot.loading && snapshot.data.length > 0 };
}
