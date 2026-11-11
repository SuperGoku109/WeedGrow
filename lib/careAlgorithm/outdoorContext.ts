import { plantDay } from '@/lib/dates/plantDay';
import { occurrenceWindow } from './events';
import type { Plant, PlantLog } from '@/firestoreModels';
import type { WeatherSample } from './types';
import { revisionFingerprint } from './revisions';
import { WIND_POLICY } from './windPolicy';
export type Moisture = 'DRY' | 'MOIST' | 'WET';
export type Drying = 'SLOW' | 'NORMAL' | 'FAST' | 'UNKNOWN';
export const OUTDOOR_POLICY = {
  freshnessHours: 24, fastFreshnessHours: 12, wateringPauseHours: 12,
  checkHours: 24, fastCheckHours: 12, slowCheckHours: 36,
  warmC: 28, coolC: 18, hotC: 35, coldC: 4, anomalyC: 6, severeChangeC: 12,
  lowHumidity: 45, highHumidity: 85, windMs: 6, severeWindMs: WIND_POLICY.gustMs, severeSustainedWindMs: WIND_POLICY.sustainedMs,
  moderateRainMm: 5, heavyRainMm: 20, trendHours: 6, wetSpanHours: 24,
  learningTransitions: 3, learningWindowDays: 14, maxWeatherAgeHours: 1,
  learningStepHours: 6, soonHours: 6, signalFreshHours: 6, humidTrendWindowHours: 24,
  mildewMinC: 15, mildewMaxC: 28, botrytisHumidity: 90, botrytisMinC: 10, botrytisMaxC: 25,
  minLearningGapHours: 2, maxLearningGapHours: 48, smallPotL: 5, smallPotCheckHours: 3,
  wetHistoryHours: 72, pestFollowupDays: 7, recommendationLifetimeMinutes: 30,
  dryingWindowHours: 6, minimumWeatherHours: 3, baselineDays: 7, baselineDaysPerHour: 3,
  extremeWindMs: 30, extremeHeatC: 40, freezingC: 0, extremeRainMm: 40,
} as const;
export type OutdoorPolicy = { [K in keyof typeof OUTDOOR_POLICY]: number };
export function utcSeconds(value: unknown): number | null {
  try {
    if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
    const date: unknown = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() / 1000 : null;
  } catch { return null; }
}
export function careConfiguration(plant: Plant) {
  return revisionFingerprint({ location: plant.location, revision: plant.locationRevision, environment: plant.environment,
    pot: plant.potSize, potMaterial: plant.potMaterial, potType: plant.potType, potDrainage: plant.potDrainage, growingSite: plant.growingSite, plantedIn: plant.plantedIn, medium: plant.careMedium, soilType: plant.soilType, protection: plant.permanentProtection, sun: plant.sunlightExposure, rain: plant.rainReception, stage: plant.growthStage });
}
export interface Observation { id: string; at: number; state: Moisture; configuration?: string; precise: boolean; feedback?: PlantLog['inspectionFeedback'] }
export function normalizeObservations(logs: readonly PlantLog[], now: number): Observation[] {
  const groups = new Map<string, (Observation & { revisionAt: number })[]>();
  for (const [i, log] of logs.entries()) {
    const at = utcSeconds(log.timestamp), edited = utcSeconds(log.editedAt);
    if (at === null || at > now || edited !== null && edited > now || !['DRY', 'MOIST', 'WET'].includes(log.moistureState ?? '')) continue;
    const id = (log as PlantLog & { id?: string }).id ?? String(i);
    const row = { id, at, state: log.moistureState!, configuration: log.moistureConfiguration, precise: log.occurrencePrecision === 'time', feedback: log.inspectionFeedback, revisionAt: edited ?? at };
    const group = groups.get(id); if (group) group.push(row); else groups.set(id, [row]);
  }
  const rows: Observation[] = []; let conflictAt = -Infinity;
  for (const group of groups.values()) {
    const revisionAt = Math.max(...group.map(r => r.revisionAt));
    const current = group.filter(r => r.revisionAt === revisionAt);
    const signatures = new Set(current.map(r => JSON.stringify([r.at, r.state, r.configuration, r.precise, r.feedback])));
    if (signatures.size !== 1) { conflictAt = Math.max(conflictAt, ...current.map(r => r.at)); continue; }
    const row = current[0]; rows.push({ id: row.id, at: row.at, state: row.state, configuration: row.configuration, precise: row.precise, feedback: row.feedback });
  }
  const states = new Map<number, Set<Moisture>>();
  for (const row of rows) { const values = states.get(row.at) ?? new Set<Moisture>(); values.add(row.state); states.set(row.at, values); }
  for (const [at, values] of states) if (values.size > 1) conflictAt = Math.max(conflictAt, at);
  // A contradictory newest report cannot revive an earlier report as current.
  const seen = new Set<number>();
  return rows.filter(r => r.at > conflictAt).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).filter(r => {
    if (seen.has(r.at)) return false; seen.add(r.at); return true;
  });
}
/** Choose a provider revision deterministically. Conflicting equal revisions are
 * unknown, rather than whichever row happened to arrive first. */
