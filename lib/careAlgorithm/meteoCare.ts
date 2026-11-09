import { normalizeMeteo } from './adapters';
import { evaluateShadow } from './evaluate';
import { METEO_MODEL, meteoLiquidRain, type OpenMeteoPayload } from '@/lib/weather/openMeteo';
import { decide } from './waterBank';
import type { WaterModelInput } from './waterModel';
import type { WaterResult, WeatherSample } from './types';

export function meteoCareSamples(raw: OpenMeteoPayload, locationRevision: number, retrievedUtc: number) {
  // decodeOpenMeteo requires Unix seconds. The numeric axis is UTC even when display
  // daily boundaries use a local timezone; canonical normalization must retain UTC.
  const sourceRevision = `meteo-${retrievedUtc}`;
  const decoded = normalizeMeteo({ ...raw, utc_offset_seconds: 0 }, 'forecast', { retrievedUtc, firstAvailableUtc: retrievedUtc,
    locationRevision, sourceRevision, modelSelection: METEO_MODEL });
  const samples = decoded.samples.map(s => {
    if (s.variable !== 'liquid_rain_mm' || s.quality === 'ok') return s;
    const index = raw.hourly.time.indexOf(s.valid_end_utc); const value = meteoLiquidRain(raw.hourly, index);
    return value === undefined ? s : { ...s, value, quality: 'ok' as const, reason_codes: ['liquid_precipitation_with_explicit_zero_snow'] };
  });
  const c = raw.current;
  if (typeof c?.time === 'number' && c.time <= retrievedUtc) {
    const map = [['temperature_2m', 'air_temperature_c', '°C'], ['relative_humidity_2m', 'air_rh_pct', '%'], ['dew_point_2m', 'air_dewpoint_c', '°C'],
      ['wind_speed_10m', 'wind_speed_ms', 'm/s'], ['wind_gusts_10m', 'wind_gust_ms', 'm/s']] as const;
    for (const [field, variable, unit] of map) if (typeof c[field] === 'number') samples.push({ schema_version: '8.4', provider: 'Open-Meteo', product: 'forecast',
      model_selection: METEO_MODEL, model_selection_basis: 'provider_best_match_unpinned', source_revision: sourceRevision, location_revision: locationRevision,
      retrieved_at_utc: retrievedUtc, available_at_utc: retrievedUtc, issued_at_utc: null, variable, unit, value: c[field]!, time_support: 'point', kind: 'current_point',
      valid_start_utc: c.time, valid_end_utc: c.time, quality: 'ok', reason_codes: ['current_model_estimate_not_measurement'] });
  }
  return samples;
}

/** Interactive-only estimate. Past forecast-model rows stay explicitly model estimates.
 * Current-hour timing uses zero/full MODEL totals, not fabricated observed rain or
 * a uniform fraction. These are conditional model bounds, not forecast-error bounds. */
export function evaluateMeteoWater(input: Omit<WaterModelInput, 'weather' | 'et0Source' | 'rainSource'>, raw: OpenMeteoPayload, retrievedUtc: number): WaterResult {
  const now = input.evaluationUtc; const empty = (code: string): WaterResult => ({ decision: 'uncertain', needsWater: null, reasonCodes: [code] });
  if (retrievedUtc > now || now - retrievedUtc >= 3600) return empty('local_meteo_stale');
  const rows = meteoCareSamples(raw, input.setup.locationRevision, retrievedUtc).filter(s => ['et0_mm', 'liquid_rain_mm'].includes(s.variable));
  const completed = rows.filter(s => s.valid_end_utc <= now).map(s => ({ ...s, retrieved_at_utc: now, available_at_utc: now, product: 'interactive_model_estimate', kind: 'occurred_estimate' as const,
    reason_codes: [...s.reason_codes, 'past_model_estimate_not_observed'] }));
  const lastHour = Math.floor(now / 3600) * 3600; const partial = now > lastHour;
  const next = rows.filter(s => s.valid_start_utc === lastHour && s.valid_end_utc === lastHour + 3600);
  if (partial && (!next.some(s => s.variable === 'et0_mm' && s.quality === 'ok')
    || input.setup.soilRain !== 'no' && !next.some(s => s.variable === 'liquid_rain_mm' && s.quality === 'ok'))) return empty('local_meteo_current_hour_missing');
  const source = { provider: 'Open-Meteo', product: 'interactive_model_estimate', modelSelection: METEO_MODEL, sourceRevision: `meteo-${retrievedUtc}` };
  const profile = { ...input.profile, domain: { ...input.profile.domain, sourceKeys: [`${source.provider}/${source.product}/${source.modelSelection}`] } };
  const run = (worst: boolean) => {
    const weather: WeatherSample[] = [...completed];
    if (partial) for (const row of next) weather.push({ ...row, retrieved_at_utc: now, available_at_utc: now, product: source.product, kind: 'occurred_estimate', valid_end_utc: now,
      value: row.variable === 'et0_mm' ? worst ? row.value : 0 : worst ? 0 : row.value,
      reason_codes: ['conditional_current_hour_model_timing_bound'] });
    return evaluateShadow({ ...input, profile, weather, et0Source: source, rainSource: source });
  };
  const low = run(true), high = partial ? run(false) : low;
  if (!low.states.length || !high.states.length) return { ...empty('local_meteo_history_gap'), reasonCodes: [...new Set([...low.reasonCodes, ...high.reasonCodes])],
    ...('coverageIssue' in low && low.coverageIssue ? { coverageIssue: low.coverageIssue } : {}) };
  const states = low.states.map((s, i) => ({ ...s, reserveL: [s.reserveL[0], high.states[i].reserveL[1]] as const }));
  const decision = decide(states);
  const effects = 'evidence' in low && low.evidence ? low.evidence.effects : { weatherDemand: true, directRain: false, loggedWatering: false, uncertainRainReception: false };
  return { decision, needsWater: decision === 'uncertain' ? null : decision === 'water', reasonCodes: [...new Set(['open_meteo_model_estimate',
    ...(partial ? ['partial_hour_conditional_model_bounds'] : []), ...low.reasonCodes, ...high.reasonCodes,
    ...(decision === 'uncertain' ? ['scenarios_span_watering_threshold'] : [])])],
    evidence: { historyStartUtc: input.anchorUtc, historyEndUtc: now, effects,
      scenarios: states.map(s => ({ id: s.scenario.id, reserveL: s.reserveL, actionReserveL: s.scenario.actionReserveL })) } };
}
