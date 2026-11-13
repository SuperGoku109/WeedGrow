import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { addDays, plantDay, zonedTime } from '../../lib/dates/plantDay';
import { nextWateringRepeat, validWateringRepeat, type WateringRepeat } from '../../lib/logs/wateringRepeat';

/** Re-check the plant and daily log inside one transaction, so retries never duplicate care. */
export async function recordDueWatering(plantId: string, now = Date.now()) {
  const db = getFirestore(), ref = db.doc(`plants/${plantId}`);
  return db.runTransaction(async tx => {
    const plant = (await tx.get(ref)).data();
    const routine = plant?.wateringRepeat as WateringRepeat | undefined;
    if (!plant || !routine || routine.nextAt > now) return false;
    if (!validWateringRepeat(routine) || !Number.isFinite(routine.nextAt) || plant.deleting || plant.status !== 'active'
      || !plant.owners?.length || plant.harvest || plant.harvestedOn || ['harvested', 'drying', 'curing', 'completed'].includes(plant.growthStage)) {
      tx.update(ref, { wateringRepeat: null }); return false;
    }
    const day = plantDay(new Date(routine.nextAt), routine.timeZone);
    const logs = await tx.get(ref.collection('logs').where('type', '==', 'watering')
      .where('timestamp', '>=', Timestamp.fromDate(zonedTime(day, '00:00', routine.timeZone)))
      .where('timestamp', '<', Timestamp.fromDate(zonedTime(addDays(day, 1), '00:00', routine.timeZone))));
    const target = ref.collection('logs').doc(`watering_${day}`);
    const existing = await tx.get(target);
    const nextAt = nextWateringRepeat(routine, routine.nextAt);
    if (!logs.empty || existing.exists) { tx.update(ref, { wateringRepeat: { ...routine, nextAt } }); return false; }
    tx.create(target, { type: 'watering', category: 'watering', description: '', waterMl: routine.waterMl,
      calendarDay: day, timeZone: routine.timeZone, occurrencePrecision: 'time', recordingSource: 'schedule',
      timestamp: Timestamp.fromMillis(routine.nextAt), recordedAt: Timestamp.fromMillis(now), editedAt: Timestamp.fromMillis(now),
      updatedBy: plant.owners[0], mutationId: `repeat_${routine.nextAt}` });
    const careSnoozes = { ...(plant.careSnoozes || {}) };
    if (day === plantDay(new Date(now), routine.timeZone)) delete careSnoozes.watering;
    tx.update(ref, { wateringRepeat: { ...routine, nextAt }, careSummary: null, careRevision: (plant.careRevision || 0) + 1, careSnoozes });
    return true;
  });
}

export async function runRepeatingWatering(now = Date.now()) {
  // Bounded pages also catch up missed executions without creating future entries.
  for (let page = 0; page < 5; page++) {
    const due = await getFirestore().collection('plants').where('wateringRepeat.nextAt', '<=', now).orderBy('wateringRepeat.nextAt').limit(100).get();
    if (due.empty) return;
    for (const plant of due.docs) await recordDueWatering(plant.id, now);
  }
}
