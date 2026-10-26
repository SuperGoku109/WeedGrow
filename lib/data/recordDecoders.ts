import type { Plant, Group, PlantLog, WeatherCacheEntry, ProgressPic } from '@/firestoreModels';
import type { Timestamp } from 'firebase/firestore';
import { isCalendarDay } from '@/lib/dates/plantDay';
export function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function publishDecoded<T>(read: () => T, publish: (data: T) => void, fail: (reason: unknown) => void) { try { publish(read()); } catch (error) { fail(error); } }
export class RecordDecodeError extends Error {
  constructor(path: string, field: string) { super(`Saved data at ${path} has an invalid ${field} field. Reload or repair this record before continuing.`); this.name = 'RecordDecodeError'; }
}
function record(value: unknown, path: string) { if (!isRecord(value)) throw new RecordDecodeError(path, 'record'); return value; }
function check(ok: unknown, path: string, field: string): asserts ok { if (!ok) throw new RecordDecodeError(path, field); }
function text(value: unknown): value is string { return typeof value === 'string'; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function timestamp(value: unknown): value is Timestamp { return isRecord(value) && typeof value.toMillis === 'function' && typeof value.toDate === 'function' && Number.isFinite(value.toMillis()); }
function optional(data: Record<string, unknown>, keys: string[], valid: (value: unknown) => boolean, path: string) { for (const key of keys) if (data[key] != null) check(valid(data[key]), path, key); }
function point(value: unknown) { return isRecord(value) && finite(value.lat) && finite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180; }
function clocks(data: Record<string, unknown>, path: string) { optional(data, ['createdAt', 'updatedAt', 'ageRecordedAt', 'locationChangedAt', 'editedAt'], timestamp, path); }
export function decodePlant(value: unknown, path: string): Plant {
  const data = record(value, path);
  check(text(data.name) && !!data.name.trim(), path, 'name'); check(strings(data.owners) && data.owners.length, path, 'owners');
  check(['germination', 'seedling', 'vegetative', 'flowering', 'clone'].includes(String(data.growthStage)), path, 'growthStage');
  check(['outdoor', 'indoor', 'greenhouse'].includes(String(data.environment)), path, 'environment'); check(['pot', 'ground'].includes(String(data.plantedIn)), path, 'plantedIn');
  check(['active', 'archived', 'harvested', 'dead'].includes(String(data.status)), path, 'status');
  optional(data, ['strain', 'strainType', 'startedOn', 'groupId', 'locationLabel', 'locationTimeZone', 'locationNickname', 'sensorProfileId', 'potSize', 'sunlightExposure', 'wateringFrequency', 'feedingFrequency', 'fertilizer', 'notes', 'imageUri', 'soilType', 'soilPh', 'permanentProtection', 'environmentNotes'], text, path);
  optional(data, ['ageDays'], value => finite(value) && Number.isInteger(value) && value >= 0 && value <= 36500, path);
  optional(data, ['height'], value => finite(value) && value >= 0 && value <= 10000, path);
  optional(data, ['waterLevel'], value => finite(value) && value >= 0 && value <= 1, path);
  optional(data, ['ageKnown', 'ageEstimated', 'deleting'], value => typeof value === 'boolean', path);
  optional(data, ['locationRevision'], value => finite(value) && Number.isInteger(value) && value >= 0, path);
  optional(data, ['pests', 'trainingTags', 'companionPlants'], strings, path); optional(data, ['location'], point, path); clocks(data, path);
  if (data.locationMode != null) check(['custom', 'space'].includes(String(data.locationMode)), path, 'locationMode');
  for (const field of ['careSnoozes', 'careSkips']) if (data[field] != null) { const entries = record(data[field], path); check(Object.values(entries).every(field === 'careSnoozes' ? finite : value => text(value) && isCalendarDay(value)), path, field); }
  if (data.reminderSchedule != null) { const schedule = record(data.reminderSchedule, path); check(['none', 'interval', 'custom'].includes(String(schedule.type)), path, 'reminderSchedule'); optional(schedule, ['intervalDays'], finite, path); optional(schedule, ['customDays'], strings, path); optional(schedule, ['timeOfDay'], text, path); }
  if (data.currentWeather != null) decodeWeather(data.currentWeather, `${path}/currentWeather`);
  if (data.harvest != null) { const harvest = record(data.harvest, path); check(text(harvest.date) && text(harvest.recordId) && text(harvest.notes), path, 'harvest'); optional(harvest, ['weightGrams'], finite, path); }
  // Missing optional legacy metadata remains explicitly unknown.
  return { ...data, strain: data.strain ?? '', createdAt: data.createdAt ?? null, updatedAt: data.updatedAt ?? null } as unknown as Plant;
}
export function decodeGroup(value: unknown, path: string): Group {
  const data = record(value, path); check(text(data.name) && !!data.name.trim(), path, 'name'); check(text(data.createdBy), path, 'createdBy');
  check(['outdoor', 'indoor', 'greenhouse'].includes(String(data.environment)), path, 'environment'); check(strings(data.plantIds), path, 'plantIds');
  optional(data, ['location'], point, path); optional(data, ['sensorProfileId', 'weatherSourcePlantId', 'locationLabel'], text, path); clocks(data, path);
  return { ...data, plantIds: [...new Set(data.plantIds)], location: data.location ?? null, createdAt: data.createdAt ?? null, updatedAt: data.updatedAt ?? null } as unknown as Group;
}
export function decodeLog(value: unknown, path: string): PlantLog {
  const data = record(value, path); check(['watering', 'fertilizing', 'note', 'photo', 'training', 'stage_change', 'harvest'].includes(String(data.type)), path, 'type'); check(timestamp(data.timestamp), path, 'timestamp');
  optional(data, ['description', 'updatedBy', 'photoUri', 'calendarDay', 'timeZone', 'mutationId'], text, path);
  optional(data, ['waterMl', 'nutrientMlPerL', 'ph', 'heightCm', 'soilMoisture'], finite, path); clocks(data, path);
  if (data.category != null) check(['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(String(data.category)), path, 'category');
  if (data.movement != null) { const movement = record(data.movement, path); optional(movement, ['from', 'to'], point, path); optional(movement, ['fromLabel', 'toLabel'], text, path); check(finite(movement.revision), path, 'movement'); }
  return { ...data, updatedBy: data.updatedBy ?? '' } as unknown as PlantLog;
}
export function decodeWeather(value: unknown, path: string, depth = 0): WeatherCacheEntry {
  const data = record(value, path); check(depth < 4, path, 'previousLocations');
  check(text(data.date) && isCalendarDay(data.date), path, 'date'); check(timestamp(data.fetchedAt), path, 'fetchedAt');
  for (const field of ['temperature', 'humidity', 'windSpeed', 'rainfall', 'uvIndex']) check(finite(data[field]), path, field);
  optional(data, ['dewPoint', 'cloudCoverage', 'windGust', 'pop', 'nightHumidity', 'locationRevision'], finite, path);
  optional(data, ['source', 'weatherSummary', 'timeZone', 'locationLabel', 'sunrise', 'sunset'], text, path); optional(data, ['sourceCoordinates'], point, path);
  optional(data, ['forecasted'], value => typeof value === 'boolean', path);
  if (data.detailedTemps != null) check(Object.values(record(data.detailedTemps, path)).every(value => value == null || finite(value)), path, 'detailedTemps');
  if (data.hourlySummary != null) check(Object.values(record(data.hourlySummary, path)).every(finite), path, 'hourlySummary');
  if (data.previousLocations != null) { check(Array.isArray(data.previousLocations) && data.previousLocations.length <= 500, path, 'previousLocations'); data.previousLocations.forEach((entry, index) => decodeWeather(entry, `${path}/previousLocations/${index}`, depth + 1)); }
  return { ...data, source: data.source ?? 'Unknown source', weatherSummary: data.weatherSummary ?? '', forecasted: data.forecasted === true } as unknown as WeatherCacheEntry;
}
export function decodePhoto(value: unknown, id: string, path: string): ProgressPic {
  const data = record(value, path); check(text(data.imageUrl || data.url), path, 'imageUrl'); optional(data, ['caption'], text, path); optional(data, ['timestamp'], timestamp, path);
  return { ...data, id, imageUrl: (data.imageUrl || data.url) as string } as ProgressPic;
}
export function decodeProfile(value: unknown, id: string, path: string) {
  const data = record(value, path); check(text(data.createdBy), path, 'createdBy'); optional(data, ['name'], text, path); optional(data, ['defaultTemp', 'defaultHumidity'], finite, path); clocks(data, path);
  if (data.environmentType != null) check(['indoor', 'greenhouse'].includes(String(data.environmentType)), path, 'environmentType'); optional(data, ['isManual', 'deleting'], value => typeof value === 'boolean', path);
  return { ...data, id, name: data.name == null ? 'Unnamed profile' : data.name } as { id: string; name: string; createdBy: string; environmentType?: 'indoor' | 'greenhouse'; isManual?: boolean; defaultTemp?: number | null; defaultHumidity?: number | null; deleting?: boolean };
}
