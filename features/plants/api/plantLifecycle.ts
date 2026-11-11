import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { newLogId } from '@/lib/logs/journalRepository';
import { plantDay, zonedTime } from '@/lib/dates/plantDay';
import { stageChangeFields } from '@/lib/plants/growthTracking';
import type { Plant } from '@/firestoreModels';
import { assertGrowthDates } from '@/lib/plants/growthDates';
import { livingGrowthEnded } from '@/lib/plants/growthLifecycle';
export async function recordHarvest(plantId: string, date: string, weightGrams: number | undefined, notes: string, requestId = newLogId()) {
  const dateError = validateLogDate(date, date);
  if (dateError) throw new Error(dateError);
  if (weightGrams != null && (!Number.isFinite(weightGrams) || weightGrams < 0 || weightGrams > 10000000)) throw new Error('Enter a valid weight in grams.');
  if (notes.length > 4000) throw new Error('Keep harvest notes under 4,000 characters.');
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const current = await tx.get(ref);
    if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (current.data().harvest?.recordId === requestId) return;
    const zone = current.data().locationTimeZone;
    const invalidDate = validateLogDate(date, plantDay(new Date(), zone));
    if (invalidDate) throw new Error(invalidDate);
    if (current.data().status !== 'active' || current.data().deleting) throw new Error('This plant is no longer active. Refresh its details.');
    if (livingGrowthEnded(current.data() as Plant)) throw new Error('Harvest has already ended this plant’s living growth.');
    const harvest = { date, ...(weightGrams != null ? { weightGrams } : {}), notes: notes.trim(), recordId: requestId };
    const fields = stageChangeFields(current.data() as Plant, 'harvested', date, plantDay(new Date(), zone));
    assertGrowthDates(current.data() as Plant, fields, plantDay(new Date(), zone));
    tx.update(ref, { ...fields, status: 'harvested', postHarvestTracking: false, harvest, updatedAt: serverTimestamp() });
    tx.set(doc(db, 'plants', plantId, 'logs', `harvest_${requestId}`), { type: 'harvest', harvest, fromStage: current.data().growthStage || 'unknown', toStage: 'harvested', occurrencePrecision: 'date', recordedAt: serverTimestamp(), calendarDay: date, ...(zone ? { timeZone: zone } : {}), description: `${weightGrams != null ? `${weightGrams} g harvested. ` : ''}${notes.trim()}`, timestamp: Timestamp.fromDate(zonedTime(date, '12:00', zone)), updatedBy: uid });
  });
}
