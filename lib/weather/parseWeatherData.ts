import { Timestamp } from 'firebase/firestore';
import type { WeatherCacheEntry } from '@/firestoreModels';

/**
 * Convert the OpenWeatherMap One Call API response into a map of
 * `WeatherCacheEntry` objects keyed by date (YYYY-MM-DD).
 */
export function parseWeatherData(apiResponse: any): Record<string, WeatherCacheEntry> {
  if (!apiResponse) return {};

  const entries: Record<string, WeatherCacheEntry> = {};
  const fetchedAt = Number.isFinite(apiResponse._weedgrowFetchedAt) ? Timestamp.fromMillis(apiResponse._weedgrowFetchedAt) : Timestamp.now();
  const tzOffset = apiResponse.timezone_offset ?? 0; // seconds
  const NIGHT_START_HOUR = 20;
  const NIGHT_END_HOUR = 7;

  const toDateStr = (unix: number) =>
    new Date((unix + tzOffset) * 1000).toISOString().split('T')[0];
  const toLocalShiftedDate = (unix: number) => new Date((unix + tzOffset) * 1000);
  const isNightHour = (hour: number) => hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;

  // Aggregate hourly data so we can compute summaries like the peak
  // temperature or number of hours with rain for each day.
  const hourlyMap: Record<
    string,
    {
      peakTemp: number;
      rainHours: number;
      nightHumidityTotal: number;
      nightHumiditySamples: number;
    }
  > = {};
  if (Array.isArray(apiResponse.hourly)) {
    for (const hour of apiResponse.hourly) {
      const shifted = toLocalShiftedDate(hour.dt);
      const d = shifted.toISOString().split('T')[0];
      const existing = hourlyMap[d] || {
        peakTemp: -Infinity,
        rainHours: 0,
        nightHumidityTotal: 0,
        nightHumiditySamples: 0,
      };
      if (hour.temp > existing.peakTemp) existing.peakTemp = hour.temp;
      const rainAmount = hour.rain?.['1h'] ?? hour.snow?.['1h'] ?? 0;
      if (rainAmount > 0) existing.rainHours += 1;
      const hourOfDay = shifted.getUTCHours();
      if (typeof hour.humidity === 'number' && isNightHour(hourOfDay)) {
        existing.nightHumidityTotal += hour.humidity;
        existing.nightHumiditySamples += 1;
      }
      hourlyMap[d] = existing;
    }
  }

  const buildEntry = (
    dateStr: string,
    forecasted: boolean,
    sourceData: any
  ): WeatherCacheEntry => {
    const base: WeatherCacheEntry = {
      ...(typeof apiResponse.timezone === 'string' ? { timeZone: apiResponse.timezone } : {}),
      date: dateStr,
      fetchedAt,
      forecasted,
      source: 'OpenWeatherMap',
      temperature: sourceData.temp?.day ?? sourceData.temp,
      humidity: sourceData.humidity,
      windSpeed: sourceData.wind_speed,
      rainfall: typeof sourceData.rain === 'number' ? sourceData.rain : sourceData.rain?.['1h'] ?? sourceData.rainfall ?? 0,
      uvIndex: sourceData.uvi,
      weatherSummary: sourceData.weather?.[0]?.description ?? '',
      dewPoint: sourceData.dew_point,
      cloudCoverage: sourceData.clouds,
      windGust: sourceData.wind_gust,
      sunrise: sourceData.sunrise
        ? new Date((sourceData.sunrise + tzOffset) * 1000).toISOString()
        : undefined,
      sunset: sourceData.sunset
        ? new Date((sourceData.sunset + tzOffset) * 1000).toISOString()
        : undefined,
      pop: sourceData.pop,
    };

    // Add detailed temperature segments if available
    if (sourceData.temp && typeof sourceData.temp === 'object') {
      base.detailedTemps = {
        morn: sourceData.temp.morn ?? null,
        day: sourceData.temp.day ?? null,
        eve: sourceData.temp.eve ?? null,
        night: sourceData.temp.night ?? null,
        min: sourceData.temp.min ?? null,
        max: sourceData.temp.max ?? null,
      };
    }

    // Merge in the hourly summaries we computed above if available
    const hourly = hourlyMap[dateStr];
    if (hourly) {
      base.hourlySummary = {
        peakTemp: hourly.peakTemp,
        rainHours: hourly.rainHours,
      };
      if (hourly.nightHumiditySamples > 0) {
        base.nightHumidity = Number(
          (hourly.nightHumidityTotal / hourly.nightHumiditySamples).toFixed(1),
        );
      }
    }

    return base;
  };

  // Today from current conditions
  if (apiResponse.current) {
    const today = toDateStr(apiResponse.current.dt);
    entries[today] = buildEntry(today, false, apiResponse.current);
  }

  // Daily forecasts (daily[0] is today)
  if (Array.isArray(apiResponse.daily)) {
    apiResponse.daily.forEach((d: any, idx: number) => {
      const dateStr = toDateStr(d.dt);
      // daily[0] overlaps with the `current` object, so only entries after
      // index 0 are considered "forecast" data
      const forecasted = idx > 0;
      const dailyEntry = buildEntry(dateStr, forecasted, d);
      const existing = entries[dateStr];

      // For "today", preserve observed current values and merge daily metadata.
      if (idx === 0 && existing) {
        entries[dateStr] = {
          ...dailyEntry,
          ...existing,
          temperature: existing.temperature ?? dailyEntry.temperature,
          humidity: existing.humidity ?? dailyEntry.humidity,
          windSpeed: existing.windSpeed ?? dailyEntry.windSpeed,
          rainfall: existing.rainfall ?? dailyEntry.rainfall,
          uvIndex: existing.uvIndex ?? dailyEntry.uvIndex,
          weatherSummary: existing.weatherSummary || dailyEntry.weatherSummary,
          dewPoint: existing.dewPoint ?? dailyEntry.dewPoint,
          cloudCoverage: existing.cloudCoverage ?? dailyEntry.cloudCoverage,
          windGust: existing.windGust ?? dailyEntry.windGust,
          pop: dailyEntry.pop ?? existing.pop,
          detailedTemps: dailyEntry.detailedTemps ?? existing.detailedTemps,
          hourlySummary: existing.hourlySummary ?? dailyEntry.hourlySummary,
          nightHumidity: existing.nightHumidity ?? dailyEntry.nightHumidity,
          forecasted: false,
        };
        return;
      }

      entries[dateStr] = dailyEntry;
    });
  }

  return entries;
}
