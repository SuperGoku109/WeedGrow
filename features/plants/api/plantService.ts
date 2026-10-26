import { plantDay } from '@/lib/dates/plantDay';
import { assertUnchanged, type EditBaseline } from '@/lib/plants/editConflict';
import { db } from '@/services/firebase';
import { doc, deleteDoc, collection, runTransaction, arrayRemove, serverTimestamp, query, where } from 'firebase/firestore';
import { deleteCollectionInBatches } from '@/lib/data/deleteCollectionInBatches';
import { assertValidPlantFields } from '@/lib/plants/plantValidation';
import { normalizePlantSetup } from '@/lib/plants/plantRules';
import { queryPages } from '@/lib/data/queryPages';
import { requireUserId } from '@/services/session';
import { invalidatePlantCache } from '@/services/gardenData';
import logger from '@/lib/logger';
import type { Plant } from '@/firestoreModels';
import { sameLocation } from '@/features/location/locationState';

// Main delete function for entire plant + subcollections
export async function deletePlantAndSubcollections(id: string) {
  const plantRef = doc(db, 'plants', id);
  const uid = requireUserId();
  const exists = await runTransaction(db, async tx => {
    const plant = await tx.get(plantRef);
    if (!plant.exists()) return false;
    if (!plant.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    // A tombstone stops new child writes while resumable cleanup runs. Failed
    // cleanup leaves an archived record, so the user can retry safely.
    tx.update(plantRef, { deleting: true, status: 'archived', groupId: null, updatedAt: serverTimestamp() });
    return true;
  });
  if (!exists) return;
  // Membership writers reject the marker. Discover memberships after it is
  // committed, then re-read each group so concurrent group edits are preserved.
  for await (const members of queryPages(query(collection(db, 'groups'), where('createdBy', '==', uid), where('plantIds', 'array-contains', id)))) for (const member of members) await runTransaction(db, async tx => {
    const group = await tx.get(member.ref);
    if (group.exists() && group.data().createdBy === uid) tx.update(member.ref, { plantIds: arrayRemove(id), ...(group.data().weatherSourcePlantId === id ? { weatherSourcePlantId: null } : {}), updatedAt: serverTimestamp() });
  });

  const deleteSubcollection = (sub: string) => deleteCollectionInBatches(db, `plants/${id}/${sub}`);

  await Promise.all([
    deleteSubcollection('logs'),
    deleteSubcollection('weatherCache'),
    deleteSubcollection('progressPics'),
    deleteSubcollection('photoAssets'),
  ]);

  await deleteDoc(plantRef);

  // Invalidate the plant cache so fresh data is fetched next time
  invalidatePlantCache();
}

export type UpdatePlantFields = Partial<Omit<Plant, 'createdAt' | 'updatedAt' | 'owners' | 'deleting' | 'harvest' | 'currentWeather' | 'locationRevision' | 'weatherHistoryBefore' | 'locationChangedAt' | 'locationTimeZone' | 'ageRecordedAt'>>;

export async function updatePlant(id: string, updates: UpdatePlantFields, baseline?: EditBaseline) {
  // The start date is checked inside the transaction against the plant's day.
  assertValidPlantFields({ ...updates, startedOn: null });
  updates = { ...updates, ...('name' in updates ? { name: updates.name!.trim() } : {}) };
  try {
    const uid = requireUserId();
    const plantRef = doc(db, 'plants', id);
    await runTransaction(db, async transaction => {
      const current = await transaction.get(plantRef);
      if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not available in your account.');
      if (current.data().deleting) throw new Error('This plant is being deleted. Finish deleting it before making other changes.');
      const previous = current.data() as Plant;
      const normalized = normalizePlantSetup(updates, previous);
      assertValidPlantFields(normalized, plantDay(new Date(), previous.locationTimeZone));
      assertUnchanged(previous as unknown as EditBaseline, normalized, baseline);
      const changedSpace = !!(updates.environment && updates.environment !== previous.environment && previous.groupId);
      const mode = changedSpace ? 'custom' : updates.locationMode || ('location' in updates ? 'custom' : previous.locationMode || 'custom');
      const groupRef = previous.groupId && (changedSpace || mode === 'space') ? doc(db, 'groups', previous.groupId) : null;
      const group = groupRef ? await transaction.get(groupRef) : null;
      if (normalized.sensorProfileId) {
        const profile = await transaction.get(doc(db, 'sensorProfiles', normalized.sensorProfileId));
        if (!profile.exists() || profile.data().createdBy !== uid || profile.data().deleting) throw new Error('Choose an available sensor profile from your account.');
      }
      if (changedSpace && groupRef && group?.exists()) transaction.update(groupRef, { plantIds: arrayRemove(id), ...(group.data()?.weatherSourcePlantId === id ? { weatherSourcePlantId: null } : {}), updatedAt: serverTimestamp() });
      if (mode === 'space' && (!group?.exists() || group.data()?.createdBy !== uid)) throw new Error('Choose a growing space before following its location.');
      const resolved = mode === 'space' ? { ...normalized, location: group!.data()!.location || null, locationLabel: group!.data()!.locationLabel || group!.data()!.name, locationMode: mode } : { ...normalized, locationMode: mode };
      const moved = 'location' in resolved && !sameLocation(previous.location, resolved.location);
      if (moved) transaction.set(doc(db, 'plants', id, 'logs', `move_${(previous.locationRevision || 0) + 1}`), {
        type: 'note', category: 'notes', timestamp: serverTimestamp(), updatedBy: uid,
        description: `Moved from ${previous.locationLabel || (previous.location ? `${previous.location.lat}, ${previous.location.lng}` : 'no location')} to ${resolved.locationLabel || (resolved.location ? `${resolved.location.lat}, ${resolved.location.lng}` : 'no location')}.`,
        movement: { from: previous.location || null, to: resolved.location || null, fromLabel: previous.locationLabel || '', toLabel: resolved.locationLabel || '', revision: (previous.locationRevision || 0) + 1 },
      });
      transaction.update(plantRef, { ...resolved, ...(moved ? { locationRevision: (previous.locationRevision || 0) + 1, locationChangedAt: serverTimestamp(), locationTimeZone: null, ...(previous.location || previous.weatherHistoryBefore ? { weatherHistoryBefore: [previous.weatherHistoryBefore || '', plantDay(new Date(), previous.locationTimeZone)].sort().pop() } : {}) } : {}), ...(updates.ageDays != null ? { ageKnown: true, ageRecordedAt: serverTimestamp() } : {}), ...(changedSpace ? { groupId: null } : {}), updatedAt: serverTimestamp() });
    });
    invalidatePlantCache();
  } catch (error) {
    logger.error('Error updating plant:', error);
    throw error instanceof Error ? error : new Error('Failed to update plant. Please try again.');
  }
}
