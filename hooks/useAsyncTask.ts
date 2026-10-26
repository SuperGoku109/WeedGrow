import { useCallback, useEffect, useRef, useState } from 'react';
export interface TaskContext { signal: AbortSignal; isCurrent(): boolean; publish(update: () => void): void }
export type TaskResult<T> = { ok: true; value: T } | { ok: false; cancelled: boolean; error: string };
export function useAsyncTask(scope: string) {
  const currentScope = useRef(scope); currentScope.current = scope;
  const active = useRef<{ scope: string; controller: AbortController } | null>(null);
  const [saved, setSaved] = useState<{ scope: string; status: 'idle' | 'running' | 'success' | 'error'; error: string }>({ scope, status: 'idle', error: '' });
  useEffect(() => () => { if (active.current?.scope === scope) active.current.controller.abort(); }, [scope]);
  const run = useCallback(async <T,>(job: (context: TaskContext) => Promise<T>): Promise<TaskResult<T>> => {
    if (active.current?.scope === scope && !active.current.controller.signal.aborted) return { ok: false, cancelled: true, error: '' };
    active.current?.controller.abort();
    const request = { scope, controller: new AbortController() }; active.current = request;
    const isCurrent = () => currentScope.current === scope && active.current === request && !request.controller.signal.aborted;
    const context: TaskContext = { signal: request.controller.signal, isCurrent, publish: update => { if (isCurrent()) update(); } };
    setSaved({ scope, status: 'running', error: '' });
    try { const value = await job(context); if (!isCurrent()) return { ok: false, cancelled: true, error: '' }; setSaved({ scope, status: 'success', error: '' }); return { ok: true, value }; }
    catch (failure) { if (!isCurrent()) return { ok: false, cancelled: true, error: '' }; const error = failure instanceof Error ? failure.message : 'This action could not be completed. Retry.'; setSaved({ scope, status: 'error', error }); return { ok: false, cancelled: false, error }; }
    finally { if (active.current === request) active.current = null; }
  }, [scope]);
  const cancel = useCallback(() => { active.current?.controller.abort(); active.current = null; setSaved({ scope, status: 'idle', error: '' }); }, [scope]);
  return { status: saved.scope === scope ? saved.status : 'idle' as const, error: saved.scope === scope ? saved.error : '', run, cancel };
}
