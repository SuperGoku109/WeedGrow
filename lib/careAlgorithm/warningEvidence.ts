import type { Variable, WeatherSample } from './types';
import { validSample } from './weather';
import type { WarningWindow } from './warnings';

/** Coverage declarations cannot override missing values, wrong support, gaps or unresolved revisions. */
export function warningEvidence(window: WarningWindow, variable: Variable, locationRevision: number, supports: readonly WeatherSample['time_support'][], intervals = false) {
  const raw = window.samples.filter(s => s && s.variable === variable && s.location_revision === locationRevision
    && s.valid_start_utc >= window.startUtc && s.valid_end_utc <= window.endUtc
    && (window.phase === 'forecast24h' ? s.kind === 'forecast' : s.kind !== 'forecast'));
  const paths = new Set(raw.map(s => JSON.stringify([s.provider, s.product, s.model_selection])));
  if (paths.size > 1) return { rows: [] as WeatherSample[], complete: false, reason: 'unselected_warning_sources' };
  const groups = new Map<string, WeatherSample[]>();
  for (const s of raw) {
    const key = JSON.stringify([s.valid_start_utc, s.valid_end_utc, s.time_support]);
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const rows: WeatherSample[] = []; let conflict = false;
  for (const group of groups.values()) {
    if (new Set(group.map(s => JSON.stringify([s.source_revision, s.quality, s.value]))).size > 1) { conflict = true; continue; }
    const s = group[0];
    if (validSample(s) && s.quality === 'ok' && supports.includes(s.time_support)) rows.push(s);
  }
  rows.sort((a, b) => a.valid_start_utc - b.valid_start_utc || a.valid_end_utc - b.valid_end_utc);
  if (intervals && rows.some((s, i) => i > 0 && s.valid_start_utc < rows[i - 1].valid_end_utc)) {
    return { rows: [] as WeatherSample[], complete: false, reason: 'overlapping_warning_integrals' };
  }
  const valid = raw.length > 0 && raw.every(s => validSample(s) && s.quality === 'ok' && supports.includes(s.time_support));
  const covered = !intervals || rows.length > 0 && rows[0].valid_start_utc === window.startUtc
    && rows[rows.length - 1].valid_end_utc === window.endUtc && rows.every((s, i) => !i || s.valid_start_utc === rows[i - 1].valid_end_utc);
  return { rows, complete: window.completeVariables.includes(variable) && valid && !conflict && covered,
    reason: conflict ? 'warning_revision_conflict' : valid && covered ? null : 'warning_coverage_missing' };
}
