import React from 'react';
// @ts-expect-error The Expo test renderer has no bundled declarations.
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEditDraft } from '../useEditDraft';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'draft-owner' } }) }));
it('recovers the original edit baseline and clears queued writes after saving', async () => {
  const key = 'weedgrow.edit.v1.draft-owner.plant.p';
  await AsyncStorage.setItem(key, JSON.stringify({ value: { name: 'Draft name' }, baseline: { name: 'Old name' }, savedAt: Date.now() }));
  let draft!: ReturnType<typeof useEditDraft<{ name: string }>>;
  function Probe() { draft = useEditDraft('plant.p', { name: 'Latest name' }, { name: 'Latest name' }, true); return null; }
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  const apply = jest.fn();
  await act(async () => draft.recover(apply));
  expect(apply).toHaveBeenCalledWith({ name: 'Draft name' });
  expect(draft.baseline.current).toEqual({ name: 'Old name' });
  await act(async () => draft.clear());
  expect(await AsyncStorage.getItem(key)).toBeNull();
  act(() => renderer.unmount());
});
