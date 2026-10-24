import { useCallback, useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Plant } from '@/firestoreModels';
import { useSession } from '@/services/session';
import { plantsStore } from '@/services/gardenData';
import { createLiveStore } from '@/lib/data/liveStore';
const documents = createLiveStore<Plant | null>(null, key => (next, fail) => {
  const [uid, id] = JSON.parse(key);
  return onSnapshot(doc(db, 'plants', id), snapshot => next(snapshot.exists() && snapshot.data().owners?.includes(uid) ? snapshot.data() as Plant : null), () => { next(null); fail(); });
}, 'This plant could not be loaded. Check your connection and retry.');
const missing = { data: null, loading: false, error: '' };
export function usePlant(id?: string) {
  const { user, loading: accountLoading } = useSession(); const uid = user?.uid;
  const key = uid && id ? JSON.stringify([uid, id]) : '';
  const subscribe = useCallback((notify: () => void) => key ? documents.subscribe(key, notify) : () => {}, [key]);
  const get = useCallback(() => key ? documents.get(key) : accountLoading ? documents.initial : missing, [key, accountLoading]);
  const snapshot = useSyncExternalStore(subscribe, get, () => documents.initial);
  const cached = uid && snapshot.loading ? plantsStore.get(uid).data.find(plant => plant.id === id) : undefined;
  const plant = snapshot.data || cached || null;
  const refresh = useCallback(() => { if (key) documents.refresh(key); }, [key]);
  return { plant, loading: snapshot.loading && !plant, error: snapshot.error, refresh };
}
