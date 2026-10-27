import { arrayRemove, arrayUnion, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { invalidatePlantCache } from '@/services/gardenData';
import { plantDay } from '@/lib/dates/plantDay';
import { sameLocation } from '@/features/location/locationState';
import { assertSpaceCapacity } from '../groupPolicy';
import { gardenMoveSignature } from '../gardenMove';
import type { Group, Plant } from '@/firestoreModels';

export interface MovePlantRequest {
  plantId: string; destinationId: string; expectedGroupId: string | null; legacySourceId?: string;
  expectedPlantUpdatedAt: number | null; destinationSignature: string; followGarden: boolean; requestId: string;
}
export async function movePlantToGarden(input: MovePlantRequest) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const plantRef = doc(db, 'plants', input.plantId);
    const destinationRef = doc(db, 'groups', input.destinationId);
    const logRef = doc(db, 'plants', input.plantId, 'logs', `garden_move_${input.requestId}`);
    const [plantDoc, destinationDoc, prior] = await Promise.all([tx.get(plantRef), tx.get(destinationRef), tx.get(logRef)]);
    const plant = plantDoc.data() as Plant | undefined;
    const destination = destinationDoc.data() as Group | undefined;
    if (!plant || !plant.owners.includes(uid) || plant.deleting) throw new Error('This plant is unavailable in your account.');
    if (prior.exists()) {
      if (prior.data().gardenMove?.toGardenId !== input.destinationId) throw new Error('This move request already completed with a different destination.');
      return;
    }
    if (!destination || destination.createdBy !== uid) throw new Error('The destination garden is unavailable.');
    if ((plant.groupId || null) !== input.expectedGroupId || (plant.updatedAt?.toMillis?.() || null) !== input.expectedPlantUpdatedAt) throw new Error('This plant changed. Close and reopen the move to review its current settings.');
    if (gardenMoveSignature(destination) !== input.destinationSignature) throw new Error('The destination settings changed. Close and reopen the move to review them.');
    if (plant.groupId === input.destinationId) throw new Error('This plant is already in that garden.');
    const sourceId = plant.groupId || input.legacySourceId;
    const sourceRef = sourceId ? doc(db, 'groups', sourceId) : null;
    const sourceDoc = sourceRef ? await tx.get(sourceRef) : null;
    if (sourceDoc?.exists() && sourceDoc.data().createdBy !== uid) throw new Error('The source garden is unavailable in your account.');
    if (!plant.groupId && sourceDoc?.exists() && !sourceDoc.data().plantIds?.includes(input.plantId)) throw new Error('The source garden membership changed. Reopen this move.');
    assertSpaceCapacity([...(destination.plantIds || []), input.plantId]);
    const follows = input.followGarden || plant.environment !== destination.environment;
    if (follows && destination.sensorProfileId && destination.environment !== 'outdoor') {
      const profile = await tx.get(doc(db, 'sensorProfiles', destination.sensorProfileId));
      if (!profile.exists() || profile.data().createdBy !== uid || profile.data().deleting) throw new Error('The destination sensor profile is unavailable. Update the garden settings first.');
    }
    const nextLocation = follows ? destination.location : plant.location || null;
    const locationChanged = !sameLocation(plant.location, nextLocation);
    const contextChanged = locationChanged || plant.environment !== destination.environment;
    const revision = (plant.locationRevision || 0) + (contextChanged ? 1 : 0);
    if (sourceDoc?.exists() && sourceRef) tx.update(sourceRef, { plantIds: arrayRemove(input.plantId), ...(sourceDoc.data().weatherSourcePlantId === input.plantId ? { weatherSourcePlantId: null } : {}), updatedAt: serverTimestamp() });
    tx.update(destinationRef, { plantIds: arrayUnion(input.plantId), updatedAt: serverTimestamp() });
    tx.update(plantRef, {
      groupId: input.destinationId, environment: destination.environment, locationMode: follows ? 'space' : 'custom',
      ...(follows ? { location: nextLocation, locationLabel: destination.locationLabel || destination.name, locationNickname: destination.name, sensorProfileId: destination.environment === 'outdoor' ? null : destination.sensorProfileId || null } : {}),
      ...(contextChanged ? { currentWeather: null, locationRevision: revision, locationChangedAt: serverTimestamp(), locationTimeZone: null,
        ...(plant.location || plant.weatherHistoryBefore ? { weatherHistoryBefore: [plant.weatherHistoryBefore || '', plantDay(new Date(), plant.locationTimeZone)].sort().pop() } : {}) } : {}),
      updatedAt: serverTimestamp(),
    });
    tx.set(logRef, { type: 'note', category: 'notes', timestamp: serverTimestamp(), recordedAt: serverTimestamp(), calendarDay: plantDay(new Date(), plant.locationTimeZone), ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), updatedBy: uid,
      description: `Moved from ${sourceDoc?.data()?.name || 'outside a garden'} to ${destination.name}.`,
      gardenMove: { fromGardenId: sourceId || null, toGardenId: input.destinationId, fromName: sourceDoc?.data()?.name || '', toName: destination.name },
      ...(locationChanged ? { movement: { from: plant.location || null, to: nextLocation, fromLabel: plant.locationLabel || '', toLabel: destination.locationLabel || destination.name, revision } } : {}),
    });
  });
  invalidatePlantCache();
}
