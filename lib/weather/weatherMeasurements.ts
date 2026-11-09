import { decodeWeatherResponse, type WeatherSample } from './weatherResponse';
import type { WeatherCacheEntry } from '@/firestoreModels';
import { repeatedPointForecast } from './weatherQuality';

export type WeatherMeasurement = Omit<WeatherCacheEntry, 'fetchedAt' | 'previousLocations'> & { fetchedAtMillis: number };

/**
 * Convert the OpenWeatherMap One Call API response into a map of
 * `WeatherCacheEntry` objects keyed by date (YYYY-MM-DD).
 */
export function parseWeatherMeasurements(input: unknown): Record<string, WeatherMeasurement> {
  if (!input) return {};
  const apiResponse = decodeWeatherResponse(input);
  if (repeatedPointForecast(apiResponse)) throw new Error('Weather provider returned a repeated single-point forecast. Refresh to verify current conditions.');

  const entries: Record<string, WeatherMeasurement> = {};
  const fetchedAt = Number.isFinite(apiResponse._weedgrowFetchedAt) ? apiResponse._weedgrowFetchedAt! : Date.now();
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
      if (typeof hour.temp === 'number' && hour.temp > existing.peakTemp) existing.peakTemp = hour.temp;
      const rainAmount = (typeof hour.rain === 'number' ? hour.rain : hour.rain?.['1h']) ?? hour.snow?.['1h'] ?? 0;
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
    sourceData: WeatherSample
  ): WeatherMeasurement => {
    const temperature = typeof sourceData.temp === 'number' ? sourceData.temp : sourceData.temp?.day;
    if (!apiResponse._weedgrowProvider && (typeof temperature !== 'number' || typeof sourceData.humidity !== 'number' || typeof sourceData.wind_speed !== 'number')) throw new Error('Weather response was missing required conditions.');
    const base: WeatherMeasurement = {
      ...(typeof apiResponse.timezone === 'string' ? { timeZone: apiResponse.timezone } : {}),
      date: dateStr,
      fetchedAtMillis: fetchedAt,
      forecasted,
      source: apiResponse._weedgrowProvider ?? 'OpenWeatherMap',
      weatherDataVersion: apiResponse._weedgrowProvider ? 3 : 2,
      ...(apiResponse._weedgrowProvider ? { temperatureBasis: 'model' as const, qualityNotes: apiResponse._weedgrowNotes ?? [],
        ...(sourceData === apiResponse.current && apiResponse._weedgrowMeteo?.current?.interval ? { rainIntervalSeconds: apiResponse._weedgrowMeteo.current.interval } : {}) } : {}),
      ...(sourceData === apiResponse.current ? { observationUtc: sourceData.dt } : {}),
      ...(apiResponse._weedgrowForecastIssue ? { forecastIssue: apiResponse._weedgrowForecastIssue } : {}),
      temperature,
      humidity: sourceData.humidity,
      windSpeed: sourceData.wind_speed,
      rainfall: typeof sourceData.rain === 'number' ? sourceData.rain : sourceData.rain?.['1h'] ?? sourceData.rainfall ?? (apiResponse._weedgrowProvider ? undefined : 0),
      uvIndex: sourceData.uvi,
      weatherSummary: sourceData.weather?.[0]?.description ?? '',
      dewPoint: sourceData.dew_point,
      cloudCoverage: sourceData.clouds,
      windGust: sourceData.wind_gust,
      sunrise: sourceData.sunrise != null
        ? new Date(sourceData.sunrise * 1000).toISOString()
        : undefined,
      sunset: sourceData.sunset != null
        ? new Date(sourceData.sunset * 1000).toISOString()
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
    if (hourly && Number.isFinite(hourly.peakTemp)) {
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
    apiResponse.daily.forEach(d => {
      const dateStr = toDateStr(d.dt);
      // A daily aggregate is a forecast; only a same-date current observation
      // can supply the observed fields. Array position is not a calendar date.
      const forecasted = true;
      const dailyEntry = buildEntry(dateStr, forecasted, d);
      const existing = entries[dateStr];

      // For "today", preserve observed current values and merge daily metadata.
      if (existing && apiResponse.current && dateStr === toDateStr(apiResponse.current.dt)) {
        entries[dateStr] = {
          ...dailyEntry,
          ...existing,
          temperature: existing.temperature ?? dailyEntry.temperature,
          humidity: apiResponse._weedgrowProvider ? existing.humidity : existing.humidity ?? dailyEntry.humidity,
          windSpeed: apiResponse._weedgrowProvider ? existing.windSpeed : existing.windSpeed ?? dailyEntry.windSpeed,
          rainfall: apiResponse._weedgrowProvider ? existing.rainfall : existing.rainfall ?? dailyEntry.rainfall,
          uvIndex: apiResponse._weedgrowProvider ? existing.uvIndex : existing.uvIndex ?? dailyEntry.uvIndex,
          weatherSummary: apiResponse._weedgrowProvider ? existing.weatherSummary : existing.weatherSummary || dailyEntry.weatherSummary,
          dewPoint: apiResponse._weedgrowProvider ? existing.dewPoint : existing.dewPoint ?? dailyEntry.dewPoint,
          cloudCoverage: apiResponse._weedgrowProvider ? existing.cloudCoverage : existing.cloudCoverage ?? dailyEntry.cloudCoverage,
          windGust: apiResponse._weedgrowProvider ? existing.windGust : existing.windGust ?? dailyEntry.windGust,
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
