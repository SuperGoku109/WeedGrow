import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
export async function snoozeCare(uid: string, taskId: string, until: number, onlyIfMissing = false) {
  if (requireUserId() !== uid) throw new Error('Your account changed. Sign in again.');
  const [plantId, kind, extra] = taskId.split(':');
  if (!plantId || extra || !['watering', 'feeding'].includes(kind) || !Number.isFinite(until)) throw new Error('Choose a valid task and snooze time.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const plant = await tx.get(ref);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().deleting || plant.data().status !== 'active') throw new Error('This plant is not active in your account.');
    const careSnoozes = { ...(plant.data().careSnoozes || {}) };
    if (onlyIfMissing && careSnoozes[kind] != null) return;
    if (until > Date.now()) careSnoozes[kind] = until; else delete careSnoozes[kind];
    tx.update(ref, { careSnoozes });
  });
}
