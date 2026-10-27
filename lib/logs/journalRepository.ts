import { journalEntryPayload, journalPayload, journalRevision, journalTargetId } from './journalMutation';
import { validateMeasurements } from './logMeasurements';
import { plantDay, zonedTime, addDays } from '@/lib/dates/plantDay';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { PlantLog } from '@/firestoreModels';
import { validateLogDate } from './plantJournal';

export { validateMeasurements } from './logMeasurements';

export type JournalEntry = PlantLog & { id: string };
export type LogInput = Omit<PlantLog, 'timestamp'>;
export const wateringId = (date: string) => `watering_${date}`;
export const newLogId = () => doc(collection(db, 'journalIds')).id;
export async function legacyWaterings(plantId: string, day: string, zone?: string | null) {
  return getDocs(query(collection(db, 'plants', plantId, 'logs'), where('type', '==', 'watering'),
    where('timestamp', '>=', Timestamp.fromDate(zonedTime(day, '00:00', zone))),
    where('timestamp', '<=', Timestamp.fromDate(new Date(zonedTime(addDays(day, 1), '00:00', zone).getTime() - 1)))));
}
// Deterministic daily IDs serialize waterings from concurrent devices. Legacy
// random-ID waterings are checked too. Stable request IDs make retries safe.
export async function saveJournalEntry(plantId: string, input: LogInput, date: string | undefined = undefined, existing?: JournalEntry, requestId = newLogId(), baseline?: string) {
  const uid = requireUserId();
  const initialPlant = await getDoc(doc(db, 'plants', plantId));
  if (!initialPlant.exists() || !initialPlant.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
  const zone = initialPlant.data().locationTimeZone;
  date = date || plantDay(new Date(), zone);
  const dateError = validateLogDate(date, plantDay(new Date(), zone));
  if (dateError) throw new Error(dateError);
  validateMeasurements(input);
  const id = journalTargetId(input, date, requestId, existing);
  if (input.type === 'watering') {
    const legacy = await legacyWaterings(plantId, date, zone);
    if (legacy.docs.some(item => item.id !== existing?.id && item.id !== id)) throw new Error('Watering already logged for this day.');
  }
  const ref = doc(db, 'plants', plantId, 'logs', id);
  await runTransaction(db, async transaction => {
    const plant = await transaction.get(doc(db, 'plants', plantId));
    const target = await transaction.get(ref);
    const oldRef = existing ? doc(db, 'plants', plantId, 'logs', existing.id) : null;
    const old = oldRef && existing?.id !== id ? await transaction.get(oldRef) : target;
    if (!plant.exists() || !plant.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (plant.data().deleting) throw new Error('This plant is being deleted.');
    if (target.exists() && target.data().mutationId === requestId) {
      if (journalEntryPayload(target.data() as PlantLog) !== journalPayload(input, date!)) throw new Error('This save already completed with different details. Reconcile the previous save before making changes.');
      return;
    }
    if (existing && (!old?.exists() || journalRevision(old.data()) !== (baseline || journalRevision(existing)))) throw new Error('This entry changed. Reload it before editing.');
    if (target.exists() && existing?.id !== id) throw new Error('Watering already logged for this day.');
    if (!existing && plant.data().status !== 'active') throw new Error('Restore this plant before recording new activities.');
    if (oldRef && existing?.id !== id) transaction.delete(oldRef);
    if ((plant.data().locationTimeZone || null) !== (zone || null)) throw new Error('The plant location changed. Reopen this entry before saving.');
    if (date === plantDay(new Date(), zone) && ['watering', 'fertilizing'].includes(input.type)) {
      const careSnoozes = { ...(plant.data().careSnoozes || {}) }; delete careSnoozes[input.type === 'watering' ? 'watering' : 'feeding'];
      transaction.update(doc(db, 'plants', plantId), { careSnoozes });
    }
    const sameDay = !!existing && (existing.calendarDay || plantDay(existing.timestamp.toDate(), existing.timeZone || zone)) === date;
    const eventZone = sameDay ? existing.timeZone || zone : zone;
    const precision = sameDay ? existing.occurrencePrecision || 'time' : date === plantDay(new Date(), zone) ? 'time' : 'date';
    transaction.set(ref, { ...input, calendarDay: date, ...(eventZone ? { timeZone: eventZone } : {}), occurrencePrecision: precision, updatedBy: uid, mutationId: requestId,
      timestamp: sameDay ? existing!.timestamp : date === plantDay(new Date(), zone) ? serverTimestamp() : Timestamp.fromDate(zonedTime(date!, '12:00', zone)),
      ...(existing ? existing.recordedAt ? { recordedAt: existing.recordedAt } : {} : { recordedAt: serverTimestamp() }), editedAt: serverTimestamp() });
  });
  return { id, mutationId: requestId };
}
export async function deleteJournalEntry(plantId: string, id: string, expected?: string | JournalEntry) {
  requireUserId();
  await runTransaction(db, async transaction => {
    const ref = doc(db, 'plants', plantId, 'logs', id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    if (typeof expected === 'object' ? journalRevision(snapshot.data()) !== journalRevision(expected) : snapshot.data().mutationId !== expected) throw new Error('This entry has changed. Open the journal to remove it.');
    transaction.delete(ref);
  });
}

export async function readJournalEntry(plantId: string, entryId: string): Promise<JournalEntry | null> {
  requireUserId();
  const snapshot = await getDoc(doc(db, 'plants', plantId, 'logs', entryId));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id || entryId } as JournalEntry : null;
}
