import { validCoordinates } from './locationService';
import { cancelledLocation, LOCATION_TIMEOUT_MESSAGE, LOCATION_TIMEOUT_MS, type DevicePosition, type LocationStage } from './deviceLocationTypes';

export function getDeviceLocation(signal: AbortSignal, onStage: (stage: LocationStage) => void): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(cancelledLocation()); return; }
    if (typeof window === 'undefined' || !window.isSecureContext) { reject(new Error('Device location needs HTTPS or localhost. Search for a town or place a pin instead.')); return; }
    if (!navigator.geolocation) { reject(new Error('This browser does not provide device location. Open the app in Chrome, Edge or Safari, or choose a pin on the map.')); return; }
    let finished = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (position?: DevicePosition, error?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(position!);
    };
    const abort = () => finish(undefined, cancelledLocation());
    signal.addEventListener('abort', abort, { once: true });
    // This deadline includes waiting for a permission prompt, unlike Expo's
    // browser permission helper, which first asks for an unbounded position.
    timeout = setTimeout(() => finish(undefined, new Error(LOCATION_TIMEOUT_MESSAGE)), LOCATION_TIMEOUT_MS);
    onStage('position');
    try {
      navigator.geolocation.getCurrentPosition(position => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!validCoordinates(coords)) { finish(undefined, new Error('The device returned an invalid location. Choose a pin or try again.')); return; }
        finish({ coords, accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null });
      }, error => {
        const message = error.code === 1
          ? 'Location access was blocked. Allow location for this site in browser settings and turn on device location, then retry. You can also choose a pin on the map.'
          : error.code === 3 ? LOCATION_TIMEOUT_MESSAGE
          : 'Your browser could not determine your position. Check device location services or try Chrome, Edge or Safari. Search and map selection still work.';
        finish(undefined, new Error(message));
      }, { enableHighAccuracy: false, maximumAge: 60000, timeout: LOCATION_TIMEOUT_MS });
    } catch { finish(undefined, new Error('Device location is unavailable in this browser. Search for a town or place a pin instead.')); }
  });
}
