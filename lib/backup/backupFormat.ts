import { PLANT_STAGES, validatePlantFields } from '@/lib/plants/plantValidation';
import { isRecord } from '@/lib/data/recordDecoders';
import { isCalendarDay } from '@/lib/dates/plantDay';
import { MAX_BACKUP_BYTES, MAX_BACKUP_RECORDS, utf8Bytes } from './backupLimits';
export interface BackupRecord { path: string; data: Record<string, unknown> }
export interface GardenBackup { format: 'weedgrow'; version: 1; backupId: string; exportedAt: string; records: BackupRecord[]; warnings?: string[] }
const ID = '[A-Za-z0-9_-]{1,100}';
const PATH = new RegExp(`^(plants/${ID}(/(logs|progressPics|photoAssets|weatherCache)/${ID})?|groups/${ID}|sensorProfiles/${ID})$`);
const allowed: Record<string, string[]> = {
  plants: ['currentWeather', 'careSnoozes', 'weatherHistoryBefore', 'locationTimeZone', 'careSkips', 'locationMode', 'locationRevision', 'locationChangedAt', 'name', 'strain', 'strainType', 'startedOn', 'ageEstimated', 'ageRecordedAt', 'groupId', 'locationLabel', 'owners', 'growthStage', 'ageDays', 'ageKnown', 'status', 'environment', 'plantedIn', 'potSize', 'sunlightExposure', 'wateringFrequency', 'fertilizer', 'feedingFrequency', 'pests', 'trainingTags', 'notes', 'imageUri', 'waterLevel', 'height', 'soilType', 'soilPh', 'permanentProtection', 'companionPlants', 'environmentNotes', 'location', 'locationNickname', 'sensorProfileId', 'reminderSchedule', 'createdAt', 'updatedAt', 'restoreOperationId', 'harvest'],
  weatherCache: ['temperatureBasis', 'qualityNotes', 'rainIntervalSeconds', 'weatherDataVersion', 'observationUtc', 'forecastIssue', 'timeZone', 'date', 'fetchedAt', 'forecasted', 'source', 'temperature', 'humidity', 'windSpeed', 'rainfall', 'uvIndex', 'weatherSummary', 'hourlySummary', 'dewPoint', 'cloudCoverage', 'windGust', 'sunrise', 'sunset', 'pop', 'nightHumidity', 'detailedTemps', 'sourceCoordinates', 'locationRevision', 'locationLabel', 'previousLocations'],
  logs: ['occurrencePrecision', 'recordedAt', 'calendarDay', 'timeZone', 'movement', 'category', 'type', 'timestamp', 'description', 'photoUri', 'careCheck', 'inspectionResult', 'updatedBy', 'mutationId', 'editedAt', 'waterMl', 'nutrientMlPerL', 'ph', 'heightCm', 'soilMoisture', 'harvest'],
  progressPics: ['occurrencePrecision', 'recordedAt', 'calendarDay', 'timeZone', 'imageUrl', 'url', 'timestamp', 'caption'], photoAssets: ['dataUri'],
  groups: ['locationLabel', 'name', 'environment', 'plantIds', 'location', 'createdBy', 'createdAt', 'updatedAt', 'sensorProfileId', 'weatherSourcePlantId', 'restoreOperationId'],
  sensorProfiles: ['name', 'createdBy', 'createdAt', 'updatedAt', 'temperature', 'humidity', 'soilMoisture', 'light', 'source', 'readings', 'environment', 'description', 'type', 'settings', 'environmentType', 'isManual', 'defaultTemp', 'defaultHumidity', 'restoreOperationId'],
};
allowed.plants.push('rainReception', 'careMedium', 'potMaterial', 'potType', 'growingSite', 'potDrainage', 'fertilizerForm', 'feedingReminderSchedule');
allowed.plants.push('wateringRepeat');
allowed.logs.push('recordingSource', 'wateringRepeatChange');
allowed.logs.push('moistureState', 'moistureConfiguration', 'inspectionFeedback', 'rainfallObservation');
allowed.plants.push('stageStartedOn', 'germinationStartedOn', 'emergedOn', 'preflowerObservedOn', 'floweringStartedOn', 'harvestedOn', 'lastStageReviewedOn', 'stageTrackingVersion', 'stageRevision', 'growthProfile', 'stageReview', 'stagePush', 'stageReminders', 'postHarvestTracking');
allowed.logs.push('fromStage', 'toStage', 'stageRevision', 'stageReview', 'fromPhase', 'toPhase', 'phaseMutation', 'historyEvent', 'toStatus');
allowed.plants.push('stageStartedOnEstimated', 'ageEstimateSource', 'floweringPhase', 'lateFloweringStartedOn');
export function validateBackup(raw: string): GardenBackup {
  if (raw.length > MAX_BACKUP_BYTES || utf8Bytes(raw) > MAX_BACKUP_BYTES) throw new Error('Choose a backup under 30 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON. Choose a BudBuddy backup.'); }
  if (!isRecord(parsed) || parsed.format !== 'weedgrow' || parsed.version !== 1 || typeof parsed.backupId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(parsed.backupId) || !Array.isArray(parsed.records) || !parsed.records.length) throw new Error('This is not a supported BudBuddy backup.');
  if (parsed.records.length > MAX_BACKUP_RECORDS) throw new Error('Choose a backup with at most 50,000 records.');
  const records: BackupRecord[] = parsed.records.map((entry: unknown) => { if (!isRecord(entry) || typeof entry.path !== 'string' || !isRecord(entry.data)) throw new Error('The backup contains invalid records.'); return { path: entry.path, data: entry.data }; });
  const value: GardenBackup = { format: 'weedgrow', version: 1, backupId: parsed.backupId, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '', records };
  if (Array.isArray(parsed.warnings) && parsed.warnings.every((item: unknown) => typeof item === 'string')) value.warnings = parsed.warnings;
  const seen = new Set<string>();
  for (const record of value.records) {
    if (!PATH.test(record.path) || seen.has(record.path) || !record.data || typeof record.data !== 'object' || Array.isArray(record.data)) throw new Error('The backup contains duplicate or invalid records.');
    seen.add(record.path);
    const parts = record.path.split('/');
    const kind = parts.length === 4 ? parts[2] : parts[0];
    if (Object.keys(record.data).some(key => !allowed[kind]?.includes(key))) throw new Error(`Unsupported fields in ${record.path}.`);
    const data = record.data;
    if (kind === 'plants') {
      const tracking = ['stageStartedOn', 'stageStartedOnEstimated', 'ageEstimateSource', 'germinationStartedOn', 'emergedOn', 'preflowerObservedOn', 'floweringStartedOn', 'harvestedOn', 'lastStageReviewedOn', 'stageRevision', 'growthProfile', 'stageReview', 'stagePush', 'stageReminders', 'postHarvestTracking'];
      const errors = validatePlantFields(Object.fromEntries(tracking.filter(key => !key.endsWith('On') && data[key] != null).map(key => [key, data[key]])));
      for (const key of tracking.filter(key => key.endsWith('On'))) if (data[key] != null && (typeof data[key] !== 'string' || !isCalendarDay(data[key] as string))) errors[key] = 'Invalid saved stage date.';
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    }
    if (kind === 'plants') { const errors = validatePlantFields(Object.fromEntries(['potMaterial', 'potType', 'growingSite', 'potDrainage', 'fertilizerForm', 'reminderSchedule', 'feedingReminderSchedule'].filter(key => data[key] != null).map(key => [key, data[key]]))); if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]); }
    for (const key of ['description', 'caption', 'notes', 'wateringFrequency', 'feedingFrequency', 'strain']) if (data[key] != null && typeof data[key] !== 'string') throw new Error(`The ${key} field must be text.`);
    if (kind === 'logs') for (const [key, max] of [['waterMl', 1000000], ['nutrientMlPerL', 1000], ['ph', 14], ['heightCm', 10000], ['soilMoisture', 100]] as const) {
      if (data[key] != null && (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || (data[key] as number) < 0 || (data[key] as number) > max)) throw new Error(`The ${key} measurement is invalid.`);
    }
    if (kind === 'plants' && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 || !(PLANT_STAGES as readonly string[]).includes(String(data.growthStage)) || !['outdoor', 'indoor', 'greenhouse'].includes(String(data.environment)) || !['pot', 'ground'].includes(String(data.plantedIn)) || !['active', 'archived', 'harvested', 'dead'].includes(String(data.status)))) throw new Error('A plant has invalid required fields.');
    if (kind === 'groups' && (typeof data.name !== 'string' || !data.name.trim() || !['outdoor', 'indoor', 'greenhouse'].includes(String(data.environment)))) throw new Error('A space has invalid required fields.');
    if (kind === 'photoAssets' && (typeof data.dataUri !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.dataUri) || data.dataUri.length > (parts[3].endsWith('_thumb') ? 20480 : 184320))) throw new Error('An image is invalid or too large.');
    if ((kind === 'logs' || kind === 'progressPics') && data.occurrencePrecision != null && !['date', 'time'].includes(String(data.occurrencePrecision))) throw new Error('A record has invalid date precision.');
    if ((kind === 'logs' || kind === 'progressPics') && data.recordedAt != null && !isTimestamp(data.recordedAt)) throw new Error('A record has an invalid submission timestamp.');
    if (kind === 'logs') {
      if (data.moistureState != null && !['DRY', 'MOIST', 'WET'].includes(String(data.moistureState))) throw new Error('A journal entry has invalid moisture state.');
      if (data.rainfallObservation != null && !['LIGHT', 'MODERATE', 'HEAVY'].includes(String(data.rainfallObservation))) throw new Error('A journal entry has invalid rainfall observation.');
      if (data.inspectionFeedback != null && !['useful', 'too_early', 'too_late'].includes(String(data.inspectionFeedback))) throw new Error('A journal entry has invalid inspection feedback.');
      if (data.moistureConfiguration != null && typeof data.moistureConfiguration !== 'string') throw new Error('A journal entry has invalid moisture configuration.');
    }
    if (kind === 'logs' && (!['watering', 'fertilizing', 'note', 'photo', 'training', 'stage_change', 'harvest'].includes(String(data.type)) || !isTimestamp(data.timestamp))) throw new Error('A journal entry has an invalid type or date.');
    if (kind === 'progressPics' && (!isTimestamp(data.timestamp) || typeof (data.imageUrl || data.url) !== 'string')) throw new Error('A photo has invalid metadata.');
    if (JSON.stringify(data).length > (kind === 'weatherCache' ? 800000 : 200000)) throw new Error('A backup record is too large.');
    if (kind === 'weatherCache' && (!isTimestamp(data.fetchedAt) || typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date))) throw new Error('A saved weather record has an invalid date.');
    if (kind === 'plants' && data.locationMode != null && !['custom', 'space'].includes(String(data.locationMode))) throw new Error('A plant has an invalid location source.');
    if (data.locationRevision != null && (typeof data.locationRevision !== 'number' || !Number.isInteger(data.locationRevision) || data.locationRevision < 0)) throw new Error('A location revision is invalid.');
    for (const key of ['timeZone', 'locationTimeZone']) if (data[key] != null) { try { if (typeof data[key] !== 'string') throw new Error(); new Intl.DateTimeFormat('en', { timeZone: data[key] as string }).format(new Date()); } catch { throw new Error('A record has an invalid timezone.'); } }
    validateTree(data);
  }
  for (const record of value.records) {
    const parts = record.path.split('/');
    if (parts.length === 4 && !seen.has(`plants/${parts[1]}`)) throw new Error('A backup entry has no parent plant.');
    const data = record.data;
    if (parts[0] === 'plants' && parts.length === 2 && data.groupId && !seen.has(`groups/${data.groupId}`)) throw new Error('A plant references a missing growing space.');
    if (parts.length === 2 && data.sensorProfileId && !seen.has(`sensorProfiles/${data.sensorProfileId}`)) throw new Error('A sensor profile is missing from the backup.');
    if (parts[0] === 'groups' && (!Array.isArray(data.plantIds) || data.plantIds.length > 80 || data.plantIds.some((id: unknown) => typeof id !== 'string' || !seen.has(`plants/${id}`)))) throw new Error('A growing space references a missing plant.');
    for (const key of ['imageUri', 'imageUrl', 'url', 'photoUri']) {
      const uri = data[key];
      if (typeof uri !== 'string' || !uri) continue;
      if (uri.startsWith('firestore-photo:')) { const path = uri.slice(16); if (!seen.has(path) || path.split('/')[1] !== parts[1]) throw new Error('A photo reference is missing or belongs to another plant.'); }
      else if (!/^https:\/\//i.test(uri)) throw new Error('Only backed-up photos and HTTPS image links can be restored.');
    }
  }
  const membership = new Map<string, string>();
  const recordsByPath = new Map(value.records.map(record => [record.path, record]));
  for (const group of value.records.filter(record => /^groups\/[^/]+$/.test(record.path))) {
    const id = group.path.split('/')[1]; const ids = group.data.plantIds as string[];
    for (const plantId of ids) {
      if (membership.has(plantId) && membership.get(plantId) !== id) throw new Error('A plant is assigned to more than one growing space.');
      const plant = recordsByPath.get(`plants/${plantId}`)!;
      if (plant.data.environment !== group.data.environment || plant.data.groupId && plant.data.groupId !== id) throw new Error('Plant and growing-space membership do not agree.');
      membership.set(plantId, id);
      // Earlier backups had only the group's membership array. Restore copies
      // may infer a missing backlink when that membership is unambiguous.
      if (!plant.data.groupId) plant.data.groupId = id;
    }
    if (group.data.weatherSourcePlantId && !ids.includes(String(group.data.weatherSourcePlantId))) throw new Error('A growing-space weather source is not one of its members.');
  }
  for (const plant of value.records.filter(record => /^plants\/[^/]+$/.test(record.path))) if (plant.data.groupId && membership.get(plant.path.split('/')[1]) !== plant.data.groupId) throw new Error('A plant is missing from its growing space.');
  return value;
}
function isTimestamp(value: unknown): value is { $timestamp: number } { return isRecord(value) && typeof value.$timestamp === 'number' && Number.isFinite(value.$timestamp) && value.$timestamp >= -62135596800000 && value.$timestamp <= 253402300799999; }
function validateTree(value: unknown, depth = 0) {
  if (depth > 12) throw new Error('Backup nesting is invalid.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Backup contains an invalid number.');
  if (isRecord(value) && '$timestamp' in value && (!isTimestamp(value) || Object.keys(value).length !== 1)) throw new Error('Backup contains an invalid timestamp.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Backup contains an unsafe field.');
    validateTree(child, depth + 1);
  }
}
export function escapeCsv(value: unknown) { const text = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"'; }
