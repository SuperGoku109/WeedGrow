import type { Plant, PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import type { MildewRiskLevel } from '@/lib/weather/powderyMildewRisk';
import type { Evaluation } from '@/lib/careAlgorithm/types';
import { evaluatePlantCare } from '@/lib/careAlgorithm/appAdapter';
import { weatherMatchesLocation } from '@/lib/plants/locationState';
import { plantDay } from '@/lib/dates/plantDay';
import type { CareDiagnostic } from '@/lib/careAlgorithm/careDiagnostics';
import { waterExplanation } from '@/lib/careAlgorithm/waterExplanation';
export const DEFAULT_LOOKBACK_DAYS = 6;
export const DEFAULT_RAIN_THRESHOLD_MM = 8;
export function getLocalDateString(date = new Date()) { return plantDay(date); }
export type PlantSummary = Plant & { id: string };
type WaterSource = 'manual' | 'rain' | 'unknown';

export interface WateringInsight {
  weatherFetchedAtMs?: number;
  plantId: string;
  plantName: string;
  needsWater: boolean | null;
  careEvaluation?: Evaluation;
  careDiagnostic?: CareDiagnostic;
  score: number;
  daysSinceLastWater: number;
  thresholdDays: number;
  lastWaterSource: WaterSource;
  todayRainfall: number;
  tomorrowRainfall: number;
  precipitationProbability: number | null;
  tomorrowPrecipitationProbability: number | null;
  forecastedToday: boolean;
  forecastedTomorrow: boolean;
  todayRainObserved: boolean;
  recentRainfallTotalMm: number;
  hasSaturatingRecentRain: boolean;
  temperatureMax: number | null;
  temperatureMin: number | null;
  temperatureDay: number | null;
  temperatureNight: number | null;
  humidity: number | null;
  cloudCoverage: number | null;
  dewPoint: number | null;
  windSpeed: number | null;
  windGust: number | null;
  uvIndex: number | null;
  weatherSummary: string | null;
  sunrise: string | null;
  sunset: string | null;
  dayLengthHours: number | null;
  mildewRiskLevel: MildewRiskLevel | 'unknown';
  mildewShouldWarn: boolean;
  mildewConsecutiveVeryHumidWarmDays: number;
  mildewReasons: string[];
  reason: string;
}

export interface EvaluateOptions {
  execution?: 'local' | 'backend';
  lookbackDays: number;
  rainfallThresholdMm: number;
}

export type RangeEntry = {
  logs: PlantLog[];
  weather: WeatherCacheEntry | null;
};

/** Production care uses v8.4 nullable decisions. Legacy daily cache values are presentation only. */
export function calculatePlantWatering(plant: PlantSummary, now: Date, _options: EvaluateOptions, range: Record<string, RangeEntry>): WateringInsight | null {
  if (plant.deleting || plant.status !== 'active') return null;
  const careEvaluation = evaluatePlantCare(plant, now);
  const status = plant.careEvaluationRevision ? 'server_evaluation_not_loaded' : 'server_evaluation_missing';
  careEvaluation.water.reasonCodes = [status];
  const journalWeatherDays = Object.entries(range).filter(([, entry]) => entry.weather && weatherMatchesLocation(entry.weather, plant)).map(([day]) => day).sort();
  const weather = Object.values(range).map(e => e.weather).find(w => w?.date === plantDay(now, plant.locationTimeZone) && weatherMatchesLocation(w, plant));
  return {
    plantId: plant.id, plantName: plant.name || 'Unnamed plant', careEvaluation, needsWater: careEvaluation.water.needsWater,
    careDiagnostic: { source: 'local_fallback', status, checkedAtUtc: now.getTime() / 1000, backendRevisionPresent: !!plant.careEvaluationRevision, journalWeatherDays },
    weatherFetchedAtMs: weather?.fetchedAt?.toDate?.().getTime(),
    score: 0, daysSinceLastWater: 0, thresholdDays: 0, lastWaterSource: 'unknown', todayRainfall: 0, tomorrowRainfall: 0,
    precipitationProbability: null, tomorrowPrecipitationProbability: null, forecastedToday: false, forecastedTomorrow: false,
    todayRainObserved: false, recentRainfallTotalMm: 0, hasSaturatingRecentRain: false,
    temperatureMax: null, temperatureMin: null, temperatureDay: null, temperatureNight: null,
    humidity: null, cloudCoverage: null, dewPoint: null, windSpeed: null, windGust: null, uvIndex: null,
    weatherSummary: null, sunrise: null, sunset: null, dayLengthHours: null,
    mildewRiskLevel: 'unknown', mildewShouldWarn: false, mildewConsecutiveVeryHumidWarmDays: 0, mildewReasons: ['Predictive powdery mildew assessment is unavailable.'],
    reason: waterExplanation(careEvaluation.water),
  };
}

