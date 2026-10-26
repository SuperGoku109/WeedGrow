import { useCallback, useSyncExternalStore } from 'react';
import type { createLiveStore } from '@/lib/data/liveStore';
/** A single React adapter for the canonical idle/loading/refreshing/ready/error
 * state. A changed key selects its own snapshot before effects run. */
export function useLiveResource<T>(store: ReturnType<typeof createLiveStore<T>>, key: string | null, pending = false) {
  const subscribe = useCallback((notify: () => void) => key ? store.subscribe(key, notify) : () => {}, [store, key]);
  const get = useCallback(() => key ? store.get(key) : pending ? store.initial : store.idle, [store, key, pending]);
  const state = useSyncExternalStore(subscribe, get, () => store.initial);
  const refresh = useCallback(() => { if (key) store.refresh(key); }, [store, key]);
  return { ...state, refresh };
}
