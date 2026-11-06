import { isRecord } from '@/lib/data/recordDecoders';
export interface WeatherTemperatures { day?: number; night?: number; morn?: number; eve?: number; min?: number; max?: number }
export interface WeatherSample { dt: number; temp?: number | WeatherTemperatures; humidity?: number; wind_speed?: number; rain?: number | { '1h'?: number }; snow?: { '1h'?: number }; rainfall?: number; uvi?: number; weather?: { description?: string }[]; dew_point?: number; clouds?: number; wind_gust?: number; sunrise?: number; sunset?: number; pop?: number }
export interface WeatherResponse { current?: WeatherSample; daily?: WeatherSample[]; hourly?: WeatherSample[]; timezone?: string; timezone_offset?: number; _weedgrowFetchedAt?: number }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function sample(value: unknown): WeatherSample {
  if (!isRecord(value) || !finite(value.dt) || value.dt < -62135596800 || value.dt > 253402214399) throw new Error('Weather response has an invalid observation date.');
  for (const key of ['humidity', 'wind_speed', 'rainfall', 'uvi', 'dew_point', 'clouds', 'wind_gust', 'sunrise', 'sunset', 'pop']) if (value[key] != null && !finite(value[key])) throw new Error('Weather response contains an invalid measurement.');
  for (const [key, min, max] of [
    ['humidity', 0, 100], ['clouds', 0, 100], ['pop', 0, 1],
    ['wind_speed', 0, Infinity], ['wind_gust', 0, Infinity], ['rainfall', 0, Infinity], ['uvi', 0, Infinity],
    ['sunrise', -62135596800, 253402214399], ['sunset', -62135596800, 253402214399],
  ] as const) if (finite(value[key]) && (value[key] < min || value[key] > max)) throw new Error('Weather response contains an out-of-range measurement.');
  if (value.temp != null && !finite(value.temp) && !(isRecord(value.temp) && Object.values(value.temp).every(item => item == null || finite(item)))) throw new Error('Weather response contains invalid temperatures.');
  if (value.rain != null && !finite(value.rain) && !(isRecord(value.rain) && Object.values(value.rain).every(finite))) throw new Error('Weather response contains invalid precipitation.');
  if (value.snow != null && !(isRecord(value.snow) && Object.values(value.snow).every(finite))) throw new Error('Weather response contains invalid snowfall.');
  for (const key of ['rain', 'snow']) {
    const precipitation = value[key];
    if (finite(precipitation) && precipitation < 0 || isRecord(precipitation) && Object.values(precipitation).some(item => finite(item) && item < 0)) throw new Error('Weather response contains negative precipitation.');
  }
  if (value.weather != null && (!Array.isArray(value.weather) || value.weather.some(item => !isRecord(item) || item.description != null && typeof item.description !== 'string'))) throw new Error('Weather response contains invalid descriptions.');
  return value as unknown as WeatherSample;
}
export function decodeWeatherResponse(value: unknown): WeatherResponse {
  if (!isRecord(value)) throw new Error('Weather response was incomplete.');
  const result: WeatherResponse = {};
  if (value.current != null) result.current = sample(value.current);
  for (const key of ['daily', 'hourly'] as const) if (value[key] != null) { const entries = value[key]; if (!Array.isArray(entries) || entries.length > (key === 'daily' ? 16 : 168)) throw new Error('Weather response has an invalid forecast window.'); result[key] = entries.map(sample); }
  if (typeof value.timezone === 'string') result.timezone = value.timezone;
  if (value.timezone_offset != null) {
    if (!finite(value.timezone_offset) || !Number.isInteger(value.timezone_offset) || Math.abs(value.timezone_offset) > 86400) throw new Error('Weather response has an invalid timezone offset.');
    result.timezone_offset = value.timezone_offset;
  }
  if (value._weedgrowFetchedAt != null) {
    if (!finite(value._weedgrowFetchedAt) || value._weedgrowFetchedAt < 0 || value._weedgrowFetchedAt > 253402214399000) throw new Error('Weather response has an invalid retrieval timestamp.');
    result._weedgrowFetchedAt = value._weedgrowFetchedAt;
  }
  return result;
}
