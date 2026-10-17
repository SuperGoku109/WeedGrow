import type { Plant, PlantLog, WeatherCacheEntry } from '@/firestoreModels';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { parseWeatherData } from '@/lib/weather/parseWeatherData';
import {
  assessPowderyMildewRisk,
  type MildewDaySample,
  type MildewRiskAssessment,
  type MildewRiskLevel,
} from '@/lib/weather/powderyMildewRisk';
import { updateWeatherCache } from '@/lib/weather/updateFirestore';
import logger from '@/lib/logger';

// Time + tuning constants for the recommendation heuristic.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 6;
const DEFAULT_RAIN_THRESHOLD_MM = 8; // ~0.3in daily rain can often offset irrigation need.
const LIGHT_RAIN_THRESHOLD_MM = 3; // Below this is usually surface wetting only.
const RECENT_RAIN_WINDOW_DAYS = 3;
const RECENT_RAIN_ACCUMULATION_THRESHOLD_MM = 25; // ~1in over 3 days.
const DRYNESS_TRIGGER_GRACE_DAYS = 0.25; // Reduces near-threshold churn from coarse day bucketing.
const HOT_TEMP_THRESHOLD = 30;
const VERY_HOT_TEMP_THRESHOLD = 33;
const COOL_TEMP_THRESHOLD = 18;
const COLD_TEMP_THRESHOLD = 15;
const HEAT_STRESS_WARNING_TEMP_THRESHOLD = 32;
const LOW_HUMIDITY_THRESHOLD = 45;
const HIGH_HUMIDITY_THRESHOLD = 75;
const HIGH_WIND_DRYING_THRESHOLD_KPH = 22;
const HIGH_WIND_GUST_DRYING_THRESHOLD_KPH = 35;
const HIGH_UV_INDEX_THRESHOLD = 8;
const EXTREME_UV_INDEX_THRESHOLD = 11;
const LONG_DAYLIGHT_HOURS_THRESHOLD = 13;
const SHORT_DAYLIGHT_HOURS_THRESHOLD = 10;
const HIGH_POP_RAIN_DELAY_THRESHOLD = 0.65;
const LIKELY_FORECAST_RAIN_POP_THRESHOLD = 0.55;
const DEFAULT_FORECAST_RAIN_CONFIDENCE = 0.35;
const CLOUDY_THRESHOLD = 70;
const MILDEW_SAMPLE_DAYS = 3;
const LIGHT_RAIN_DELAY_WEIGHTS = [1, 0.6, 0.35] as const;
const GERMINATION_STAGE_REDUCTION_DAYS = 0.45;
const SEEDLING_STAGE_REDUCTION_DAYS = 0.35;
const SMALL_POT_THRESHOLD_LITERS = 7;
const LARGE_POT_THRESHOLD_LITERS = 25;
const SMALL_POT_REDUCTION_DAYS = 0.35;
const LARGE_POT_INCREASE_DAYS = 0.2;
const FULL_SUN_REDUCTION_DAYS = 0.25;
const SHADE_INCREASE_DAYS = 0.2;
const PARTIAL_SHADE_INCREASE_DAYS = 0.1;
const GALLON_TO_LITERS = 3.785;

/**
 * Watering algorithm walkthrough
 *
 * Core flow:
 * 1) Load logs + weather for [today - lookbackDays, tomorrow].
 * 2) Refresh missing today/tomorrow weather from API when coordinates exist.
 * 3) If yesterday weather is missing but today exists, run a conservative Plan B.
 * 4) If today weather is still missing, return a neutral "check manually" insight.
 * 5) Find latest water source from manual watering logs and/or rainfall events.
 * 6) Build adaptive thresholdDays from environment + climate modifiers.
 * 7) needsWater = (daysSinceLastWater / thresholdDays) >= 1, with rain overrides.
 * 8) Generate a human-readable reason string for UI cards.
 *
 * Example paths:
 * - Dry + hot: last water 3d ago, outdoor base 2d, hot/low humidity lowers threshold to ~1.2d -> needsWater=true.
 * - Rain override: no recent manual logs, rain today 4.0mm -> needsWater=false, daysSinceLastWater=0, source=rain.
 * - Missing yesterday: yesterday weather missing, today dry, tomorrow rain 2.0mm -> Plan B usually says skip watering.
 */
export type PlantSummary = Plant & { id: string };
type WaterSource = 'manual' | 'rain' | 'unknown';

export interface WateringInsight {
  plantId: string;
  plantName: string;
  needsWater: boolean;
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
  mildewRiskLevel: MildewRiskLevel;
  mildewShouldWarn: boolean;
  mildewConsecutiveVeryHumidWarmDays: number;
  mildewReasons: string[];
  reason: string;
}

interface EvaluateOptions {
  lookbackDays: number;
  rainfallThresholdMm: number;
}

type RangeEntry = {
  logs: PlantLog[];
  weather: WeatherCacheEntry | null;
};

interface HistoricalSignals {
  lastManualWater: Date | null;
  lastRainDate: Date | null;
  yesterdayWeatherFound: boolean;
}

interface ClimateFlags {
  isVeryHot: boolean;
  isHot: boolean;
  isCoolAndCloudy: boolean;
  isLowHumidity: boolean;
  isHighWind: boolean;
  isHighWindGust: boolean;
  isHighUv: boolean;
  isExtremeUv: boolean;
  isLongDaylight: boolean;
  isShortDaylight: boolean;
}

const LOW_MILDEW_ASSESSMENT: MildewRiskAssessment = {
  level: 'low',
  shouldWarn: false,
  consecutiveVeryHumidWarmDays: 0,
  reasons: [],
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Returns local YYYY-MM-DD (not UTC), used for cache keys and comparisons.
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date): string {
  return getLocalDateString(date);
}

function getBaseThreshold(environment: Plant['environment'] | undefined): number {
  if (environment === 'indoor') return 3;
  if (environment === 'greenhouse') return 2.5;
  return 2; // outdoor or unspecified
}

