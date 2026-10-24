import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { getDocs } from 'firebase/firestore';
import { useProgressGallery } from '../hooks/useProgressGallery';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), startAfter: jest.fn(), getDocs: jest.fn() }));
it('does no photo reads until Photos opens and retains recent pages when switching tabs', async () => {
  jest.mocked(getDocs).mockResolvedValue({ size: 1, docs: [{ id: 'photo', data: () => ({ imageUrl: 'https://example.test/image.jpg' }) }] } as never);
  let gallery!: ReturnType<typeof useProgressGallery>;
  function Probe({ enabled }: { enabled: boolean }) { gallery = useProgressGallery('p', enabled); return null; }
  let renderer: any; await act(async () => { renderer = create(React.createElement(Probe, { enabled: false })); });
  expect(getDocs).not.toHaveBeenCalled();
  await act(async () => renderer.update(React.createElement(Probe, { enabled: true })));
  expect(getDocs).toHaveBeenCalledTimes(1); expect(gallery.pics[0].id).toBe('photo');
  await act(async () => renderer.update(React.createElement(Probe, { enabled: false })));
  await act(async () => renderer.update(React.createElement(Probe, { enabled: true })));
  expect(getDocs).toHaveBeenCalledTimes(1);
  await act(async () => gallery.refresh()); expect(getDocs).toHaveBeenCalledTimes(2);
  act(() => renderer.unmount());
});
