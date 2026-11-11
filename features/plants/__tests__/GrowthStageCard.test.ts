import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Card from '../components/GrowthStageCard';
import { plantThemes } from '../components/plantDetailTheme';
import { confirmGrowthStage, reviewGrowthSuggestion, recordPreflowerObservation } from '../api/growthTracking';
import type { Plant } from '@/firestoreModels';
jest.mock('../api/growthTracking', () => ({ confirmGrowthStage: jest.fn().mockResolvedValue(undefined), reviewGrowthSuggestion: jest.fn().mockResolvedValue(undefined), recordPreflowerObservation: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../api/plantService', () => ({ updatePlant: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => new Date('2026-01-20T12:00:00Z') }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null, Feather: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
jest.mock('../components/PlantDateField', () => () => null);
jest.mock('../components/PlantEditorFields', () => ({ EditorTheme: jest.requireActual('react').createContext({}), EditorSelect: () => null, EditorField: () => null }));
const base = { name: 'Hops', owners: ['owner'], status: 'active', growthStage: 'seedling', stageStartedOn: '2026-01-01', stageRevision: 2, locationTimeZone: 'Africa/Johannesburg' } as Plant;
let renderer: any;
const saved = jest.fn(); const harvest = jest.fn();
async function mount(plant = base) { await act(async () => { renderer = create(React.createElement(Card, { plantId: 'p', plant, theme: plantThemes.grove, onHarvest: harvest, onSaved: saved })); }); }
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && node.props.onPress)[0]; }
afterEach(() => act(() => renderer?.unmount()));
it('requires an explicit dated confirmation and exposes elapsed stage time', async () => {
  await mount(); expect(JSON.stringify(renderer.toJSON())).toContain('19 days in this stage');
  await act(async () => button('Confirm vegetative').props.onPress());
  expect(confirmGrowthStage).not.toHaveBeenCalled();
  await act(async () => button('Save confirmed stage').props.onPress());
  expect(confirmGrowthStage).toHaveBeenCalledWith('p', 'vegetative', '2026-01-20', 2);
  expect(saved).toHaveBeenCalledWith('Growth stage saved.');
});
it('lets the user record physical signs before a seasonal suggestion becomes due', async () => {
  await mount({ ...base, growthStage: 'vegetative', growthProfile: { flowering: 'photoperiod' }, location: { lat: -26, lng: 28 } });
  expect(button('Confirm flowering')).toBeUndefined();
  await act(async () => button('Record early flowering signs').props.onPress());
  await act(async () => button('Save early signs').props.onPress());
  expect(recordPreflowerObservation).toHaveBeenCalledWith('p', '2026-01-20', 2);
  expect(confirmGrowthStage).not.toHaveBeenCalled();
});
it('reviews without advancing the plant and routes harvest through the existing harvest flow', async () => {
  await mount(); await act(async () => button('Not yet').props.onPress());
  expect(reviewGrowthSuggestion).toHaveBeenCalledWith('p', 'seedling:2026-01-01:2', 'not_yet');
  expect(confirmGrowthStage).not.toHaveBeenCalled();
  act(() => renderer.unmount());
  await mount({ ...base, growthStage: 'flowering', stageStartedOn: '2025-10-01' });
  await act(async () => button('Mark as harvested').props.onPress()); expect(harvest).toHaveBeenCalledTimes(1);
});
it('offers optional post-harvest tracking and keeps failures visible', async () => {
  await mount({ ...base, status: 'harvested', growthStage: 'harvested' });
  await act(async () => button('Finish tracking').props.onPress());
  jest.mocked(confirmGrowthStage).mockRejectedValueOnce(new Error('Connection unavailable'));
  await act(async () => button('Save confirmed stage').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Connection unavailable');
});
