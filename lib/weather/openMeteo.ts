import type { WeatherResponse, WeatherSample, WeatherTemperatures } from './weatherResponse';
import { isRecord } from '@/lib/data/recordDecoders';
import { plantDay } from '@/lib/dates/plantDay';

export interface MeteoSeries { time: number[]; [variable: string]: (number | null)[] }
export interface OpenMeteoPayload {
  latitude: number; longitude: number; timezone: string; utc_offset_seconds: number;
  current?: Record<string, number | null>; current_units?: Record<string, string>;
  hourly: MeteoSeries; hourly_units: Record<string, string>;
  daily?: MeteoSeries; daily_units?: Record<string, string>;
}
export const METEO_MODEL = 'provider_best_match_unpinned';
const hourlyFields = 'temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_gusts_10m,shortwave_radiation,et0_fao_evapotranspiration,rain,showers,precipitation,snowfall,cloud_cover,precipitation_probability,weather_code,uv_index';
export function openMeteoUrl(lat: number, lng: number, pastDays = 14, forecastDays = 7) {
  if (![lat, lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Weather location is invalid.');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lng), timezone: 'auto', timeformat: 'unixtime', wind_speed_unit: 'ms',
    past_days: String(pastDays), forecast_days: String(forecastDays), hourly: hourlyFields,
    current: 'temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,weather_code,rain,showers',
    daily: 'temperature_2m_max,temperature_2m_min,rain_sum,showers_sum,uv_index_max,precipitation_probability_max,sunrise,sunset' }).toString();
  return url.toString();
}
const units: Record<string, string> = { temperature_2m: '°C', temperature_2m_max: '°C', temperature_2m_min: '°C', relative_humidity_2m: '%',
  dew_point_2m: '°C', wind_speed_10m: 'm/s', wind_gusts_10m: 'm/s', shortwave_radiation: 'W/m²', et0_fao_evapotranspiration: 'mm',
  rain: 'mm', showers: 'mm', precipitation: 'mm', snowfall: 'cm', cloud_cover: '%', precipitation_probability: '%', weather_code: 'wmo code',
  uv_index: '', uv_index_max: '', rain_sum: 'mm', showers_sum: 'mm', precipitation_probability_max: '%', sunrise: 'unixtime', sunset: 'unixtime' };
