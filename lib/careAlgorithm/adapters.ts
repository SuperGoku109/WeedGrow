import { finite, type Variable, type WeatherSample } from './types';
import { UNITS, validSample } from './weather';
import { addDays, plantDay, zonedTime } from '@/lib/dates/plantDay';

type ObjectRow = Record<string, unknown>;
const object = (value: unknown): value is ObjectRow => !!value && typeof value === 'object' && !Array.isArray(value);
export interface Acquisition {
  retrievedUtc: number; firstAvailableUtc: number; locationRevision: number;
  /** Immutable raw-response hash/revision assigned by the backend, not provider valid time. */
  sourceRevision: string; modelSelection: string;
}
function meta(payload: ObjectRow, provider: string, product: string, a: Acquisition) {
  if (!finite(a.retrievedUtc) || !finite(a.firstAvailableUtc) || a.firstAvailableUtc > a.retrievedUtc
    || !Number.isInteger(a.locationRevision) || a.locationRevision < 0 || !a.sourceRevision || !a.modelSelection) throw new Error('invalid_acquisition');
  return { schema_version: '8.4' as const, provider, product, source_revision: a.sourceRevision, model_selection: a.modelSelection,
    model_selection_basis: 'request_configuration_not_resolved_model_identity', location_revision: a.locationRevision,
    retrieved_at_utc: a.retrievedUtc, available_at_utc: a.firstAvailableUtc, issued_at_utc: null,
    grid_latitude: finite(payload.latitude) ? payload.latitude : finite(payload.lat) ? payload.lat : null,
    grid_longitude: finite(payload.longitude) ? payload.longitude : finite(payload.lon) ? payload.lon : null,
    grid_elevation_m: finite(payload.elevation) ? payload.elevation : null };
}
function makeSample(metadata: ReturnType<typeof meta>, variable: Variable, value: unknown, at: number, support: WeatherSample['time_support'], kind: WeatherSample['kind'], reasons: string[] = []): WeatherSample {
  let quality: WeatherSample['quality'] = reasons.some(r => /invalid|unexpected|misaligned/.test(r)) ? 'invalid' : value === null || value === undefined ? 'missing' : 'ok';
  const validValue = finite(value) && (variable === 'air_rh_pct' ? value >= 0 && value <= 100
    : ['air_temperature_c', 'air_dewpoint_c'].includes(variable) ? value >= -60 && value <= 60 : value >= 0);
  if (value !== null && value !== undefined && !validValue) { quality = 'invalid'; reasons = [...reasons, 'invalid_value']; }
  const sample: WeatherSample = { ...metadata, variable, value: quality === 'ok' ? value as number : null, unit: UNITS[variable],
    valid_start_utc: ['point', 'rate'].includes(support) ? at : at - 3600, valid_end_utc: at, time_support: support, kind, quality, reason_codes: reasons };
  if (!validSample(sample)) throw new Error('invalid_normalized_sample');
  return sample;
}
export function normalizeMeteo(payload: unknown, product: 'forecast' | 'archive', acquisition: Acquisition) {
  if (!['forecast', 'archive'].includes(product)) throw new Error('unsupported_product');
  if (!object(payload) || payload.utc_offset_seconds !== 0 || !object(payload.hourly) || !object(payload.hourly_units)) throw new Error('invalid_UTC_hourly_envelope');
  const metadata = meta(payload, 'Open-Meteo', product, acquisition);
  const hourly = payload.hourly; const units = payload.hourly_units; const times = hourly.time;
  if (!Array.isArray(times) || units.time !== 'unixtime' || !times.every((t, i) => finite(t) && (!i || t - times[i - 1] === 3600))) throw new Error('invalid_hourly_time_axis');
  function read(field: string, unit: string, index: number): [unknown, string[]] {
    if (!Object.hasOwn(hourly, field)) return [null, ['missing_field']];
    const values = hourly[field];
    if (!Array.isArray(values) || values.length !== (times as unknown[]).length) return [null, ['misaligned_array']];
    if (units[field] !== unit) return [null, ['unexpected_units']];
    return [values[index], values[index] === null ? ['missing_value'] : []];
  }
  const fields: [string, Variable, WeatherSample['time_support'], number | null][] = [
    ['temperature_2m', 'air_temperature_c', 'point', 2], ['relative_humidity_2m', 'air_rh_pct', 'point', 2],
    ['dew_point_2m', 'air_dewpoint_c', 'point', 2], ['wind_speed_10m', 'wind_speed_ms', 'point', 10],
    ['wind_gusts_10m', 'wind_gust_ms', product === 'forecast' || acquisition.modelSelection === 'cerra' ? 'interval_maximum' : 'point', 10],
    ['shortwave_radiation', 'shortwave_w_m2', 'interval_mean', null], ['et0_fao_evapotranspiration', 'et0_mm', 'interval_sum', null]];
  const samples: WeatherSample[] = []; const issues: string[] = [];
  times.forEach((t, i) => {
    if (product === 'archive' && t > acquisition.retrievedUtc) { issues.push('future_archive_row_rejected'); return; }
    const kind = product === 'forecast' ? 'forecast' : 'occurred_estimate';
    for (const [field, variable, support, height] of fields) {
      const [value, reasons] = read(field, UNITS[variable], i);
      samples.push({ ...makeSample(metadata, variable, value, t, support, kind, reasons), measurement_height_m: height });
    }
    const [rain, r] = read('rain', 'mm', i); const [showers, s] = read('showers', 'mm', i);
    const rainValid = rain === null || finite(rain) && rain >= 0;
    const showersValid = showers === null || finite(showers) && showers >= 0;
    const reasons = product === 'archive' ? r : [...r.map(x => `rain:${x}`), ...s.map(x => `showers:${x}`)];
    if (!rainValid || product === 'forecast' && !showersValid) reasons.push('invalid_rain_component');
    const amount = product === 'archive' ? rain : finite(rain) && finite(showers) && rainValid && showersValid && !reasons.length ? rain + showers : null;
    samples.push(makeSample(metadata, 'liquid_rain_mm', amount, t, 'interval_sum', kind, reasons));
  });
  return { samples, issues };
}
export function normalizeOpenWeather(payload: unknown, product: 'onecall_metric' | 'timemachine_metric', acquisition: Acquisition) {
  if (!['onecall_metric', 'timemachine_metric'].includes(product)) throw new Error('unsupported_product');
  if (!object(payload)) throw new Error('payload_not_object');
  const metadata = meta(payload, 'OpenWeather', product, acquisition);
  const rows: [unknown, WeatherSample['kind']][] = []; const issues: string[] = [];
  if (product === 'timemachine_metric') {
    if (!Array.isArray(payload.data)) throw new Error('history_data_envelope_required');
    rows.push(...payload.data.map(row => [row, 'occurred_estimate'] as [unknown, WeatherSample['kind']]));
  } else {
    if (Object.hasOwn(payload, 'current')) rows.push([payload.current, 'current_point']);
    if (payload.hourly !== undefined && !Array.isArray(payload.hourly)) issues.push('invalid_hourly_envelope');
    if (Array.isArray(payload.hourly)) rows.push(...payload.hourly.map(row => [row, 'forecast'] as [unknown, WeatherSample['kind']]));
  }
  const samples: WeatherSample[] = [];
  const solar: { validUtc: number; sunriseUtc: number | null; sunsetUtc: number | null }[] = [];
  const fields: [string, Variable][] = [['temp', 'air_temperature_c'], ['humidity', 'air_rh_pct'], ['dew_point', 'air_dewpoint_c'], ['wind_speed', 'wind_speed_ms'], ['wind_gust', 'wind_gust_ms']];
  for (const [row, kind] of rows) {
    if (!object(row) || !finite(row.dt)) { issues.push('invalid_point_row'); continue; }
    if (kind !== 'forecast' && row.dt > acquisition.retrievedUtc) { issues.push('future_nonforecast_row_rejected'); continue; }
    for (const [field, variable] of fields) samples.push(makeSample(metadata, variable, row[field] ?? null, row.dt, 'point', kind));
    // Solar timestamps are UTC instants. The timezone is for calendar boundaries/display only.
    solar.push({ validUtc: row.dt, sunriseUtc: finite(row.sunrise) ? row.sunrise : null, sunsetUtc: finite(row.sunset) ? row.sunset : null });
    const complete = finite(row.temp) && row.temp >= -60 && row.temp <= 60 && finite(row.humidity) && row.humidity >= 0 && row.humidity <= 100 && finite(row.wind_speed) && row.wind_speed >= 0;
    const missingRain = !Object.hasOwn(row, 'rain');
    const value = missingRain ? complete ? 0 : null : object(row.rain) ? row.rain['1h'] ?? null : null;
    const reasons = missingRain ? [complete ? 'documented_no_phenomenon_omission' : 'incomplete_sample_no_zero_inference'] : !object(row.rain) ? ['invalid_rain_structure'] : [];
    samples.push(makeSample(metadata, 'rain_rate_mm_h', value, row.dt, 'rate', kind, reasons));
  }
  const dailyForecasts: WeatherSample[] = [];
  if (product === 'onecall_metric' && payload.daily !== undefined) {
    if (!Array.isArray(payload.daily)) issues.push('invalid_daily_envelope');
    else for (const row of payload.daily) {
      if (!object(row) || !finite(row.dt)) { issues.push('invalid_daily_row'); continue; }
      if (typeof payload.timezone !== 'string') { issues.push('invalid_daily_timezone'); continue; }
      try {
        new Intl.DateTimeFormat('en', { timeZone: payload.timezone }).format();
        const day = plantDay(new Date(row.dt * 1000), payload.timezone);
        const start = zonedTime(day, '00:00', payload.timezone).getTime() / 1000;
        const end = zonedTime(addDays(day, 1), '00:00', payload.timezone).getTime() / 1000;
        const sample = { ...makeSample(metadata, 'liquid_rain_mm', row.rain ?? null, end, 'interval_sum', 'forecast'), valid_start_utc: start };
        if (!validSample(sample)) throw new Error('invalid_daily_bounds');
        dailyForecasts.push(sample);
      } catch { issues.push('invalid_daily_timezone'); }
    }
  }
  return { samples, dailyForecasts, solar, issues, rawSourceEvents: Array.isArray(payload.alerts) ? payload.alerts : [], sourceEventCoverage: 'unknown' as const };
}
