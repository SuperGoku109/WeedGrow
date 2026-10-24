import React from 'react';
// @ts-expect-error Jest Expo includes the renderer without its TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { nameForCoordinates, searchPlaces } from '../locationService';
import { useLocationPicker } from '../useLocationPicker';
import { getDeviceLocation } from '../deviceLocation';
jest.mock('../deviceLocation', () => ({ getDeviceLocation: jest.fn() }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), Accuracy: { Balanced: 3 } }));
jest.mock('../locationService', () => ({ ...jest.requireActual('../locationService'), nameForCoordinates: jest.fn(), searchPlaces: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('ignores slow names from an older pin and preserves exact coordinates', async () => {
  const changed = jest.fn();
  let resolveOld!: (name: string) => void;
  jest.mocked(nameForCoordinates).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce('New area');
  let picker!: ReturnType<typeof useLocationPicker>;
  function Probe() { picker = useLocationPicker(null, '', changed); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => picker.selectPin({ lat: 1, lng: 2 }));
  await act(async () => { jest.advanceTimersByTime(450); });
  act(() => picker.selectPin({ lat: 3.123456, lng: 4.123456 }));
  await act(async () => { jest.advanceTimersByTime(450); });
  await act(async () => resolveOld('Old area'));
  expect(changed).toHaveBeenLastCalledWith({ lat: 3.123456, lng: 4.123456 }, 'New area');
  expect(picker.query).toBe('New area');
  act(() => renderer.unmount());
});
it('shows a device error without replacing an existing pin', async () => {
  jest.mocked(getDeviceLocation).mockRejectedValueOnce(new Error('Location access was blocked.'));
  const changed = jest.fn(); let picker!: ReturnType<typeof useLocationPicker>;
  function Probe() { picker = useLocationPicker({ lat: 1, lng: 2 }, 'Existing area', changed); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  await act(async () => picker.locate());
  expect(picker.busy).toBe(''); expect(picker.error).toContain('blocked');
  expect(picker.query).toBe('Existing area'); expect(changed).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
it('cancel releases device loading and ignores late device results', async () => {
  let resolve!: (value: any) => void;
  jest.mocked(getDeviceLocation).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const changed = jest.fn(); let picker!: ReturnType<typeof useLocationPicker>;
  function Probe() { picker = useLocationPicker(null, '', changed); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => { void picker.locate(); }); expect(picker.busy).toBe('gps');
  act(() => picker.cancelAction()); expect(picker.busy).toBe('');
  await act(async () => resolve({ coords: { lat: 3, lng: 4 }, accuracy: 50 }));
  expect(changed).not.toHaveBeenCalled(); expect(picker.notice).toContain('Cancelled');
  act(() => renderer.unmount());
});
it('device success places the pin immediately and exposes reported accuracy', async () => {
  jest.mocked(getDeviceLocation).mockResolvedValueOnce({ coords: { lat: -33.9, lng: 18.4 }, accuracy: 800 });
  jest.mocked(nameForCoordinates).mockResolvedValueOnce('Cape Town');
  const changed = jest.fn(); let picker!: ReturnType<typeof useLocationPicker>;
  function Probe() { picker = useLocationPicker(null, '', changed); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  await act(async () => picker.locate());
  expect(changed).toHaveBeenLastCalledWith({ lat: -33.9, lng: 18.4 }, '-33.90000, 18.40000');
  expect(picker.accuracy).toBe(800); expect(picker.busy).toBe('name');
  await act(async () => { jest.advanceTimersByTime(450); });
  expect(changed).toHaveBeenLastCalledWith({ lat: -33.9, lng: 18.4 }, 'Cape Town');
  act(() => renderer.unmount());
});
it('clearing a location cancels an in-flight search and its late results', async () => {
  const changed = jest.fn(); let resolve!: (places: any[]) => void;
  jest.mocked(searchPlaces).mockImplementation(() => new Promise(done => { resolve = done; }));
  let picker!: ReturnType<typeof useLocationPicker>;
  function Probe() { picker = useLocationPicker(null, '', changed); return null; }
  let renderer: any;
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => picker.changeQuery('Cape Town'));
  act(() => { void picker.search(); });
  act(() => picker.clear());
  await act(async () => resolve([{ label: 'Old', lat: 1, lng: 2 }]));
  expect(picker.query).toBe(''); expect(picker.results).toEqual([]);
  expect(changed).toHaveBeenLastCalledWith(null, '');
  act(() => renderer.unmount());
});
