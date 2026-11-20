import { collection, documentId, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { addDays, zonedTime } from '@/lib/dates/plantDay';

export function journalRangeQuery(plantId: string, start: string, end: string, timeZone?: string | null) {
  // Include logs recorded in a different timezone before the plant moved.
  const first = zonedTime(addDays(start, -2), '00:00', timeZone);
  const pastLast = zonedTime(addDays(end, 3), '00:00', timeZone);
  return query(collection(db, 'plants', plantId, 'logs'),
    where('timestamp', '>=', Timestamp.fromDate(first)),
    where('timestamp', '<', Timestamp.fromDate(pastLast)));
}

export function journalWeatherRangeQuery(plantId: string, start: string, end: string) {
  return query(collection(db, 'plants', plantId, 'weatherCache'),
    where(documentId(), '>=', start),
    where(documentId(), '<=', end));
}