export function normalizeOutdoorWeather(samples: readonly WeatherSample[], now: number, policy: OutdoorPolicy) {
  const groups = new Map<string, WeatherSample[]>();
  for (const s of samples) {
    if (![s.available_at_utc, s.retrieved_at_utc, s.valid_start_utc, s.valid_end_utc].every(Number.isFinite)
      || !['occurred_estimate', 'current_point', 'forecast'].includes(s.kind)
      || s.issued_at_utc !== null && (!Number.isFinite(s.issued_at_utc) || s.issued_at_utc > s.retrieved_at_utc)
      || s.available_at_utc > now || s.retrieved_at_utc > now || now - s.retrieved_at_utc >= policy.maxWeatherAgeHours * 3600
      || s.valid_start_utc > s.valid_end_utc
      || (s.kind === 'forecast' ? s.valid_start_utc <= now || s.valid_end_utc > now + 86400 : s.valid_end_utc > now || s.valid_end_utc <= now - policy.learningWindowDays * 86400)) continue;
    const key = JSON.stringify([s.variable, s.kind, s.location_revision, s.time_support, s.valid_start_utc, s.valid_end_utc]);
    const group = groups.get(key); if (group) group.push(s); else groups.set(key, [s]);
  }
  const result: WeatherSample[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => b.retrieved_at_utc - a.retrieved_at_utc || b.available_at_utc - a.available_at_utc || a.source_revision.localeCompare(b.source_revision));
    const s = rows[0];
    if (rows.some(other => other.retrieved_at_utc === s.retrieved_at_utc && other.available_at_utc === s.available_at_utc && (other.value !== s.value || other.quality !== s.quality))) continue;
    if (s.quality !== 'ok' || s.value === null || !Number.isFinite(s.value)) continue;
    if (s.variable === 'air_rh_pct' && (s.value < 0 || s.value > 100)
      || s.variable === 'air_temperature_c' && (s.value < -60 || s.value > 60)
      || ['wind_speed_ms', 'wind_gust_ms', 'liquid_rain_mm'].includes(s.variable) && s.value < 0) continue;
    result.push(s);
  }
  return result.sort((a, b) => b.valid_end_utc - a.valid_end_utc || a.variable.localeCompare(b.variable) || a.kind.localeCompare(b.kind));
}
/** Compare the same local hours on prior days, so ordinary afternoon warming
 * is not mistaken for a local temperature anomaly. This is recent history,
 * not a climatological normal or a seasonal crop threshold. */
export function localTemperatureBaseline(samples: readonly WeatherSample[], plant: Plant, at: number, p: OutdoorPolicy, hours = 1): number | null {
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-GB', { timeZone: plant.locationTimeZone || 'UTC', hour: '2-digit', hourCycle: 'h23' }); } catch { return null; }
  const wanted = new Set(Array.from({ length: hours }, (_, i) => formatter.format(new Date((at - i * 3600) * 1000))));
  const groups = new Map<string, Map<number, number>>();
  for (const s of samples) {
    if (s.kind === 'forecast' || s.variable !== 'air_temperature_c' || s.value === null || s.valid_end_utc > at - 86400 || s.valid_end_utc <= at - p.baselineDays * 86400) continue;
    const hour = formatter.format(new Date(s.valid_end_utc * 1000));
    if (!wanted.has(hour)) continue;
    const days = groups.get(hour) ?? new Map<number, number>(); days.set(Math.floor(s.valid_end_utc / 86400), s.value); groups.set(hour, days);
  }
  const means: number[] = [];
  for (const hour of wanted) {
    const days = groups.get(hour); if (!days || days.size < p.baselineDaysPerHour) return null;
    const values = [...days.values()]; means.push(values.reduce((sum, v) => sum + v, 0) / values.length);
  }
  return means.reduce((sum, v) => sum + v, 0) / means.length;
}
export function dryingConditions(samples: readonly WeatherSample[], plant: Plant, at: number, p: OutdoorPolicy): Drying {
  const recent = samples.filter(s => s.kind !== 'forecast' && s.valid_end_utc <= at && s.valid_end_utc > at - p.dryingWindowHours * 3600);
  const values = (v: WeatherSample['variable']) => [...new Map(recent.filter(s => s.variable === v).map(s => [Math.floor(s.valid_end_utc / 3600), s.value!])).values()];
  const t = values('air_temperature_c'), rh = values('air_rh_pct'), wind = values('wind_speed_ms');
  if (t.length < p.minimumWeatherHours || rh.length < p.minimumWeatherHours || wind.length < p.minimumWeatherHours) return 'UNKNOWN';
  const mean = (a: number[]) => a.reduce((sum, v) => sum + v, 0) / a.length;
  const baseline = localTemperatureBaseline(samples, plant, at, p, p.dryingWindowHours);
  const warm = mean(t) >= p.warmC || baseline !== null && mean(t) >= baseline + p.anomalyC;
  const rain = recent.filter(s => s.variable === 'liquid_rain_mm' && s.time_support === 'interval_sum').reduce((sum, s) => sum + s.value!, 0);
  if (warm && (mean(rh) <= p.lowHumidity || mean(wind) >= p.windMs) && plant.sunlightExposure?.trim().toLowerCase() !== 'mostly shade') return 'FAST';
  if (mean(t) <= p.coolC && mean(rh) >= p.highHumidity || rain >= p.moderateRainMm && plant.rainReception?.soil === 'yes') return 'SLOW';
  return 'NORMAL';
}

/** Date-only care records retain their entire possible occurrence window. */
export function careEventWindow(log: PlantLog, plant: Plant, now: number) {
  const at = utcSeconds(log.timestamp);
  if (log.occurrencePrecision === 'time') return at !== null && at <= now ? { start: at, end: at } : null;
  const zone = log.timeZone || plant.locationTimeZone;
  if (!zone || at === null) return null;
  const day = log.calendarDay || plantDay(new Date(at * 1000), zone);
  try {
    let window: readonly [number, number];
    try { window = occurrenceWindow(day, zone, Math.min(utcSeconds(log.recordedAt) ?? now, now), now); }
    catch {
      const edited = utcSeconds(log.editedAt); if (edited === null) return null;
      window = occurrenceWindow(day, zone, Math.min(edited, now), now);
    }
    return { start: window[0], end: window[1] };
  } catch { return null; }
}
