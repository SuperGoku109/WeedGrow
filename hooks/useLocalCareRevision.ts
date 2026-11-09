import { useSyncExternalStore } from 'react';
import { subscribeLocalCareSettings, localCareSettingsRevision } from '@/services/localCareSettings';
export function useLocalCareRevision() {
  return useSyncExternalStore(subscribeLocalCareSettings, localCareSettingsRevision, localCareSettingsRevision);
}
