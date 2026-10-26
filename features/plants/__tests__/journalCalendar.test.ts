import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Calendar } from 'react-native-calendars';
import JournalDateNavigator from '../components/JournalDateNavigator';
import { plantThemes } from '../components/plantDetailTheme';
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
it('changes years directly while rejecting earlier years and clamps the first year to the first available month', () => {
  const input = () => renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'Calendar year' && typeof node.props.onChangeText === 'function')[0];
  act(() => input().props.onChangeText('2025')); act(() => button('Go to year').props.onPress());
  expect(renderer.root.findByType(Calendar).props.current).toBe('2026-10-01');
  act(() => button('Next year').props.onPress()); expect(renderer.root.findByType(Calendar).props.current).toBe('2027-10-01');
  act(() => renderer.root.findByType(Calendar).props.onMonthChange({ dateString: '2027-02-01' }));
  act(() => button('Previous year').props.onPress()); expect(renderer.root.findByType(Calendar).props.current).toBe('2026-10-01');
});
