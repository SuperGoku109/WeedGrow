import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from '../useReducedMotion';
jest.mock('react-native', () => ({ AccessibilityInfo: { isReduceMotionEnabled: jest.fn(), addEventListener: jest.fn() } }));
it('shares one native observer across consumers and releases it when unused', async () => {
  const remove = jest.fn(); let update!: (value: boolean) => void;
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  jest.mocked(AccessibilityInfo.addEventListener).mockReturnValue({ remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  const values: boolean[] = [];
  function Probe({ index }: { index: number }) { values[index] = useReducedMotion(); return null; }
  let renderer: any; await act(async () => { renderer = create(React.createElement(React.Fragment, null, React.createElement(Probe, { index: 0 }), React.createElement(Probe, { index: 1 }))); });
  expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  update = jest.mocked(AccessibilityInfo.addEventListener).mock.calls[0][1] as unknown as (value: boolean) => void;
  act(() => update(true)); expect(values).toEqual([true, true]);
  act(() => renderer.unmount()); expect(remove).toHaveBeenCalledTimes(1);
});
