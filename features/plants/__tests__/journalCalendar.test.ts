import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Calendar } from 'react-native-calendars';
import DropDownPicker from 'react-native-dropdown-picker';
import JournalDateNavigator from '../components/JournalDateNavigator';
import { plantThemes } from '../components/plantDetailTheme';
jest.mock('react-native-dropdown-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-calendars', () => ({ Calendar: () => null }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
const jump = jest.fn();
let renderer: any;
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
beforeEach(() => {
  act(() => { renderer = create(React.createElement(JournalDateNavigator, { today: '2026-10-27', selected: '2026-10-27', dates: ['2026-10-27'], minimum: '2026-10-17', canGoBack: false, logs: {}, historyStatus: 'ready', theme: plantThemes.grove, onSelect: jest.fn(), onJump: jump, onMove: jest.fn(), onToday: jest.fn(), onSearch: jest.fn() })); });
  act(() => button('Choose journal date from full calendar').props.onPress());
});
afterEach(() => act(() => renderer.unmount()));
it('disables pre-addition dates and guards direct calendar events', () => {
  const calendar = renderer.root.findByType(Calendar);
  expect(calendar.props.minDate).toBe('2026-10-17'); expect(calendar.props.disableArrowLeft).toBe(true);
  expect(button('Previous 7 days').props.disabled).toBe(true);
  act(() => calendar.props.onDayPress({ dateString: '2026-10-16' })); expect(jump).not.toHaveBeenCalled();
  act(() => calendar.props.onDayPress({ dateString: '2026-10-17' })); expect(jump).toHaveBeenCalledWith('2026-10-17');
});
it('offers a year dropdown bounded by the added year and clamps the first year to its available month', () => {
  const dropdown = () => renderer.root.findByType(DropDownPicker);
  expect(dropdown().props.searchable).toBe(false);
  expect(dropdown().props.items.map((item: { value: number }) => item.value)).toEqual([2026, 2027]);
  act(() => dropdown().props.setValue(() => 2025)); expect(renderer.root.findByType(Calendar).props.current).toBe('2026-10-01');
  act(() => dropdown().props.setValue(() => 2027)); expect(renderer.root.findByType(Calendar).props.current).toBe('2027-10-01');
  act(() => renderer.root.findByType(Calendar).props.onMonthChange({ dateString: '2027-02-01' }));
  act(() => dropdown().props.setValue(() => 2026)); expect(renderer.root.findByType(Calendar).props.current).toBe('2026-10-01');
});
