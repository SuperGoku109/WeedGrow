import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { plantDay } from '@/lib/dates/plantDay';
export async function skipCareTask(plantId: string, kind: 'watering' | 'feeding', skipped: boolean, expectedDay?: string) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const plant = await tx.get(ref);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().status !== 'active' || plant.data().deleting) throw new Error('This plant is not active in your account.');
    const day = plantDay(new Date(), plant.data().locationTimeZone);
    if (expectedDay && expectedDay !== day) throw new Error('The plant’s day changed. Refresh the checklist.');
    const careSkips = { ...(plant.data().careSkips || {}) };
    if (skipped) careSkips[kind] = day; else delete careSkips[kind];
    const careSnoozes = { ...(plant.data().careSnoozes || {}) };
    if (skipped) delete careSnoozes[kind];
    tx.update(ref, { careSkips, careSnoozes, updatedAt: serverTimestamp() });
    const log = doc(db, 'plants', plantId, 'logs', `skip_${kind}_${day}`);
    if (skipped) tx.set(log, { type: 'note', category: 'notes', timestamp: serverTimestamp(), description: `Skipped ${kind} check today. No watering or feeding was recorded.`, updatedBy: uid });
    else tx.delete(log);
  });
}
