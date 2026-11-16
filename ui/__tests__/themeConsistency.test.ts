import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { StyleSheet, Text, TextInput } from 'react-native';
import { gardenThemes } from '@/design-system/tokens/garden';
import AppNotice from '../AppNotice';
import { Field } from '@/features/addPlant/components/FlowUI';
import { PendingStatus } from '../LoadingFeedback';
import { EditorField } from '@/features/plants/components/PlantEditorFields';
import { Input } from '@/design-system/components/Input/Input';

let mockTheme = gardenThemes.grove;
jest.mock('@/hooks/useAppTheme', () => ({ useAppTheme: () => mockTheme }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-paper', () => ({ Portal: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let tree: any;
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

it.each(Object.entries(gardenThemes))('%s renders success feedback and fields with its own colors', (_name, theme) => {
  mockTheme = theme;
  act(() => { tree = create(React.createElement(React.Fragment)); });
  // Use createElement because this repository's test files use the .ts extension.
  act(() => tree.update(React.createElement(React.Fragment, null,
    React.createElement(AppNotice, { visible: true, tone: 'success', duration: 0, onDismiss: jest.fn() }, 'Watering logged'),
    React.createElement(Field, { label: 'Plant name', value: 'Basil' }),
    React.createElement(PendingStatus, { label: 'Saving care' }),
    React.createElement(EditorField, { label: 'Soil pH', value: '6' }),
    React.createElement(Input, { accessibilityLabel: 'Legacy reading', value: '7' }),
  )));
  const notice = StyleSheet.flatten(tree.root.findByProps({ testID: 'app-notice' }).props.style);
  expect(notice).toMatchObject({ backgroundColor: theme.surface, borderColor: theme.border });
  const message = tree.root.findAllByType(Text).find((node: any) => node.props.children === 'Watering logged');
  expect(StyleSheet.flatten(message.props.style).color).toBe(theme.text);
  const field = tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Plant name');
  expect(StyleSheet.flatten(field.props.style)).toMatchObject({ backgroundColor: theme.background, color: theme.text });
  act(() => field.props.onFocus({}));
  expect(StyleSheet.flatten(field.props.style)).toMatchObject({ backgroundColor: theme.elevated, borderColor: theme.accent });
  for (const label of ['Soil pH', 'Legacy reading']) {
    const input = tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label);
    expect(StyleSheet.flatten(input.props.style).color).toBe(theme.text);
    expect(input.props.placeholderTextColor).toBe(theme.muted);
  }
});

it('updates an already visible watering notice when appearance changes', () => {
  mockTheme = gardenThemes.grove;
  const render = () => React.createElement(AppNotice, { visible: true, duration: 0, onDismiss: jest.fn() }, 'Watering logged');
  act(() => { tree = create(render()); });
  mockTheme = gardenThemes.daylight;
  act(() => tree.update(render()));
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'app-notice' }).props.style).backgroundColor).toBe(gardenThemes.daylight.surface);
});
