import { isRecord } from '@/lib/data/recordDecoders';
export interface WeatherTemperatures { day?: number; night?: number; morn?: number; eve?: number; min?: number; max?: number }
export interface WeatherSample { dt: number; temp?: number | WeatherTemperatures; humidity?: number; wind_speed?: number; rain?: number | { '1h'?: number }; snow?: { '1h'?: number }; rainfall?: number; uvi?: number; weather?: { description?: string }[]; dew_point?: number; clouds?: number; wind_gust?: number; sunrise?: number; sunset?: number; pop?: number }
export interface WeatherResponse { current?: WeatherSample; daily?: WeatherSample[]; hourly?: WeatherSample[]; timezone?: string; timezone_offset?: number; _weedgrowFetchedAt?: number }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function sample(value: unknown): WeatherSample {
  if (!isRecord(value) || !finite(value.dt) || value.dt < -62135596800 || value.dt > 253402214399) throw new Error('Weather response has an invalid observation date.');
  for (const key of ['humidity', 'wind_speed', 'rainfall', 'uvi', 'dew_point', 'clouds', 'wind_gust', 'sunrise', 'sunset', 'pop']) if (value[key] != null && !finite(value[key])) throw new Error('Weather response contains an invalid measurement.');
  if (value.temp != null && !finite(value.temp) && !(isRecord(value.temp) && Object.values(value.temp).every(item => item == null || finite(item)))) throw new Error('Weather response contains invalid temperatures.');
  if (value.rain != null && !finite(value.rain) && !(isRecord(value.rain) && Object.values(value.rain).every(finite))) throw new Error('Weather response contains invalid precipitation.');
  if (value.snow != null && !(isRecord(value.snow) && Object.values(value.snow).every(finite))) throw new Error('Weather response contains invalid snowfall.');
  if (value.weather != null && (!Array.isArray(value.weather) || value.weather.some(item => !isRecord(item) || item.description != null && typeof item.description !== 'string'))) throw new Error('Weather response contains invalid descriptions.');
  return value as unknown as WeatherSample;
}
export function decodeWeatherResponse(value: unknown): WeatherResponse {
  if (!isRecord(value)) throw new Error('Weather response was incomplete.');
  const result: WeatherResponse = {};
  if (value.current != null) result.current = sample(value.current);
  for (const key of ['daily', 'hourly'] as const) if (value[key] != null) { const entries = value[key]; if (!Array.isArray(entries) || entries.length > (key === 'daily' ? 16 : 168)) throw new Error('Weather response has an invalid forecast window.'); result[key] = entries.map(sample); }
  if (typeof value.timezone === 'string') result.timezone = value.timezone;
  if (finite(value.timezone_offset)) result.timezone_offset = value.timezone_offset;
  if (finite(value._weedgrowFetchedAt)) result._weedgrowFetchedAt = value._weedgrowFetchedAt;
  return result;
}
