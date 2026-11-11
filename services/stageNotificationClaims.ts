import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './session';
import type { Plant } from '@/firestoreModels';
import { stagePushPlan } from '@/lib/plants/growthTracking';
import { decodePlant } from '@/lib/data/recordDecoders';

/** One transaction claims a stage reminder across restarts and devices. Fail closed on ambiguous delivery. */
export async function claimStageNotification(plantId: string, uid: string, expected: { key: string; dueAt: number }) {
  if (requireUserId() !== uid) return false;
  return runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const snapshot = await tx.get(ref);
    if (!snapshot.exists() || !snapshot.data().owners?.includes(uid)) return false;
    const plan = stagePushPlan(decodePlant(snapshot.data(), `plants/${plantId}`) as Plant);
    if (!plan || plan.key !== expected.key || plan.dueAt !== expected.dueAt) return false;
    tx.update(ref, { stagePush: expected, updatedAt: serverTimestamp() });
    return true;
  });
}

/** Called only by the device that just cancelled its own still-pending notification. */
export async function postponeStageNotification(plantId: string, uid: string, previous: { key: string; dueAt: number }) {
  if (requireUserId() !== uid) return null;
  return runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const snapshot = await tx.get(ref);
    if (!snapshot.exists() || !snapshot.data().owners?.includes(uid)) return null;
    const plant = decodePlant(snapshot.data(), `plants/${plantId}`);
    const now = new Date();
    if (plant.stagePush?.key !== previous.key || plant.stagePush.dueAt !== previous.dueAt || previous.dueAt <= now.getTime()) return null;
    // The cancelled future reservation already satisfied spacing from any earlier delivery.
    const plan = stagePushPlan({ ...plant, stagePush: null }, now);
    if (!plan || plan.key !== previous.key || plan.dueAt <= previous.dueAt) return null;
    const replacement = { key: plan.key, dueAt: plan.dueAt };
    tx.update(ref, { stagePush: replacement, updatedAt: serverTimestamp() });
    return replacement;
  });
}
