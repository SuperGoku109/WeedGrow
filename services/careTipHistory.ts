import { doc, runTransaction } from 'firebase/firestore';
import type { Plant } from '@/firestoreModels';
import { careTipRecords, mergeCareTipHistory, type CareTipRecord, type CareTipTarget } from '@/lib/care/careTipHistory';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';

export async function saveCareTips(uid: string, targets: readonly CareTipTarget[], handled = false) {
  if (!targets.length) return;
  if (requireUserId() !== uid) throw new Error('Your account changed. Sign in again.');
  const byPlant = new Map<string, CareTipRecord[]>();
  for (const { plantId, tip } of targets) {
    const records = byPlant.get(plantId) || [];
    records.push(tip);
    byPlant.set(plantId, records);
  }
  const handledAt = handled ? Date.now() : undefined;
  await runTransaction(db, async transaction => {
    const plants = await Promise.all([...byPlant].map(([id, tips]) => {
      const ref = doc(db, 'plants', id);
      return transaction.get(ref).then(snapshot => ({ ref, plant: snapshot.data() as Plant | undefined, tips }));
    }));
    for (const { ref, plant, tips } of plants) {
      if (!plant?.owners?.includes(uid) || plant.deleting || plant.status !== 'active') {
        if (handled) throw new Error('An affected plant is no longer active in this garden.');
        continue;
      }
      const existing = careTipRecords(plant);
      const next = mergeCareTipHistory(existing, tips, handledAt);
      if (next.length !== existing.length || next.some((record, index) => record !== existing[index])) {
        transaction.update(ref, { careTipHistory: next });
      }
    }
  });
}
