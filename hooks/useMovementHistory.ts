import { useLiveResource } from './useLiveResource';
import { useSession } from '@/services/session';
import { movementStore } from '@/services/plantJournalData';
export function useMovementHistory(id: string) {
  const { user, loading } = useSession();
  return useLiveResource(movementStore, user && id ? JSON.stringify([user.uid, id]) : null, loading);
}
