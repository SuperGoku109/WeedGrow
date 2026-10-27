import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import AnchoredActionMenu, { menuPosition } from '../AnchoredActionMenu';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../GrowMotion', () => ({ useReducedMotion: () => true, GrowPress: jest.requireActual('react-native').Pressable }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 16, left: 0, right: 0 }) }));
it('opens below an upper trigger while keeping the menu within phone edges', () => {
  const p = menuPosition({ x: 266, y: 80, width: 48, height: 48 }, 320, 740, 270, 20, 16);
  expect(p.opensBelow).toBe(true); expect(p.top).toBe(138);
  expect(p.left).toBeGreaterThanOrEqual(12); expect(p.left + p.width).toBeLessThanOrEqual(308);
});
it('flips above a low trigger and respects safe areas', () => {
  const p = menuPosition({ x: 300, y: 700, width: 48, height: 48 }, 390, 844, 160, 24, 34);
  expect(p.opensBelow).toBe(false); expect(p.top).toBe(530); expect(p.maxHeight).toBeGreaterThanOrEqual(160);
});
it('constrains long menus to the larger available side', () => {
  const p = menuPosition({ x: 250, y: 320, width: 48, height: 48 }, 320, 600, 900, 20, 24);
  expect(p.opensBelow).toBe(false); expect(p.top).toBe(28); expect(p.maxHeight).toBe(282);
});
it('dismisses before invoking a selected action and does not invoke actions on outside dismissal', () => {
  const events: string[] = [];
  let renderer: any;
  act(() => { renderer = create(React.createElement(AnchoredActionMenu, { anchor: { x: 200, y: 100, width: 48, height: 48 }, title: 'Garden', onClose: () => events.push('close'), actions: [{ label: 'Garden settings', icon: 'tune-variant', onPress: () => events.push('settings') }] })); });
  const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  act(() => button('Dismiss options').props.onPress()); expect(events).toEqual(['close']);
  events.length = 0;
  act(() => button('Garden settings').props.onPress()); expect(events).toEqual(['close', 'settings']);
  act(() => renderer.unmount());
});
