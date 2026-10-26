import { listSensorProfiles } from '@/services/sensorProfiles';
// features/addPlant/api/environmentApi.ts


export const potSizeOptions = ['1L','5L','10L','20L','50L'];

export const sunlightOptions = [
  { label: 'Full Sun',      value: 'Full Sun',      icon: 'white-balance-sunny' },
  { label: 'Partial Sun',   value: 'Partial Sun',   icon: 'weather-partly-cloudy' },
  { label: 'Mostly Shade',  value: 'Mostly Shade',  icon: 'weather-cloudy' },
  { label: 'Not Sure',      value: 'Not Sure',      icon: 'help-circle-outline' },
];

/** Fetches all sensor profiles from Firestore. */
export async function fetchSensorProfiles(): Promise<{ id:string; name:string }[]> {
  return (await listSensorProfiles()).filter(profile => !profile.deleting);
}