function checked(value: unknown, field: string, unit: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || unit !== units[field]) return null;
  if (['temperature_2m', 'temperature_2m_max', 'temperature_2m_min', 'dew_point_2m'].includes(field)) return value >= -60 && value <= 60 ? value : null;
  if (['relative_humidity_2m', 'cloud_cover', 'precipitation_probability', 'precipitation_probability_max'].includes(field)) return value >= 0 && value <= 100 ? value : null;
  if (field === 'weather_code') return Number.isInteger(value) && WMO[value] !== undefined ? value : null;
  return value >= 0 ? value : null;
}
/** Missing/misaligned fields remain null independently; a malformed axis invalidates the envelope. */
export function decodeOpenMeteo(raw: unknown): OpenMeteoPayload {
  if (!isRecord(raw) || typeof raw.latitude !== 'number' || !Number.isFinite(raw.latitude) || Math.abs(raw.latitude) > 90
    || typeof raw.longitude !== 'number' || !Number.isFinite(raw.longitude) || Math.abs(raw.longitude) > 180
    || typeof raw.timezone !== 'string' || typeof raw.utc_offset_seconds !== 'number' || !Number.isInteger(raw.utc_offset_seconds) || Math.abs(raw.utc_offset_seconds) > 86400) throw new Error('Open-Meteo returned invalid location/time metadata.');
  try { new Intl.DateTimeFormat('en', { timeZone: raw.timezone }).format(); } catch { throw new Error('Open-Meteo returned an invalid timezone.'); }
  function series(value: unknown, measures: unknown, step?: number): MeteoSeries {
    if (!isRecord(value) || !isRecord(measures) || measures.time !== 'unixtime' || !Array.isArray(value.time)
      || !value.time.length || value.time.length > 768 || !value.time.every((t, i, a) => typeof t === 'number' && Number.isFinite(t)
        && Math.abs(t) <= 253402214399 && (!i || (step ? t - a[i - 1] === step : t > a[i - 1])))) throw new Error('Open-Meteo returned an invalid time axis.');
    const result: MeteoSeries = { time: value.time };
    for (const field of Object.keys(units)) {
      const values = value[field];
      if (Array.isArray(values) && values.length === value.time.length) result[field] = values.map(v => checked(v, field, measures[field]));
    }
    return result;
  }
  const hourly = series(raw.hourly, raw.hourly_units, 3600);
  const current: Record<string, number | null> = {};
  if (isRecord(raw.current) && isRecord(raw.current_units) && raw.current_units.time === 'unixtime'
    && typeof raw.current.time === 'number' && Number.isFinite(raw.current.time) && Math.abs(raw.current.time) <= 253402214399) {
    current.time = raw.current.time;
    current.interval = typeof raw.current.interval === 'number' && raw.current.interval > 0 && raw.current.interval <= 3600 ? raw.current.interval : null;
    for (const field of Object.keys(units)) current[field] = checked(raw.current[field], field, raw.current_units[field]);
  }
  return { latitude: raw.latitude, longitude: raw.longitude, timezone: raw.timezone, utc_offset_seconds: raw.utc_offset_seconds,
    hourly, hourly_units: raw.hourly_units as Record<string, string>, current, current_units: isRecord(raw.current_units) ? raw.current_units as Record<string, string> : {},
    ...(raw.daily && isRecord(raw.daily_units) ? { daily: series(raw.daily, raw.daily_units), daily_units: raw.daily_units as Record<string, string> } : {}) };
}
export const WMO: Record<number, string> = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle', 56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain', 66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Light snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 97: 'Heavy thunderstorm', 99: 'Thunderstorm with heavy hail' };
export const meteoValue = (series: MeteoSeries, field: string, index: number): number | undefined => series[field]?.[index] ?? undefined;
/** Liquid water only: total precipitation is usable only when the same interval explicitly has zero snowfall. */
export function meteoLiquidRain(series: MeteoSeries, i: number): number | undefined {
  const rain = meteoValue(series, 'rain', i), showers = meteoValue(series, 'showers', i);
  if (rain !== undefined && showers !== undefined) return rain + showers;
  return meteoValue(series, 'snowfall', i) === 0 ? meteoValue(series, 'precipitation', i) : undefined;
}
function point(native: OpenMeteoPayload, i: number): WeatherSample {
  const h = native.hourly; const value = (field: string) => meteoValue(h, field, i);
  const rain = meteoLiquidRain(h, i); const code = value('weather_code');
  return { dt: h.time[i], temp: value('temperature_2m'), humidity: value('relative_humidity_2m'), wind_speed: value('wind_speed_10m'),
    wind_gust: value('wind_gusts_10m'), dew_point: value('dew_point_2m'), clouds: value('cloud_cover'), uvi: value('uv_index'),
    rain: rain === undefined ? undefined : { '1h': rain }, pop: value('precipitation_probability') === undefined ? undefined : value('precipitation_probability')! / 100,
    weather: code === undefined ? [] : [{ description: WMO[code] }] };
}
/** Legacy-shaped display DTO; provider-native data/provenance remain attached for the care engine. */
export function openMeteoWeatherResponse(raw: unknown, fetchedAt = Date.now()): WeatherResponse {
  const native = decodeOpenMeteo(raw); const now = fetchedAt / 1000; const h = native.hourly;
  const c = native.current ?? {}; const ctime = c.time;
  const current: WeatherSample | undefined = typeof ctime === 'number' && ctime <= now && now - ctime <= 3600 ? {
    dt: ctime, temp: c.temperature_2m ?? undefined, humidity: c.relative_humidity_2m ?? undefined, wind_speed: c.wind_speed_10m ?? undefined,
    wind_gust: c.wind_gusts_10m ?? undefined, dew_point: c.dew_point_2m ?? undefined, clouds: c.cloud_cover ?? undefined,
    // This amount covers the provider's current interval, never an invented hourly total.
    rain: c.rain != null && c.showers != null ? c.rain + c.showers : undefined,
    weather: c.weather_code == null ? [] : [{ description: WMO[c.weather_code] }] } : undefined;
  const notes: string[] = [];
  if (current) {
    const last = h.time.findLastIndex(t => t <= current.dt);
    if (last >= 0 && current.dt - h.time[last] < 3600) current.uvi = meteoValue(h, 'uv_index', last);
    if (current.temp === undefined || current.humidity === undefined || current.wind_speed === undefined) notes.push('Some current fields are unavailable; daily values are not substituted.');
  }
  const daily: WeatherSample[] = [];
  for (const [i, t] of (native.daily?.time ?? []).entries()) {
    const d = native.daily!; const day = plantDay(new Date(t * 1000), native.timezone);
    if (day < plantDay(new Date(fetchedAt), native.timezone)) continue;
    const rows = h.time.map((at, index) => ({ at, index })).filter(row => plantDay(new Date(row.at * 1000), native.timezone) === day);
    const atHour = (hour: number) => {
      const row = rows.find(row => Number(new Intl.DateTimeFormat('en-GB', { timeZone: native.timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(row.at * 1000))) === hour);
      return row ? meteoValue(h, 'temperature_2m', row.index) : undefined;
    };
    const mean = (field: string) => { const values = rows.map(row => meteoValue(h, field, row.index)); return values.length >= 23 && values.every(v => v !== undefined) ? values.reduce((a, b) => a! + b!, 0)! / values.length : undefined; };
    const temps: WeatherTemperatures = { min: meteoValue(d, 'temperature_2m_min', i), max: meteoValue(d, 'temperature_2m_max', i), morn: atHour(6), day: atHour(12), eve: atHour(18), night: atHour(23) };
    const first = rows.find(row => meteoValue(h, 'wind_speed_10m', row.index) !== undefined);
    const rain = meteoValue(d, 'rain_sum', i), showers = meteoValue(d, 'showers_sum', i);
    const humidity = mean('relative_humidity_2m'); const wind = mean('wind_speed_10m');
    // Preserve independent daily extrema even when a noon/RH/wind field is missing.
    if (humidity === undefined || wind === undefined || temps.day === undefined) notes.push(`Some daily conditions for ${day} are unavailable; current values were not substituted.`);
    daily.push({ dt: t, temp: temps, humidity, wind_speed: wind, rain: rain !== undefined && showers !== undefined ? rain + showers : undefined,
      uvi: meteoValue(d, 'uv_index_max', i), sunrise: meteoValue(d, 'sunrise', i), sunset: meteoValue(d, 'sunset', i),
      pop: meteoValue(d, 'precipitation_probability_max', i) === undefined ? undefined : meteoValue(d, 'precipitation_probability_max', i)! / 100,
      weather: first ? point(native, first.index).weather : [] });
  }
  if (current) { const today = daily.find(d => plantDay(new Date(d.dt * 1000), native.timezone) === plantDay(new Date(current.dt * 1000), native.timezone)); current.sunrise = today?.sunrise; current.sunset = today?.sunset; }
  return { current, daily, hourly: h.time.flatMap((t, i) => t >= now - 86400 && t <= now + 48 * 3600 ? [point(native, i)] : []),
    timezone: native.timezone, timezone_offset: native.utc_offset_seconds, _weedgrowFetchedAt: fetchedAt, _weedgrowProvider: 'Open-Meteo', _weedgrowMeteo: native, _weedgrowNotes: [...new Set(notes)] };
}
