import { mapConcurrent } from '@/lib/data/mapConcurrent';
import { addDays, plantDay } from '@/lib/dates/plantDay';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import { weatherMatchesLocation } from '@/lib/plants/locationState';
import logger from '@/lib/logger';
import { waterExplanation } from '@/lib/careAlgorithm/waterExplanation';
import type { CareDiagnostic } from '@/lib/careAlgorithm/careDiagnostics';
import { calculatePlantWatering, DEFAULT_LOOKBACK_DAYS, DEFAULT_RAIN_THRESHOLD_MM, type PlantSummary, type WateringInsight, type EvaluateOptions, type RangeEntry } from './wateringEngine';
export { getLocalDateString } from './wateringEngine';
export type { PlantSummary, WateringInsight } from './wateringEngine';
function hasValidCoordinates(plant: PlantSummary): plant is PlantSummary & {
  location: { lat: number; lng: number };
} {
  return typeof plant.location?.lat === 'number' && typeof plant.location?.lng === 'number'
    && Number.isFinite(plant.location.lat) && Number.isFinite(plant.location.lng)
    && Math.abs(plant.location.lat) <= 90 && Math.abs(plant.location.lng) <= 180;
}

async function refreshWeatherIfMissing(
  plant: PlantSummary,
  range: Record<string, RangeEntry>,
  targetDates: string[]
): Promise<Record<string, RangeEntry>> {
  if (!hasValidCoordinates(plant)) {
    return range;
  }

  if (plant.currentWeather?.date && weatherMatchesLocation(plant.currentWeather, plant) && range[plant.currentWeather.date]) range = { ...range, [plant.currentWeather.date]: { ...range[plant.currentWeather.date], weather: plant.currentWeather } };
  const missingDates = targetDates.filter((date) => {
    const entry = range[date];
    const fetchedAt = entry?.weather?.fetchedAt?.toDate?.().getTime();
    return !entry?.weather || !weatherMatchesLocation(entry.weather, plant) || !fetchedAt || Date.now() - fetchedAt > 6 * 3600000;
  });

  if (missingDates.length === 0) {
    return range;
  }

  try {
    const apiResponse = await fetchWeather(plant.location.lat, plant.location.lng);
    const parsed = parseWeatherData(apiResponse);
    const committed = await updateWeatherCache(plant.id, parsed, { location: plant.location, locationRevision: plant.locationRevision, locationLabel: plant.locationLabel });

    const updatedRange: Record<string, RangeEntry> = { ...range };
    Object.entries(committed || parsed).forEach(([date, weatherEntry]) => {
      const existing = updatedRange[date];
      if (existing) {
        updatedRange[date] = { ...existing, weather: weatherEntry };
      } else {
        updatedRange[date] = { logs: [], weather: weatherEntry };
      }
    });

    return updatedRange;
  } catch (error) {
    logger.error('Failed to refresh weather for plant', { plantId: plant.id, error });
    return range;
  }
}

async function evaluatePlantWatering(plant: PlantSummary, today: Date, options: EvaluateOptions): Promise<WateringInsight | null> {
  if (plant.deleting || plant.status && plant.status !== 'active') return null;
  let diagnostic: CareDiagnostic | undefined;
  if (plant.careEvaluationRevision) {
    try {
      const { readPlantCareStatus } = await import('@/services/plantCareEvaluation');
      const status = await readPlantCareStatus(plant.id, plant, today);
      diagnostic = status.diagnostic;
      const trusted = status.evaluation;
      if (trusted) {
        const insight = calculatePlantWatering(plant, today, options, {});
        return insight ? { ...insight, careEvaluation: trusted, careDiagnostic: diagnostic, needsWater: trusted.water.needsWater, reason: waterExplanation(trusted.water) } : null;
      }
    } catch { diagnostic = { source: 'local_fallback', status: 'server_snapshot_read_failed', checkedAtUtc: today.getTime() / 1000, backendRevisionPresent: true }; }
  }
  const fallback = (range: Record<string, RangeEntry>, journalHistoryReadFailed = false) => {
    const insight = calculatePlantWatering(plant, today, options, range);
    if (!insight || !insight.careEvaluation) return insight;
    insight.careDiagnostic = { ...insight.careDiagnostic!, ...diagnostic, journalHistoryReadFailed };
    insight.careEvaluation.water.reasonCodes = [insight.careDiagnostic.status];
    insight.reason = waterExplanation(insight.careEvaluation.water);
    return insight;
  };
  const day = plantDay(today, plant.locationTimeZone);
  let range: Record<string, RangeEntry>;
  try { range = await fetchLogsAndWeatherForRange(plant.id, addDays(day, -options.lookbackDays), addDays(day, 1), plant.locationTimeZone); }
  catch (error) { logger.error('Failed to fetch logs/weather for plant', { plantId: plant.id, error }); return fallback({}, true); }
  range = await refreshWeatherIfMissing(plant, range, [day, addDays(day, 1)]);
  return fallback(range);
}
/**
 * Evaluates watering insight for each plant.
 * Runs at most two plants concurrently, preserving order and respecting cancellation.
 */
export async function evaluateWateringInsights(
  plants: PlantSummary[],
  options?: Partial<EvaluateOptions>,
  signal?: AbortSignal
): Promise<WateringInsight[]> {
  if (!plants.length) return [];

  const mergedOptions: EvaluateOptions = {
    lookbackDays: options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    rainfallThresholdMm: options?.rainfallThresholdMm ?? DEFAULT_RAIN_THRESHOLD_MM,
  };

  const insights = await mapConcurrent(plants, 2, async plant => {
    if (signal?.aborted) return null;
    try {
      const insight = await evaluatePlantWatering(plant, new Date(), mergedOptions);
      return signal?.aborted ? null : insight;
    } catch (error) {
      logger.error('Failed to evaluate watering insight for plant', { plantId: plant.id, error });
      return null;
    }
  });
  return insights.filter((insight): insight is WateringInsight => !!insight);
}
