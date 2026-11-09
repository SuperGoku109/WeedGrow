import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import LocalCareControls from '../components/LocalCareControls';
import { plantThemes } from '../components/plantDetailTheme';
import { loadLocalCareSettings, saveLocalCareSettings } from '@/services/localCareSettings';
import { defaultLocalCareSettings } from '@/lib/careAlgorithm/localCare';
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/hooks/useLocalCareRevision', () => ({ useLocalCareRevision: () => 0 }));
jest.mock('@/services/localCareSettings', () => ({ loadLocalCareSettings: jest.fn(), saveLocalCareSettings: jest.fn() }));
let renderer: any;
const button = (label: string) => renderer.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label)[0];
const text = () => renderer.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
beforeEach(async () => {
  jest.mocked(loadLocalCareSettings).mockResolvedValue(defaultLocalCareSettings(Date.now() / 1000));
  jest.mocked(saveLocalCareSettings).mockResolvedValue(undefined);
  await act(async () => { renderer = create(React.createElement(LocalCareControls, { plantId: 'p', theme: plantThemes.grove })); });
});
afterEach(() => act(() => renderer.unmount()));
test('presets activate the test and reveal assumptions and parameters', async () => {
  expect(text()).toContain('Choose Open-Meteo weather');
  await act(async () => button('Dry test').props.onPress());
  expect(saveLocalCareSettings).toHaveBeenCalledWith('p', expect.objectContaining({ enabled: true, et0MmPerDay: 8, rainMmPerDay: 0 }));
  expect(text()).toContain('not measured weather history');
  await act(async () => button('Rain test').props.onPress());
  expect(saveLocalCareSettings).toHaveBeenLastCalledWith('p', expect.objectContaining({ rainMmPerDay: 30 }));
});
test('blank numeric input is rejected instead of becoming zero', async () => {
  await act(async () => button('Dry test').props.onPress());
  jest.mocked(saveLocalCareSettings).mockClear();
  const input = renderer.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Test ET0 rate (mm/day)');
  act(() => input.props.onChangeText(''));
  await act(async () => button('Apply and recalculate').props.onPress());
  expect(saveLocalCareSettings).not.toHaveBeenCalled(); expect(text()).toContain('Blank values are not zero');
});
test('live weather mode hides manual forcing and saves the model selection', async () => {
  await act(async () => button('Use Open-Meteo weather').props.onPress());
  expect(saveLocalCareSettings).toHaveBeenCalledWith('p', expect.objectContaining({ enabled: true, weatherMode: 'open-meteo' }));
  expect(renderer.root.findAllByType(TextInput).some((node: any) => node.props.accessibilityLabel === 'Test ET0 rate (mm/day)')).toBe(false);
  expect(text()).toContain('conditional zero-to-full model amounts');
});
