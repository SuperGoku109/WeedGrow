import { finite, type Variable, type WeatherSample, type WaterResult } from './types';

export const UNITS: Record<Variable, string> = { air_temperature_c: '°C', air_rh_pct: '%', air_dewpoint_c: '°C',
  wind_speed_ms: 'm/s', wind_gust_ms: 'm/s', shortwave_w_m2: 'W/m²', et0_mm: 'mm', liquid_rain_mm: 'mm', rain_rate_mm_h: 'mm/h' };
export function validSample(s: WeatherSample): boolean {
  if (!s || s.schema_version !== '8.4' || !Object.hasOwn(UNITS, s.variable) || s.unit !== UNITS[s.variable]
    || ![s.provider, s.product, s.source_revision, s.model_selection, s.model_selection_basis].every(v => typeof v === 'string' && v.trim())
    || !Number.isInteger(s.location_revision) || s.location_revision < 0 || !Array.isArray(s.reason_codes)
    || !s.reason_codes.every(v => typeof v === 'string')
    || ![s.retrieved_at_utc, s.available_at_utc, s.valid_start_utc, s.valid_end_utc].every(finite)
    || s.available_at_utc > s.retrieved_at_utc || (s.issued_at_utc !== null && (!finite(s.issued_at_utc) || s.issued_at_utc > s.available_at_utc))
    || !['occurred_estimate', 'forecast', 'current_point'].includes(s.kind)
    || !['point', 'interval_sum', 'interval_mean', 'interval_maximum', 'rate'].includes(s.time_support)
    || !['ok', 'missing', 'invalid'].includes(s.quality)) return false;
  if (s.kind !== 'forecast' && s.valid_end_utc > s.retrieved_at_utc) return false;
  if (['point', 'rate'].includes(s.time_support) ? s.valid_start_utc !== s.valid_end_utc : s.valid_start_utc >= s.valid_end_utc) return false;
  if (s.quality !== 'ok') return s.value === null;
  if (!finite(s.value)) return false;
  if (s.variable === 'air_rh_pct') return s.value >= 0 && s.value <= 100;
  if (s.variable === 'air_temperature_c' || s.variable === 'air_dewpoint_c') return s.value >= -60 && s.value <= 60;
  return s.value >= 0;
}
export interface SourceSelection {
  provider: string; product: string; modelSelection: string;
  sourceRevision?: string;
  /** Explicit nonoverlapping revision windows allow corrected/backfilled history without combining sources. */
  revisionWindows?: readonly { sourceRevision: string; startUtc: number; endUtc: number }[];
}
export function selectSamples(samples: readonly WeatherSample[], variable: Variable, selection: SourceSelection, locationRevision: number, asOfUtc: number) {
  const windows = selection.revisionWindows ? [...selection.revisionWindows].sort((a, b) => a.startUtc - b.startUtc) : null;
  if (windows && (selection.sourceRevision !== undefined || !windows.length || windows.some((w, i) => typeof w.sourceRevision !== 'string' || !w.sourceRevision
    || !finite(w.startUtc) || !finite(w.endUtc) || w.startUtc >= w.endUtc || i > 0 && w.startUtc < windows[i - 1].endUtc))) return [];
  if (!windows && (typeof selection.sourceRevision !== 'string' || !selection.sourceRevision)) return [];
  return samples.filter(s => validSample(s) && s.variable === variable && s.provider === selection.provider
    && s.product === selection.product && s.model_selection === selection.modelSelection
    && (windows ? windows.some(w => s.source_revision === w.sourceRevision && s.valid_start_utc >= w.startUtc && s.valid_end_utc <= w.endUtc) : s.source_revision === selection.sourceRevision)
    && s.location_revision === locationRevision && s.available_at_utc <= asOfUtc
    && (s.kind === 'forecast' || s.valid_end_utc <= asOfUtc));
}
/** No point-to-hour conversion. Reject conflicts/overlaps; identical retries count once. */
export function integralPath(samples: readonly WeatherSample[], start: number, end: number, kind: WeatherSample['kind']) {
  if (!finite(start) || !finite(end) || start >= end) return { complete: false, total: null, reason: 'invalid_integral_window', rows: [] };
  const unique = new Map<string, WeatherSample>();
  for (const s of samples) {
    if (s.kind !== kind || s.valid_end_utc <= start || s.valid_start_utc >= end) continue;
    const key = `${s.provider}:${s.product}:${s.source_revision}:${s.variable}:${s.valid_start_utc}:${s.valid_end_utc}`;
    const previous = unique.get(key);
    if (previous && (previous.value !== s.value || previous.quality !== s.quality)) return { complete: false, total: null, reason: 'conflicting_integrals', rows: [] };
    unique.set(key, s);
  }
  const rows = [...unique.values()].sort((a, b) => a.valid_start_utc - b.valid_start_utc);
  const paths = new Set(rows.map(s => JSON.stringify([s.variable, s.provider, s.product, s.model_selection, s.location_revision])));
  if (paths.size > 1) return { complete: false, total: null, reason: 'mixed_integral_paths', rows: [] };
  let cursor = start; let total = 0;
  for (const s of rows) {
    if (!validSample(s) || s.time_support !== 'interval_sum' || s.quality !== 'ok') return { complete: false, total: null, reason: 'unsupported_integral', rows: [] };
    if (s.valid_start_utc < cursor || s.valid_end_utc > end) return { complete: false, total: null, reason: 'overlap_or_partial_boundary', rows: [] };
    if (s.valid_start_utc !== cursor) return { complete: false, total: null, reason: 'history_gap', rows: [] };
    total += s.value!; cursor = s.valid_end_utc;
  }
  return { complete: cursor === end && end > start, total: cursor === end && end > start ? total : null,
    reason: cursor === end && end > start ? null : 'history_gap', rows };
}

