import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { useJournalSearch } from '../useJournalSearch';
import { fetchJournalPage } from '@/lib/logs/journalQueries';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/lib/logs/journalQueries', () => ({ fetchJournalPage: jest.fn() }));
let current!: ReturnType<typeof useJournalSearch>;
let renderer: any;
function Probe({ end = '2026-10-27' }: { end?: string }) {
  current = useJournalSearch([{ id: 'plant', name: 'Plant' }], '', end, 25, true, '2026-10-27');
  return null;
}
afterEach(() => act(() => renderer?.unmount()));
it('validates against the plant day instead of the device day and rejects a future range', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T12:00:00Z'));
  try {
    jest.mocked(fetchJournalPage).mockResolvedValue({ entries: [], hasMore: false, cursor: undefined });
    act(() => { renderer = create(React.createElement(Probe)); });
    await act(async () => { await current.search(); });
    expect(fetchJournalPage).toHaveBeenCalledWith('plant', '', '2026-10-27', 25, undefined);
    expect(current.error).toBe('');
    act(() => renderer.update(React.createElement(Probe, { end: '2026-10-28' })));
    await act(async () => { await current.search(); });
    expect(current.error).toContain('Choose valid past dates');
    expect(fetchJournalPage).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
