import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { usePlantJournalData } from '../hooks/usePlantJournalData';
import { journalDaysStore, journalWeatherStore } from '@/services/plantJournalData';
let mockUid = 'owner-a';
const mockReaders: { next: (snapshot: any) => void; fail: () => void; stop: jest.Mock }[] = [];
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: mockUid } }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), where: jest.fn(), documentId: () => '__name__', Timestamp: { fromDate: (value: Date) => value },
  onSnapshot: jest.fn((_query, next, fail) => { const stop = jest.fn(); mockReaders.push({ next, fail, stop }); return stop; }),
}));
const snapshot = (id: string) => ({ docs: [{ id, data: () => ({ type: 'note', calendarDay: '2026-10-24', timestamp: { toDate: () => new Date('2026-10-24T12:00:00Z'), toMillis: () => 1 } }) }] });
beforeEach(() => { jest.useFakeTimers(); mockUid = 'owner-a'; mockReaders.length = 0; });
afterEach(() => { journalDaysStore.clear(); journalWeatherStore.clear(); jest.clearAllTimers(); jest.useRealTimers(); });
it('shares readers, keeps loaded history during retry and reconnects only the failed reader', () => {
  let current!: ReturnType<typeof usePlantJournalData>;
  function Probe() { current = usePlantJournalData('p', '2026-10-24', '2026-10-24'); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(Probe))); });
  expect(mockReaders).toHaveLength(2);
  act(() => { mockReaders[0].next(snapshot('note')); mockReaders[1].next({ docs: [] }); });
  expect(current.logs['2026-10-24'][0].id).toBe('note');
  act(() => mockReaders[0].fail()); expect(current.error).toBeTruthy();
  act(() => current.retry());
  expect(mockReaders).toHaveLength(3); expect(current.logs['2026-10-24']).toHaveLength(1);
  expect(mockReaders[1].stop).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
it('never paints the previous range or account data under a new key', () => {
  let current!: ReturnType<typeof usePlantJournalData>;
  function Probe({ day }: { day: string }) { current = usePlantJournalData('p', day, day); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe, { day: '2026-10-24' })); });
  act(() => mockReaders[0].next(snapshot('private-note')));
  act(() => renderer.update(React.createElement(Probe, { day: '2026-10-23' })));
  expect(current.logs).toEqual({}); expect(current.loading).toBe(true);
  mockUid = 'owner-b';
  act(() => renderer.update(React.createElement(Probe, { day: '2026-10-24' })));
  expect(current.logs).toEqual({});
  act(() => mockReaders[0].next(snapshot('late-old-note')));
  expect(current.logs).toEqual({});
  act(() => renderer.unmount());
});
