import { getDoc } from 'firebase/firestore';
import { refreshPlantWeather } from '../refreshPlantWeather';
import { fetchWeather } from '../fetchWeather';
import { parseWeatherData } from '../parseWeatherData';
import { updateWeatherCache } from '../updateFirestore';
import { plantDay, addDays } from '@/lib/dates/plantDay';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('firebase/firestore', () => ({ doc: (_db: unknown, ...parts: string[]) => parts.join('/'), getDoc: jest.fn() }));
jest.mock('../fetchWeather', () => ({ fetchWeather: jest.fn() }));
jest.mock('../parseWeatherData', () => ({ parseWeatherData: jest.fn() }));
jest.mock('../updateFirestore', () => ({ updateWeatherCache: jest.fn() }));
const plant = { location: { lat: 1, lng: 2 }, locationRevision: 0 };
beforeEach(() => {
  jest.mocked(getDoc).mockResolvedValue({ data: () => undefined } as never);
  const today = plantDay(); const tomorrow = addDays(today, 1);
  jest.mocked(parseWeatherData).mockReturnValue({ [today]: { date: today, forecasted: false }, [tomorrow]: { date: tomorrow, forecasted: true } } as never);
  jest.mocked(updateWeatherCache).mockResolvedValue({});
});
it('fetches a missing requested forecast even when today is cached', async () => {
  const tomorrow = addDays(plantDay(), 1);
  await refreshPlantWeather('p', plant, false, tomorrow);
  expect(getDoc).toHaveBeenCalledWith(`plants/p/weatherCache/${tomorrow}`);
  expect(fetchWeather).toHaveBeenCalledTimes(1);
});
it('manual refresh bypasses the provider cache', async () => {
  await refreshPlantWeather('p', plant, true);
  expect(fetchWeather).toHaveBeenCalledWith(1, 2, true);
  expect(getDoc).not.toHaveBeenCalled();
});
