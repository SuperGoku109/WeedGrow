import type { WeatherResponse, WeatherSample } from './weatherResponse';
import { isRecord } from '@/lib/data/recordDecoders';

/** A single repeated point is not a usable daily/hourly forecast. Equal temperatures
 * alone do not trigger this: a real multi-hour timeline or varying daily fields are retained. */
export function repeatedPointForecast(value: WeatherResponse): boolean {
  if (value.daily?.length !== 1 || (value.hourly?.length ?? 0) > 1 || typeof value.current?.temp !== 'number') return false;
  const temp = value.daily[0].temp;
  return !!temp && typeof temp === 'object' && ['morn', 'day', 'eve', 'night', 'min', 'max'].every(key => temp[key as keyof typeof temp] === value.current!.temp)
    && (!value.hourly?.length || value.hourly[0].temp === value.current.temp);
}

/** Current Weather's temp_min/temp_max are spatial current extrema, never daily highs/lows. */
export function currentWeatherFallback(raw: unknown, original: WeatherResponse): WeatherResponse {
  if (!isRecord(raw) || !isRecord(raw.main) || !isRecord(raw.wind) || typeof raw.dt !== 'number'
    || !Number.isFinite(raw.dt) || typeof raw.main.temp !== 'number' || !Number.isFinite(raw.main.temp)
    || typeof raw.main.humidity !== 'number' || typeof raw.wind.speed !== 'number') throw new Error('Weather provider returned incomplete current conditions.');
  const sys = isRecord(raw.sys) ? raw.sys : {};
  const clouds = isRecord(raw.clouds) ? raw.clouds : {};
  return { timezone: original.timezone, timezone_offset: typeof raw.timezone === 'number' ? raw.timezone : original.timezone_offset,
    _weedgrowForecastIssue: 'repeated_point_forecast', current: { dt: raw.dt, temp: raw.main.temp, humidity: raw.main.humidity,
      wind_speed: raw.wind.speed, wind_gust: raw.wind.gust as number | undefined, clouds: clouds.all as number | undefined,
      sunrise: sys.sunrise as number | undefined, sunset: sys.sunset as number | undefined,
      weather: raw.weather as WeatherSample['weather'],
      rain: raw.rain as { '1h'?: number } | undefined, snow: raw.snow as { '1h'?: number } | undefined }, daily: [], hourly: [] };
}
