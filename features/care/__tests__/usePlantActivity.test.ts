import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { onSnapshot } from 'firebase/firestore';
import { activityStore, usePlantActivity } from '../usePlantActivity';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn() }));
it('shares the watering stream between cards and checklist consumers', () => {
  jest.useFakeTimers(); const callbacks: ((value: any) => void)[] = []; const stop = jest.fn();
  jest.mocked(onSnapshot).mockImplementation((_q: any, next: any) => { callbacks.push(next); return stop; });
  let cards!: ReturnType<typeof usePlantActivity>; let checklist!: typeof cards;
  function Cards() { cards = usePlantActivity(['p'], ['watering']); return null; }
  function Checklist() { checklist = usePlantActivity(['p'], ['watering', 'fertilizing']); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(React.Fragment, null, React.createElement(Cards), React.createElement(Checklist))); });
  expect(onSnapshot).toHaveBeenCalledTimes(2); // Three consumers' queries need only two distinct streams.
  act(() => callbacks[0]({ docs: [{ id: 'water', data: () => ({ type: 'watering' }) }] }));
  expect(cards.logs['p:watering']).toBe(checklist.logs['p:watering']);
  act(() => renderer.unmount()); act(() => jest.advanceTimersByTime(1500));
  expect(stop).toHaveBeenCalledTimes(2); activityStore.clear(); jest.useRealTimers();
});
