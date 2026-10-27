import { useLiveResource } from './useLiveResource';
import { useSession } from '@/services/session';
import { movementStore } from '@/services/plantJournalData';
export function useMovementHistory(id: string, enabled = true) {
  const { user, loading } = useSession();
  return useLiveResource(movementStore, user && id && enabled ? JSON.stringify([user.uid, id]) : null, enabled && loading);
}
