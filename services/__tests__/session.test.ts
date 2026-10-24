import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../authClient';
import { useSession } from '../session';
import { createLiveStore } from '@/lib/data/liveStore';
jest.mock('../authClient', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));
it('shares one auth observer and clears private cached data on sign-out', () => {
  let publish!: (user: any) => void; const stop = jest.fn();
  jest.mocked(onAuthStateChanged).mockImplementation((_auth: any, next: any) => { publish = next; return stop; });
  const sessions: Record<string, ReturnType<typeof useSession>> = {};
  function Probe({ id }: { id: string }) { sessions[id] = useSession(); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(React.Fragment, null, React.createElement(Probe, { id: 'a' }), React.createElement(Probe, { id: 'b' }))); });
  expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  const user = { uid: 'owner' }; act(() => { (auth as any).currentUser = user; publish(user); });
  expect(sessions.a.user?.uid).toBe('owner'); expect(sessions.b.user?.uid).toBe('owner');
  const privateData = createLiveStore<string[]>([], () => next => { next(['private']); return () => {}; }, 'Error');
  const leave = privateData.subscribe('owner', jest.fn()); expect(privateData.get('owner').data).toEqual(['private']);
  act(() => { (auth as any).currentUser = null; publish(null); });
  expect(sessions.a.user).toBeNull(); expect(privateData.get('owner').data).toEqual([]);
  act(() => renderer.unmount()); expect(stop).toHaveBeenCalledTimes(1); leave(); privateData.clear();
});
