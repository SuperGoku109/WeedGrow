import type { Plant } from '@/firestoreModels';
import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { onSnapshot } from 'firebase/firestore';
import { activityStore, usePlantActivity } from '../usePlantActivity';
jest.mock('@/services/careSummaries', () => ({ ensureCareSummary: jest.fn().mockResolvedValue(undefined) }));
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

it('uses revision-matched summaries without opening per-plant listeners and falls back after invalidation', () => {
  jest.useFakeTimers(); jest.mocked(onSnapshot).mockClear();
  jest.mocked(onSnapshot).mockImplementation(() => jest.fn());
  let activity!: ReturnType<typeof usePlantActivity>;
  function Probe({ plant }: { plant: Pick<Plant, 'careSummary' | 'careRevision'> & { id: string } }) { activity = usePlantActivity(['p'], ['watering', 'fertilizing'], [plant]); return null; }
  const plant = { id: 'p', careRevision: 2, careSummary: { version: 1 as const, revision: 2, watering: null, fertilizing: null } };
  let renderer: any; act(() => { renderer = create(React.createElement(Probe, { plant })); });
  expect(onSnapshot).not.toHaveBeenCalled(); expect(activity.loading).toBe(false); expect(activity.logs['p:watering']).toEqual([]);
  act(() => renderer.update(React.createElement(Probe, { plant: { ...plant, careRevision: 3, careSummary: null } })));
  expect(onSnapshot).toHaveBeenCalledTimes(2); expect(activity.loading).toBe(true);
  act(() => renderer.unmount()); act(() => jest.advanceTimersByTime(1500)); activityStore.clear(); jest.useRealTimers();
});
