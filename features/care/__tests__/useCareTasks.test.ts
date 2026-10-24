import React from 'react';
// @ts-expect-error The renderer ships with Jest Expo without TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { onSnapshot } from 'firebase/firestore';
import { useCareTasks } from '../useCareTasks';

const mockRefresh = jest.fn();
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/features/plants/hooks/usePlantList', () => ({ usePlantList: () => ({ plants: [{ id: 'p', name: 'Plant', status: 'active', wateringFrequency: 'Every day' }], loading: false, error: null, refresh: mockRefresh }) }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn() }));

it('reconnects failed history subscriptions when the checklist is refreshed', () => {
  const callbacks: { success: (snapshot: unknown) => void; fail: () => void }[] = [];
  const stop = jest.fn();
  jest.mocked(onSnapshot).mockImplementation((...args: any[]) => { callbacks.push({ success: args[1], fail: args[2] }); return stop; });
  let current!: ReturnType<typeof useCareTasks>;
  function Probe() { current = useCareTasks(); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => { callbacks[0].fail(); callbacks[1].success({ docs: [] }); });
  expect(current.error).toContain('care history');
  act(() => current.refresh());
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalledTimes(2);
  expect(callbacks).toHaveLength(4);
  act(() => { callbacks[0].fail(); callbacks[2].success({ docs: [] }); callbacks[3].success({ docs: [] }); });
  expect(current.error).toBe('');
  expect(current.loading).toBe(false);
  expect(current.tasks).toHaveLength(1);
  act(() => renderer.unmount());
});
