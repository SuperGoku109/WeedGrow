import { getDeviceLocation } from '../deviceLocation';
import * as Location from 'expo-location';
jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), hasServicesEnabledAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), Accuracy: { Balanced: 3 } }));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('includes the native permission prompt in the overall deadline', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockImplementation(() => new Promise(() => {}));
  const result = getDeviceLocation(new AbortController().signal, jest.fn());
  const assertion = expect(result).rejects.toThrow('15 seconds');
  jest.advanceTimersByTime(15000); await assertion;
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
it('explains disabled device services instead of waiting for a fix', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
  await expect(getDeviceLocation(new AbortController().signal, jest.fn())).rejects.toThrow('services are off');
});
