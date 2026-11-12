import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import PlantFilterMenu from '../components/PlantFilterMenu';
import { DEFAULT_PLANT_LIST_OPTIONS } from '@/lib/plants/plantListOptions';
import type { Plant } from '@/firestoreModels';
jest.mock('@/ui/GrowMotion', () => ({ ...jest.requireActual('@/ui/GrowMotion'), GrowPress: jest.requireActual('react-native').Pressable }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
const plants = [{ id: 'a', name: 'Plant', strain: '', createdAt: null, status: 'active', growthStage: 'seedling', environment: 'outdoor' }] as (Plant & { id: string })[];
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
afterEach(() => act(() => tree?.unmount()));

it('previews changes locally and applies the combined choices only when Show is pressed', () => {
  const apply = jest.fn(); const close = jest.fn();
  act(() => { tree = create(React.createElement(PlantFilterMenu, { anchor: { x: 280, y: 180, width: 44, height: 44 }, options: DEFAULT_PLANT_LIST_OPTIONS, status: 'active', plants, query: '', showEnvironment: true, onApply: apply, onClose: close })); });
  act(() => button('Sort by: Name A–Z').props.onPress());
  act(() => button('Environments: Indoor').props.onPress());
  expect(apply).not.toHaveBeenCalled();
  expect(button('Show 0 plants')).toBeDefined();
  act(() => button('Show 0 plants').props.onPress());
  expect(apply).toHaveBeenCalledWith({ sort: 'nameAsc', environment: ['indoor'], stage: 'all' }, 'active');
  expect(close).toHaveBeenCalledTimes(1);
});

it('resets the draft and restores the result count, while dismissal never applies it', () => {
  const apply = jest.fn(); const close = jest.fn();
  act(() => { tree = create(React.createElement(PlantFilterMenu, { anchor: { x: 280, y: 180, width: 44, height: 44 }, options: { sort: 'oldest', stage: 'seedling', environment: 'indoor' }, status: 'past', plants, query: '', showEnvironment: false, onApply: apply, onClose: close })); });
  expect(button('View past plants').props['aria-checked']).toBe(true);
  expect(button('Show 0 plants')).toBeDefined();
  act(() => button('Reset plant filters and sorting').props.onPress());
  expect(button('Show 1 plant')).toBeDefined();
  expect(button('View past plants').props['aria-checked']).toBe(false);
  expect(button('Environments: All')).toBeUndefined();
  act(() => button('Dismiss plant filters').props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
});

it('keeps multiple tiles selected, supports deselection, and changes sorting independently', () => {
  const apply = jest.fn();
  const entries = [...plants, { ...plants[0], id: 'b', name: 'Second', growthStage: 'vegetative', environment: 'indoor' } as Plant & { id: string }];
  act(() => { tree = create(React.createElement(PlantFilterMenu, { anchor: { x: 280, y: 180, width: 44, height: 44 }, options: DEFAULT_PLANT_LIST_OPTIONS, status: 'active', plants: entries, query: '', showEnvironment: true, onApply: apply, onClose: jest.fn() })); });
  act(() => button('Growth stages: Seedling').props.onPress());
  act(() => button('Growth stages: Vegetative').props.onPress());
  act(() => button('Environments: Outdoor').props.onPress());
  act(() => button('Environments: Indoor').props.onPress());
  expect(button('Growth stages: Seedling').props['aria-checked']).toBe(true);
  expect(button('Growth stages: Vegetative').props['aria-checked']).toBe(true);
  expect(button('Growth stages: All').props['aria-checked']).toBe(false);
  expect(button('Environments: Indoor').props['aria-checked']).toBe(true);
  expect(button('Environments: Outdoor').props['aria-checked']).toBe(true);
  expect(button('Show 2 plants')).toBeDefined();
  act(() => button('Sort by: Name A–Z').props.onPress());
  expect(button('Sort by: Newest added').props['aria-checked']).toBe(false);
  act(() => button('Growth stages: Seedling').props.onPress());
  expect(button('Growth stages: Vegetative').props['aria-checked']).toBe(true);
  act(() => button('Show 1 plant').props.onPress());
  expect(apply).toHaveBeenCalledWith({ sort: 'nameAsc', stage: ['vegetative'], environment: ['outdoor', 'indoor'] }, 'active');
});

it('offers the complete guide even when the collection has no plants in a stage', () => {
  act(() => { tree = create(React.createElement(PlantFilterMenu, { anchor: { x: 280, y: 180, width: 44, height: 44 }, options: DEFAULT_PLANT_LIST_OPTIONS, status: 'active', plants: [], query: '', showEnvironment: true, onApply: jest.fn(), onClose: jest.fn() })); });
  for (const label of ['Germination', 'Seedling', 'Vegetative', 'Pre-flowering', 'Flowering', 'Harvest', 'Drying', 'Curing', 'Completed', 'Rooting', 'Not recorded']) expect(button(`Growth stages: ${label}`)).toBeDefined();
  act(() => button('Growth stages: Pre-flowering').props.onPress());
  act(() => button('Growth stages: Flowering').props.onPress());
  expect(button('Growth stages: Pre-flowering').props['aria-checked']).toBe(true);
  expect(button('Growth stages: Flowering').props['aria-checked']).toBe(true);
});
