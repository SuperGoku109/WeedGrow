import { finite } from './types';
import { occurrenceWindow, type WaterEvent } from './events';

/** Boundary values have already been decoded from server timestamps into UTC seconds. */
export interface WaterLogFact {
  type: unknown; occurredUtc: number | null; recordedUtc: number | null; assertedUtc: number | null;
  calendarDay: unknown; timeZone: unknown; precision: unknown; waterMl: unknown;
}
export function normalizeWaterLog(id: string, revision: number, fact: WaterLogFact | null, availableUtc: number) {
  const invalid = (reason: string) => ({ event: null as WaterEvent | null, reasonCodes: [reason] });
  if (!id || !Number.isInteger(revision) || revision < 1 || !finite(availableUtc)) return invalid('invalid_event_metadata');
  if (!fact || fact.type !== 'watering') return { event: { id, revision, deleted: true, availableUtc } as WaterEvent, reasonCodes: [] };
  if (fact.waterMl != null && (!finite(fact.waterMl) || fact.waterMl < 0)) return invalid('invalid_watering_amount');
  const appliedL = fact.waterMl == null ? null : (fact.waterMl as number) / 1000;
  let startUtc: number; let endUtc: number; const reasons: string[] = [];
  if (fact.precision === 'time') {
    if (!finite(fact.occurredUtc) || fact.occurredUtc > availableUtc) return invalid('exact_occurrence_unavailable');
    startUtc = endUtc = fact.occurredUtc;
  } else {
    if (typeof fact.calendarDay !== 'string' || typeof fact.timeZone !== 'string' || !fact.timeZone) return invalid('date_occurrence_zone_or_day_unknown');
    try {
      // Preserve the original recording cap where it is consistent. A corrected day may require the
      // current revision's assertion cap, but never uses edit time as an exact occurrence timestamp.
      let upper = finite(fact.recordedUtc) ? Math.min(fact.recordedUtc, availableUtc) : availableUtc;
      try { [startUtc, endUtc] = occurrenceWindow(fact.calendarDay, fact.timeZone, upper, availableUtc); }
      catch {
        if (!finite(fact.assertedUtc)) return invalid('date_occurrence_metadata_conflict');
        upper = Math.min(fact.assertedUtc, availableUtc);
        [startUtc, endUtc] = occurrenceWindow(fact.calendarDay, fact.timeZone, upper, availableUtc);
        reasons.push('revised_day_assertion_cap');
      }
      if (fact.precision !== 'date') reasons.push('legacy_occurrence_bounded_to_declared_day');
    } catch { return invalid('invalid_date_occurrence'); }
  }
  return { event: { id, revision, startUtc, endUtc, appliedL, availableUtc } as WaterEvent, reasonCodes: reasons };
}
