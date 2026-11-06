import type { WeatherSample } from './types';
import { validSample, type SourceSelection } from './weather';
import { revisionFingerprint } from './revisions';

/** Latest acquired immutable revision per exact interval. Invalid corrections cannot revive older values. */
export function selectWaterHistory(samples: readonly WeatherSample[], modelSelection: string, locationRevision: number, nowUtc: number) {
  const rows = samples.filter(s => validSample(s) && s.provider === 'Open-Meteo' && s.product === 'archive'
    && s.model_selection === modelSelection && s.location_revision === locationRevision && s.kind === 'occurred_estimate'
    && s.time_support === 'interval_sum' && ['et0_mm', 'liquid_rain_mm'].includes(s.variable)
    && s.available_at_utc <= nowUtc && s.valid_end_utc <= nowUtc);
  const selected: WeatherSample[] = []; const reasons: string[] = [];
  for (const variable of ['et0_mm', 'liquid_rain_mm'] as const) {
    const intervals = new Map<string, WeatherSample[]>();
    for (const row of rows.filter(s => s.variable === variable)) {
      const key = `${row.valid_start_utc}:${row.valid_end_utc}`;
      intervals.set(key, [...(intervals.get(key) ?? []), row]);
    }
    for (const values of intervals.values()) {
      const latest = Math.max(...values.map(s => s.available_at_utc));
      const current = values.filter(s => s.available_at_utc === latest);
      if (new Set(current.map(s => revisionFingerprint([s.source_revision, s.quality, s.value]))).size > 1) {
        reasons.push('equal_authority_history_conflict');
        // Preserve the affected variable/window as invalid. Unrelated/sheltered paths remain usable.
        selected.push({ ...current[0], quality: 'invalid', value: null, reason_codes: [...current[0].reason_codes, 'equal_authority_history_conflict'] });
      } else selected.push(current[0]);
    }
  }
  const source = (variable: 'et0_mm' | 'liquid_rain_mm'): SourceSelection => ({ provider: 'Open-Meteo', product: 'archive', modelSelection,
    revisionWindows: selected.filter(s => s.variable === variable).sort((a, b) => a.valid_start_utc - b.valid_start_utc)
      .map(s => ({ sourceRevision: s.source_revision, startUtc: s.valid_start_utc, endUtc: s.valid_end_utc })) });
  return { samples: selected, et0Source: source('et0_mm'), rainSource: source('liquid_rain_mm'), reasonCodes: [...new Set(reasons)] };
}
