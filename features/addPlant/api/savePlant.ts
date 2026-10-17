import { collection, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { MILLISECONDS_PER_DAY } from '@/constants/Time';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { invalidatePlantCache } from '@/features/plants/hooks/usePlantList';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { normalizePlantForm, validatePlantForm } from '../plantFlowModel';

export const createPlantId = () => doc(collection(db, 'plants')).id;

export async function savePlantToFirestore(input: PlantForm, plantId = createPlantId()): Promise<string> {
  const form = normalizePlantForm(input);
  const errors = validatePlantForm(form);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  let photo;
  try { photo = form.imageUri ? await preparePhotoRecord(plantId, form.imageUri) : null; }
  catch { throw new Error('Your photo couldn’t be prepared. Choose it again, try a different photo, or remove it to continue.'); }
  const imageUri = photo?.uri || null;
  const ageNum = Number(form.ageDays || '0');
  const plantRef = doc(db, 'plants', plantId);
  const data = {
    name: form.name, strain: form.strain, owners: ['demoUser'],
    growthStage: form.growthStage, ageDays: ageNum, ageKnown: !!form.ageDays,
    status: 'active', environment: form.environment, plantedIn: form.plantedIn,
    potSize: form.potSize || null, sunlightExposure: form.sunlightExposure || null,
    wateringFrequency: form.wateringFrequency || null, fertilizer: form.fertilizer || null,
    pests: form.pests || [], trainingTags: form.trainingTags || [],
    notes: form.notes || null, imageUri, location: form.location || null,
    locationNickname: form.locationNickname || null, sensorProfileId: form.sensorProfileId || null,
    soilType: form.soilType || null, soilPh: form.soilPh || null,
    permanentProtection: form.permanentProtection || null,
    companionPlants: form.companionPlants || [], environmentNotes: form.environmentNotes || null,
    createdAt: Timestamp.fromMillis(Date.now() - ageNum * MILLISECONDS_PER_DAY),
    updatedAt: serverTimestamp(),
  };
  try {
    // A stable ID makes double taps and retries safe. Transactions fail offline
    // instead of silently queueing a new plant after the user has left the flow.
    await runTransaction(db, async transaction => {
      const existing = await transaction.get(plantRef);
      if (!existing.exists()) {
        for (const write of photo?.writes || []) transaction.set(write.ref, write.data);
        transaction.set(plantRef, data);
      }
    });
  } catch {
    throw new Error('Your plant couldn’t be saved. Check your connection and try again. Your details are still here.');
  }
  invalidatePlantCache();
  // Weather is optional enrichment, never a reason to delay or fail creation.
  if (form.location && Number.isFinite(form.location.lat) && Number.isFinite(form.location.lng)) {
    void fetchWeather(form.location.lat, form.location.lng)
      .then(parseWeatherData)
      .then(weather => updateWeatherCache(plantId, weather))
      .catch(error => console.warn('Could not fetch weather for new plant:', error));
  }
  return plantId;
}
