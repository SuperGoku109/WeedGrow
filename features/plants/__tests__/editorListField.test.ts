import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import EditorListField from '../components/EditorListField';
import { plantThemes } from '../components/plantDetailTheme';
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ useReducedMotion: () => true }));
let renderer: any;
const changed = jest.fn();
const input = () => renderer.root.findByType(TextInput);
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
function text() { return renderer.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' '); }
async function mount(value = '') {
  function Harness() { const [items, setItems] = React.useState(value); return React.createElement(EditorListField, { label: 'Pests recorded', value: items, onChange: (next: string) => { changed(next); setItems(next); }, disabled: false, theme: plantThemes.grove }); }
  await act(async () => { renderer = create(React.createElement(Harness)); });
}
afterEach(() => { act(() => renderer?.unmount()); changed.mockClear(); });

test('shows existing items as readable tags without comma instructions in the input', async () => {
  await mount('Aphids, Spider mites');
  expect(input().props.value).toBe('');
  expect(input().props.placeholder).toBeUndefined();
  expect(text()).toContain('Aphids'); expect(text()).toContain('Spider mites');
  expect(changed).not.toHaveBeenCalled();
});

test('retains typed content for saving before Add and supports adding and removing individual items', async () => {
  await mount('Aphids');
  act(() => input().props.onChangeText('Thrips'));
  expect(changed).toHaveBeenLastCalledWith('Aphids, Thrips');
  act(() => button('Add to pests recorded').props.onPress());
  expect(input().props.value).toBe(''); expect(text()).toContain('Thrips');
  act(() => button('Remove Aphids from pests recorded').props.onPress());
  expect(changed).toHaveBeenLastCalledWith('Thrips'); expect(text()).not.toContain('Aphids');
});

test('handles pasted lists and duplicate entries while retaining the current draft on removal', async () => {
  await mount('Aphids');
  act(() => input().props.onChangeText('aphids, Thrips'));
  act(() => input().props.onSubmitEditing());
  expect(changed).toHaveBeenLastCalledWith('Aphids, Thrips');
  act(() => input().props.onChangeText('Spider mites'));
  act(() => button('Remove Aphids from pests recorded').props.onPress());
  expect(changed).toHaveBeenLastCalledWith('Thrips, Spider mites');
  act(() => input().props.onSubmitEditing());
  expect(input().props.value).toBe(''); expect(text()).toContain('Spider mites');
});

test('restores external draft values and respects disabled controls', async () => {
  await act(async () => { renderer = create(React.createElement(EditorListField, { label: 'Pests recorded', value: 'Aphids', onChange: changed, disabled: false, theme: plantThemes.grove })); });
  await act(async () => renderer.update(React.createElement(EditorListField, { label: 'Pests recorded', value: 'Thrips', onChange: changed, disabled: true, theme: plantThemes.grove })));
  expect(text()).toContain('Thrips'); expect(text()).not.toContain('Aphids');
  expect(input().props.editable).toBe(false);
  expect(button('Remove Thrips from pests recorded').props.disabled).toBe(true);
  expect(button('Add to pests recorded').props.disabled).toBe(true);
});
