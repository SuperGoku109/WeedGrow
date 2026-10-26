import React from 'react';
// @ts-expect-error Jest Expo includes the renderer without TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import type { WeatherResponse } from '@/lib/weather/weatherResponse';
import { useGroupWeather } from '../hooks/useGroupWeather';
jest.mock('@/lib/weather/fetchWeather', () => ({ fetchWeather: jest.fn() }));
it('ignores a late response for the location a space moved away from', async () => {
  let first!: (data: WeatherResponse) => void; let second!: (data: WeatherResponse) => void;
  jest.mocked(fetchWeather).mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  let current!: ReturnType<typeof useGroupWeather>;
  function Probe({ lat }: { lat?: number }) { current = useGroupWeather(lat, 18); return null; }
  let renderer: any; act(() => { renderer = create(React.createElement(Probe, { lat: 1 })); });
  act(() => renderer.update(React.createElement(Probe, { lat: 2 })));
  await act(async () => second({ current: { dt: 1, temp: 25, humidity: 70 } }));
  await act(async () => first({ current: { dt: 1, temp: 5, humidity: 20 } }));
  expect(current.weather?.temperature).toBe(25);
  act(() => renderer.update(React.createElement(Probe, {})));
  expect(current.weather).toBeNull(); expect(current.loading).toBe(false);
  act(() => renderer.unmount());
});
