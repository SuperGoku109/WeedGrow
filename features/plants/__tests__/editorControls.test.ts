import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { EditorSelect } from '../components/PlantEditorFields';
import EditorPotSize from '../components/EditorPotSize';
jest.mock('@expo/vector-icons', () => ({ Feather: () => null, MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/ui/GrowMotion', () => ({ useReducedMotion: () => true }));
let renderer: any;
const select = jest.fn();
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
function openMenu(label: string) {
  for (const node of renderer.root.findAll((node: any) => node.props.accessibilityLabel === label)) if (node.instance?.measureInWindow) node.instance.measureInWindow = (callback: (x: number, y: number, width: number, height: number) => void) => callback(140, 300, 150, 48);
  act(() => button(label).props.onPress());
}

afterEach(() => { act(() => renderer?.unmount()); select.mockClear(); });
test('selection floats above the form, supports an empty value and closes after choosing', () => {
  act(() => { renderer = create(React.createElement(EditorSelect, { label: 'Routine', value: 'weekly', options: [{ value: '', label: 'Not specified' }, { value: 'weekly', label: 'Weekly' }], onSelect: select })); });
  openMenu('Routine: Weekly');
  expect(renderer.root.findAllByType(Modal)).toHaveLength(1);
  expect(button('Routine: Weekly').props.accessibilityState.expanded).toBe(true);
  act(() => button('Not specified').props.onPress());
  expect(select).toHaveBeenCalledWith(''); expect(button('Routine: Weekly').props.accessibilityState.expanded).toBe(false);
});
test('opening custom pot size preserves the value until a different size is chosen', () => {
  act(() => { renderer = create(React.createElement(EditorPotSize, { value: '3 gallons', onChange: select, disabled: false })); });
  expect(renderer.root.findByType(TextInput).props.value).toBe('3 gallons');
  openMenu('Pot size: Custom size');
  expect(select).not.toHaveBeenCalled();
  act(() => button('10L').props.onPress());
  expect(select).toHaveBeenCalledWith('10L');
});
test('disabling a selector closes its menu', () => {
  const props = { label: 'Stage', value: 'seedling', options: [{ value: 'seedling', label: 'Seedling' }], onSelect: select };
  act(() => { renderer = create(React.createElement(EditorSelect, props)); });
  openMenu('Stage: Seedling');
  act(() => renderer.update(React.createElement(EditorSelect, { ...props, disabled: true })));
  expect(button('Stage: Seedling').props.accessibilityState.expanded).toBe(false);
});

test('long lists remain searchable and selecting a result closes the overlay', () => {
  const options = [...Array.from({ length: 9 }, (_, i) => ({ value: String(i), label: 'Option ' + i })), { value: 'roof', label: 'Rooftop' }];
  act(() => { renderer = create(React.createElement(EditorSelect, { label: 'Site', value: '0', options, onSelect: select })); });
  openMenu('Site: Option 0');
  const search = renderer.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Search site');
  act(() => search.props.onChangeText('roof'));
  expect(button('Option 1')).toBeUndefined(); expect(button('Rooftop')).toBeDefined();
  act(() => button('Rooftop').props.onPress()); expect(select).toHaveBeenCalledWith('roof');
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
});

test('outside dismissal closes without changing the saved selection', () => {
  act(() => { renderer = create(React.createElement(EditorSelect, { label: 'Stage', value: 'seedling', options: [{ value: 'seedling', label: 'Seedling' }], onSelect: select })); });
  openMenu('Stage: Seedling');
  act(() => button('Dismiss stage options').props.onPress());
  expect(select).not.toHaveBeenCalled(); expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  expect(button('Stage: Seedling').props.accessibilityState.expanded).toBe(false);
});
