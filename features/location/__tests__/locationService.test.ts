import { coordinateLabel, nameForCoordinates, searchPlaces, validCoordinates } from '../locationService';
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { OPENWEATHERMAP_API_KEY: 'test-key' } } } }));
const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; });
it('keeps valid zero coordinates and rejects invalid pins', () => {
  expect(validCoordinates({ lat: 0, lng: 0 })).toBe(true);
  expect(validCoordinates({ lat: NaN, lng: 10 })).toBe(false);
  expect(validCoordinates({ lat: 91, lng: 10 })).toBe(false);
  expect(coordinateLabel({ lat: -33.9, lng: 18.4 })).toBe('-33.90000, 18.40000');
});
it('filters malformed search results and encodes user text', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => [{ name: 'Test Town', country: 'ZA', lat: 0, lon: 0 }, { name: 'Bad coordinates', lat: 91, lon: 0 }, null] });
  expect(await searchPlaces('Test & Town, ZA')).toEqual([{ label: 'Test Town, ZA', lat: 0, lng: 0 }]);
  expect(fetchMock.mock.calls[0][0]).toContain('Test%20%26%20Town%2C%20ZA');
});
it('resolves and caches an area name without replacing the exact pin', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => [{ name: 'Nearby', state: 'Western Cape', country: 'ZA', lat: -34, lon: 18 }] });
  const pin = { lat: -33.123456, lng: 18.123456 };
  expect(await nameForCoordinates(pin)).toBe('Nearby, Western Cape, ZA');
  expect(await nameForCoordinates(pin)).toBe('Nearby, Western Cape, ZA');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(pin).toEqual({ lat: -33.123456, lng: 18.123456 });
});
it('uses coordinates when no area is returned and rejects service errors', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
  expect(await nameForCoordinates({ lat: 1, lng: 2 })).toBe('1.00000, 2.00000');
  fetchMock.mockResolvedValueOnce({ ok: false });
  await expect(searchPlaces('Unavailable unique town')).rejects.toThrow('could not be loaded');
});
