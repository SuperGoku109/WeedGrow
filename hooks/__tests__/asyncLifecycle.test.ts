import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { useAsyncResource } from '../useAsyncResource';
import { useAsyncTask } from '../useAsyncTask';
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
it('does not show a prior key and ignores its late result, retaining ready data during retry', async () => {
  const a = deferred<string>(); const b = deferred<string>(); const retry = deferred<string>(); let reads = 0;
  let resource!: ReturnType<typeof useAsyncResource<string>>;
  function Probe({ owner }: { owner: string }) { resource = useAsyncResource(owner, () => owner === 'a' ? a.promise : ++reads === 1 ? b.promise : retry.promise, 'empty'); return null; }
  let renderer: any; await act(async () => { renderer = create(React.createElement(Probe, { owner: 'a' })); });
  await act(async () => renderer.update(React.createElement(Probe, { owner: 'b' })));
  await act(async () => a.resolve('private a')); expect(resource.data).toBe('empty');
  await act(async () => b.resolve('private b')); expect(resource.data).toBe('private b');
  await act(async () => resource.refresh()); expect(resource.status).toBe('refreshing'); expect(resource.data).toBe('private b');
  await act(async () => retry.reject(new Error('Disconnected'))); expect(resource.status).toBe('error'); expect(resource.data).toBe('private b');
  act(() => renderer.unmount());
});
it('locks duplicate tasks synchronously and suppresses publication after a scope change', async () => {
  let task!: ReturnType<typeof useAsyncTask>; const waiting = deferred<string>(); const publish = jest.fn(); const job = jest.fn(async context => { const value = await waiting.promise; context.publish(publish); return value; });
  function Probe({ owner }: { owner: string }) { task = useAsyncTask(owner); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe, { owner: 'a' })); });
  let outcome!: ReturnType<typeof task.run<string>>; act(() => { outcome = task.run(job); void task.run(job); }); expect(job).toHaveBeenCalledTimes(1);
  act(() => renderer.update(React.createElement(Probe, { owner: 'b' })));
  await act(async () => waiting.resolve('old task')); expect((await outcome).ok).toBe(false); expect(publish).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
