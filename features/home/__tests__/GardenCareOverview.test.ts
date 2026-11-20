import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import GardenCareOverview from '../components/GardenCareOverview';
import { evaluateSuggestionCardsForPlants } from '@/lib/suggestions/suggestionCards';
import type { Plant } from '@/firestoreModels';
import { gardenCareGroups } from '../gardenCare';
const mockPush = jest.fn();
const mockComplete = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/hooks/useAppTheme', () => ({ useAppTheme: () => jest.requireActual('@/design-system/tokens/garden').gardenThemes.grove }));
jest.mock('@/hooks/useLocalCareRevision', () => ({ useLocalCareRevision: () => 0 }));
jest.mock('@/lib/suggestions/suggestionCards', () => ({ evaluateSuggestionCardsForPlants: jest.fn() }));
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
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
afterEach(() => {
  act(() => tree?.unmount());
  mockComplete.mockClear();
});
it('opens the tip sheet and saves quick acknowledgements only after confirmation', async () => {
  (evaluateSuggestionCardsForPlants as jest.Mock).mockResolvedValue([{ plantId: 'a', cards: [{ id: 'a:wind', kind: 'weather', active: true, severity: 'warn', title: 'Wind alert', summary: 'Shelter this plant.', algorithmVersion: 'hops-8.4.0', metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 } }] }]);
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { plants, tasks: [], now, loading: false, error: null, onRetry: jest.fn() })); });
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
  (evaluateSuggestionCardsForPlants as jest.Mock).mockResolvedValue(scopedPlants.map(plant => ({
    plantId: plant.id, cards: [{ id: plant.id + ':watering', kind: 'watering', active: true, severity: 'watch',
      title: 'Check soil moisture', summary: 'Check before watering.', algorithmVersion: 'hops-8.4.0', metrics: {} }],
  })));
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { plants: scopedPlants, tasks: [], now,
    loading: false, error: null, onRetry: jest.fn(), gardenId: 'garden-a' })); });
  act(() => button('Mark checked: Check soil moisture').props.onPress());
  expect(button('Complete').props.disabled).toBe(true);
  act(() => button('Fern').props.onPress());
  expect(button('Complete').props.disabled).toBe(false);
  await act(async () => button('Complete').props.onPress());
  expect(mockComplete).toHaveBeenCalledWith([expect.objectContaining({ plantId: 'b' })]);
  act(() => button('Show all care').props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/care-tips', params: { gardenId: 'garden-a' } });
});
it('shows a retry state when the evaluator returns incomplete results', async () => {
  (evaluateSuggestionCardsForPlants as jest.Mock).mockResolvedValue([]);
  const retry = jest.fn();
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { plants, tasks: [], now, loading: false, error: null, onRetry: retry })); });
  await act(async () => button('Retry care advice').props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps the completed garden summary while refreshing after Home remounts', async () => {
  const evaluate = evaluateSuggestionCardsForPlants as jest.Mock;
  evaluate.mockResolvedValueOnce([{ plantId: 'a', cards: [{ id: 'a:wind', kind: 'weather', active: true, severity: 'warn', title: 'Wind alert', summary: 'Shelter this plant.', algorithmVersion: 'hops-8.4.0', metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 } }] }]);
  const props = { cacheKey: 'account-a:garden-a', plants, tasks: [], now, loading: false, error: null, onRetry: jest.fn() };
  await act(async () => { tree = create(React.createElement(GardenCareOverview, props)); });
  expect(button('Details for Wind alert')).toBeDefined();
  act(() => tree.unmount());
  evaluate.mockImplementation(() => new Promise(() => {}));
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { ...props, loading: true })); });
  expect(button('Details for Wind alert')).toBeDefined();
  act(() => button('Details for Wind alert').props.onPress());
  expect(button('Open care for Basil: Wind alert')).toBeDefined();
  await act(async () => tree.update(React.createElement(GardenCareOverview, { ...props, cacheKey: 'account-b:garden-a', loading: true })));
  expect(button('Details for Wind alert')).toBeUndefined();
});

it('removes an acknowledged alert even while showing the previous groups during refresh', async () => {
  const cards = [{ id: 'a:wind', kind: 'weather' as const, active: true, severity: 'warn' as const, confidence: 'medium' as const,
    title: 'Wind alert', summary: 'Shelter this plant.', reasons: [], algorithmVersion: 'hops-8.4.0', metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 } }];
  const results = [{ plantId: 'a', plantName: 'Basil', cards, insight: {} as never }];
  const props = { cacheKey: 'account:garden', plants, tasks: [], now, loading: false, error: null, onRetry: jest.fn(),
    advice: { results, loading: false, error: false, refresh: jest.fn() } };
  await act(async () => { tree = create(React.createElement(GardenCareOverview, props)); });
  const tip = gardenCareGroups(results, [], plants, now)[0].tips![0].tip;
  const updatedPlants = [{ ...plants[0], careTipHistory: [{ ...tip, handledAt: now.getTime() + 1 }] }];
  await act(async () => tree.update(React.createElement(GardenCareOverview, { ...props, plants: updatedPlants, loading: true })));
  expect(button('Details for Wind alert')).toBeUndefined();
});
