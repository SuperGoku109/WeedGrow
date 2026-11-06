import { decodeWeatherResponse } from '../weatherResponse';
import { parseWeatherData } from '../parseWeatherData';
jest.mock('firebase/firestore', () => ({ Timestamp: { fromMillis: (value: number) => ({ toMillis: () => value, toDate: () => new Date(value) }), now: () => ({ seconds: 1, nanoseconds: 0 }) } }));

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

it.each([
  { humidity: 101 }, { humidity: -1 }, { clouds: 101 }, { pop: 1.1 },
  { wind_speed: -1 }, { wind_gust: -1 }, { uvi: -1 }, { rainfall: -1 },
  { rain: -1 }, { rain: { '1h': -1 } }, { snow: { '1h': -1 } },
  { sunrise: 1e20 }, { sunset: -1e20 },
])('rejects out-of-range measurements before caching: %p', fields => {
  expect(() => decodeWeatherResponse({ current: { dt: 1, ...fields } })).toThrow();
});

it.each(['7200', true, Infinity, 1e20, 0.5])('rejects invalid timezone offset %p', timezone_offset => {
  expect(() => decodeWeatherResponse({ timezone_offset })).toThrow('timezone offset');
});

it.each(['1000', true, Infinity, -1, 1e20])('rejects invalid retrieval timestamp %p', _weedgrowFetchedAt => {
  expect(() => decodeWeatherResponse({ _weedgrowFetchedAt })).toThrow('retrieval timestamp');
});
