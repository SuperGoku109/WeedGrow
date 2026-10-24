import { getDeviceLocation } from '../deviceLocation.web';
jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));
const getPosition = jest.fn();
const previousSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
const previousGeo = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => {
  if (previousSecure) Object.defineProperty(window, 'isSecureContext', previousSecure); else Reflect.deleteProperty(window, 'isSecureContext');
  if (previousGeo) Object.defineProperty(navigator, 'geolocation', previousGeo); else Reflect.deleteProperty(navigator, 'geolocation');
});
it('times out even when the browser never answers a permission or position request', async () => {
  getPosition.mockImplementation(() => {});
  const result = getDeviceLocation(new AbortController().signal, jest.fn());
  const assertion = expect(result).rejects.toThrow('15 seconds');
  jest.advanceTimersByTime(15000); await assertion;
});
it('requests the position once and returns valid zero coordinates', async () => {
  getPosition.mockImplementation(success => success({ coords: { latitude: 0, longitude: 0, accuracy: 1200 } }));
  await expect(getDeviceLocation(new AbortController().signal, jest.fn())).resolves.toEqual({ coords: { lat: 0, lng: 0 }, accuracy: 1200 });
  expect(getPosition).toHaveBeenCalledTimes(1);
  expect(getPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 });
});
it('distinguishes blocked access from unavailable positioning', async () => {
  getPosition.mockImplementationOnce((_success, fail) => fail({ code: 1 }));
  await expect(getDeviceLocation(new AbortController().signal, jest.fn())).rejects.toThrow('access was blocked');
  getPosition.mockImplementationOnce((_success, fail) => fail({ code: 2 }));
  await expect(getDeviceLocation(new AbortController().signal, jest.fn())).rejects.toThrow('could not determine');
});
it('cancels immediately and ignores late browser callbacks', async () => {
  let success!: (position: any) => void;
  getPosition.mockImplementation(done => { success = done; });
  const controller = new AbortController(); const result = getDeviceLocation(controller.signal, jest.fn());
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await assertion;
  success({ coords: { latitude: 1, longitude: 2, accuracy: 50 } });
  expect(jest.getTimerCount()).toBe(0);
});
