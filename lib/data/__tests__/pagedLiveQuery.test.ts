import { listenPagedQuery } from '../pagedLiveQuery';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
const mockReaders: { next(snapshot: unknown): void; stop: jest.Mock }[] = [];
jest.mock('firebase/firestore', () => ({ documentId: () => '__name__', query: (...args: unknown[]) => args, orderBy: jest.fn(), limit: jest.fn(), startAfter: jest.fn(), onSnapshot: (_q: unknown, _options: unknown, next: (snapshot: unknown) => void) => { const stop = jest.fn(); mockReaders.push({ next, stop }); return stop; } }));
const snapshot = (...ids: string[]) => ({ docs: ids.map(id => ({ id })), metadata: { fromCache: false } });
beforeEach(() => { mockReaders.length = 0; });
it('publishes complete pages and rebuilds shifted boundaries without accepting obsolete results', () => {
  const next = jest.fn(); const fail = jest.fn(); const stop = listenPagedQuery({} as never, item => item.id, next, fail, 2, 8);
  mockReaders[0].next(snapshot('a', 'b')); expect(next).not.toHaveBeenCalled();
  mockReaders[1].next(snapshot('c')); expect(next).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  mockReaders[0].next(snapshot('a', 'aa')); expect(mockReaders[1].stop).toHaveBeenCalled();
  mockReaders[1].next(snapshot('obsolete')); expect(next).toHaveBeenLastCalledWith(['a', 'b', 'c']);
  mockReaders[2].next(snapshot('b', 'c')); mockReaders[3].next(snapshot());
  expect(next).toHaveBeenLastCalledWith(['a', 'aa', 'b', 'c']);
  const count = mockReaders.length; mockReaders[0].next(snapshot('a', 'aa')); expect(mockReaders).toHaveLength(count);
  stop(); expect(fail).not.toHaveBeenCalled();
});
it('never publishes a silently truncated garden at the safety bound', () => {
  const next = jest.fn(); const fail = jest.fn(); const stop = listenPagedQuery({} as never, (item: QueryDocumentSnapshot) => item.id, next, fail, 2, 3);
  mockReaders[0].next(snapshot('a', 'b')); mockReaders[1].next(snapshot('c', 'd'));
  expect(next).not.toHaveBeenCalled(); expect(fail.mock.calls[0][0].name).toBe('DataLimitError'); stop();
});
it('does not mistake a cached detail record for the complete garden and can recover after offline feedback', () => {
  jest.useFakeTimers();
  const next = jest.fn(); const fail = jest.fn(); const stop = listenPagedQuery({} as never, item => item.id, next, fail);
  mockReaders[0].next({ ...snapshot('detail-only'), metadata: { fromCache: true } });
  expect(next).not.toHaveBeenCalled();
  jest.advanceTimersByTime(15000); expect(fail).toHaveBeenCalledTimes(1);
  mockReaders[0].next(snapshot('a', 'b', 'c', 'detail-only'));
  expect(next).toHaveBeenLastCalledWith(['a', 'b', 'c', 'detail-only']);
  stop(); jest.useRealTimers();
});
