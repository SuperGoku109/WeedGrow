import { addDays, isCalendarDay, zonedTime } from '@/lib/dates/plantDay';
import { finite } from './types';

export interface LiveWaterEvent { id: string; revision: number; deleted?: false; startUtc: number; endUtc: number; appliedL: number | null; availableUtc?: number }
export interface DeletedWaterEvent { id: string; revision: number; deleted: true; availableUtc?: number }
export type WaterEvent = LiveWaterEvent | DeletedWaterEvent;
export function occurrenceWindow(day: string, zone: string, recordedUtc: number, evaluationUtc: number): readonly [number, number] {
  if (!isCalendarDay(day) || !zone || !finite(recordedUtc) || !finite(evaluationUtc)) throw new Error('invalid_occurrence');
  // Refuse the display helper's legacy device-zone fallback for inference.
  new Intl.DateTimeFormat('en', { timeZone: zone }).format();
  const start = zonedTime(day, '00:00', zone).getTime() / 1000;
  const end = Math.min(zonedTime(addDays(day, 1), '00:00', zone).getTime() / 1000, recordedUtc, evaluationUtc);
  if (end < start) throw new Error('future_occurrence');
  return [start, end];
}
export function canonicalEvents(events: readonly WaterEvent[], asOfUtc = Infinity) {
  const groups = new Map<string, WaterEvent[]>(); const issues: string[] = [];
  for (const e of events) {
    if (e && finite(e.availableUtc) && e.availableUtc > asOfUtc) continue;
    if (!e || typeof e.id !== 'string' || !e.id.trim() || !Number.isInteger(e.revision) || e.revision < 0) { issues.push('invalid_event_identity'); continue; }
    if (e.availableUtc !== undefined && !finite(e.availableUtc)) { issues.push('invalid_event_availability'); continue; }
    if (e.availableUtc !== undefined && e.availableUtc > asOfUtc) continue;
    groups.set(e.id, [...(groups.get(e.id) || []), e]);
  }
  const selected: LiveWaterEvent[] = [];
  for (const rows of groups.values()) {
    const revision = Math.max(...rows.map(e => e.revision)); const latest = rows.filter(e => e.revision === revision);
    if (latest.some(e => e.deleted !== undefined && typeof e.deleted !== 'boolean'
      || e.deleted !== true && (!finite(e.startUtc) || !finite(e.endUtc) || e.startUtc > e.endUtc
        || e.appliedL !== null && (!finite(e.appliedL) || e.appliedL < 0)))) { issues.push('invalid_event'); continue; }
    const signatures = new Set(latest.map(e => e.deleted === true ? 'deleted' : JSON.stringify([false, e.startUtc, e.endUtc, e.appliedL])));
    if (signatures.size !== 1) { issues.push('event_revision_conflict'); continue; }
    const e = latest[0];
    if (e.deleted) continue;
    if (!finite(e.startUtc) || !finite(e.endUtc) || e.startUtc > e.endUtc
      || (e.appliedL !== null && (!finite(e.appliedL) || e.appliedL < 0))) { issues.push('invalid_event'); continue; }
    selected.push({ ...e });
  }
  return { events: selected.sort((a, b) => a.startUtc - b.startUtc || a.id.localeCompare(b.id)), issues };
}
