import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native';
import CareScheduleEditor from '../components/CareScheduleEditor';
import WateringCareCard from '../components/WateringCareCard';
import { plantThemes } from '../components/plantDetailTheme';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';
import type { PlantReminderSchedule } from '@/firestoreModels';
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
jest.mock('../components/PlantEditorSheet', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('react-native-svg', () => { const View = jest.requireActual('react-native').View; return { __esModule: true, default: View, Circle: View, Line: View, Path: View, Rect: View, Text: View }; });
let renderer: any; const changed = jest.fn();
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
it('keeps smart and custom choices independent and requires a user label interval for smart feeding', async () => {
  function Harness() { const [value, setValue] = React.useState<PlantReminderSchedule>({ type: 'none' }); return React.createElement(CareScheduleEditor, { kind: 'feeding', value, onChange: (next: PlantReminderSchedule) => { changed(next); setValue(next); } }); }
  await act(async () => { renderer = create(React.createElement(Harness)); });
  act(() => button('Fertilizing: Smart schedule').props.onPress());
  expect(changed).toHaveBeenLastCalledWith({ type: 'smart' });
  const interval = renderer.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Fertilizing: Interval from your product label (days)');
  act(() => interval.props.onChangeText('21'));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'smart', intervalDays: 21 }));
  act(() => button('Fertilizing: Custom schedule').props.onPress());
  act(() => button('Fertilizing: Selected weekdays').props.onPress());
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'custom', customDays: ['mon'] }));
  act(() => button('Fertilizing: FRI').props.onPress());
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ customDays: ['mon', 'fri'] }));
  act(() => button('Fertilizing: Off').props.onPress()); expect(changed).toHaveBeenLastCalledWith({ type: 'none' });
});
it('shows the annual preview without journal entries and expands into placeholder information', async () => {
  const plant = makePlantSummary({ locationLabel: 'Cape Town' });
  await act(async () => { renderer = create(React.createElement(WateringCareCard, { plant, theme: plantThemes.grove })); });
  const initial = JSON.stringify(renderer.toJSON());
  expect(initial).toContain('Seasonal overview');
  expect(initial).toContain('Illustrative curve');
  expect(initial).not.toContain('journal entry');
  expect(initial).not.toContain('Your chart starts with an amount');
  expect(initial).not.toContain('Annual overview');
  act(() => button('Learn more about watering').props.onPress());
  const expanded = JSON.stringify(renderer.toJSON());
  expect(expanded).toContain('Annual overview');
  expect(expanded).toContain('Seasonal patterns');
  expect(expanded).toContain('Location context for Cape Town');
  expect(expanded).toContain('placeholder content');
});
