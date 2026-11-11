import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Card from '../components/GrowthStageCard';
import { plantThemes } from '../components/plantDetailTheme';
import { confirmGrowthStage, reviewGrowthSuggestion, recordPreflowerObservation } from '../api/growthTracking';
import type { Plant } from '@/firestoreModels';
import { updatePlant } from '../api/plantService';
import { EditorSelect, EditorField } from '../components/PlantEditorFields';
import PlantDateField from '../components/PlantDateField';
jest.mock('../api/growthTracking', () => ({ confirmGrowthStage: jest.fn().mockResolvedValue(undefined), reviewGrowthSuggestion: jest.fn().mockResolvedValue(undefined), recordPreflowerObservation: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../api/plantService', () => ({ updatePlant: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => new Date('2026-01-20T12:00:00Z') }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null, Feather: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
jest.mock('../components/PlantDateField', () => ({ __esModule: true, default: () => null, displayDay: (day: string) => day }));
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
  await mount(); await act(async () => button('Still a seedling').props.onPress());
  expect(reviewGrowthSuggestion).toHaveBeenCalledWith('p', 'seedling:2026-01-01:2', 'not_yet');
  expect(confirmGrowthStage).not.toHaveBeenCalled();
  act(() => renderer.unmount());
  await mount({ ...base, growthStage: 'flowering', stageStartedOn: '2025-10-01' });
  await act(async () => button('Mark as harvested').props.onPress()); expect(harvest).toHaveBeenCalledTimes(1);
});
it('keeps secondary tools collapsed and focuses the date form when confirming', async () => {
  await mount();
  expect(button('Stage settings')).toBeUndefined(); expect(button('Record or change stage')).toBeUndefined();
  await act(async () => button('Confirm vegetative').props.onPress());
  expect(button('Still a seedling')).toBeUndefined();
  expect(button('Save confirmed stage')).toBeDefined();
});
it('does not reuse the old stage start when selecting a different stage manually', async () => {
  await mount();
  await act(async () => button('Stage options').props.onPress());
  await act(async () => button('Record or change stage').props.onPress());
  const select = renderer.root.findAllByType(EditorSelect).find((node: any) => node.props.label === 'Confirmed growth stage');
  await act(async () => select.props.onSelect('flowering'));
  expect(renderer.root.findByType(PlantDateField).props.value).toBe('2026-01-20');
});
it('uses the stage revision captured when the form opened, preserving a conflict instead of silently overwriting', async () => {
  await mount(); await act(async () => button('Confirm vegetative').props.onPress());
  await act(async () => renderer.update(React.createElement(Card, { plantId: 'p', plant: { ...base, growthStage: 'flowering', stageRevision: 3 }, theme: plantThemes.grove, onHarvest: harvest, onSaved: saved })));
  jest.mocked(confirmGrowthStage).mockRejectedValueOnce(new Error('The stage has changed. Refresh and review it again.'));
  await act(async () => button('Save confirmed stage').props.onPress());
  expect(confirmGrowthStage).toHaveBeenCalledWith('p', 'vegetative', '2026-01-20', 2);
  expect(saved).not.toHaveBeenCalled(); expect(JSON.stringify(renderer.toJSON())).toContain('The stage has changed');
});
it('captures the settings baseline before remote edits and rejects blank quiet hours', async () => {
  const initial = { ...base, growthProfile: { flowering: 'unknown' as const } };
  await mount(initial); await act(async () => button('Stage options').props.onPress());
  await act(async () => button('Stage settings').props.onPress());
  const select = (label: string) => renderer.root.findAllByType(EditorSelect).find((node: any) => node.props.label === label);
  await act(async () => select('Flowering response').props.onSelect('photoperiod'));
  await act(async () => select('Optional stage notifications').props.onSelect('on'));
  await act(async () => renderer.root.findAllByType(EditorField).find((node: any) => node.props.label === 'Quiet hours start (0–23)').props.onChangeText(''));
  await act(async () => button('Save stage settings').props.onPress());
  expect(updatePlant).not.toHaveBeenCalled(); expect(JSON.stringify(renderer.toJSON())).toContain('Enter a whole hour');
  await act(async () => select('Optional stage notifications').props.onSelect('off'));
  await act(async () => renderer.update(React.createElement(Card, { plantId: 'p', plant: { ...base, growthProfile: { flowering: 'age_based' }, stageReminders: { enabled: true } }, theme: plantThemes.grove, onHarvest: harvest, onSaved: saved })));
  await act(async () => button('Save stage settings').props.onPress());
  expect(jest.mocked(updatePlant).mock.calls[0][2]).toMatchObject({ growthProfile: { flowering: 'unknown' } });
  expect(jest.mocked(updatePlant).mock.calls[0][1].stageReminders).toMatchObject({ enabled: false, quietStartHour: 20, quietEndHour: 8 });
});
it('shows saving feedback and blocks rapid duplicate submissions', async () => {
  let finish!: () => void;
  jest.mocked(confirmGrowthStage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await mount(); await act(async () => button('Confirm vegetative').props.onPress());
  const save = button('Save confirmed stage');
  act(() => { save.props.onPress(); save.props.onPress(); });
  expect(confirmGrowthStage).toHaveBeenCalledTimes(1); expect(JSON.stringify(renderer.toJSON())).toContain('Saving…');
  await act(async () => finish());
  expect(button('Stage settings')).toBeUndefined();
});
it('offers optional post-harvest tracking and keeps failures visible', async () => {
  await mount({ ...base, status: 'harvested', growthStage: 'harvested' });
  await act(async () => button('Finish tracking').props.onPress());
  jest.mocked(confirmGrowthStage).mockRejectedValueOnce(new Error('Connection unavailable'));
  await act(async () => button('Save confirmed stage').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Connection unavailable');
});
