import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import EditorHeight from '../components/EditorHeight';
import { plantThemes } from '../components/plantDetailTheme';
import { displayHeight, heightInCentimetres } from '../form/heightUnits';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null, MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const nodeMocks = { createNodeMock: () => ({ measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => cb(140, 300, 52, 40), focus: jest.fn() }) };
jest.mock('@/ui/GrowMotion', () => ({ useReducedMotion: () => true }));
let renderer: any;
const changed = jest.fn();
const input = () => renderer.root.findByType(TextInput);
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
function openMenu(unit: string) {
  const label = 'Height unit: ' + unit;
  for (const node of renderer.root.findAll((node: any) => node.props.accessibilityLabel === label)) if (node.instance?.measureInWindow) node.instance.measureInWindow = (callback: (x: number, y: number, width: number, height: number) => void) => callback(140, 300, 52, 40);
  act(() => button(label).props.onPress());
}
function choose(from: string, option: string) {
  openMenu(from);
  act(() => button(option).props.onPress());
}
afterEach(() => { act(() => renderer?.unmount()); changed.mockClear(); });
async function mount(value = '100') {
  function Harness() { const [cm, setCm] = React.useState(value); return React.createElement(EditorHeight, { value: cm, onChange: (next: string) => { changed(next); setCm(next); }, disabled: false, theme: plantThemes.grove }); }
  await act(async () => { renderer = create(React.createElement(Harness), nodeMocks); });
}

test('switches display units without changing the stored height or accumulating conversion error', async () => {
  await mount();
  choose('cm', 'Metres (m)'); expect(input().props.value).toBe('1');
  choose('m', 'Inches (in)'); expect(Number(input().props.value)).toBeCloseTo(39.3700787402, 8);
  choose('in', 'Feet (ft)'); expect(Number(input().props.value)).toBeCloseTo(3.28083989501, 8);
  choose('ft', 'Millimetres (mm)'); expect(input().props.value).toBe('1000');
  choose('mm', 'Centimetres (cm)'); expect(input().props.value).toBe('100');
  expect(changed).not.toHaveBeenCalled();
});

test('converts edited imperial and metric values back to centimetres', async () => {
  await mount();
  choose('cm', 'Inches (in)');
  act(() => input().props.onChangeText('12')); expect(changed).toHaveBeenLastCalledWith('30.48');
  choose('in', 'Metres (m)'); expect(input().props.value).toBe('0.3048');
  act(() => input().props.onChangeText('1,25')); expect(changed).toHaveBeenLastCalledWith('125');
  choose('m', 'Centimetres (cm)'); expect(input().props.value).toBe('125');
});

test('keeps missing and invalid values distinct from zero', async () => {
  await mount('');
  choose('cm', 'Feet (ft)'); expect(input().props.value).toBe('');
  expect(heightInCentimetres('', 'ft')).toBe('');
  expect(heightInCentimetres('0', 'ft')).toBe('0');
  expect(heightInCentimetres('invalid', 'm')).toBe('invalid');
  expect(heightInCentimetres('-2', 'm')).toBe('-200');
  expect(displayHeight('invalid', 'in')).toBe('invalid');
});

test('updates a recovered canonical value in the selected unit and disables the selector while saving', async () => {
  await act(async () => { renderer = create(React.createElement(EditorHeight, { value: '100', onChange: changed, disabled: false, theme: plantThemes.grove }), nodeMocks); });
  choose('cm', 'Metres (m)');
  await act(async () => renderer.update(React.createElement(EditorHeight, { value: '200', onChange: changed, disabled: true, theme: plantThemes.grove })));
  expect(input().props.value).toBe('2');
  expect(input().props.editable).toBe(false);
  expect(button('Height unit: m').props.disabled).toBe(true);
});

test('uses a floating overlay and dismisses without editing the measurement', async () => {
  await mount();
  openMenu('cm');
  expect(renderer.root.findAllByType(Modal)).toHaveLength(1);
  expect(input().props.value).toBe('100');
  act(() => button('Dismiss height units').props.onPress());
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  expect(input().props.value).toBe('100'); expect(changed).not.toHaveBeenCalled();
});
