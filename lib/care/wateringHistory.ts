import type { PlantLog } from '@/firestoreModels';
import { addDays, isCalendarDay, plantDay } from '@/lib/dates/plantDay';
export interface WateringDay { day: string; waterMl: number | null; wateringCount: number; unknownAmounts: number; checks: ('DRY' | 'MOIST' | 'WET')[] }
/** Recorded amounts and categorical observations only. Missing entries are gaps. */
export function wateringHistory(logs: readonly PlantLog[], first: string, last: string, zone: string | null | undefined, now = new Date()): WateringDay[] {
  if (!isCalendarDay(first) || !isCalendarDay(last) || last < first || Date.parse(last) - Date.parse(first) >= 90 * 86400000) return [];
  const days = new Map<string, WateringDay>();
  for (let day = first; day <= last; day = addDays(day, 1)) days.set(day, { day, waterMl: null, wateringCount: 0, unknownAmounts: 0, checks: [] });
  const seen = new Set<string>();
  for (const log of logs) {
    let time: Date; try { time = log.timestamp.toDate(); } catch { continue; }
    if (!Number.isFinite(time.getTime()) || time > now) continue;
    const id = (log as PlantLog & { id?: string }).id || log.mutationId || `${time.getTime()}:${log.type}:${log.waterMl}:${log.moistureState}`;
    if (seen.has(id)) continue; seen.add(id);
    const day = log.occurrencePrecision === 'date' && log.calendarDay ? log.calendarDay : plantDay(time, zone || 'UTC');
    const row = days.get(day); if (!row) continue;
    if (log.type === 'watering') {
      row.wateringCount++;
      if (typeof log.waterMl === 'number' && Number.isFinite(log.waterMl) && log.waterMl >= 0) row.waterMl = (row.waterMl ?? 0) + log.waterMl;
      else row.unknownAmounts++;
    }
    if (['DRY', 'MOIST', 'WET'].includes(log.moistureState ?? '')) row.checks.push(log.moistureState!);
  }
  return [...days.values()];
}
