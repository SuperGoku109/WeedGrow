import type { PlantLog } from '@/firestoreModels';
import { plantDay } from '@/lib/dates/plantDay';
import { measurementKeys } from './logMeasurements';

function normalized(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') {
    if ('toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (Array.isArray(value)) return value.map(normalized);
    return Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'id' && item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]));
  }
  return value;
}
export function journalRevision(entry: Partial<PlantLog>) { return JSON.stringify(normalized({ ...entry, updatedBy: entry.updatedBy || '' })); }
export function journalPayload(input: Partial<PlantLog>, date: string) {
  const keys = ['type', 'category', 'description', ...measurementKeys, 'careCheck', 'inspectionResult', 'photoUri'] as const;
  return JSON.stringify(normalized({ date, ...Object.fromEntries(keys.map(key => [key, key === 'description' ? input[key] || '' : input[key] ?? null])) }));
}
export function journalEntryPayload(entry: PlantLog) { return journalPayload(entry, entry.calendarDay || plantDay(entry.timestamp.toDate(), entry.timeZone)); }
export function journalTargetId(input: Partial<PlantLog>, date: string, requestId: string, existing?: { id: string; type: PlantLog['type'] }) {
  return input.type === 'watering' ? `watering_${date}` : existing?.type === 'watering' ? requestId : existing?.id || requestId;
}
export interface JournalAttempt {
  requestId: string;
  targetId: string;
  date: string;
  input: Omit<PlantLog, 'timestamp'>;
  baseline?: string;
  sourceId?: string;
}
