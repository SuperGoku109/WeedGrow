import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import AppNotice from '../AppNotice';
import AnimatedModal from '../AnimatedModal';

let mockReduced = true;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native-paper', () => ({ Portal: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 16, left: 0, right: 0 }) }));
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(() => { jest.useFakeTimers(); mockReduced = true; });
afterEach(() => { act(() => tree?.unmount()); jest.clearAllTimers(); jest.useRealTimers(); });

it('dismisses timed feedback once, including when the parent supplies a fresh callback', () => {
  const dismiss = jest.fn();
  act(() => { tree = create(React.createElement(AppNotice, { visible: true, onDismiss: dismiss, duration: 1000 }, 'Saved')); });
  act(() => jest.advanceTimersByTime(600));
  act(() => tree.update(React.createElement(AppNotice, { visible: true, onDismiss: () => dismiss(), duration: 1000 }, 'Saved')));
  act(() => jest.advanceTimersByTime(400));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it('keeps Undo available, locks duplicate submissions, and pauses dismissal while it is running', async () => {
  let resolve!: () => void;
  const action = jest.fn(() => new Promise<void>(done => { resolve = done; }));
  const dismiss = jest.fn();
  act(() => { tree = create(React.createElement(AppNotice, { visible: true, onDismiss: dismiss, duration: 1000, action: { label: 'Undo', onPress: action } }, 'Watering logged')); });
  let pending: Promise<void>;
  act(() => { const undo = button('Undo'); pending = undo.props.onPress(); void undo.props.onPress(); });
  expect(action).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(5000));
  expect(dismiss).not.toHaveBeenCalled();
  await act(async () => { resolve(); await pending; });
  act(() => jest.advanceTimersByTime(1000));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it('keeps a failed action visible with an accessible retry rather than announcing success', async () => {
  const action = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined);
  const dismiss = jest.fn();
  act(() => { tree = create(React.createElement(AppNotice, { visible: true, onDismiss: dismiss, action: { label: 'Undo', onPress: action } }, 'Watering logged')); });
  await act(async () => button('Undo').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Could not complete that action');
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' }).length).toBeGreaterThan(0);
  act(() => jest.advanceTimersByTime(10000));
  expect(dismiss).not.toHaveBeenCalled();
  await act(async () => button('Retry Undo').props.onPress());
  expect(action).toHaveBeenCalledTimes(2);
});

it('retains feedback text through its exit and then removes it', () => {
  mockReduced = false;
  const dismiss = jest.fn();
  act(() => { tree = create(React.createElement(AppNotice, { visible: true, onDismiss: dismiss }, 'Watering logged')); });
  act(() => jest.advanceTimersByTime(300));
  act(() => tree.update(React.createElement(AppNotice, { visible: false, onDismiss: dismiss }, '')));
  expect(JSON.stringify(tree.toJSON())).toContain('Watering logged');
  act(() => jest.advanceTimersByTime(300));
  expect(tree.toJSON()).toBeNull();
});

it('keeps an explicit error visible until the user dismisses it', () => {
  const dismiss = jest.fn();
  act(() => { tree = create(React.createElement(AppNotice, { visible: true, tone: 'error', onDismiss: dismiss, duration: 1000 }, 'Could not undo watering')); });
  act(() => jest.advanceTimersByTime(10000));
  expect(dismiss).not.toHaveBeenCalled();
  act(() => button('Dismiss notification').props.onPress());
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it('lets a draft guard decline a sheet close without hiding or locking the editor', () => {
  const guard = jest.fn();
  // eslint-disable-next-line react/no-children-prop -- The modal takes a render function, not ordinary children.
  act(() => { tree = create(React.createElement(AnimatedModal, { onClose: guard, children: () => React.createElement(Text, null, 'Unsaved details') })); });
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(guard).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Text).props.children).toBe('Unsaved details');
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(guard).toHaveBeenCalledTimes(2);
});

it('blocks hardware dismissal during a save but allows its successful completion to close the dialog', () => {
  const close = jest.fn();
  let finish!: () => void;
  // eslint-disable-next-line react/no-children-prop -- The modal takes a render function, not ordinary children.
  act(() => { tree = create(React.createElement(AnimatedModal, { disabled: true, deferClose: true, onClose: close, children: dismiss => { finish = dismiss; return React.createElement(Text, null, 'Saving'); } })); });
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(close).not.toHaveBeenCalled();
  act(() => finish());
  expect(close).toHaveBeenCalledTimes(1);
});

it('finishes an animated dismissal once, even after repeated close requests', () => {
  mockReduced = false;
  const close = jest.fn();
  // eslint-disable-next-line react/no-children-prop -- The modal takes a render function, not ordinary children.
  act(() => { tree = create(React.createElement(AnimatedModal, { deferClose: true, onClose: close, children: () => React.createElement(Text, null, 'Dialog') })); });
  act(() => { tree.root.findByType(Modal).props.onRequestClose(); tree.root.findByType(Modal).props.onRequestClose(); });
  expect(close).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(400));
  expect(close).toHaveBeenCalledTimes(1);
});
