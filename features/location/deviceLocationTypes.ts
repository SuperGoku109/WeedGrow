import type { Coordinates } from './locationService';
export interface DevicePosition { coords: Coordinates; accuracy: number | null }
export type LocationStage = 'permission' | 'position';
export const LOCATION_TIMEOUT_MS = 15000;
export const LOCATION_TIMEOUT_MESSAGE = 'Your device did not return a location in 15 seconds. Check location access in your browser and device settings, then retry or choose a pin on the map.';
export function cancelledLocation() { const error = new Error('Location request cancelled.'); error.name = 'AbortError'; return error; }
