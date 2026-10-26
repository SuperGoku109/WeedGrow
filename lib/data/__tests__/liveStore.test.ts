import { createLiveStore } from '../liveStore';
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
function setup() {
  const subscriptions: { key: string; next(value: string[]): void; fail(): void; stop: jest.Mock }[] = [];
  const store = createLiveStore<string[]>([], key => (next, fail) => { const stop = jest.fn(); subscriptions.push({ key, next, fail, stop }); return stop; }, 'Could not load', 100);
  return { store, subscriptions };
}
it('shares one stream between consumers and reuses it across short navigation gaps', () => {
  const { store, subscriptions } = setup();
  const first = store.subscribe('owner', jest.fn()); const second = store.subscribe('owner', jest.fn());
  expect(subscriptions).toHaveLength(1); expect(store.stats()).toEqual({ streams: 1, consumers: 2 });
  subscriptions[0].next(['plant']); first(); second();
  jest.advanceTimersByTime(50); const third = store.subscribe('owner', jest.fn());
  expect(subscriptions).toHaveLength(1); expect(store.get('owner').data).toEqual(['plant']);
  third(); jest.advanceTimersByTime(100);
  expect(subscriptions[0].stop).toHaveBeenCalledTimes(1); expect(store.stats().streams).toBe(0);
});
it('clears private data on account change and ignores late callbacks', () => {
  const { store, subscriptions } = setup();
  const leave = store.subscribe('owner-a', jest.fn()); subscriptions[0].next(['private-a']);
  store.clear(); subscriptions[0].next(['late-private-a']);
  const leaveB = store.subscribe('owner-b', jest.fn()); subscriptions[1].next(['private-b']);
  expect(store.get('owner-a').data).toEqual([]); expect(store.get('owner-b').data).toEqual(['private-b']);
  leave(); leaveB(); store.clear();
});
it('coalesces refreshes and only reconnects failed streams after ordinary writes', () => {
  const { store, subscriptions } = setup(); const leave = store.subscribe('owner', jest.fn());
  store.refresh('owner'); expect(subscriptions).toHaveLength(1);
  subscriptions[0].next(['plant']); store.retryFailed(); expect(subscriptions).toHaveLength(1);
  subscriptions[0].fail(); store.retryFailed(); expect(subscriptions).toHaveLength(2);
  subscriptions[0].next(['stale']); subscriptions[1].next(['fresh']);
  expect(store.get('owner').data).toEqual(['fresh']); leave(); store.clear();
});
it('turns a synchronous connection failure into a retryable error', () => {
  let attempts = 0;
  const store = createLiveStore<string[]>([], () => next => {
    if (++attempts === 1) throw new Error('Cannot start reader');
    next(['recovered']); return jest.fn();
  }, 'Could not load');
  const leave = store.subscribe('owner', jest.fn());
  expect(store.get('owner')).toEqual({ status: 'error', data: [], loading: false, error: 'Could not load' });
  store.retryFailed();
  expect(store.get('owner').data).toEqual(['recovered']);
  leave(); store.clear();
});
it('distinguishes an initial load from refresh while keeping an empty successful result', () => {
  const { store, subscriptions } = setup();
  expect(store.idle.status).toBe('idle');
  const leave = store.subscribe('owner', jest.fn());
  expect(store.get('owner').status).toBe('loading');
  subscriptions[0].next([]); expect(store.get('owner').status).toBe('ready');
  store.refresh('owner'); expect(store.get('owner').status).toBe('refreshing');
  subscriptions[1].fail(); expect(store.get('owner').status).toBe('error');
  leave(); store.clear();
});
