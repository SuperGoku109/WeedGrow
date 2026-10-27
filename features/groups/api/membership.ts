import { plantDay } from '@/lib/dates/plantDay';
import { assertUnchanged, type EditBaseline } from '@/lib/plants/editConflict';
import { collection, doc, runTransaction, serverTimestamp, arrayRemove, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { invalidatePlantCache } from '@/services/gardenData';
import { assertSpaceCapacity } from '../groupPolicy';
import type { Group, Plant } from '@/firestoreModels';
import { sameLocation } from '@/features/location/locationState';
import { assertValidPlantFields } from '@/lib/plants/plantValidation';

// A plant has one growing space. Read every affected record before writing so
// moving, removing and deleting membership remain atomic across devices.
export async function saveGrowingSpace(id: string | undefined, updates: Partial<Group>, remove = false, baseline?: EditBaseline) {
  const uid = requireUserId();
  const ref = id ? doc(db, 'groups', id) : doc(collection(db, 'groups'));
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    const before = snapshot.exists() ? snapshot.data() as Group : null;
    if (id && !before) throw new Error('This garden no longer exists.');
    if (before && before.createdBy !== uid) throw new Error('This garden is not in your account.');
    if (before) assertUnchanged(before as unknown as EditBaseline, updates, baseline);
    const next = { ...before, ...updates };
    if (!remove) assertValidPlantFields({ name: next.name, environment: next.environment, location: next.location });
    if (!remove && next.environment === 'outdoor') next.sensorProfileId = null;
    if (next.plantIds != null && (!Array.isArray(next.plantIds) || next.plantIds.some(value => typeof value !== 'string' || !value || value.includes('/')))) throw new Error('Choose valid plant records for this garden.');
    const ids = remove ? [] : [...new Set(next.plantIds || [])];
    const allIds = [...new Set([...(before?.plantIds || []), ...ids])];
    assertSpaceCapacity(ids);
    assertSpaceCapacity(allIds);
    if (!remove && (!next.name?.trim() || next.name.trim().length > 100)) throw new Error('Use a garden name of 1–100 characters.');
    if (!remove && next.sensorProfileId) {
      const profile = await tx.get(doc(db, 'sensorProfiles', next.sensorProfileId));
      if (!profile.exists() || profile.data().createdBy !== uid || profile.data().deleting) throw new Error('Choose an available sensor profile from your account.');
    }
    const plants = await Promise.all(allIds.map(pid => tx.get(doc(db, 'plants', pid))));
    const previousGroups = new Map<string, DocumentSnapshot>();
    for (const plant of plants) {
      const data = plant.data() as Plant | undefined;
      if (ids.includes(plant.id) && (!data || !data.owners.includes(uid) || data.environment !== next.environment)) throw new Error('Choose plants you own with the same environment as this garden.');
      if (ids.includes(plant.id) && plant.data()?.deleting) throw new Error('A selected plant is being deleted. Remove it from this selection.');
      if (data?.groupId && data.groupId !== ref.id && ids.includes(plant.id) && !previousGroups.has(data.groupId)) {
        const other = await tx.get(doc(db, 'groups', data.groupId));
        if (other.exists() && other.data().createdBy !== uid) throw new Error('A previous garden is not in your account.');
        previousGroups.set(data.groupId, other);
      }
    }
    for (const plant of plants) {
      if (!plant.exists()) continue;
      const data = plant.data() as Plant;
      if (ids.includes(plant.id)) {
        if (data.groupId && data.groupId !== ref.id && previousGroups.get(data.groupId)?.exists()) tx.update(doc(db, 'groups', data.groupId), { plantIds: arrayRemove(plant.id), ...(previousGroups.get(data.groupId)?.data()?.weatherSourcePlantId === plant.id ? { weatherSourcePlantId: null } : {}), updatedAt: serverTimestamp() });
        const inherited = data.locationMode === 'space';
        const moved = inherited && !sameLocation(data.location, next.location);
        if (moved) tx.set(doc(db, 'plants', plant.id, 'logs', `move_${(data.locationRevision || 0) + 1}`), {
          type: 'note', category: 'notes', timestamp: serverTimestamp(), updatedBy: uid,
          description: `Moved with ${next.name} from ${data.locationLabel || 'previous location'} to ${next.locationLabel || next.name || 'new location'}.`,
          movement: { from: data.location || null, to: next.location || null, fromLabel: data.locationLabel || '', toLabel: next.locationLabel || next.name || '', revision: (data.locationRevision || 0) + 1 },
        });
        const label = next.locationLabel || next.name;
        const membershipChanged = data.groupId !== ref.id;
        const labelChanged = inherited && (data.locationLabel || '') !== (label || '');
        if (membershipChanged || moved || labelChanged) tx.update(plant.ref, { groupId: ref.id, ...(inherited ? { location: next.location || null, locationLabel: label, ...(moved ? { locationRevision: (data.locationRevision || 0) + 1, locationChangedAt: serverTimestamp(), locationTimeZone: null, ...(data.location || data.weatherHistoryBefore ? { weatherHistoryBefore: [data.weatherHistoryBefore || '', plantDay(new Date(), data.locationTimeZone)].sort().pop() } : {}) } : {}) } : {}), updatedAt: serverTimestamp() });
      } else if (data.groupId === ref.id) tx.update(plant.ref, { groupId: null, locationMode: 'custom', updatedAt: serverTimestamp() });
    }
    if (remove) tx.delete(ref);
    else tx.set(ref, { ...next, name: next.name!.trim(), plantIds: ids, createdBy: uid,
      weatherSourcePlantId: ids.includes(next.weatherSourcePlantId || '') ? next.weatherSourcePlantId : null,
      createdAt: before?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() });
  });
  invalidatePlantCache();
  return ref.id;
}
