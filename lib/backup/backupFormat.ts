export interface BackupRecord { path: string; data: Record<string, unknown> }
export interface GardenBackup { format: 'weedgrow'; version: 1; backupId: string; exportedAt: string; records: BackupRecord[]; warnings?: string[] }
const ID = '[A-Za-z0-9_-]{1,100}';
const PATH = new RegExp(`^(plants/${ID}(/(logs|progressPics|photoAssets|weatherCache)/${ID})?|groups/${ID}|sensorProfiles/${ID})$`);
const allowed: Record<string, string[]> = {
  plants: ['currentWeather', 'careSnoozes', 'weatherHistoryBefore', 'locationTimeZone', 'careSkips', 'locationMode', 'locationRevision', 'locationChangedAt', 'name', 'strain', 'strainType', 'startedOn', 'ageEstimated', 'ageRecordedAt', 'groupId', 'locationLabel', 'owners', 'growthStage', 'ageDays', 'ageKnown', 'status', 'environment', 'plantedIn', 'potSize', 'sunlightExposure', 'wateringFrequency', 'fertilizer', 'feedingFrequency', 'pests', 'trainingTags', 'notes', 'imageUri', 'waterLevel', 'height', 'soilType', 'soilPh', 'permanentProtection', 'companionPlants', 'environmentNotes', 'location', 'locationNickname', 'sensorProfileId', 'reminderSchedule', 'createdAt', 'updatedAt', 'restoreOperationId', 'harvest'],
  weatherCache: ['timeZone', 'date', 'fetchedAt', 'forecasted', 'source', 'temperature', 'humidity', 'windSpeed', 'rainfall', 'uvIndex', 'weatherSummary', 'hourlySummary', 'dewPoint', 'cloudCoverage', 'windGust', 'sunrise', 'sunset', 'pop', 'nightHumidity', 'detailedTemps', 'sourceCoordinates', 'locationRevision', 'locationLabel', 'previousLocations'],
  logs: ['calendarDay', 'timeZone', 'movement', 'category', 'type', 'timestamp', 'description', 'photoUri', 'careCheck', 'inspectionResult', 'updatedBy', 'mutationId', 'editedAt', 'waterMl', 'nutrientMlPerL', 'ph', 'heightCm', 'soilMoisture', 'harvest'],
  progressPics: ['imageUrl', 'url', 'timestamp', 'caption'], photoAssets: ['dataUri'],
  groups: ['locationLabel', 'name', 'environment', 'plantIds', 'location', 'createdBy', 'createdAt', 'updatedAt', 'sensorProfileId', 'weatherSourcePlantId', 'restoreOperationId'],
  sensorProfiles: ['name', 'createdBy', 'createdAt', 'updatedAt', 'temperature', 'humidity', 'soilMoisture', 'light', 'source', 'readings', 'environment', 'description', 'type', 'settings', 'environmentType', 'isManual', 'defaultTemp', 'defaultHumidity', 'restoreOperationId'],
};
export function validateBackup(raw: string): GardenBackup {
  if (raw.length > 100 * 1024 * 1024) throw new Error('Choose a backup under 100 MB.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON. Choose a WeedGrow backup.'); }
  if (value?.format !== 'weedgrow' || value.version !== 1 || !/^[A-Za-z0-9_-]{1,40}$/.test(value.backupId) || !Array.isArray(value.records) || !value.records.length) throw new Error('This is not a supported WeedGrow backup.');
  if (value.records.length > 50000) throw new Error('Choose a backup with at most 50,000 records.');
  const seen = new Set<string>();
  for (const record of value.records) {
    if (!PATH.test(record.path) || seen.has(record.path) || !record.data || typeof record.data !== 'object' || Array.isArray(record.data)) throw new Error('The backup contains duplicate or invalid records.');
    seen.add(record.path);
    const parts = record.path.split('/');
    const kind = parts.length === 4 ? parts[2] : parts[0];
    if (Object.keys(record.data).some(key => !allowed[kind]?.includes(key))) throw new Error(`Unsupported fields in ${record.path}.`);
    const data = record.data;
    for (const key of ['description', 'caption', 'notes', 'wateringFrequency', 'feedingFrequency', 'strain']) if (data[key] != null && typeof data[key] !== 'string') throw new Error(`The ${key} field must be text.`);
    if (kind === 'logs') for (const [key, max] of [['waterMl', 1000000], ['nutrientMlPerL', 1000], ['ph', 14], ['heightCm', 10000], ['soilMoisture', 100]] as const) {
      if (data[key] != null && (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || (data[key] as number) < 0 || (data[key] as number) > max)) throw new Error(`The ${key} measurement is invalid.`);
    }
    if (kind === 'plants' && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 || !['germination', 'seedling', 'vegetative', 'flowering', 'clone'].includes(data.growthStage) || !['outdoor', 'indoor', 'greenhouse'].includes(data.environment) || !['pot', 'ground'].includes(data.plantedIn) || !['active', 'archived', 'harvested', 'dead'].includes(data.status))) throw new Error('A plant has invalid required fields.');
    if (kind === 'groups' && (typeof data.name !== 'string' || !data.name.trim() || !['outdoor', 'indoor', 'greenhouse'].includes(data.environment))) throw new Error('A space has invalid required fields.');
    if (kind === 'photoAssets' && (typeof data.dataUri !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.dataUri) || data.dataUri.length > (parts[3].endsWith('_thumb') ? 20480 : 184320))) throw new Error('An image is invalid or too large.');
    if (kind === 'logs' && (!['watering', 'fertilizing', 'note', 'photo', 'training', 'stage_change', 'harvest'].includes(data.type) || !isTimestamp(data.timestamp))) throw new Error('A journal entry has an invalid type or date.');
    if (kind === 'progressPics' && (!isTimestamp(data.timestamp) || typeof (data.imageUrl || data.url) !== 'string')) throw new Error('A photo has invalid metadata.');
    if (JSON.stringify(data).length > (kind === 'weatherCache' ? 800000 : 200000)) throw new Error('A backup record is too large.');
    if (kind === 'weatherCache' && (!isTimestamp(data.fetchedAt) || typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date))) throw new Error('A saved weather record has an invalid date.');
    if (kind === 'plants' && data.locationMode != null && !['custom', 'space'].includes(data.locationMode)) throw new Error('A plant has an invalid location source.');
    if (data.locationRevision != null && (!Number.isInteger(data.locationRevision) || data.locationRevision < 0)) throw new Error('A location revision is invalid.');
    for (const key of ['timeZone', 'locationTimeZone']) if (data[key] != null) { try { if (typeof data[key] !== 'string') throw new Error(); new Intl.DateTimeFormat('en', { timeZone: data[key] as string }).format(new Date()); } catch { throw new Error('A record has an invalid timezone.'); } }
    validateTree(data);
  }
  for (const record of value.records) {
    const parts = record.path.split('/');
    if (parts.length === 4 && !seen.has(`plants/${parts[1]}`)) throw new Error('A backup entry has no parent plant.');
    const data = record.data;
    if (parts[0] === 'plants' && parts.length === 2 && data.groupId && !seen.has(`groups/${data.groupId}`)) throw new Error('A plant references a missing growing space.');
    if (parts.length === 2 && data.sensorProfileId && !seen.has(`sensorProfiles/${data.sensorProfileId}`)) throw new Error('A sensor profile is missing from the backup.');
    if (parts[0] === 'groups' && (!Array.isArray(data.plantIds) || data.plantIds.length > 80 || data.plantIds.some((id: string) => !seen.has(`plants/${id}`)))) throw new Error('A growing space references a missing plant.');
    for (const key of ['imageUri', 'imageUrl', 'url', 'photoUri']) {
      const uri = data[key];
      if (typeof uri !== 'string' || !uri) continue;
      if (uri.startsWith('firestore-photo:')) { const path = uri.slice(16); if (!seen.has(path) || path.split('/')[1] !== parts[1]) throw new Error('A photo reference is missing or belongs to another plant.'); }
      else if (!/^https:\/\//i.test(uri)) throw new Error('Only backed-up photos and HTTPS image links can be restored.');
    }
  }
  return value;
}
function isTimestamp(value: unknown): value is { $timestamp: number } { return !!value && typeof value === 'object' && Number.isFinite((value as { $timestamp?: number }).$timestamp) && Math.abs((value as { $timestamp: number }).$timestamp) < 8640000000000000; }
function validateTree(value: unknown, depth = 0) {
  if (depth > 12) throw new Error('Backup nesting is invalid.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Backup contains an invalid number.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Backup contains an unsafe field.');
    validateTree(child, depth + 1);
  }
}
export function escapeCsv(value: unknown) { const text = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"'; }
