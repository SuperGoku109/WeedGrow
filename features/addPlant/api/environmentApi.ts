import { requireUserId } from '@/services/session';
// features/addPlant/api/environmentApi.ts

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';

export const potSizeOptions = ['1L','5L','10L','20L','50L'];

export const sunlightOptions = [
  { label: 'Full Sun',      value: 'Full Sun',      icon: 'white-balance-sunny' },
  { label: 'Partial Sun',   value: 'Partial Sun',   icon: 'weather-partly-cloudy' },
  { label: 'Mostly Shade',  value: 'Mostly Shade',  icon: 'weather-cloudy' },
  { label: 'Not Sure',      value: 'Not Sure',      icon: 'help-circle-outline' },
];

/** Fetches all sensor profiles from Firestore. */
export async function fetchSensorProfiles(): Promise<{ id:string; name:string }[]> {
  const snap = await getDocs(query(collection(db, 'sensorProfiles'), where('createdBy', '==', requireUserId())));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any;
}
