import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWeather } from '../fetchWeather';
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { OPENWEATHERMAP_API_KEY: 'test-only-key' } } } }));
beforeEach(async () => { await AsyncStorage.clear(); });
it('reuses a location response across sequential plant requests but refreshes on demand', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ current: { dt: 1792526400, temp: 20 }, timezone: 'Africa/Johannesburg' }) } as Response);
  const first = await fetchWeather(-33, 18);
  const second = await fetchWeather(-33, 18);
  expect(request).toHaveBeenCalledTimes(1);
  expect(second._weedgrowFetchedAt).toBe(first._weedgrowFetchedAt);
  await fetchWeather(-33, 18, true);
  expect(request).toHaveBeenCalledTimes(2);
});
it('coalesces concurrent requests for the same pin', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ current: { dt: 1792526400, temp: 20 } }) } as Response);
  await Promise.all([fetchWeather(1, 2), fetchWeather(1, 2), fetchWeather(1, 2)]);
  expect(request).toHaveBeenCalledTimes(1);
});
