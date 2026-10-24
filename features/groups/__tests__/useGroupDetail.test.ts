import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { useGroupDetail } from '../hooks/useGroupDetail';
let mockPlants = [{ id: 'p', name: 'Original plant', ageKnown: false }];
const mockRefresh = jest.fn();
jest.mock('@/hooks/useGardenData', () => ({ useOwnedGroups: () => ({ groups: [{ id: 'space', name: 'Home', plantIds: ['p'] }], refresh: mockRefresh, loading: false, error: '' }) }));
jest.mock('@/features/plants/hooks/usePlantList', () => ({ usePlantList: () => ({ plants: mockPlants, refresh: mockRefresh, loading: false, error: '' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock('../api/groupApi', () => ({ deleteGroup: jest.fn() }));
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));
it('shows live member edits without fetching each member or manually refreshing', () => {
  let group!: ReturnType<typeof useGroupDetail>;
  function Probe() { group = useGroupDetail('space'); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe)); });
  expect(group.plants[0].name).toBe('Original plant'); expect(group.avgAgeDays).toBeNull();
  mockPlants = [{ id: 'p', name: 'Updated on another device', ageKnown: false }];
  act(() => renderer.update(React.createElement(Probe)));
  expect(group.plants[0].name).toBe('Updated on another device'); expect(mockRefresh).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
