import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import RouteTransition from '../RouteTransition';

let mockPath = '/';
let mockReduced = false;
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));
const originalOS = Platform.OS;
let tree: any;
beforeEach(() => { jest.useFakeTimers(); Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true }); mockPath = '/'; mockReduced = false; });
afterEach(() => { act(() => tree?.unmount()); jest.clearAllTimers(); jest.useRealTimers(); Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }); });

it('keeps an opaque backdrop while route content fades and survives an interrupted transition', () => {
  const unmount = jest.fn();
  function Content() { React.useEffect(() => unmount, []); return React.createElement(Text, null, 'Plant'); }
  const render = () => React.createElement(RouteTransition, null, React.createElement(Content));
  act(() => { tree = create(render()); });
  const backdrop = () => tree.root.findAllByProps({ testID: 'route-backdrop' })[0];
  const contentOpacity = () => tree.root.findAll((node: any) => node.props.style && StyleSheet.flatten(node.props.style)?.opacity instanceof Animated.Value)[0].props.style.opacity;
  mockPath = '/plant/one';
  act(() => tree.update(render()));
  expect(contentOpacity().__getValue()).toBe(0);
  expect(StyleSheet.flatten(backdrop().props.style)).toEqual({ flex: 1, backgroundColor: '#15231c' });
  mockPath = '/plant/one/growth';
  act(() => { jest.advanceTimersByTime(60); tree.update(render()); });
  expect(StyleSheet.flatten(backdrop().props.style).opacity).toBeUndefined();
  act(() => jest.advanceTimersByTime(400));
  expect(contentOpacity().__getValue()).toBe(1);
  expect(unmount).not.toHaveBeenCalled();
});

it('leaves tab fades to the tab navigator and skips route motion with Reduce Motion', () => {
  const render = () => React.createElement(RouteTransition, null, React.createElement(Text, null, 'Content'));
  act(() => { tree = create(render()); });
  mockPath = '/profiles';
  act(() => tree.update(render()));
  const opacity = () => tree.root.findAll((node: any) => node.props.style && StyleSheet.flatten(node.props.style)?.opacity instanceof Animated.Value)[0].props.style.opacity.__getValue();
  expect(opacity()).toBe(1);
  mockReduced = true; mockPath = '/plant/one';
  act(() => tree.update(render()));
  expect(opacity()).toBe(1);
});
