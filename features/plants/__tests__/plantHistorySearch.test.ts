import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { usePlantHistorySearch } from '../hooks/usePlantHistorySearch';
import { fetchJournalPage } from '@/lib/logs/journalQueries';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/lib/logs/journalQueries', () => ({ fetchJournalPage: jest.fn() }));
let current!: ReturnType<typeof usePlantHistorySearch>;
let renderer: any;
function Probe({ plantId = 'p' }: { plantId?: string }) { current = usePlantHistorySearch(plantId, '2026-10-01', '2026-10-27', 'Asia/Tokyo'); return null; }
afterEach(() => act(() => renderer?.unmount()));
it('automatically searches every page in the selected plant-local range', async () => {
  jest.mocked(fetchJournalPage).mockResolvedValueOnce({ entries: [{ id: 'one' }] as never, hasMore: true, cursor: { id: 'cursor' } as never }).mockResolvedValueOnce({ entries: [{ id: 'two' }] as never, hasMore: false, cursor: undefined });
  await act(async () => { renderer = create(React.createElement(Probe)); });
  expect(current.busy).toBe(false); expect(current.error).toBe(''); expect(current.entries.map(entry => entry.id)).toEqual(['one', 'two']);
  expect(fetchJournalPage).toHaveBeenLastCalledWith('p', '2026-10-01', '2026-10-27', 50, { id: 'cursor' }, 'Asia/Tokyo');
});
it('does not publish a slow result from a previously selected plant', async () => {
  let finish!: (value: any) => void;
  jest.mocked(fetchJournalPage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ entries: [{ id: 'new' }] as never, hasMore: false, cursor: undefined });
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => renderer.update(React.createElement(Probe, { plantId: 'other' })));
  await act(async () => finish({ entries: [{ id: 'old' }], hasMore: false }));
  expect(current.entries.map(entry => entry.id)).toEqual(['new']);
});
it('labels failed later pages as incomplete and retries the full range', async () => {
  jest.mocked(fetchJournalPage).mockResolvedValueOnce({ entries: [{ id: 'one' }] as never, hasMore: true, cursor: { id: 'cursor' } as never }).mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { renderer = create(React.createElement(Probe)); });
  expect(current.busy).toBe(false); expect(current.error).toBe('Offline');
  jest.mocked(fetchJournalPage).mockResolvedValueOnce({ entries: [{ id: 'complete' }] as never, hasMore: false, cursor: undefined });
  await act(async () => current.retry());
  expect(current.error).toBe(''); expect(current.entries.map(entry => entry.id)).toEqual(['complete']);
});
