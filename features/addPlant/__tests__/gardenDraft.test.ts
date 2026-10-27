import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAddPlantForm } from '../hooks/useAddPlantForm';
import { INITIAL_PLANT_FORM } from '../draftStorage';

const mockUser = { uid: 'owner' };
jest.mock('@/services/session', () => ({ useSession: () => ({ user: mockUser, loading: false }) }));
jest.mock('@/services/preferences', () => ({ readPreferences: async () => ({ defaultEnvironment: 'outdoor' }) }));
jest.mock('../api/savePlant', () => ({ createPlantId: () => 'new-plant' }));
jest.mock('@/features/groups/api/groupApi', () => ({ getGroupById: async () => ({ id: 'tent', name: 'Flower tent', environment: 'indoor', location: null, sensorProfileId: 'sensor' }) }));

it('prefills a new plant from its entry garden without retargeting a resumed draft', async () => {
  jest.useFakeTimers();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ version: 1, plantId: 'draft-plant', step: 2, savedAt: '2026-10-27', form: { ...INITIAL_PLANT_FORM, name: 'Existing draft', groupId: 'patio', groupName: 'Patio' } }));
  let form!: ReturnType<typeof useAddPlantForm>;
  function Probe() { form = useAddPlantForm('tent'); return null; }
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  expect(form.form).toMatchObject({ groupId: 'tent', groupName: 'Flower tent', environment: 'indoor', locationMode: 'space', sensorProfileId: 'sensor' });
  act(() => form.resumeDraft());
  expect(form.form).toMatchObject({ name: 'Existing draft', groupId: 'patio', groupName: 'Patio' });
  expect(form.plantId).toBe('draft-plant');
  act(() => renderer.unmount());
  jest.useRealTimers();
});
