import { initializeApp } from 'firebase-admin/app';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { rebuildCareSummary, runMaintenance } from './operations';
initializeApp();
const region = 'us-central1';
const weatherKey = defineSecret('OPENWEATHERMAP_API_KEY');
export const collectGardenWeather = onSchedule({ region, schedule: 'every 15 minutes', timeZone: 'UTC', secrets: [weatherKey], timeoutSeconds: 540, maxInstances: 1, retryCount: 2 }, async () => runMaintenance(weatherKey.value()));
export const summarizePlantCare = onDocumentWritten({ region, document: 'plants/{plantId}/logs/{logId}', retry: true, maxInstances: 4 }, async event => {
  const kinds = [event.data?.before.data()?.type, event.data?.after.data()?.type];
  if (kinds.some(k => k === 'watering' || k === 'fertilizing')) await rebuildCareSummary(event.params.plantId);
});
export const initializePlantCare = onDocumentCreated({ region, document: 'plants/{plantId}', retry: true, maxInstances: 4 }, async event => rebuildCareSummary(event.params.plantId));
