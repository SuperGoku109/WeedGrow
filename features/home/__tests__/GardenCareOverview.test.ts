import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import GardenCareOverview from '../components/GardenCareOverview';
import type { Plant } from '@/firestoreModels';
import type { SuggestionCard } from '@/lib/suggestions/types';
import { gardenCareGroups } from '../gardenCare';
const mockPush = jest.fn();
const mockComplete = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/hooks/useAppTheme', () => ({ useAppTheme: () => jest.requireActual('@/design-system/tokens/garden').gardenThemes.grove }));
jest.mock('@/features/care/useCareTipHistory', () => ({ useCareTipHistory: () => ({ complete: mockComplete, refresh: jest.fn(), error: '' }) }));
jest.mock('@/features/plants/components/PlantEditorSheet', () => {
  const { createElement } = jest.requireActual('react');
  const { View, Pressable } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children, onClose }: { children: React.ReactNode; onClose(): void }) =>
    createElement(View, {}, createElement(Pressable, { accessibilityLabel: 'Close care details', onPress: onClose }), children) };
});
jest.mock('@/ui/ActionDialog', () => {
  const { createElement } = jest.requireActual('react');
  const { View, Pressable } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children, confirmDisabled, onConfirm, onClose }: {
    children?: (saving: boolean) => React.ReactNode; confirmDisabled: boolean; onConfirm(): Promise<void>; onClose(): void;
  }) => createElement(View, {},
    children?.(false),
    createElement(Pressable, { accessibilityLabel: 'Cancel', onPress: onClose }),
    createElement(Pressable, { accessibilityLabel: 'Complete', disabled: confirmDisabled, onPress: async () => { await onConfirm(); onClose(); } })) };
});
const now = new Date('2026-11-16T12:00:00Z');
const plants = [{ id: 'a', name: 'Basil', status: 'active' }] as (Plant & { id: string })[];
const windCard: SuggestionCard = {
  id: 'a:wind', kind: 'weather', active: true, severity: 'warn', confidence: 'medium', reasons: [],
  title: 'Wind alert', summary: 'Shelter this plant.', algorithmVersion: 'hops-8.4.0',
  metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 },
};
const windGroups = gardenCareGroups([{ plantId: 'a', cards: [windCard] }], [], plants, now);
const defaults = { plants, groups: windGroups, now, loading: false, failed: false, onRetry: jest.fn() };
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
afterEach(() => {
  act(() => tree?.unmount());
  mockComplete.mockClear();
});
it('opens the tip sheet and saves quick acknowledgements only after confirmation', async () => {
  await act(async () => { tree = create(React.createElement(GardenCareOverview, defaults)); });
  const label = 'Details for Wind alert';
  expect(button('Open care for Basil: Wind alert')).toBeUndefined();
  act(() => button(label).props.onPress());
  expect(button('Close care details')).toBeDefined();
  act(() => button('Open care for Basil: Wind alert').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/plant/[id]', params: { id: 'a', returnToPlants: '1' } });
  expect(button('Open care for Basil: Wind alert')).toBeUndefined();
  act(() => button('Mark handled: Wind alert').props.onPress());
  expect(mockComplete).not.toHaveBeenCalled();
  act(() => button('Cancel').props.onPress());
  expect(mockComplete).not.toHaveBeenCalled();
  expect(button('Complete')).toBeUndefined();
  act(() => button('Mark handled: Wind alert').props.onPress());
  await act(async () => button('Complete').props.onPress());
  expect(mockComplete).toHaveBeenCalledWith([expect.objectContaining({ plantId: 'a' })]);
});

it('asks which plants were checked and completes only the selected plants', async () => {
  const scopedPlants = [...plants, { ...plants[0], id: 'b', name: 'Fern' }];
  const results = scopedPlants.map(plant => ({
    plantId: plant.id, cards: [{ ...windCard, id: plant.id + ':watering', kind: 'watering' as const, severity: 'watch' as const,
      title: 'Check soil moisture', summary: 'Check before watering.', metrics: {} }],
  }));
  const groups = gardenCareGroups(results, [], scopedPlants, now);
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { ...defaults, plants: scopedPlants, groups, gardenId: 'garden-a' })); });
  act(() => button('Mark checked: Check soil moisture').props.onPress());
  expect(button('Complete').props.disabled).toBe(true);
  act(() => button('Fern').props.onPress());
  expect(button('Complete').props.disabled).toBe(false);
  await act(async () => button('Complete').props.onPress());
  expect(mockComplete).toHaveBeenCalledWith([expect.objectContaining({ plantId: 'b' })]);
  act(() => button('Show all care').props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/care-tips', params: { gardenId: 'garden-a' } });
});
it('offers a retry when Home reports a care loading failure', async () => {
  const retry = jest.fn();
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { ...defaults, groups: [], failed: true, onRetry: retry })); });
  await act(async () => button('Retry care advice').props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps the completed garden summary while refreshing after Home remounts', async () => {
  const props = { ...defaults, cacheKey: 'account-a:garden-a' };
  await act(async () => { tree = create(React.createElement(GardenCareOverview, props)); });
  expect(button('Details for Wind alert')).toBeDefined();
  act(() => tree.unmount());
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { ...props, groups: [], loading: true })); });
  expect(button('Details for Wind alert')).toBeDefined();
  act(() => button('Details for Wind alert').props.onPress());
  expect(button('Open care for Basil: Wind alert')).toBeDefined();
  await act(async () => tree.update(React.createElement(GardenCareOverview, { ...props, groups: [], cacheKey: 'account-b:garden-a', loading: true })));
  expect(button('Details for Wind alert')).toBeUndefined();
});

it('removes an acknowledged alert even while showing the previous groups during refresh', async () => {
  const props = { ...defaults, cacheKey: 'account:garden' };
  await act(async () => { tree = create(React.createElement(GardenCareOverview, props)); });
  const tip = windGroups[0].tips![0].tip;
  const updatedPlants = [{ ...plants[0], careTipHistory: [{ ...tip, handledAt: now.getTime() + 1 }] }];
  await act(async () => tree.update(React.createElement(GardenCareOverview, { ...props, groups: [], plants: updatedPlants, loading: true })));
  expect(button('Details for Wind alert')).toBeUndefined();
});
