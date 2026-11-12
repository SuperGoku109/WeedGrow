import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Animated, Text, View } from 'react-native';
import { GrowCollapse, GrowConfirm, GrowPress, usePressMotion, useSelectionIndicator } from '../GrowMotion';

let mockReduced = false;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));
beforeEach(() => { jest.useFakeTimers(); mockReduced = false; });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('runs the action immediately without waiting for the press animation', () => {
  const action = jest.fn();
  let tree: any;
  act(() => { tree = create(React.createElement(GrowPress, { onPress: action }, 'Save')); });
  const control = tree.root.findAll((node: any) => typeof node.props.onPressIn === 'function' && typeof node.props.onPress === 'function')[0];
  act(() => { control.props.onPressIn({}); control.props.onPress({}); });
  expect(action).toHaveBeenCalledTimes(1);
  act(() => { control.props.onPressOut({}); tree.unmount(); });
});

it('resets a pressed control when it becomes disabled or Reduce Motion is enabled', () => {
  let motion: ReturnType<typeof usePressMotion>;
  function Probe({ disabled = false }) { motion = usePressMotion(disabled); return null; }
  let tree: any;
  act(() => { tree = create(React.createElement(Probe)); });
  act(() => { motion!.pressIn(); jest.advanceTimersByTime(150); });
  act(() => { tree.update(React.createElement(Probe, { disabled: true })); });
  expect((motion!.style.transform[0].scale as any).__getValue()).toBe(1);
  mockReduced = true;
  act(() => { tree.update(React.createElement(Probe)); motion!.pressIn(); });
  expect((motion!.style.transform[0].scale as any).__getValue()).toBe(1);
  act(() => tree.unmount());
});

it('hides closing details from accessibility immediately and survives a rapid reopen', () => {
  let tree: any;
  const render = (open: boolean) => React.createElement(GrowCollapse, { open }, React.createElement(Text, null, 'Details'));
  act(() => { tree = create(render(true)); });
  const measure = tree.root.findAllByType(View).find((node: any) => node.props.onLayout);
  act(() => measure.props.onLayout({ nativeEvent: { layout: { height: 120 } } }));
  act(() => jest.advanceTimersByTime(300));
  act(() => tree.update(render(false)));
  expect(tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThan(0);
  act(() => { jest.advanceTimersByTime(50); tree.update(render(true)); });
  act(() => jest.advanceTimersByTime(500));
  expect(tree.root.findByType(Text).props.children).toBe('Details');
  act(() => tree.unmount());
});

it('shows and removes details immediately with Reduce Motion, without losing their contents', () => {
  mockReduced = true;
  let tree: any;
  const render = (open: boolean) => React.createElement(GrowCollapse, { open }, React.createElement(Text, null, 'Details'));
  act(() => { tree = create(render(false)); });
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  act(() => tree.update(render(true)));
  expect(tree.root.findByType(Text).props.children).toBe('Details');
  act(() => tree.update(render(false)));
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  act(() => tree.unmount());
});

it('uses measured positions for selection, including unequal widths and a right-to-left order', () => {
  mockReduced = true;
  let selection: ReturnType<typeof useSelectionIndicator>;
  function Probe({ selected }: { selected: string }) { selection = useSelectionIndicator(selected); return null; }
  let tree: any;
  act(() => { tree = create(React.createElement(Probe, { selected: 'first' })); });
  act(() => {
    selection!.onItemLayout('first', { nativeEvent: { layout: { x: 180, width: 96 } } } as any);
    selection!.onItemLayout('second', { nativeEvent: { layout: { x: 4, width: 172 } } } as any);
  });
  act(() => tree.update(React.createElement(Probe, { selected: 'second' })));
  expect((selection!.indicatorStyle.transform[0].translateX as any).__getValue()).toBe(4);
  expect((selection!.indicatorStyle.width as any).__getValue()).toBe(172);
  act(() => tree.unmount());
});

it('only celebrates a newly confirmed action, never historical data or reduced-motion changes', () => {
  const spring = jest.spyOn(Animated, 'spring');
  let tree: any;
  const render = (confirmed: boolean) => React.createElement(GrowConfirm, { confirmed }, React.createElement(Text, null, 'Saved'));
  act(() => { tree = create(render(true)); });
  expect(spring).not.toHaveBeenCalled();
  act(() => tree.update(render(false)));
  act(() => tree.update(render(true)));
  expect(spring).toHaveBeenCalledTimes(1);
  act(() => tree.update(render(true)));
  expect(spring).toHaveBeenCalledTimes(1);
  mockReduced = true;
  act(() => tree.update(render(false)));
  act(() => tree.update(render(true)));
  expect(spring).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
