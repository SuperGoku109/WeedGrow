import { arrayUnion, collection, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { invalidatePlantCache } from '@/services/gardenData';
import { assertSpaceCapacity } from '@/features/groups/groupPolicy';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { normalizePlantForm, validatePlantForm } from '../plantFlowModel';

export const createPlantId = () => doc(collection(db, 'plants')).id;
export class PlantSaveError extends Error {
  constructor(message: string, public field?: keyof PlantForm) { super(message); this.name = 'PlantSaveError'; }
}

export async function savePlantToFirestore(input: PlantForm, plantId = createPlantId()): Promise<string> {
  const form = normalizePlantForm(input);
  const errors = validatePlantForm(form);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const uid = requireUserId();

  let photo;
  try { photo = form.imageUri ? await preparePhotoRecord(plantId, form.imageUri) : null; }
  catch { throw new Error('Your photo couldn’t be prepared. Choose it again, try a different photo, or remove it to continue.'); }
  const imageUri = photo?.uri || null;
  const ageNum = Number(form.ageDays || '0');
  const plantRef = doc(db, 'plants', plantId);
  const data = {
    name: form.name, strain: form.strain, strainType: form.strainType || 'unknown', owners: [uid],
    growthStage: form.growthStage, ageDays: ageNum, ageKnown: !!form.ageDays,
    status: 'active', environment: form.environment, plantedIn: form.plantedIn,
    potSize: form.potSize || null, sunlightExposure: form.sunlightExposure || null,
    wateringFrequency: form.wateringFrequency || null, fertilizer: form.fertilizer || null,
    feedingFrequency: form.feedingFrequency || null,
    pests: form.pests || [], trainingTags: form.trainingTags || [],
    notes: form.notes || null, imageUri, location: form.location || null,
    locationNickname: form.locationNickname || null, sensorProfileId: form.sensorProfileId || null,
    locationLabel: form.locationLabel || null, groupId: form.groupId || null,
    locationMode: form.locationMode || 'custom', locationRevision: 0,
    soilType: form.soilType || null, soilPh: form.soilPh || null,
    permanentProtection: form.permanentProtection || null,
    companionPlants: form.companionPlants || [], environmentNotes: form.environmentNotes || null,
    startedOn: form.startedOn || null,
    ageEstimated: !!form.ageEstimated,
    ageRecordedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    // A stable ID makes double taps and retries safe. Transactions fail offline
    // instead of silently queueing a new plant after the user has left the flow.
    await runTransaction(db, async transaction => {
      const existing = await transaction.get(plantRef);
      if (existing.exists()) {
        if (!existing.data().owners?.includes(uid)) throw new PlantSaveError('This plant belongs to a different account. Start a new draft.');
        return;
      }
      const groupRef = form.groupId ? doc(db, 'groups', form.groupId) : null;
      if (data.locationMode === 'space' && !groupRef) throw new PlantSaveError('Choose a growing space or use an individual location.', 'groupId');
      if (groupRef) {
        const group = await transaction.get(groupRef);
        if (!group.exists() || group.data().createdBy !== uid) throw new PlantSaveError('Your selected growing space is no longer available. Choose another space or a separate setup.', 'groupId');
        if (group.data().environment !== form.environment) throw new PlantSaveError('The growing space’s environment has changed. Select it again to update this setup.', 'groupId');
        try { assertSpaceCapacity([...(group.data().plantIds || []), plantId]); }
        catch (error) { throw new PlantSaveError((error as Error).message, 'groupId'); }
        if (data.locationMode === 'space') { data.location = group.data().location || null; data.locationLabel = group.data().locationLabel || group.data().name; }
      }
      if (form.sensorProfileId) {
        const profile = await transaction.get(doc(db, 'sensorProfiles', form.sensorProfileId));
        if (!profile.exists() || profile.data().createdBy !== uid) throw new PlantSaveError('The sensor profile is no longer available. Choose another profile or continue without one.', 'groupId');
      }
      if (!existing.exists()) {
        for (const write of photo?.writes || []) transaction.set(write.ref, write.data);
        transaction.set(plantRef, data);
        if (groupRef) transaction.update(groupRef, { plantIds: arrayUnion(plantId), updatedAt: serverTimestamp() });
        transaction.set(doc(db, 'plants', plantId, 'logs', 'setup-created'), { type: 'note', category: 'notes', description: 'Plant added to garden.', timestamp: serverTimestamp(), updatedBy: uid });
        for (const [field, type, category] of [['lastWateredOn', 'watering', 'watering'], ['lastFedOn', 'fertilizing', 'feeding']] as const) {
          if (form[field]) transaction.set(doc(db, 'plants', plantId, 'logs', type === 'watering' ? `watering_${form[field]}` : `setup-${category}`), {
            type, category, description: 'Recorded during plant setup.', updatedBy: uid, calendarDay: form[field],
            timestamp: Timestamp.fromDate(new Date(form[field]! + 'T12:00:00')),
          });
        }
        if (photo) {
          transaction.set(doc(db, 'plants', plantId, 'progressPics', 'setup-photo'), { imageUrl: photo.uri, caption: 'First photo', timestamp: serverTimestamp() });
          transaction.set(doc(db, 'plants', plantId, 'logs', 'setup-photo'), { type: 'photo', description: 'First progress photo.', photoUri: photo.uri, timestamp: serverTimestamp(), updatedBy: uid });
        }
      }
    });
  } catch (error) {
    if (error instanceof PlantSaveError) throw error;
    throw new Error('Your plant couldn’t be saved. Check your connection and try again. Your details are still here.');
  }
  invalidatePlantCache();
  // Weather is optional enrichment, never a reason to delay or fail creation.
  if (data.location && Number.isFinite(data.location.lat) && Number.isFinite(data.location.lng)) {
    const expected = { location: data.location, locationRevision: 0, locationLabel: data.locationLabel };
    void fetchWeather(data.location.lat, data.location.lng)
      .then(parseWeatherData)
      .then(weather => updateWeatherCache(plantId, weather, expected))
      .catch(error => console.warn('Could not fetch weather for new plant:', error));
  }
  return plantId;
}
