import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { plantDay } from '@/lib/dates/plantDay';
import { legacyWaterings, newLogId, wateringId } from './journalRepository';
import { MAX_ATOMIC_WATERING_PLANTS } from '@/features/groups/groupPolicy';

export async function waterGrowingSpace(groupId: string) {
  const uid = requireUserId();
  const operationId = newLogId();
  // Read membership inside the transaction, then read legacy history outside
  // it. Retry if membership changes before committing the complete operation.
  const { getDoc } = await import('firebase/firestore');
  const groupRef = doc(db, 'groups', groupId);
  const initial = await getDoc(groupRef);
  if (!initial.exists() || initial.data().createdBy !== uid) throw new Error('This space is not in your account.');
  const ids: string[] = [...new Set<string>(initial.data().plantIds || [])].sort();
  if (ids.length > MAX_ATOMIC_WATERING_PLANTS) throw new Error(`Atomic group watering supports up to ${MAX_ATOMIC_WATERING_PLANTS} plants. Use individual care records for larger spaces.`);
  const initialPlants = await Promise.all(ids.map(pid => getDoc(doc(db, 'plants', pid))));
  const zones = initialPlants.map(plant => plant.data()?.locationTimeZone);
  const days = zones.map(zone => plantDay(new Date(), zone));
  const legacy = await Promise.all(ids.map((pid, index) => legacyWaterings(pid, days[index], zones[index])));
  return runTransaction(db, async tx => {
    const group = await tx.get(groupRef);
    if (!group.exists() || group.data().createdBy !== uid || JSON.stringify([...group.data().plantIds].sort()) !== JSON.stringify(ids)) throw new Error('Space membership changed. Refresh and try again.');
    const plants = await Promise.all(ids.map(pid => tx.get(doc(db, 'plants', pid))));
    const entries = await Promise.all(ids.map((pid, index) => tx.get(doc(db, 'plants', pid, 'logs', wateringId(days[index])))));
    const written: string[] = [];
    plants.forEach((plant, index) => {
      if (!plant.exists() || !plant.data().owners?.includes(uid)) throw new Error('A member is unavailable. Refresh the space before watering.');
      if ((plant.data().locationTimeZone || null) !== (zones[index] || null) || plantDay(new Date(), zones[index]) !== days[index]) throw new Error('A plant’s local day changed. Refresh the space before watering.');
      if (plant.data().status !== 'active' || plant.data().deleting || !legacy[index].empty || entries[index].exists()) return;
      tx.set(entries[index].ref, { type: 'watering', category: 'watering', calendarDay: days[index], ...(zones[index] ? { timeZone: zones[index] } : {}), timestamp: serverTimestamp(), description: `Group watering: ${group.data().name}`, updatedBy: uid, mutationId: operationId });
      if (plant.data().careSnoozes?.watering != null) {
        const careSnoozes = { ...plant.data().careSnoozes }; delete careSnoozes.watering;
        tx.update(plant.ref, { careSnoozes });
      }
      written.push(plant.id);
    });
    return { written, skipped: ids.length - written.length };
  });
}