function formatDaysSince(days: number, source: Exclude<WaterSource, 'unknown'>): string {
  if (days < 0.5) return source === 'rain' ? 'watered by rain today' : 'watered today';
  if (days < 2) return source === 'rain' ? 'watered by rain yesterday' : 'watered yesterday';
  const wholeDays = Math.max(Math.floor(days), 2);
  const suffix = wholeDays === 1 ? 'day' : 'days';
  if (source === 'rain') return `rainfall ${wholeDays} ${suffix} ago`;
  return `watered ${wholeDays} ${suffix} ago`;
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatReason(parts: string[]): string {
  if (!parts.length) return 'Check the soil moisture manually; data was limited.';
  const [first, ...rest] = parts;
  const sentences = [capitalize(first), ...rest];
  return `${sentences.join('; ')}.`;
}

function hasValidCoordinates(plant: PlantSummary): plant is PlantSummary & {
  location: { lat: number; lng: number };
} {
  return typeof plant.location?.lat === 'number' && typeof plant.location?.lng === 'number';
}

function getRainfall(weather: WeatherCacheEntry | null | undefined): number {
  return typeof weather?.rainfall === 'number' ? weather.rainfall : 0;
}

function clampProbability(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function getRainConfidence(
  isForecasted: boolean,
  precipitationProbability: number | null | undefined,
): number {
  if (!isForecasted) return 1;
  return clampProbability(precipitationProbability) ?? DEFAULT_FORECAST_RAIN_CONFIDENCE;
}

function getEffectiveRainfallMm(
  rainfallMm: number,
  isForecasted: boolean,
  precipitationProbability: number | null | undefined,
): number {
  if (!Number.isFinite(rainfallMm) || rainfallMm <= 0) return 0;
  return rainfallMm * getRainConfidence(isForecasted, precipitationProbability);
}

function hasLikelyRainAtOrAboveThreshold(
  rainfallMm: number,
  thresholdMm: number,
  isForecasted: boolean,
  precipitationProbability: number | null | undefined,
): boolean {
  if (rainfallMm < thresholdMm) return false;
  if (!isForecasted) return true;

  const pop = clampProbability(precipitationProbability);
  if (typeof pop === 'number' && pop >= LIKELY_FORECAST_RAIN_POP_THRESHOLD) return true;
  return getEffectiveRainfallMm(rainfallMm, true, pop) >= thresholdMm;
}

function isObservedWeatherForDate(
  weather: WeatherCacheEntry | null | undefined,
  dateKey: string,
): boolean {
  if (!weather) return false;
  if (weather.date && weather.date !== dateKey) return false;
  return weather.forecasted !== true;
}

function getLightRainDelayDays(
  range: Record<string, RangeEntry>,
  today: Date,
  rainfallThresholdMm: number,
): number {
  if (!Number.isFinite(rainfallThresholdMm) || rainfallThresholdMm <= 0) return 0;

  let effectiveRainMm = 0;

  LIGHT_RAIN_DELAY_WEIGHTS.forEach((weight, offset) => {
    const key = formatDate(addDays(today, -offset));
    const weather = range[key]?.weather;
    if (!weather) return;
    if (offset === 0 && !isObservedWeatherForDate(weather, key)) return;

    const rainfall = getRainfall(weather);
    if (rainfall >= LIGHT_RAIN_THRESHOLD_MM && rainfall < rainfallThresholdMm) {
      effectiveRainMm += rainfall * weight;
    }
  });

  const delayDays = effectiveRainMm / rainfallThresholdMm;
  if (!Number.isFinite(delayDays) || delayDays <= 0) return 0;
  if (delayDays > 1) return 1;
  return delayDays;
}

function getRecentRainfallTotal(
  range: Record<string, RangeEntry>,
  today: Date,
  days = RECENT_RAIN_WINDOW_DAYS,
): number {
  let total = 0;
  const safeDays = Math.max(days, 1);

  for (let offset = 0; offset < safeDays; offset += 1) {
    const key = formatDate(addDays(today, -offset));
    const weather = range[key]?.weather;
    const rainfall = getRainfall(weather);
    if (offset === 0 && weather && !isObservedWeatherForDate(weather, key)) {
      total += getEffectiveRainfallMm(rainfall, true, getPrecipitationProbability(weather));
    } else {
      total += rainfall;
    }
  }

  return total;
}

function getTemperatureMax(weather: WeatherCacheEntry | null | undefined): number | null {
  if (!weather) return null;
  if (typeof weather.detailedTemps?.max === 'number') return weather.detailedTemps.max;
  return typeof weather.temperature === 'number' ? weather.temperature : null;
}

function getHumidity(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.humidity === 'number' ? weather.humidity : null;
}

function getWindSpeed(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.windSpeed === 'number' ? weather.windSpeed * 3.6 : null;
}

function getDewPoint(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.dewPoint === 'number' ? weather.dewPoint : null;
}

function getNightTemperature(weather: WeatherCacheEntry | null | undefined): number | undefined {
  return typeof weather?.detailedTemps?.night === 'number' ? weather.detailedTemps.night : undefined;
}

function getCloudCoverage(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.cloudCoverage === 'number' ? weather.cloudCoverage : null;
}

function getUvIndex(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.uvIndex === 'number' ? weather.uvIndex : null;
}

function getPrecipitationProbability(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.pop === 'number' ? weather.pop : null;
}

function getWindGust(weather: WeatherCacheEntry | null | undefined): number | null {
  return typeof weather?.windGust === 'number' ? weather.windGust * 3.6 : null;
}

function getWeatherSummary(weather: WeatherCacheEntry | null | undefined): string | null {
  if (typeof weather?.weatherSummary !== 'string') return null;
  const trimmed = weather.weatherSummary.trim();
  return trimmed ? trimmed : null;
}

function getSunrise(weather: WeatherCacheEntry | null | undefined): string | null {
  if (typeof weather?.sunrise !== 'string') return null;
  const trimmed = weather.sunrise.trim();
  return trimmed ? trimmed : null;
}

function getSunset(weather: WeatherCacheEntry | null | undefined): string | null {
  if (typeof weather?.sunset !== 'string') return null;
  const trimmed = weather.sunset.trim();
  return trimmed ? trimmed : null;
}

function getDetailedTemp(
  weather: WeatherCacheEntry | null | undefined,
  key: 'min' | 'max' | 'day' | 'night',
): number | null {
  const value = weather?.detailedTemps?.[key];
  return typeof value === 'number' ? value : null;
}

function parseDateMillis(value: string | null): number | null {
  if (!value) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  return millis;
}

function getDayLengthHours(weather: WeatherCacheEntry | null | undefined): number | null {
  const sunrise = parseDateMillis(getSunrise(weather));
  const sunset = parseDateMillis(getSunset(weather));
  if (sunrise === null || sunset === null) return null;

  let hours = (sunset - sunrise) / (1000 * 60 * 60);
  if (hours < 0) hours += 24;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return null;
  return Number(hours.toFixed(2));
}

function getNightHumidity(weather: WeatherCacheEntry | null | undefined): number | undefined {
  const value = (weather as any)?.nightHumidity;
  return typeof value === 'number' ? value : undefined;
}

function buildMildewSamples(
  range: Record<string, RangeEntry>,
  today: Date,
  sampleDays = MILDEW_SAMPLE_DAYS,
): MildewDaySample[] {
  const safeSampleDays = Math.max(sampleDays, 1);
  const samples: MildewDaySample[] = [];

  for (let dayOffset = safeSampleDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const key = formatDate(addDays(today, -dayOffset));
    const weather = range[key]?.weather;
    const dayHumidity = getHumidity(weather);
    const dayTemperatureC = getDetailedTemp(weather, 'day') ?? weather?.temperature ?? null;

    if (dayHumidity === null || dayTemperatureC === null) continue;

    const nightHumidity = getNightHumidity(weather);
    const windSpeedKph = getWindSpeed(weather);
    const dewPointC = getDewPoint(weather);
    const nightTemperatureC = getNightTemperature(weather);
    const sample: MildewDaySample = { dayHumidity, dayTemperatureC };

    if (typeof nightHumidity === 'number') sample.nightHumidity = nightHumidity;
    if (typeof windSpeedKph === 'number') sample.windSpeedKph = windSpeedKph;
    if (typeof dewPointC === 'number') sample.dewPointC = dewPointC;
    if (typeof nightTemperatureC === 'number') sample.nightTemperatureC = nightTemperatureC;

    samples.push(sample);
  }

  return samples;
}

function assessMildewFromRange(range: Record<string, RangeEntry>, today: Date): MildewRiskAssessment {
  const samples = buildMildewSamples(range, today);
  if (!samples.length) return LOW_MILDEW_ASSESSMENT;
  return assessPowderyMildewRisk(samples);
}

function assessMildewFromTodayWeather(
  todayWeather: WeatherCacheEntry | null,
): MildewRiskAssessment {
  if (!todayWeather) return LOW_MILDEW_ASSESSMENT;
  const dayHumidity = getHumidity(todayWeather);
  const dayTemperatureC = getDetailedTemp(todayWeather, 'day') ?? todayWeather?.temperature ?? null;

  if (dayHumidity === null || dayTemperatureC === null) {
    return LOW_MILDEW_ASSESSMENT;
  }

  const nightHumidity = getNightHumidity(todayWeather);
  const windSpeedKph = getWindSpeed(todayWeather);
  const dewPointC = getDewPoint(todayWeather);
  const nightTemperatureC = getNightTemperature(todayWeather);
  const sample: MildewDaySample = { dayHumidity, dayTemperatureC };
  if (typeof nightHumidity === 'number') sample.nightHumidity = nightHumidity;
  if (typeof windSpeedKph === 'number') sample.windSpeedKph = windSpeedKph;
  if (typeof dewPointC === 'number') sample.dewPointC = dewPointC;
  if (typeof nightTemperatureC === 'number') sample.nightTemperatureC = nightTemperatureC;
  const samples: MildewDaySample[] = [sample];

  return assessPowderyMildewRisk(samples);
}

function buildMildewReasonSuffix(assessment: MildewRiskAssessment): string | null {
  if (assessment.level === 'low') return null;

  if (assessment.level === 'watch') {
    return 'Mildew watch: humidity is entering the risk range, so monitor leaves closely.';
  }

  const levelLabel = assessment.level === 'very_high' ? 'very high' : 'high';
  const parts = [`Powdery mildew risk is ${levelLabel}`];

  if (assessment.consecutiveVeryHumidWarmDays >= 2) {
    parts.push(
      `${assessment.consecutiveVeryHumidWarmDays} humid warm day(s) in a row are increasing pressure`,
    );
  }

  if (assessment.reasons.some((reason) => reason.includes('Humid nights'))) {
    parts.push('humid nights with warm days are amplifying risk');
  }

  parts.push('avoid wetting leaves and improve airflow');
  return `${parts.join('; ')}.`;
}

function appendMildewReason(baseReason: string, assessment: MildewRiskAssessment): string {
  const mildewSuffix = buildMildewReasonSuffix(assessment);
  if (!mildewSuffix) return baseReason;
  return `${baseReason} ${mildewSuffix}`;
}

function extractLastWaterEvent(
  lastManualWater: Date | null,
  lastRainDate: Date | null,
): { lastWaterDay: Date | null; lastWaterSource: WaterSource } {
  const manualEventDay = lastManualWater ? startOfDay(lastManualWater) : null;
  const rainEventDay = lastRainDate ? startOfDay(lastRainDate) : null;
  let lastWaterSource: WaterSource = 'unknown';
  let lastWaterDay: Date | null = null;

  if (manualEventDay && (!rainEventDay || manualEventDay >= rainEventDay)) {
    lastWaterDay = manualEventDay;
    lastWaterSource = 'manual';
  } else if (rainEventDay) {
    lastWaterDay = rainEventDay;
    lastWaterSource = 'rain';
  }

  return { lastWaterDay, lastWaterSource };
}

function resolveDaysSinceLastWater(
  lastWaterDay: Date | null,
  lookbackDays: number,
  today: Date,
): number {
  let daysSinceLastWater: number;

  if (lastWaterDay) {
    daysSinceLastWater = (today.getTime() - lastWaterDay.getTime()) / MS_PER_DAY;
  } else {
    daysSinceLastWater = lookbackDays + 1;
  }

  if (!Number.isFinite(daysSinceLastWater)) {
    return lookbackDays + 1;
  }
  if (daysSinceLastWater < 0) return 0;
  return daysSinceLastWater;
}

function buildClimateFlags(
  temperatureMax: number | null,
  humidity: number | null,
  cloudCoverage: number | null,
  windSpeed: number | null,
  windGust: number | null,
  uvIndex: number | null,
  dayLengthHours: number | null,
): ClimateFlags {
  const isVeryHot = typeof temperatureMax === 'number' && temperatureMax >= VERY_HOT_TEMP_THRESHOLD;
  const isHot = typeof temperatureMax === 'number' && temperatureMax >= HOT_TEMP_THRESHOLD;
  const isCoolAndCloudy =
    typeof temperatureMax === 'number' &&
    typeof cloudCoverage === 'number' &&
    temperatureMax <= COOL_TEMP_THRESHOLD &&
    cloudCoverage >= CLOUDY_THRESHOLD;
  const isLowHumidity = typeof humidity === 'number' && humidity <= LOW_HUMIDITY_THRESHOLD;
  const isHighWind = typeof windSpeed === 'number' && windSpeed >= HIGH_WIND_DRYING_THRESHOLD_KPH;
  const isHighWindGust =
    typeof windGust === 'number' && windGust >= HIGH_WIND_GUST_DRYING_THRESHOLD_KPH;
  const isExtremeUv = typeof uvIndex === 'number' && uvIndex >= EXTREME_UV_INDEX_THRESHOLD;
  const isHighUv = typeof uvIndex === 'number' && uvIndex >= HIGH_UV_INDEX_THRESHOLD;
  const isLongDaylight =
    typeof dayLengthHours === 'number' && dayLengthHours >= LONG_DAYLIGHT_HOURS_THRESHOLD;
  const isShortDaylight =
    typeof dayLengthHours === 'number' && dayLengthHours <= SHORT_DAYLIGHT_HOURS_THRESHOLD;

  return {
    isVeryHot,
    isHot,
    isCoolAndCloudy,
    isLowHumidity,
    isHighWind,
    isHighWindGust,
    isHighUv,
    isExtremeUv,
    isLongDaylight,
    isShortDaylight,
  };
}

function parsePotSizeLiters(potSize?: string): number | null {
  if (!potSize) return null;
  const normalized = potSize.trim().toLowerCase();
  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)(?:\s*([a-z]+))?/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = amountMatch[2] ?? '';

  if (unit.startsWith('gal') || /\b(gal|gallon|gallons)\b/.test(normalized)) {
    return amount * GALLON_TO_LITERS;
  }

  if (
    unit === 'l' ||
    unit.startsWith('lit') ||
    /\b(l|liter|liters|litre|litres)\b/.test(normalized)
  ) {
    return amount;
  }

  // Default to liters when unit is omitted.
  return amount;
}

function getGrowthStageThresholdModifier(growthStage: Plant['growthStage'] | undefined): number {
  if (growthStage === 'germination') return -GERMINATION_STAGE_REDUCTION_DAYS;
  if (growthStage === 'seedling') return -SEEDLING_STAGE_REDUCTION_DAYS;
  return 0;
}

function getPotSizeThresholdModifier(potSize?: string): number {
  const liters = parsePotSizeLiters(potSize);
  if (liters === null) return 0;
  if (liters <= SMALL_POT_THRESHOLD_LITERS) return -SMALL_POT_REDUCTION_DAYS;
  if (liters >= LARGE_POT_THRESHOLD_LITERS) return LARGE_POT_INCREASE_DAYS;
  return 0;
}

function getSunlightThresholdModifier(sunlightExposure?: string): number {
  if (!sunlightExposure) return 0;
  const normalized = sunlightExposure.trim().toLowerCase();

  if (normalized.includes('full sun') || normalized.includes('direct sun')) {
    return -FULL_SUN_REDUCTION_DAYS;
  }

  if (normalized.includes('partial shade')) {
    return PARTIAL_SHADE_INCREASE_DAYS;
  }

  if (normalized.includes('shade') || normalized.includes('low light')) {
    return SHADE_INCREASE_DAYS;
  }

  return 0;
}

function calculateThresholdDays(
  environment: Plant['environment'] | undefined,
  growthStage: Plant['growthStage'] | undefined,
  potSize: string | undefined,
  sunlightExposure: string | undefined,
  climate: ClimateFlags,
  tomorrowRainfall: number,
  forecastedTomorrow: boolean,
  tomorrowPop: number | null,
  rainfallThresholdMm: number,
): number {
  let thresholdDays = getBaseThreshold(environment);
  thresholdDays += getGrowthStageThresholdModifier(growthStage);
  thresholdDays += getPotSizeThresholdModifier(potSize);
  thresholdDays += getSunlightThresholdModifier(sunlightExposure);

  if (climate.isVeryHot) thresholdDays -= 0.75;
  else if (climate.isHot) thresholdDays -= 0.5;

  if (climate.isLowHumidity) thresholdDays -= 0.3;
  if (climate.isHighWind) thresholdDays -= 0.2;
  if (climate.isHighWindGust) thresholdDays -= 0.15;
  if (climate.isExtremeUv) thresholdDays -= 0.25;
  else if (climate.isHighUv) thresholdDays -= 0.15;
  if (climate.isLongDaylight) thresholdDays -= 0.15;
  else if (climate.isShortDaylight) thresholdDays += 0.15;
  if (climate.isCoolAndCloudy) thresholdDays += 0.5;
  const likelyTomorrowSignificantRain = hasLikelyRainAtOrAboveThreshold(
    tomorrowRainfall,
    rainfallThresholdMm,
    forecastedTomorrow,
    tomorrowPop,
  );
  const likelyTomorrowLightRain =
    tomorrowRainfall >= LIGHT_RAIN_THRESHOLD_MM
    && (
      !forecastedTomorrow
      || (
        typeof tomorrowPop === 'number'
        && tomorrowPop >= HIGH_POP_RAIN_DELAY_THRESHOLD
      )
    );

  if (likelyTomorrowSignificantRain || likelyTomorrowLightRain) {
    thresholdDays += 0.5;
  }

  if (thresholdDays < 1) return 1;
  if (thresholdDays > 4) return 4;
  return thresholdDays;
}

function hasUsefulHistoryBeforeDate(
  range: Record<string, RangeEntry>,
  boundaryDate: Date,
): boolean {
  return Object.entries(range).some(([dateKey, entry]) => {
    const dayDate = startOfDay(new Date(`${dateKey}T00:00:00`));
    if (dayDate >= boundaryDate) return false;
    if (entry.weather) return true;
    return Array.isArray(entry.logs) && entry.logs.some((log) => log.type === 'watering');
  });
}

function collectHistoricalSignals(
  range: Record<string, RangeEntry>,
  yesterdayKey: string,
  startOfToday: Date,
  endOfToday: Date,
  rainfallThresholdMm: number,
): HistoricalSignals {
  let lastManualWater: Date | null = null;
  let lastRainDate: Date | null = null;
  let yesterdayWeatherFound = false;

  Object.entries(range).forEach(([dateKey, entry]) => {
    const dayDate = startOfDay(new Date(`${dateKey}T00:00:00`));
    if (dateKey === yesterdayKey && entry.weather) yesterdayWeatherFound = true;
    if (dayDate >= endOfToday) return;

    const logs = Array.isArray(entry.logs) ? entry.logs : [];
    logs.forEach((log) => {
      if (log.type !== 'watering') return;
      const ts = typeof log.timestamp?.toDate === 'function' ? log.timestamp.toDate() : dayDate;
      if (ts >= endOfToday) return;
      if (!lastManualWater || ts > lastManualWater) {
        lastManualWater = ts;
      }
    });

    if (dayDate < startOfToday) {
      const rainfall = getRainfall(entry.weather);
      if (rainfall >= rainfallThresholdMm) {
        if (!lastRainDate || dayDate > lastRainDate) {
          lastRainDate = dayDate;
        }
      }
    }
  });

  return {
    lastManualWater,
    lastRainDate,
    yesterdayWeatherFound,
  };
}

function buildReason(params: {
  lastWaterDay: Date | null;
  daysSinceLastWater: number;
  lastWaterSource: WaterSource;
  needsWater: boolean;
  climate: ClimateFlags;
  humidity: number | null;
  thresholdDays: number;
  todayRainfall: number;
  todayRainObserved: boolean;
  tomorrowRainfall: number;
  forecastedTomorrow: boolean;
  tomorrowPrecipitationProbability: number | null;
  recentRainfallTotalMm: number;
  recentRainfallThresholdMm: number;
  rainfallThresholdMm: number;
  lightRainThresholdMm: number;
  temperatureMax: number | null;
}): string {
  const reasonParts: string[] = [];
  const {
    lastWaterDay,
    daysSinceLastWater,
    lastWaterSource,
    needsWater,
    climate,
    humidity,
    thresholdDays,
    todayRainfall,
    todayRainObserved,
    tomorrowRainfall,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
    recentRainfallTotalMm,
    recentRainfallThresholdMm,
    rainfallThresholdMm,
    lightRainThresholdMm,
    temperatureMax,
  } = params;

  if (lastWaterDay) {
    const source = lastWaterSource === 'rain' ? 'rain' : 'manual';
    reasonParts.push(`${formatDaysSince(daysSinceLastWater, source)}`);
  } else {
    reasonParts.push('No watering logged in the past week.');
  }

  if (needsWater) {
    if (todayRainfall >= lightRainThresholdMm && todayRainfall < rainfallThresholdMm) {
      if (todayRainObserved) {
        reasonParts.push(`only light rain (${todayRainfall.toFixed(1)}mm) today`);
      } else {
        reasonParts.push(`only light rain (~${todayRainfall.toFixed(1)}mm) is forecast today`);
      }
    }
    if (climate.isVeryHot || climate.isHot) {
      reasonParts.push(`forecast high of ${Math.round(temperatureMax ?? HOT_TEMP_THRESHOLD)} degC`);
    }
    if (climate.isLowHumidity && typeof humidity === 'number') {
      reasonParts.push(`humidity near ${Math.round(humidity)}%`);
    }
    if (climate.isHighWind) {
      reasonParts.push('strong winds are increasing drying');
    }
    if (!climate.isVeryHot && !climate.isHot && !climate.isLowHumidity) {
      reasonParts.push(`now beyond the ${thresholdDays.toFixed(1)} day watering window`);
    }
  } else {
    if (todayRainfall >= rainfallThresholdMm && todayRainObserved) {
      reasonParts.push(`received about ${todayRainfall.toFixed(1)}mm of rain today`);
      if (todayRainfall >= rainfallThresholdMm * 2) {
        reasonParts.push(
          `heavy rain likely soaked the root zone; skip watering for about ${Math.max(Math.round(thresholdDays), 1)} day(s)`,
        );
      }
    } else if (todayRainfall >= rainfallThresholdMm) {
      reasonParts.push(`forecast suggests around ${todayRainfall.toFixed(1)}mm of rain today`);
    } else if (recentRainfallTotalMm >= recentRainfallThresholdMm) {
      reasonParts.push(
        `recent rainfall totaled ~${recentRainfallTotalMm.toFixed(1)}mm over the last ${RECENT_RAIN_WINDOW_DAYS} days`,
      );
    } else if (
      hasLikelyRainAtOrAboveThreshold(
        tomorrowRainfall,
        rainfallThresholdMm,
        forecastedTomorrow,
        tomorrowPrecipitationProbability,
      )
    ) {
      if (
        forecastedTomorrow
        && typeof tomorrowPrecipitationProbability === 'number'
      ) {
        reasonParts.push(
          `rain (~${tomorrowRainfall.toFixed(1)}mm) likely tomorrow (${Math.round(tomorrowPrecipitationProbability * 100)}% chance)`,
        );
      } else {
        reasonParts.push(`rain (~${tomorrowRainfall.toFixed(1)}mm) expected tomorrow`);
      }
    } else if (
      forecastedTomorrow
      && tomorrowRainfall >= rainfallThresholdMm
      && typeof tomorrowPrecipitationProbability === 'number'
    ) {
      reasonParts.push(
        `tomorrow rain forecast is low-confidence (${Math.round(tomorrowPrecipitationProbability * 100)}% chance)`,
      );
    } else {
      const remaining = Math.max(thresholdDays - daysSinceLastWater, 0);
      reasonParts.push(
        `still within the ${thresholdDays.toFixed(1)} day watering window (${remaining.toFixed(1)} days left)`,
      );
    }
  }

  const isHeatStressDay =
    typeof temperatureMax === 'number' && temperatureMax >= HEAT_STRESS_WARNING_TEMP_THRESHOLD;
  if (isHeatStressDay) {
    if (needsWater) {
      reasonParts.push('heat stress risk today - water early morning and check for wilting');
    } else {
      reasonParts.push('heat stress watch - monitor wilting and consider temporary shade');
    }
  }

  const isCoolDay = typeof temperatureMax === 'number' && temperatureMax < COLD_TEMP_THRESHOLD;
  const isHumidDay = typeof humidity === 'number' && humidity >= HIGH_HUMIDITY_THRESHOLD;
  const hasRecentWetPattern =
    todayRainfall >= lightRainThresholdMm || recentRainfallTotalMm >= rainfallThresholdMm;
  if (isCoolDay && isHumidDay && hasRecentWetPattern && !needsWater) {
    reasonParts.push('cool and wet pattern raises root rot risk; avoid overwatering');
  } else if (isCoolDay && !hasRecentWetPattern && needsWater) {
    reasonParts.push('cool weather caution: water lightly and avoid leaving roots soggy');
  }

  return formatReason(reasonParts);
}

function buildPlanBInsight(
  plant: PlantSummary,
  todayWeather: WeatherCacheEntry,
  tomorrowWeather: WeatherCacheEntry | null,
  options: EvaluateOptions,
): WateringInsight {
  const todayRainfall = getRainfall(todayWeather);
  const tomorrowRainfall = getRainfall(tomorrowWeather);
  const precipitationProbability = getPrecipitationProbability(todayWeather);
  const tomorrowPrecipitationProbability = getPrecipitationProbability(tomorrowWeather);
  const forecastedToday = todayWeather.forecasted === true;
  const forecastedTomorrow = tomorrowWeather?.forecasted === true;
  const effectiveTodayRainfall = getEffectiveRainfallMm(
    todayRainfall,
    forecastedToday,
    precipitationProbability,
  );
  const effectiveTomorrowRainfall = getEffectiveRainfallMm(
    tomorrowRainfall,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
  );
  const temperatureMax = getTemperatureMax(todayWeather);
  const temperatureMin = getDetailedTemp(todayWeather, 'min');
  const temperatureDay = getDetailedTemp(todayWeather, 'day');
  const temperatureNight = getDetailedTemp(todayWeather, 'night');
  const humidity = getHumidity(todayWeather);
  const cloudCoverage = getCloudCoverage(todayWeather);
  const dewPoint = getDewPoint(todayWeather);
  const windSpeed = getWindSpeed(todayWeather);
  const windGust = getWindGust(todayWeather);
  const uvIndex = getUvIndex(todayWeather);
  const weatherSummary = getWeatherSummary(todayWeather);
  const sunrise = getSunrise(todayWeather);
  const sunset = getSunset(todayWeather);
  const dayLengthHours = getDayLengthHours(todayWeather);
  let needsWater = true;
  const planBReason: string[] = [];
  const likelySignificantRainToday = hasLikelyRainAtOrAboveThreshold(
    todayRainfall,
    options.rainfallThresholdMm,
    forecastedToday,
    precipitationProbability,
  );
  const likelySignificantRainTomorrow = hasLikelyRainAtOrAboveThreshold(
    tomorrowRainfall,
    options.rainfallThresholdMm,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
  );
  const likelyLightRainTomorrow =
    tomorrowRainfall >= LIGHT_RAIN_THRESHOLD_MM
    && forecastedTomorrow
    && typeof tomorrowPrecipitationProbability === 'number'
    && tomorrowPrecipitationProbability >= HIGH_POP_RAIN_DELAY_THRESHOLD;
  const hasSignificantRainSoon =
    likelySignificantRainToday || likelySignificantRainTomorrow || likelyLightRainTomorrow;

  // Plan B is intentionally conservative when yesterday's weather is missing.
  if (hasSignificantRainSoon) {
    needsWater = false;
    if (likelySignificantRainToday) {
      if (forecastedToday) {
        const todayChance =
          typeof precipitationProbability === 'number'
            ? ` (${Math.round(precipitationProbability * 100)}% chance)`
            : '';
        planBReason.push(`Rain is likely today (~${effectiveTodayRainfall.toFixed(1)}mm effective${todayChance})`);
      } else {
        planBReason.push(`It rained today (${todayRainfall.toFixed(1)}mm)`);
      }
    }
    if (likelySignificantRainTomorrow) {
      if (forecastedTomorrow) {
        const tomorrowChance =
          typeof tomorrowPrecipitationProbability === 'number'
            ? ` (${Math.round(tomorrowPrecipitationProbability * 100)}% chance)`
            : '';
        planBReason.push(`Rain likely tomorrow (~${effectiveTomorrowRainfall.toFixed(1)}mm effective${tomorrowChance})`);
      } else {
        planBReason.push(`Rain expected tomorrow (${tomorrowRainfall.toFixed(1)}mm)`);
      }
    } else if (likelyLightRainTomorrow) {
      planBReason.push(
        `Light rain is likely tomorrow (${tomorrowRainfall.toFixed(1)}mm, ${Math.round((tomorrowPrecipitationProbability ?? 0) * 100)}% chance)`,
      );
    }
    planBReason.push('No watering needed.');
  } else {
    planBReason.push('No significant rain today or tomorrow.');
    if (todayRainfall >= LIGHT_RAIN_THRESHOLD_MM) {
      if (forecastedToday) {
        const todayChance =
          typeof precipitationProbability === 'number'
            ? ` (${Math.round(precipitationProbability * 100)}% chance)`
            : '';
        planBReason.push(
          `Forecast rain today is not likely enough to replace watering (${todayRainfall.toFixed(1)}mm${todayChance}).`,
        );
      } else {
        planBReason.push(`Only light rain fell today (${todayRainfall.toFixed(1)}mm).`);
      }
    } else if (
      forecastedTomorrow
      && tomorrowRainfall >= options.rainfallThresholdMm
      && typeof tomorrowPrecipitationProbability === 'number'
    ) {
      planBReason.push(
        `Tomorrow rain forecast is low-confidence (${Math.round(tomorrowPrecipitationProbability * 100)}% chance).`,
      );
    }
    if (typeof temperatureMax === 'number') {
      if (temperatureMax >= HOT_TEMP_THRESHOLD) {
        planBReason.push(`Forecast is sunny/hot (high of ${Math.round(temperatureMax)}°C)`);
      } else {
        planBReason.push(`Forecast high is around ${Math.round(temperatureMax)}°C`);
      }
    }
    planBReason.push('Watering is recommended.');
  }

  if (typeof temperatureMax === 'number' && temperatureMax >= HEAT_STRESS_WARNING_TEMP_THRESHOLD) {
    if (needsWater) {
      planBReason.push('Heat stress risk today: water early and check for wilting.');
    } else {
      planBReason.push('Heat stress watch: monitor wilting and provide temporary shade.');
    }
  }

  if (
    typeof temperatureMax === 'number' &&
    temperatureMax < COLD_TEMP_THRESHOLD &&
    typeof humidity === 'number' &&
    humidity >= HIGH_HUMIDITY_THRESHOLD &&
    (effectiveTodayRainfall >= LIGHT_RAIN_THRESHOLD_MM || likelySignificantRainTomorrow) &&
    !needsWater
  ) {
    planBReason.push('Cool wet conditions increase root rot risk - avoid overwatering.');
  }

  const mildew = assessMildewFromTodayWeather(todayWeather);
  const baseReason = `Yesterday's weather data unavailable - assuming no water was received. ${planBReason.join(' ')} Using current and forecast data only.`;

  return {
    plantId: plant.id,
    plantName: plant.name || 'Unnamed plant',
    needsWater,
    score: 0,
    daysSinceLastWater: 1,
    thresholdDays: getBaseThreshold(plant.environment),
    lastWaterSource: 'unknown',
    todayRainfall,
    tomorrowRainfall,
    precipitationProbability,
    tomorrowPrecipitationProbability,
    forecastedToday,
    forecastedTomorrow,
    todayRainObserved: !forecastedToday,
    recentRainfallTotalMm: Number(todayRainfall.toFixed(2)),
    hasSaturatingRecentRain: todayRainfall >= RECENT_RAIN_ACCUMULATION_THRESHOLD_MM,
    temperatureMax,
    temperatureMin,
    temperatureDay,
    temperatureNight,
    humidity,
    cloudCoverage,
    dewPoint,
    windSpeed,
    windGust,
    uvIndex,
    weatherSummary,
    sunrise,
    sunset,
    dayLengthHours,
    mildewRiskLevel: mildew.level,
    mildewShouldWarn: mildew.shouldWarn,
    mildewConsecutiveVeryHumidWarmDays: mildew.consecutiveVeryHumidWarmDays,
    mildewReasons: mildew.reasons,
    reason: appendMildewReason(baseReason, mildew),
  };
}

async function refreshWeatherIfMissing(
  plant: PlantSummary,
  range: Record<string, RangeEntry>,
  targetDates: string[]
): Promise<Record<string, RangeEntry>> {
  if (!hasValidCoordinates(plant)) {
    return range;
  }

  const missingDates = targetDates.filter((date) => {
    const entry = range[date];
    const fetchedAt = entry?.weather?.fetchedAt?.toDate?.().getTime();
    return !entry?.weather || !fetchedAt || Date.now() - fetchedAt > 6 * 3600000;
  });

  if (missingDates.length === 0) {
    return range;
  }

  try {
    const apiResponse = await fetchWeather(plant.location.lat, plant.location.lng);
    const parsed = parseWeatherData(apiResponse);
    await updateWeatherCache(plant.id, parsed);

    const updatedRange: Record<string, RangeEntry> = { ...range };
    Object.entries(parsed).forEach(([date, weatherEntry]) => {
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

async function evaluatePlantWatering(
  plant: PlantSummary,
  today: Date,
  options: EvaluateOptions
): Promise<WateringInsight | null> {
  // Phase 0: ignore non-active plants.
  // Early exit: archived/harvested/dead plants are not part of daily watering guidance.
  if (plant.status && plant.status !== 'active') return null;

  // Phase 1: load logs + weather window [today - lookback, tomorrow].
  const startDate = formatDate(addDays(today, -options.lookbackDays));
  const endDate = formatDate(addDays(today, 1));

  let range: Record<string, RangeEntry>;
  try {
    range = await fetchLogsAndWeatherForRange(plant.id, startDate, endDate);
  } catch (error) {
    logger.error('Failed to fetch logs/weather for plant', { plantId: plant.id, error });
    // Early exit: without logs/weather we cannot compute a safe recommendation.
    return null;
  }

  const todayKey = formatDate(today);
  const tomorrowKey = formatDate(addDays(today, 1));
  const yesterdayKey = formatDate(addDays(today, -1));
  const targetDates = [todayKey, tomorrowKey];
  const startOfToday = startOfDay(today);
  const endOfToday = addDays(today, 1);

  // Phase 2: fill missing today/tomorrow weather from API cache refresh.
  range = await refreshWeatherIfMissing(plant, range, targetDates);

  const todayWeather = range[todayKey]?.weather ?? null;
  const tomorrowWeather = range[tomorrowKey]?.weather ?? null;

  // Phase 3: if yesterday is missing but today exists, use a simpler fallback.
  if (todayWeather && !range[yesterdayKey]?.weather && !hasUsefulHistoryBeforeDate(range, startOfToday)) {
    // Early exit: Plan B favors conservative guidance when continuity is broken.
    return buildPlanBInsight(plant, todayWeather, tomorrowWeather, options);
  }

  // Phase 4: if we still do not have today's weather, return a neutral insight.
  if (!todayWeather) {
    logger.warn("Missing today's weather data for plant after fallback", { plantId: plant.id, todayKey });
    // Early exit: neutral/manual-check state avoids false confidence while cache syncs.
    return {
      plantId: plant.id,
      plantName: plant.name || 'Unnamed plant',
      needsWater: false,
      score: 0,
      daysSinceLastWater: 0,
      thresholdDays: getBaseThreshold(plant.environment),
      lastWaterSource: 'unknown',
      todayRainfall: 0,
      tomorrowRainfall: 0,
      precipitationProbability: null,
      tomorrowPrecipitationProbability: null,
      forecastedToday: false,
      forecastedTomorrow: false,
      todayRainObserved: false,
      recentRainfallTotalMm: 0,
      hasSaturatingRecentRain: false,
      temperatureMax: null,
      temperatureMin: null,
      temperatureDay: null,
      temperatureNight: null,
      humidity: null,
      cloudCoverage: null,
      dewPoint: null,
      windSpeed: null,
      windGust: null,
      uvIndex: null,
      weatherSummary: null,
      sunrise: null,
      sunset: null,
      dayLengthHours: null,
      mildewRiskLevel: 'low',
      mildewShouldWarn: false,
      mildewConsecutiveVeryHumidWarmDays: 0,
      mildewReasons: [],
      reason: 'Weather data is still syncing. Check soil moisture manually today.',
    };
  }

  const todayRainfall = getRainfall(todayWeather);
  const tomorrowRainfall = getRainfall(tomorrowWeather);
  const precipitationProbability = getPrecipitationProbability(todayWeather);
  const tomorrowPrecipitationProbability = getPrecipitationProbability(tomorrowWeather);
  const forecastedToday = todayWeather.forecasted === true;
  const forecastedTomorrow = tomorrowWeather?.forecasted === true;
  const todayRainObserved = isObservedWeatherForDate(todayWeather, todayKey);
  const hasObservedSignificantRainToday =
    todayRainObserved && todayRainfall >= options.rainfallThresholdMm;
  const hasLikelySignificantRainTomorrow = hasLikelyRainAtOrAboveThreshold(
    tomorrowRainfall,
    options.rainfallThresholdMm,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
  );
  const hasLikelyHighConfidenceLightRainTomorrow =
    tomorrowRainfall >= LIGHT_RAIN_THRESHOLD_MM
    && forecastedTomorrow
    && typeof tomorrowPrecipitationProbability === 'number'
    && tomorrowPrecipitationProbability >= HIGH_POP_RAIN_DELAY_THRESHOLD;
  const recentRainfallTotalMm = getRecentRainfallTotal(range, today, RECENT_RAIN_WINDOW_DAYS);
  const hasSaturatingRecentRain =
    recentRainfallTotalMm >= RECENT_RAIN_ACCUMULATION_THRESHOLD_MM;
  const lightRainDelayDays = getLightRainDelayDays(range, today, options.rainfallThresholdMm);
  const temperatureMax = getTemperatureMax(todayWeather);
  const temperatureMin = getDetailedTemp(todayWeather, 'min');
  const temperatureDay = getDetailedTemp(todayWeather, 'day');
  const temperatureNight = getDetailedTemp(todayWeather, 'night');
  const humidity = getHumidity(todayWeather);
  const windSpeed = getWindSpeed(todayWeather);
  const windGust = getWindGust(todayWeather);
  const cloudCoverage = getCloudCoverage(todayWeather);
  const dewPoint = getDewPoint(todayWeather);
  const uvIndex = getUvIndex(todayWeather);
  const weatherSummary = getWeatherSummary(todayWeather);
  const sunrise = getSunrise(todayWeather);
  const sunset = getSunset(todayWeather);
  const dayLengthHours = getDayLengthHours(todayWeather);

  // Phase 5: inspect historical logs/weather to find the latest water source.
  const history = collectHistoricalSignals(
    range,
    yesterdayKey,
    startOfToday,
    endOfToday,
    options.rainfallThresholdMm,
  );

  const { lastWaterDay, lastWaterSource: initialWaterSource } = extractLastWaterEvent(
    history.lastManualWater,
    history.lastRainDate,
  );
  let lastWaterSource: WaterSource = initialWaterSource;

  // Phase 6: estimate dryness window and whether watering is due.
  let daysSinceLastWater = resolveDaysSinceLastWater(
    lastWaterDay,
    options.lookbackDays,
    today,
  );
  if (lightRainDelayDays > 0) {
    // Recent light rain can delay dryness a bit without fully replacing a watering event.
    daysSinceLastWater = Math.max(daysSinceLastWater - lightRainDelayDays, 0);
  }

  const climate = buildClimateFlags(
    temperatureMax,
    humidity,
    cloudCoverage,
    windSpeed,
    windGust,
    uvIndex,
    dayLengthHours,
  );
  const thresholdDays = calculateThresholdDays(
    plant.environment,
    plant.growthStage,
    plant.potSize,
    plant.sunlightExposure,
    climate,
    tomorrowRainfall,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
    options.rainfallThresholdMm,
  );

  let needsWater = daysSinceLastWater >= thresholdDays + DRYNESS_TRIGGER_GRACE_DAYS;

  // Rain today/tomorrow can suppress manual watering need.
  if (hasObservedSignificantRainToday || hasSaturatingRecentRain) {
    needsWater = false;
    lastWaterSource = 'rain';
    daysSinceLastWater = 0;
  }

  if (hasLikelySignificantRainTomorrow && daysSinceLastWater < thresholdDays + 0.5) {
    needsWater = false;
  }
  if (
    !hasLikelySignificantRainTomorrow
    && hasLikelyHighConfidenceLightRainTomorrow
    && daysSinceLastWater < thresholdDays + 0.25
  ) {
    needsWater = false;
  }

  const effectiveDrynessRatio = thresholdDays > 0 ? daysSinceLastWater / thresholdDays : 0;
  let score = effectiveDrynessRatio;
  if (hasObservedSignificantRainToday || hasSaturatingRecentRain) {
    score = 0;
  } else if (!needsWater) {
    score = Math.min(effectiveDrynessRatio, 0.99);
  }
  if (!Number.isFinite(score)) score = 0;

  // Phase 7: produce a human-readable explanation.
  const reason = buildReason({
    lastWaterDay,
    daysSinceLastWater,
    lastWaterSource,
    needsWater,
    climate,
    humidity,
    thresholdDays,
    todayRainfall,
    todayRainObserved,
    tomorrowRainfall,
    forecastedTomorrow,
    tomorrowPrecipitationProbability,
    recentRainfallTotalMm,
    recentRainfallThresholdMm: RECENT_RAIN_ACCUMULATION_THRESHOLD_MM,
    rainfallThresholdMm: options.rainfallThresholdMm,
    lightRainThresholdMm: LIGHT_RAIN_THRESHOLD_MM,
    temperatureMax,
  });
  const mildew = assessMildewFromRange(range, today);
  const reasonWithMildew = appendMildewReason(reason, mildew);

  // Final return: fully evaluated insight using historical logs, weather, and modifiers.
  return {
    plantId: plant.id,
    plantName: plant.name || 'Unnamed plant',
    needsWater,
    score: Number(score.toFixed(2)),
    daysSinceLastWater: Number(daysSinceLastWater.toFixed(2)),
    thresholdDays: Number(thresholdDays.toFixed(2)),
    lastWaterSource,
    todayRainfall: Number(todayRainfall.toFixed(2)),
    tomorrowRainfall: Number(tomorrowRainfall.toFixed(2)),
    precipitationProbability,
    tomorrowPrecipitationProbability,
    forecastedToday,
    forecastedTomorrow,
    todayRainObserved,
    recentRainfallTotalMm: Number(recentRainfallTotalMm.toFixed(2)),
    hasSaturatingRecentRain,
    temperatureMax: temperatureMax ?? null,
    temperatureMin,
    temperatureDay,
    temperatureNight,
    humidity,
    cloudCoverage,
    dewPoint,
    windSpeed,
    windGust,
    uvIndex,
    weatherSummary,
    sunrise,
    sunset,
    dayLengthHours,
    mildewRiskLevel: mildew.level,
    mildewShouldWarn: mildew.shouldWarn,
    mildewConsecutiveVeryHumidWarmDays: mildew.consecutiveVeryHumidWarmDays,
    mildewReasons: mildew.reasons,
    reason: reasonWithMildew,
  };
}

/**
 * Evaluates watering insight for each plant.
 * Runs sequentially to avoid flooding the weather/cache services.
 */
export async function evaluateWateringInsights(
  plants: PlantSummary[],
  options?: Partial<EvaluateOptions>
): Promise<WateringInsight[]> {
  if (!plants.length) return [];

  const mergedOptions: EvaluateOptions = {
    lookbackDays: options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    rainfallThresholdMm: options?.rainfallThresholdMm ?? DEFAULT_RAIN_THRESHOLD_MM,
  };

  const today = startOfDay(new Date());
  const insights: WateringInsight[] = [];

  for (const plant of plants) {
    try {
      const insight = await evaluatePlantWatering(plant, today, mergedOptions);
      if (insight) insights.push(insight);
    } catch (error) {
      logger.error('Failed to evaluate watering insight for plant', { plantId: plant.id, error });
    }
  }
  return insights;
}
