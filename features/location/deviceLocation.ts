import * as Location from 'expo-location';
import { validCoordinates } from './locationService';
import { cancelledLocation, LOCATION_TIMEOUT_MESSAGE, LOCATION_TIMEOUT_MS, type DevicePosition, type LocationStage } from './deviceLocationTypes';

export function getDeviceLocation(signal: AbortSignal, onStage: (stage: LocationStage) => void): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(cancelledLocation()); return; }
    let finished = false;
    const finish = (position?: DevicePosition, error?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(position!);
    };
    const abort = () => finish(undefined, cancelledLocation());
    const timeout = setTimeout(() => finish(undefined, new Error(LOCATION_TIMEOUT_MESSAGE)), LOCATION_TIMEOUT_MS);
    signal.addEventListener('abort', abort, { once: true });
    void (async () => {
      onStage('permission');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (finished) return;
      if (!permission.granted) throw new Error('Location access is off. Allow location for WeedGrow in device settings, then retry or choose a map pin.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Device location services are off. Turn them on in device settings or choose a map pin.');
      if (finished) return;
      onStage('position');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (!validCoordinates(coords)) throw new Error('The device returned an invalid location. Choose a map pin or retry.');
      finish({ coords, accuracy: position.coords.accuracy });
    })().catch(error => finish(undefined, error instanceof Error ? error : new Error('Device location is unavailable. Try again or choose a pin on the map.')));
  });
}
