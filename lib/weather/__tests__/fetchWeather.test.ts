import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWeather, readCachedWeatherResponse } from '../fetchWeather';
import { meteoFixture } from './meteoFixture';
beforeEach(async () => { await AsyncStorage.clear(); });
const response = () => ({ ok: true, json: async () => meteoFixture() }) as Response;
test('shares a location response, requests Open-Meteo without a key, and refreshes on demand', async () => {
  const request = jest.spyOn(global, 'fetch').mockImplementation(async () => response());
  const first = await fetchWeather(-34, 18); const second = await fetchWeather(-34, 18);
  expect(request).toHaveBeenCalledTimes(1); expect(second._weedgrowFetchedAt).toBe(first._weedgrowFetchedAt);
  const url = new URL(String(request.mock.calls[0][0]));
  expect(url.hostname).toBe('api.open-meteo.com'); expect(url.searchParams.has('appid')).toBe(false); expect(url.searchParams.has('apikey')).toBe(false);
  expect(url.searchParams.get('wind_speed_unit')).toBe('ms'); expect(url.searchParams.get('hourly')).toContain('et0_fao_evapotranspiration');
  await fetchWeather(-34, 18, true); expect(request).toHaveBeenCalledTimes(2);
});
test('coalesces simultaneous same-location network requests', async () => {
  const request = jest.spyOn(global, 'fetch').mockImplementation(async () => response());
  await Promise.all([fetchWeather(1, 2), fetchWeather(1, 2), fetchWeather(1, 2)]);
  expect(request).toHaveBeenCalledTimes(1);
});
test('care reads cached native weather without another request; old provider cache is ignored', async () => {
  const request = jest.spyOn(global, 'fetch').mockImplementation(async () => response());
  await AsyncStorage.setItem('weedgrow.weather.v1.1:2', JSON.stringify({ savedAt: Date.now(), value: { current: { dt: 1, temp: 12 } } }));
  expect(await readCachedWeatherResponse(1, 2)).toBeUndefined();
  await fetchWeather(1, 2);
  expect((await readCachedWeatherResponse(1, 2))?._weedgrowMeteo?.hourly.time).toHaveLength(120);
  expect(request).toHaveBeenCalledTimes(1);
});
test('failed/rate-limited responses are specific and never cached as weather', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response);
  await expect(fetchWeather(1, 2)).rejects.toThrow('free weather request limit');
  expect(await readCachedWeatherResponse(1, 2)).toBeUndefined(); expect(request).toHaveBeenCalledTimes(1);
});
test('invalid coordinates are rejected before any request', async () => {
  const request = jest.spyOn(global, 'fetch');
  await expect(fetchWeather(NaN, 2)).rejects.toThrow('location'); expect(request).not.toHaveBeenCalled();
});
