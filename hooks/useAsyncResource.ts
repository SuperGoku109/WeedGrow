import { useCallback, useEffect, useRef, useState } from 'react';
export type ResourceState<T> = { status: 'idle' | 'loading' | 'refreshing' | 'ready' | 'error'; data: T; error: string };
export function useAsyncResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, initial: T, errorMessage = 'This data could not be loaded. Retry.') {
  const loader = useRef(load); loader.current = load;
  const currentKey = useRef(key); currentKey.current = key;
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState<ResourceState<T> & { key: string | null }>({ key: null, status: 'idle', data: initial, error: '' });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController(); const read = loader.current;
    setSaved(previous => ({ key, status: previous.key === key && previous.status !== 'idle' && previous.status !== 'loading' ? 'refreshing' : 'loading', data: previous.key === key ? previous.data : initial, error: '' }));
    void Promise.resolve().then(() => controller.signal.aborted ? initial : read(controller.signal)).then(data => { if (!controller.signal.aborted && currentKey.current === key) setSaved({ key, status: 'ready', data, error: '' }); }).catch(failure => {
      if (!controller.signal.aborted && currentKey.current === key) setSaved(previous => ({ key, status: 'error', data: previous.key === key ? previous.data : initial, error: failure instanceof Error && failure.name === 'RecordDecodeError' ? failure.message : errorMessage }));
    });
    return () => controller.abort();
    // The explicit key describes request inputs. Loader/initial are captured for
    // this request; changing an inline function must not cause another read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const state: ResourceState<T> = !key ? { status: 'idle', data: initial, error: '' } : saved.key === key ? saved : { status: 'loading', data: initial, error: '' };
  return { ...state, loading: state.status === 'loading' || state.status === 'refreshing', refresh };
}
