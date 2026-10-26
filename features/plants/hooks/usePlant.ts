import { useLiveResource } from '@/hooks/useLiveResource';
import { useSession } from '@/services/session';
import { plantsStore } from '@/services/gardenData';
import { plantDocuments } from '@/services/plantDocuments';
export function usePlant(id?: string) {
  const { user, loading: accountLoading } = useSession(); const uid = user?.uid;
  const snapshot = useLiveResource(plantDocuments, uid && id ? JSON.stringify([uid, id]) : null, accountLoading);
  const cached = uid && snapshot.loading ? plantsStore.get(uid).data.find(plant => plant.id === id) : undefined;
  const plant = snapshot.data || cached || null;
  const status = plant && snapshot.loading ? 'refreshing' : snapshot.status === 'ready' && !plant ? 'missing' : snapshot.status;
  return { plant, status, loading: snapshot.loading && !plant, error: snapshot.error, refresh: snapshot.refresh };
}
