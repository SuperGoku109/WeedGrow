import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { EditorSelect } from '../components/PlantEditorFields';
import EditorPotSize from '../components/EditorPotSize';
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ useReducedMotion: () => true }));
let renderer: any;
const select = jest.fn();
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
afterEach(() => { act(() => renderer?.unmount()); select.mockClear(); });
test('selection expands in place, supports an empty value and closes after choosing', () => {
  act(() => { renderer = create(React.createElement(EditorSelect, { label: 'Routine', value: 'weekly', options: [{ value: '', label: 'Not specified' }, { value: 'weekly', label: 'Weekly' }], onSelect: select })); });
  act(() => button('Routine: Weekly').props.onPress());
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  expect(button('Routine: Weekly').props.accessibilityState.expanded).toBe(true);
  act(() => button('Not specified').props.onPress());
  expect(select).toHaveBeenCalledWith(''); expect(button('Routine: Weekly').props.accessibilityState.expanded).toBe(false);
});
test('opening custom pot size preserves the value until a different size is chosen', () => {
  act(() => { renderer = create(React.createElement(EditorPotSize, { value: '3 gallons', onChange: select, disabled: false })); });
  expect(renderer.root.findByType(TextInput).props.value).toBe('3 gallons');
  act(() => button('Pot size: Custom size').props.onPress());
  expect(select).not.toHaveBeenCalled();
  act(() => button('10L').props.onPress());
  expect(select).toHaveBeenCalledWith('10L');
});
test('disabling a selector closes its menu', () => {
  const props = { label: 'Stage', value: 'seedling', options: [{ value: 'seedling', label: 'Seedling' }], onSelect: select };
  act(() => { renderer = create(React.createElement(EditorSelect, props)); });
  act(() => button('Stage: Seedling').props.onPress());
  act(() => renderer.update(React.createElement(EditorSelect, { ...props, disabled: true })));
  expect(button('Stage: Seedling').props.accessibilityState.expanded).toBe(false);
});
