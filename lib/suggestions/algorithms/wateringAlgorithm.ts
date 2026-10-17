import type { SuggestionAlgorithmContext, SuggestionCard, SuggestionConfidence, SuggestionSeverity } from '@/lib/suggestions/types';

const ALGORITHM_VERSION = 'watering-v1';

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function stripSharedRiskSuffixes(reason: string): string {
  return reason
    .replace(/Mildew watch:[^.]*\./gi, '')
    .replace(/Powdery mildew risk is[^.]*\./gi, '')
    .replace(/[^.;]*root rot risk[^.;]*[.;]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveSeverity(context: SuggestionAlgorithmContext): SuggestionSeverity {
  const { insight } = context;
  const likelyRainToday =
    insight.todayRainfall >= 8
    && (
      insight.todayRainObserved
      || (
        insight.forecastedToday
        && typeof insight.precipitationProbability === 'number'
        && insight.precipitationProbability >= 0.6
      )
    );
  const likelyRainTomorrow =
    insight.tomorrowRainfall >= 8
    && (
      !insight.forecastedTomorrow
      || (
        typeof insight.tomorrowPrecipitationProbability === 'number'
        && insight.tomorrowPrecipitationProbability >= 0.6
      )
    );
  const hasFastDryingPressure =
    (typeof insight.uvIndex === 'number' && insight.uvIndex >= 10)
    || (typeof insight.windGust === 'number' && insight.windGust >= 35)
    || (typeof insight.windSpeed === 'number' && insight.windSpeed >= 22)
    || (typeof insight.dayLengthHours === 'number' && insight.dayLengthHours >= 13);
  if (insight.needsWater && (insight.score >= 1.35 || hasFastDryingPressure)) return 'critical';
  if (insight.needsWater) return 'warn';
  if (insight.hasSaturatingRecentRain || likelyRainToday || likelyRainTomorrow) return 'info';
  if (insight.forecastedToday && insight.todayRainfall >= 8) return 'watch';
  return 'info';
}

function resolveConfidence(context: SuggestionAlgorithmContext): SuggestionConfidence {
  const { insight } = context;
  if (insight.reason.includes('Weather data is still syncing')) return 'low';

  const evidenceCount = [
    typeof insight.temperatureMax === 'number',
    typeof insight.humidity === 'number',
    Number.isFinite(insight.todayRainfall),
    Number.isFinite(insight.daysSinceLastWater),
  ].filter(Boolean).length;

  if (evidenceCount >= 4) return 'high';
  if (
    !insight.todayRainObserved
    && insight.todayRainfall >= 8
    && typeof insight.precipitationProbability === 'number'
    && insight.precipitationProbability < 0.5
  ) {
    return 'medium';
  }
  if (evidenceCount >= 2) return 'medium';
  return 'low';
}

function resolveTitle(context: SuggestionAlgorithmContext): string {
  const { insight } = context;
  if (insight.needsWater) return 'Watering required';
  if (
    !insight.needsWater
    && typeof insight.tomorrowPrecipitationProbability === 'number'
    && insight.tomorrowPrecipitationProbability >= 0.65
    && insight.tomorrowRainfall >= 3
  ) {
    return 'Delay watering, rain likely';
  }
  if (insight.todayRainfall >= 8) return 'Skip watering today';
  if (insight.tomorrowRainfall >= 8) return 'Delay watering until tomorrow';
  return 'Watering on track';
}

export function evaluateWateringAlgorithm(context: SuggestionAlgorithmContext): SuggestionCard {
  const { insight } = context;
  const baseSummary = stripSharedRiskSuffixes(insight.reason) || insight.reason;
  const reasons = baseSummary
    .split(';')
    .map((part) => sentenceCase(part))
    .filter((part) => part.length > 0)
    .slice(0, 3);

  if (typeof insight.uvIndex === 'number' && insight.uvIndex >= 8) {
    reasons.push(sentenceCase(`UV index is high (${insight.uvIndex.toFixed(1)}), so pots can dry faster`));
  }
  if (typeof insight.windGust === 'number' && insight.windGust >= 30) {
    reasons.push(sentenceCase(`Wind gusts near ${Math.round(insight.windGust)} km/h increase drying`));
  }
  if (
    typeof insight.tomorrowPrecipitationProbability === 'number'
    && insight.tomorrowPrecipitationProbability >= 0.65
    && insight.tomorrowRainfall >= 3
  ) {
    reasons.push(
      sentenceCase(
        `Forecast confidence is high (${Math.round(insight.tomorrowPrecipitationProbability * 100)}% precip chance tomorrow)`,
      ),
    );
  }
  if (
    insight.forecastedToday
    && insight.todayRainfall > 0
    && typeof insight.precipitationProbability === 'number'
  ) {
    reasons.push(
      sentenceCase(
        `Today's rain is forecast-only (${Math.round(insight.precipitationProbability * 100)}% precip chance)`,
      ),
    );
  }
  if (insight.hasSaturatingRecentRain) {
    reasons.push(sentenceCase(`Recent rainfall is saturating (~${insight.recentRainfallTotalMm.toFixed(1)}mm in ${3} days)`));
  }

  return {
    id: `${insight.plantId}:watering`,
    kind: 'watering',
    active: true,
    severity: resolveSeverity(context),
    title: resolveTitle(context),
    summary: sentenceCase(baseSummary),
    reasons,
    metrics: {
      needsWater: insight.needsWater,
      daysSinceLastWater: insight.daysSinceLastWater,
      thresholdDays: insight.thresholdDays,
      todayRainfallMm: insight.todayRainfall,
      tomorrowRainfallMm: insight.tomorrowRainfall,
      humidity: insight.humidity,
      temperatureMaxC: insight.temperatureMax,
      temperatureMinC: insight.temperatureMin,
      temperatureDayC: insight.temperatureDay,
      temperatureNightC: insight.temperatureNight,
      cloudCoverage: insight.cloudCoverage,
      dewPointC: insight.dewPoint,
      windSpeedKph: insight.windSpeed,
      windGustKph: insight.windGust,
      uvIndex: insight.uvIndex,
      precipitationProbability: insight.precipitationProbability,
      tomorrowPrecipitationProbability: insight.tomorrowPrecipitationProbability,
      todayRainObserved: insight.todayRainObserved,
      recentRainfallTotalMm: insight.recentRainfallTotalMm,
      hasSaturatingRecentRain: insight.hasSaturatingRecentRain,
      dayLengthHours: insight.dayLengthHours,
      weatherSummary: insight.weatherSummary ?? '',
    },
    confidence: resolveConfidence(context),
    algorithmVersion: ALGORITHM_VERSION,
  };
}
