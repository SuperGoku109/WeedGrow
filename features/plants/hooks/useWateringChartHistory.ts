import { useCallback } from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useSession } from '@/services/session';
import { journalDaysStore } from '@/services/plantJournalData';
/** Reuse the account-scoped journal listener; do not fetch weather for a chart. */
export function useWateringChartHistory(id: string, first: string, last: string, zone?: string | null) {
  const { user, loading } = useSession();
  const key = user && id ? JSON.stringify([user.uid, id, first, last, zone || 'UTC']) : '';
  const result = useLiveResource(journalDaysStore, key || null, loading);
  const retry = useCallback(() => { if (key) journalDaysStore.refresh(key); }, [key]);
  return { logs: Object.values(result.data).flat(), loading: result.loading, error: result.error, retry };
}
