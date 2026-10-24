import React from 'react';
// @ts-expect-error Jest Expo includes the renderer without TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { useDiscardGuard } from '../useDiscardGuard';
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), usePreventRemove: jest.fn() }));
jest.mock('../ActionDialog', () => () => null);
it('keeps edited forms open until discard is confirmed', async () => {
  let guard!: ReturnType<typeof useDiscardGuard>; const leave = jest.fn();
  function Probe() { guard = useDiscardGuard(true); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe)); });
  act(() => guard.requestClose(leave)); expect(leave).not.toHaveBeenCalled(); expect(guard.dialog).not.toBeNull();
  act(() => guard.dialog!.props.onClose()); expect(leave).not.toHaveBeenCalled();
  act(() => guard.requestClose(leave));
  await act(async () => guard.dialog!.props.onConfirm()); expect(leave).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
});
it('successful save exits without asking to discard saved changes', () => {
  let guard!: ReturnType<typeof useDiscardGuard>; const leave = jest.fn();
  function Probe() { guard = useDiscardGuard(true); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe)); });
  act(() => guard.finish(leave)); expect(leave).toHaveBeenCalledTimes(1); expect(guard.dialog).toBeNull();
  act(() => renderer.unmount());
});
