import { initializeApp } from 'firebase-admin/app';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { rebuildCareSummary, runMaintenance } from './operations';
import { refreshPlantCare } from './careOperations';
import { captureWaterEvent } from './careEventLedger';
import { captureSetupTransition } from './careStateLedger';
import { careInputKey } from '../../lib/careAlgorithm/snapshot';
import type { Plant } from '../../firestoreModels';
initializeApp();
// Match the existing Firestore database's Johannesburg location.
const region = 'africa-south1';
const weatherKey = defineSecret('OPENWEATHERMAP_API_KEY');
export const collectGardenWeather = onSchedule({ region, schedule: 'every 15 minutes', timeZone: 'UTC', secrets: [weatherKey], timeoutSeconds: 540, maxInstances: 1, retryCount: 2 }, async () => runMaintenance(weatherKey.value()));
export const summarizePlantCare = onDocumentWritten({ region, document: 'plants/{plantId}/logs/{logId}', secrets: [weatherKey], retry: true, maxInstances: 4 }, async event => {
  const kinds = [event.data?.before.data()?.type, event.data?.after.data()?.type];
  if (kinds.some(k => k === 'watering' || k === 'fertilizing')) {
    if (kinds.some(k => k === 'watering')) await captureWaterEvent(event.params.plantId, event.params.logId);
    await rebuildCareSummary(event.params.plantId);
    await refreshPlantCare(event.params.plantId, weatherKey.value());
  }
});
export const initializePlantCare = onDocumentCreated({ region, document: 'plants/{plantId}', retry: true, maxInstances: 4 }, async event => rebuildCareSummary(event.params.plantId));
export const evaluatePlantCare = onDocumentWritten({ region, document: 'plants/{plantId}', secrets: [weatherKey], retry: true, maxInstances: 4 }, async event => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!after || after.deleting) return;
  // Publishing the server snapshot pointer does not loop into another evaluation.
  if (before && careInputKey(before as Plant) === careInputKey(after as Plant)) return;
  const stamp = event.data?.after.updateTime;
  if (stamp) await captureSetupTransition(event.params.plantId, before ? before as Plant : null, after as Plant,
    stamp.seconds + stamp.nanoseconds / 1e9, `${stamp.seconds}:${stamp.nanoseconds}`);
  await refreshPlantCare(event.params.plantId, weatherKey.value());
});
