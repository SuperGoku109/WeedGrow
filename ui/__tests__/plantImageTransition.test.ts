import React from 'react';
import { Image } from 'react-native';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import PlantImageTransitionProvider, { usePlantImageTransition } from '../PlantImageTransition';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('../PlantCoverFade', () => () => null);
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  __esModule: true,
  default: { View: 'View', Image: 'Image' },
}));
jest.mock('react-native/Libraries/Components/View/View', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = React.forwardRef(function MeasurableView(props, ref) {
    return React.createElement('View', { ...props, ref });
  });
  return { __esModule: true, default: View };
});

const uri = 'https://example.test/plant.jpg';
const frame = { x: 10, y: 140, width: 100, height: 80 };
let transition: ReturnType<typeof usePlantImageTransition>;
let tree: ReturnType<typeof create>;
const measureInWindow = jest.fn((callback: (x: number, y: number) => void) => callback(0, 0));

function Probe() {
  transition = usePlantImageTransition();
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  act(() => {
    tree = create(React.createElement(PlantImageTransitionProvider, null, React.createElement(Probe)), {
      createNodeMock: () => ({ measureInWindow }),
    });
  });
});

afterEach(() => {
  act(() => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function overlayImage() {
  return tree.root.findAll((node: { props: { source?: { uri: string }; onLoad?: () => void } }) =>
    node.props.source?.uri === uri && typeof node.props.onLoad === 'function')[0];
}

it('keeps the source screen available until its overlay image can take over', () => {
  const getSize = jest.spyOn(Image, 'getSize');
  const navigate = jest.fn();
  act(() => transition.start('plant', uri, frame, navigate));
  expect(transition.preparing).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  act(() => overlayImage().props.onLoad({ nativeEvent: { source: { width: 800, height: 600 } } }));
  expect(getSize).not.toHaveBeenCalled();
  expect(measureInWindow).toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(20));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(transition.preparing).toBe(false);
  expect(transition.previewUri).toBe(uri);
});

it('falls back to ordinary navigation when the photo stalls and ignores a late load', () => {
  const navigate = jest.fn();
  act(() => transition.start('plant', uri, frame, navigate));
  const lateLoad = overlayImage().props.onLoad;
  act(() => jest.advanceTimersByTime(510));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(transition.active).toBe(false);
  expect(transition.contentReady).toBe(true);
  act(() => { lateLoad(); jest.advanceTimersByTime(20); });
  expect(navigate).toHaveBeenCalledTimes(1);
});
