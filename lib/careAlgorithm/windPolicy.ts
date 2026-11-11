/** General weather-preparation screens, not species-specific damage thresholds.
 * Met Office Beaufort guidance places mean winds around 40 km/h in strong-breeze
 * territory. Gusts are screened separately; ordinary breezes stay silent.
 * See docs/wind-alert-policy.md for rationale and limitations.
 */
import type { Plant } from '@/firestoreModels';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';

export const WIND_POLICY = {
  sustainedMs: 40 / 3.6,
  gustMs: 60 / 3.6,
  youngSustainedMs: 30 / 3.6,
  youngGustMs: 45 / 3.6,
  youngAgeDays: 14,
} as const;

export interface WindPlantContext {
  growthStage?: string | null; startedOn?: string | null; ageKnown?: boolean;
  ageDays?: number | null; ageRecordedAtUtc?: number | null; timeZone?: string | null;
}
/** Keep raw age inputs in the setup fingerprint; compute age at evaluation time. */
export function windPlantContext(plant: Plant): WindPlantContext {
  let recorded: number | null = null;
  try { const value = plant.ageRecordedAt?.toDate().getTime(); if (typeof value === 'number' && Number.isFinite(value)) recorded = value / 1000; } catch { /* Invalid age metadata remains unknown. */ }
  return { growthStage: plant.growthStage ?? null, startedOn: plant.startedOn ?? null, ageKnown: plant.ageKnown,
    ageDays: plant.ageDays ?? null, ageRecordedAtUtc: recorded, timeZone: plant.locationTimeZone ?? null };
}
export function windThresholds(context: WindPlantContext, nowUtc: number) {
  let ageDays: number | null = null;
  if (Number.isFinite(nowUtc) && context.ageKnown !== false) {
    let timeZone = context.timeZone || 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { timeZone = 'UTC'; }
    const today = plantDay(new Date(nowUtc * 1000), timeZone);
    if (context.startedOn) {
      if (isCalendarDay(context.startedOn)) {
        const days = (Date.parse(today) - Date.parse(context.startedOn)) / 86400000;
        if (Number.isInteger(days) && days >= 0) ageDays = days;
      }
    } else if (Number.isInteger(context.ageDays) && context.ageDays! >= 0 && typeof context.ageRecordedAtUtc === 'number'
      && Number.isFinite(context.ageRecordedAtUtc) && context.ageRecordedAtUtc <= nowUtc) {
      const recordedDay = plantDay(new Date(context.ageRecordedAtUtc * 1000), timeZone);
      ageDays = context.ageDays! + (Date.parse(today) - Date.parse(recordedDay)) / 86400000;
    }
  }
  const earlyStage = ['germination', 'seedling', 'clone'].includes(context.growthStage ?? '');
  const knownLaterStage = ['vegetative', 'flowering'].includes(context.growthStage ?? '');
  const youngAge = !knownLaterStage && ageDays !== null && ageDays <= WIND_POLICY.youngAgeDays;
  const vulnerable = earlyStage || youngAge;
  return { sustainedMs: vulnerable ? WIND_POLICY.youngSustainedMs : WIND_POLICY.sustainedMs,
    gustMs: vulnerable ? WIND_POLICY.youngGustMs : WIND_POLICY.gustMs, ageDays,
    basis: earlyStage ? 'early_growth_stage' : youngAge ? 'young_recorded_age' : 'standard_or_unknown',
    explanation: earlyStage ? `The recorded ${context.growthStage} stage uses the early-growth wind screen.`
      : youngAge ? `Recorded age is ${ageDays} days and growth stage is unknown; the early-growth wind screen applies.`
        : 'The standard wind screen applies; older age or greater height does not establish wind resistance.' };
}
