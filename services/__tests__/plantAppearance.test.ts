import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPlantAppearance, savePlantAppearance, subscribePlantAppearance } from '../plantAppearance';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
it.each(['grove', 'daylight', 'ocean', 'dusk'] as const)('remembers the %s theme and notifies after saving', async value => {
  const listener = jest.fn(), unsubscribe = subscribePlantAppearance(listener);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  await savePlantAppearance(value);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('weedgrow.plant-theme', value);
  expect(listener).toHaveBeenCalledTimes(1);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(value);
  expect(await readPlantAppearance()).toBe(value);
  unsubscribe();
});
it('falls back for unknown saved themes and does not publish a failed save', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('unavailable');
  expect(await readPlantAppearance()).toBe('grove');
  const listener = jest.fn(), unsubscribe = subscribePlantAppearance(listener);
  jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Full storage'));
  await expect(savePlantAppearance('ocean')).rejects.toThrow('Full storage');
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});
