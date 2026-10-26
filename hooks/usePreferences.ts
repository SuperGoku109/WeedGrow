import { useEffect } from 'react';
import { defaults, readPreferences, subscribePreferences } from '@/services/preferences';
import { useAsyncResource } from './useAsyncResource';
export function usePreferences(uid?: string) {
  const resource = useAsyncResource(uid || 'device', () => readPreferences(uid), defaults, 'Device preferences could not be loaded. Retry.');
  const refresh = resource.refresh;
  useEffect(() => subscribePreferences(refresh), [refresh]);
  return { preferences: resource.data, status: resource.status, error: resource.error, refresh };
}
