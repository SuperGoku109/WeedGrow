import { getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { refreshGardenWeather } from '../refreshGardenWeather';
import { fetchWeather } from '../fetchWeather';
import { parseWeatherData } from '../parseWeatherData';
import { plantDay } from '@/lib/dates/plantDay';

jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('../fetchWeather', () => ({ fetchWeather: jest.fn() }));
jest.mock('../parseWeatherData', () => ({ parseWeatherData: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...path) => ({ path: path.join('/') })), getDoc: jest.fn(), runTransaction: jest.fn(),
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));
const location = { lat: -26, lng: 28 };
const today = plantDay(new Date(), 'Africa/Johannesburg');
const garden = { createdBy: 'owner', location, locationLabel: 'Patio', plantIds: [] };
const live = { date: today, forecasted: false, timeZone: 'Africa/Johannesburg', fetchedAt: Timestamp.now(), temperature: 20, humidity: 60, source: 'OpenWeatherMap' };
function setup(current = garden, old?: unknown) {
  jest.mocked(getDoc).mockResolvedValue({ data: () => garden } as never);
  jest.mocked(parseWeatherData).mockReturnValue({ [today]: live } as never);
  const set = jest.fn(); const update = jest.fn();
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async (ref: { path: string }) => ({ data: () => ref.path.includes('weatherCache') ? old : current }), set, update } as never));
  return { set, update };
}
it('saves weather for an empty garden and updates its current conditions', async () => {
  const { set, update } = setup();
  await refreshGardenWeather('empty');
  expect(fetchWeather).toHaveBeenCalledWith(-26, 28, false);
  expect(set).toHaveBeenCalledWith({ path: `groups/empty/weatherCache/${today}` }, expect.objectContaining({ sourceCoordinates: location, temperature: 20 }));
  expect(update).toHaveBeenCalledWith({ path: 'groups/empty' }, expect.objectContaining({ currentWeather: expect.objectContaining({ date: today }) }));
});
it('does not fetch again while current weather at the same pin is fresh', async () => {
  setup();
  jest.mocked(getDoc).mockResolvedValue({ data: () => ({ ...garden, currentWeather: { ...live, sourceCoordinates: location } }) } as never);
  await refreshGardenWeather('fresh');
  expect(fetchWeather).not.toHaveBeenCalled();
  expect(runTransaction).not.toHaveBeenCalled();
});
it('rejects a stale response when the garden pin changed', async () => {
  const { set, update } = setup({ ...garden, location: { lat: 1, lng: 2 } });
  await expect(refreshGardenWeather('moving')).rejects.toThrow('location changed');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
it('keeps earlier same-day locations and never rewrites yesterday', async () => {
  const yesterday = '2000-01-01';
  const prior = { ...live, sourceCoordinates: { lat: 1, lng: 2 } };
  const { set } = setup(garden, prior);
  jest.mocked(parseWeatherData).mockReturnValue({ [today]: live, [yesterday]: { ...live, date: yesterday } } as never);
  await refreshGardenWeather('history');
  expect(set).toHaveBeenCalledTimes(1);
  expect(set.mock.calls[0][1].previousLocations).toEqual([prior]);
});
it('does not fetch weather for another account or a legacy garden without a pin', async () => {
  setup();
  jest.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ ...garden, createdBy: 'someone-else' }) } as never);
  await expect(refreshGardenWeather('foreign')).rejects.toThrow('unavailable');
  jest.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ ...garden, location: null }) } as never);
  await refreshGardenWeather('legacy');
  expect(fetchWeather).not.toHaveBeenCalled();
});
