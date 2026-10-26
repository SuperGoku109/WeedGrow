import { decodeWeatherResponse } from '../weatherResponse';
import { parseWeatherData } from '../parseWeatherData';
jest.mock('firebase/firestore', () => ({ Timestamp: { now: () => ({ seconds: 1, nanoseconds: 0 }) } }));

it('rejects malformed measurements and dates before caching weather', () => {
  expect(() => decodeWeatherResponse({ current: { dt: 1, humidity: '55' } })).toThrow('measurement');
  expect(() => decodeWeatherResponse({ current: { dt: 1e20 } })).toThrow('date');
  expect(() => decodeWeatherResponse({ current: { dt: 1, snow: 4 } })).toThrow('snowfall');
  expect(() => decodeWeatherResponse({ hourly: Array(169).fill({ dt: 1 }) })).toThrow('window');
});

it('does not manufacture conditions or save an infinite hourly peak from incomplete samples', () => {
  expect(() => parseWeatherData({ current: { dt: 1, temp: 20 } })).toThrow('required conditions');
  const result = parseWeatherData({ current: { dt: 1, temp: 20, humidity: 55, wind_speed: 2, uvi: 1 }, hourly: [{ dt: 1, humidity: 60 }] });
  expect(result['1970-01-01'].temperature).toBe(20);
  expect(result['1970-01-01'].hourlySummary).toBeUndefined();
});
