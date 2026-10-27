import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import DailyCareAdvice from '../components/DailyCareAdvice';
import { plantThemes } from '../components/plantDetailTheme';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, GrowReveal: jest.requireActual('react-native').View }));
const card = (id: string, severity: SuggestionCard['severity'], kind: SuggestionCard['kind']): SuggestionCard => ({ id, severity, kind, title: id, summary: `${id} explanation`, reasons: [], active: true, metrics: {}, confidence: 'high', algorithmVersion: '1' });
const cards = [card('Watering recorded', 'info', 'watering'), card('Mildew risk', 'critical', 'powderyMildew'), card('Root rot risk', 'warn', 'rootRot')];
let renderer: any;
const record = jest.fn();
function button(prefix: string) { return renderer.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel?.startsWith(prefix))[0]; }
function text() { return renderer.root.findAllByType(Text).map((node: any) => node.props.children).flat().filter((value: unknown) => typeof value === 'string').join(' '); }
async function mount(canRecord = true) { await act(async () => { renderer = create(React.createElement(DailyCareAdvice, { cards, loading: false, error: '', hasLocation: true, theme: plantThemes.grove, onRefresh: () => {}, onRecord: record, canRecord })); }); }
afterEach(() => { act(() => renderer?.unmount()); record.mockClear(); });
test('minimized advice retains the urgent warning and count without explanations or logging actions', async () => {
  await mount();
  expect(text()).toContain('Mildew risk'); expect(text()).toContain('3 notes');
  expect(text()).not.toContain('Mildew risk explanation'); expect(button('Log observation')).toBeUndefined();
  expect(button('Expand care notes').props.accessibilityState.expanded).toBe(false);
});
test('only one explanation opens at a time, preserves logging context, and minimizing closes details', async () => {
  await mount();
  act(() => button('Expand care notes').props.onPress());
  act(() => button('Urgent: Mildew risk').props.onPress());
  expect(text()).toContain('Mildew risk explanation');
  act(() => button('Care note: Watering recorded').props.onPress());
  expect(text()).not.toContain('Mildew risk explanation'); expect(text()).toContain('Watering recorded explanation');
  act(() => button('Record soil check').props.onPress()); expect(record).toHaveBeenCalledWith('health', 'soil-check');
  act(() => button('Minimize care notes').props.onPress()); act(() => button('Expand care notes').props.onPress());
  expect(text()).not.toContain('Watering recorded explanation');
});
test('read-only plants retain explanations without offering logging', async () => {
  await mount(false);
  act(() => button('Expand care notes').props.onPress()); act(() => button('Urgent: Mildew risk').props.onPress());
  expect(text()).toContain('Mildew risk explanation'); expect(button('Log observation')).toBeUndefined();
});
