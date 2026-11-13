import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { usePlantHistory } from '../hooks/usePlantHistory';
import { fetchPlantHistoryPage } from '@/services/plantHistory';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/services/plantHistory', () => ({ fetchPlantHistoryPage: jest.fn() }));
let current!: ReturnType<typeof usePlantHistory>;
let renderer: any;
function Probe({ id = 'p' }: { id?: string }) { current = usePlantHistory(id); return null; }
const page = (ids: string[], more = false) => ({ entries: ids.map(id => ({ id })) as never, cursor: { id: ids.at(-1) } as never, hasMore: more });
afterEach(() => { act(() => renderer?.unmount()); jest.resetAllMocks(); });
it('loads older events on demand, prevents duplicate requests and deduplicates overlapping pages', async () => {
  jest.mocked(fetchPlantHistoryPage).mockResolvedValueOnce(page(['one', 'two'], true)).mockResolvedValueOnce(page(['two', 'three']));
  await act(async () => { renderer = create(React.createElement(Probe)); });
  expect(fetchPlantHistoryPage).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.all([current.loadMore(), current.loadMore()]); });
  expect(fetchPlantHistoryPage).toHaveBeenCalledTimes(2);
  expect(current.entries.map(item => item.id)).toEqual(['one', 'two', 'three']);
  expect(current.hasMore).toBe(false);
});
it('ignores slow results from another plant', async () => {
  let finish!: (value: any) => void;
  jest.mocked(fetchPlantHistoryPage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(page(['new']));
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => renderer.update(React.createElement(Probe, { id: 'other' })));
  await act(async () => finish(page(['old'])));
  expect(current.entries.map(item => item.id)).toEqual(['new']);
});
it('keeps loaded history after a page fails and retries the same cursor', async () => {
  jest.mocked(fetchPlantHistoryPage).mockResolvedValueOnce(page(['one'], true)).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page(['two']));
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => current.loadMore());
  expect(current.error).toContain('Older events');
  expect(current.entries.map(item => item.id)).toEqual(['one']);
  await act(async () => current.loadMore());
  expect(current.entries.map(item => item.id)).toEqual(['one', 'two']);
  expect(current.error).toBe('');
});