/** A partial completed sum contributes [0,total], never a uniform fraction. Future bins cannot supply bounds. */
export function boundedOccurredIntegral(samples: readonly WeatherSample[], start: number, end: number) {
  const rows = samples.filter(s => s.kind === 'occurred_estimate' && s.valid_end_utc > start && s.valid_start_utc < end);
  const pathStart = rows.length ? Math.min(...rows.map(s => s.valid_start_utc)) : start;
  const pathEnd = rows.length ? Math.max(...rows.map(s => s.valid_end_utc)) : end;
  const path = integralPath(rows, pathStart, pathEnd, 'occurred_estimate');
  if (!path.complete || pathStart > start || pathEnd < end) return { complete: false, lower: 0, upper: 0, rows: [] as WeatherSample[], partial: false };
  let lower = 0; let upper = 0; let partial = false;
  for (const row of path.rows) {
    upper += row.value!;
    if (row.valid_start_utc >= start && row.valid_end_utc <= end) lower += row.value!;
    else partial = true;
  }
  return { complete: true, lower, upper, rows: path.rows, partial };
}

/** Diagnostic only: never fills a gap, alters forcing, or treats an invalid interval as zero. */
export function occurredCoverageIssue(samples: readonly WeatherSample[], variable: 'et0_mm' | 'liquid_rain_mm', start: number, end: number): NonNullable<WaterResult['coverageIssue']> {
  const issue = (cause: NonNullable<WaterResult['coverageIssue']>['cause'], fromUtc: number, toUtc: number) => ({ variable, cause, fromUtc, toUtc });
  const seen = new Set<string>(); let cursor = start; let used = false;
  const rows = samples.filter(s => s.kind === 'occurred_estimate' && s.valid_end_utc > start && s.valid_start_utc < end)
    .sort((a, b) => a.valid_start_utc - b.valid_start_utc || a.valid_end_utc - b.valid_end_utc);
  for (const row of rows) {
    const key = JSON.stringify([row.valid_start_utc, row.valid_end_utc, row.time_support, row.value, row.quality]);
    if (seen.has(key)) continue; seen.add(key);
    const a = Math.max(start, row.valid_start_utc); const b = Math.min(end, row.valid_end_utc);
    if (row.time_support !== 'interval_sum') return issue('unsupported_support', a, b);
    if (row.valid_start_utc > cursor) return issue('gap', cursor, Math.min(end, row.valid_start_utc));
    if (row.quality !== 'ok') return issue(row.quality === 'missing' ? 'missing_value' : 'invalid_value', a, b);
    if (used && row.valid_start_utc < cursor) return issue('overlap', a, Math.min(cursor, b));
    cursor = b; used = true;
  }
  return issue('gap', cursor, end);
}

export interface ExposureBin { startUtc: number; endUtc: number; value: number | null; support: 'representative_bin' | 'point' | 'interval_maximum' }
export function exposure(bins: readonly ExposureBin[], threshold: number, direction: 'above' | 'below' = 'above') {
  if (!finite(threshold)) throw new Error('invalid_threshold');
  const rows = [...bins].sort((a, b) => a.startUtc - b.startUtc);
  let hours = 0; let degreeHours = 0; let longestHours = 0; let run = 0; let lastEnd: number | null = null;
  let crossing = false;
  for (const b of rows) {
    if (!finite(b.startUtc) || !finite(b.endUtc) || b.endUtc < b.startUtc) throw new Error('invalid_exposure_interval');
    const delta = b.value === null || !finite(b.value) ? null : direction === 'above' ? b.value - threshold : threshold - b.value;
    if (delta !== null && delta >= 0) crossing = true;
    if (b.support !== 'representative_bin') continue;
    if (lastEnd !== null && b.startUtc < lastEnd) return { crossing, hours: null, degreeHours: null, longestHours: null, reason: 'overlapping_exposure' };
    if (b.startUtc !== lastEnd || delta === null || delta < 0) run = 0;
    const dt = (b.endUtc - b.startUtc) / 3600;
    if (delta !== null && delta >= 0) { hours += dt; degreeHours += delta * dt; run += dt; longestHours = Math.max(longestHours, run); }
    lastEnd = b.endUtc;
  }
  return { crossing, hours, degreeHours, longestHours, reason: 'representative_bin_approximation' };
}

/** Missing RH only; invalid RH cannot be repaired by hiding its quality flag. */
export function pairedAirFallback(t: WeatherSample, rh: WeatherSample, dew: WeatherSample) {
  const rows = [t, rh, dew];
  const paired = rows.every(s => validSample(s) && s.provider === t.provider && s.product === t.product && s.source_revision === t.source_revision
    && s.location_revision === t.location_revision && s.valid_start_utc === t.valid_start_utc && s.valid_end_utc === t.valid_end_utc
    && s.kind === t.kind && s.time_support === t.time_support);
  if (!paired || t.variable !== 'air_temperature_c' || rh.variable !== 'air_rh_pct' || dew.variable !== 'air_dewpoint_c'
    || t.time_support !== 'point' || rh.quality !== 'missing' || t.quality !== 'ok' || dew.quality !== 'ok'
    || t.value! < 0 || t.value! > 60 || dew.value! < 0 || dew.value! > t.value!) return null;
  const es = (c: number) => .6108 * Math.exp(17.27 * c / (c + 237.3));
  return { rhPct: 100 * es(dew.value!) / es(t.value!), airVpdKpa: es(t.value!) - es(dew.value!), basis: 'paired_air_dewpoint_fallback' };
}
