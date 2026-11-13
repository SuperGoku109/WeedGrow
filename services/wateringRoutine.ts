import { doc, getDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './session';
import { legacyWaterings } from '@/lib/logs/journalRepository';
import { nextWateringRepeat, validWateringRepeat, type WateringRepeat } from '@/lib/logs/wateringRepeat';
import { plantDay } from '@/lib/dates/plantDay';

export async function stopWateringRoutine(plantId: string) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId), plant = await tx.get(ref);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().deleting) throw new Error('This plant is not available.');
    tx.update(ref, { wateringRepeat: null });
  });
}

/** Free-plan foreground/catch-up path; the cloud worker uses the same daily IDs. */
export async function recordDueWateringRoutine(plantId: string, now = Date.now()): Promise<number | null> {
  const uid = requireUserId(), ref = doc(db, 'plants', plantId);
  const initial = await getDoc(ref), first = initial.data()?.wateringRepeat as WateringRepeat | undefined;
  if (!first || !validWateringRepeat(first) || !Number.isFinite(first.nextAt) || first.nextAt > now) return null;
  const day = plantDay(new Date(first.nextAt), first.timeZone);
  const legacy = await legacyWaterings(plantId, day, first.timeZone);
  return runTransaction(db, async tx => {
    if (requireUserId() !== uid) return null;
    const plant = await tx.get(ref), data = plant.data(), routine = data?.wateringRepeat as WateringRepeat | undefined;
    if (!data || !data.owners?.includes(uid) || data.deleting || !routine || JSON.stringify(routine) !== JSON.stringify(first)) return null;
    if (data.status !== 'active' || data.harvest || data.harvestedOn || ['harvested', 'drying', 'curing', 'completed'].includes(data.growthStage)) { tx.update(ref, { wateringRepeat: null }); return null; }
    const target = doc(db, 'plants', plantId, 'logs', `watering_${day}`), existing = await tx.get(target);
    const nextAt = nextWateringRepeat(routine, routine.nextAt);
    const changes: Record<string, unknown> = { wateringRepeat: { ...routine, nextAt } };
    if (!existing.exists() && legacy.empty) {
      tx.set(target, { type: 'watering', category: 'watering', description: '', waterMl: routine.waterMl,
        calendarDay: day, timeZone: routine.timeZone, occurrencePrecision: 'time', recordingSource: 'schedule',
        timestamp: Timestamp.fromMillis(routine.nextAt), recordedAt: serverTimestamp(), editedAt: serverTimestamp(), updatedBy: uid, mutationId: `repeat_${routine.nextAt}` });
      const careSnoozes = { ...(data.careSnoozes || {}) };
      if (day === plantDay(new Date(now), routine.timeZone)) delete careSnoozes.watering;
      Object.assign(changes, { careSummary: null, careRevision: (data.careRevision || 0) + 1, careSnoozes });
    }
    tx.update(ref, changes);
    return nextAt;
  }).catch(async error => {
    // An enrolled plant's revision rule can reject the losing concurrent commit
    // before Firestore reports a transaction conflict. Acknowledge the winner.
    if (error?.code !== 'permission-denied' || requireUserId() !== uid) throw error;
    const current = (await getDoc(ref)).data()?.wateringRepeat as WateringRepeat | undefined;
    if (current && validWateringRepeat(current) && current.nextAt > first.nextAt
      && current.startOn === first.startOn && current.everyDays === first.everyDays && current.time === first.time
      && current.timeZone === first.timeZone && current.waterMl === first.waterMl) return current.nextAt;
    throw error;
  });
}
