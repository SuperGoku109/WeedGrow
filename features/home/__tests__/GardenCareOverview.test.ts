import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import GardenCareOverview from '../components/GardenCareOverview';
import { evaluateSuggestionCardsForPlants } from '@/lib/suggestions/suggestionCards';
import type { Plant } from '@/firestoreModels';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/hooks/useAppTheme', () => ({ useAppTheme: () => jest.requireActual('@/design-system/tokens/garden').gardenThemes.grove }));
jest.mock('@/hooks/useLocalCareRevision', () => ({ useLocalCareRevision: () => 0 }));
jest.mock('@/lib/suggestions/suggestionCards', () => ({ evaluateSuggestionCardsForPlants: jest.fn() }));
const now = new Date('2026-11-16T12:00:00Z');
const plants = [{ id: 'a', name: 'Basil', status: 'active' }] as (Plant & { id: string })[];
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
afterEach(() => act(() => tree?.unmount()));
it('expands inline, opens the affected plant, and collapses again', async () => {
  (evaluateSuggestionCardsForPlants as jest.Mock).mockResolvedValue([{ plantId: 'a', cards: [{ id: 'a:wind', kind: 'weather', active: true, severity: 'warn', title: 'Wind alert', summary: 'Shelter this plant.', algorithmVersion: 'hops-8.4.0', metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 } }] }]);
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { plants, tasks: [], now, loading: false, error: null, onRetry: jest.fn() })); });
  const label = 'Today’s garden care. 1 thing needs checking';
  expect(button('Open care for Basil: Wind alert')).toBeUndefined();
  act(() => button(label).props.onPress());
  expect(button(label).props.accessibilityState.expanded).toBe(true);
  act(() => button('Open care for Basil: Wind alert').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/plant/[id]', params: { id: 'a', returnToPlants: '1' } });
  act(() => button(label).props.onPress());
  expect(button('Open care for Basil: Wind alert')).toBeUndefined();
});
it('shows a retry state when the evaluator returns incomplete results', async () => {
  (evaluateSuggestionCardsForPlants as jest.Mock).mockResolvedValue([]);
  const retry = jest.fn();
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { plants, tasks: [], now, loading: false, error: null, onRetry: retry })); });
  act(() => button('Today’s garden care. Care needs a refresh').props.onPress());
  const retryButton = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && !node.props.accessibilityLabel && typeof node.props.onPress === 'function')[0];
  await act(async () => retryButton.props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps the completed garden summary while refreshing after Home remounts', async () => {
  const evaluate = evaluateSuggestionCardsForPlants as jest.Mock;
  evaluate.mockResolvedValueOnce([{ plantId: 'a', cards: [{ id: 'a:wind', kind: 'weather', active: true, severity: 'warn', title: 'Wind alert', summary: 'Shelter this plant.', algorithmVersion: 'hops-8.4.0', metrics: { expiresAtUtc: now.getTime() / 1000 + 3600 } }] }]);
  const props = { cacheKey: 'account-a:garden-a', plants, tasks: [], now, loading: false, error: null, onRetry: jest.fn() };
  await act(async () => { tree = create(React.createElement(GardenCareOverview, props)); });
  expect(button('Today’s garden care. 1 thing needs checking')).toBeDefined();
  act(() => tree.unmount());
  evaluate.mockImplementation(() => new Promise(() => {}));
  await act(async () => { tree = create(React.createElement(GardenCareOverview, { ...props, loading: true })); });
  expect(button('Today’s garden care. 1 thing needs checking')).toBeDefined();
  expect(button('Today’s garden care. Checking your garden…')).toBeUndefined();
  act(() => button('Today’s garden care. 1 thing needs checking').props.onPress());
  expect(button('Open care for Basil: Wind alert')).toBeDefined();
  await act(async () => tree.update(React.createElement(GardenCareOverview, { ...props, cacheKey: 'account-b:garden-a', loading: true })));
  expect(button('Today’s garden care. Checking your garden…')).toBeDefined();
});
