import { plantDay, zonedTime, addDays } from '@/lib/dates/plantDay';
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/services/firebase';

export const DEFAULT_HISTORY_DAYS = 5;

export interface WateringHistoryEntry {
  date: string; // YYYY-MM-DD
  watered: boolean;
}

/**
 * Fetch watering history for the past `days` days including today.
 * Returns an array ordered from oldest to newest.
 */
export async function fetchWateringHistory(
  plantId: string,
  days = DEFAULT_HISTORY_DAYS,
): Promise<WateringHistoryEntry[]> {
  const plant = await getDoc(doc(db, 'plants', plantId));
  const zone = plant.data()?.locationTimeZone;
  const today = plantDay(new Date(), zone);
  const start = zonedTime(addDays(today, -(days + 1)), '00:00', zone);
  const end = zonedTime(addDays(today, 3), '00:00', zone);

  const q = query(
    collection(db, 'plants', plantId, 'logs'),
    where('type', '==', 'watering'),
    where('timestamp', '>=', Timestamp.fromDate(start)),
    where('timestamp', '<=', Timestamp.fromDate(end)),
  );

  const snap = await getDocs(q);
  const wateredDates = new Set(
    snap.docs.map((d) => d.data().calendarDay || plantDay(d.data().timestamp.toDate(), d.data().timeZone || zone))
  );

  const history: WateringHistoryEntry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDays(today, -i);
    history.push({ date: iso, watered: wateredDates.has(iso) });
  }
  return history;
}
