/** Historical heuristic/regression support. Production hops care uses W10=disabled, never this risk score. */
export type MildewRiskLevel = 'low' | 'watch' | 'high' | 'very_high';

export interface MildewDaySample {
  /** Average or representative daytime humidity (%) */
  dayHumidity: number;
  /** Representative daytime temperature in Celsius */
  dayTemperatureC: number;
  /** Optional night humidity (%) for day/night cycle checks */
  nightHumidity?: number;
  /** Optional near-ground wind speed in km/h (outdoor airflow proxy) */
  windSpeedKph?: number;
  /** Optional dew point in Celsius for condensation checks */
  dewPointC?: number;
  /** Optional nighttime temperature in Celsius */
  nightTemperatureC?: number;
}

export interface MildewRiskAssessment {
  level: MildewRiskLevel;
  shouldWarn: boolean;
  consecutiveVeryHumidWarmDays: number;
  reasons: string[];
}

const MIN_TEMP_RISK_C = 12;
const OPTIMAL_TEMP_MIN_C = 18;
const OPTIMAL_TEMP_MAX_C = 26;
const PEAK_TEMP_MIN_C = 20;
const PEAK_TEMP_MAX_C = 25;
const MAX_TEMP_RISK_C = 30;

const HUMIDITY_RISK_START = 60;
const HUMIDITY_HIGH = 65;
const HUMIDITY_VERY_HUMID = 70;
const HUMIDITY_CONDENSATION_NIGHT = 80;

const LOW_WIND_THRESHOLD_KPH = 5;
const HIGH_WIND_THRESHOLD_KPH = 22;
const CONDENSATION_DEW_SPREAD_C = 2;
const CONDENSATION_NIGHT_TEMP_MAX_C = 20;

function toSeverity(level: MildewRiskLevel): number {
  if (level === 'low') return 0;
  if (level === 'watch') return 1;
  if (level === 'high') return 2;
  return 3;
}

function fromSeverity(value: number): MildewRiskLevel {
  if (value <= 0) return 'low';
  if (value === 1) return 'watch';
  if (value === 2) return 'high';
  return 'very_high';
}

function clampHumidity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function clampWind(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return value;
}

function isOptimalTemp(tempC: number): boolean {
  return tempC >= OPTIMAL_TEMP_MIN_C && tempC <= OPTIMAL_TEMP_MAX_C;
}

function isPeakTemp(tempC: number): boolean {
  return tempC >= PEAK_TEMP_MIN_C && tempC <= PEAK_TEMP_MAX_C;
}

function isSuppressedTemp(tempC: number): boolean {
  return tempC < MIN_TEMP_RISK_C || tempC > MAX_TEMP_RISK_C;
}

function baseLevelByHumidity(humidity: number): MildewRiskLevel {
  if (humidity >= HUMIDITY_HIGH) return 'high';
  if (humidity >= HUMIDITY_RISK_START) return 'watch';
  return 'low';
}

function countConsecutiveVeryHumidWarmDays(samples: MildewDaySample[]): number {
  let count = 0;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const day = samples[i];
    const dayHumidity = clampHumidity(day.dayHumidity);
    if (dayHumidity >= HUMIDITY_VERY_HUMID && isOptimalTemp(day.dayTemperatureC)) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function hasHumidNightWarmDayCycle(samples: MildewDaySample[]): boolean {
  return samples.some((day) => {
    const nightHumidity = clampHumidity(day.nightHumidity ?? -1);
    return (
      nightHumidity >= HUMIDITY_VERY_HUMID &&
      day.dayTemperatureC >= PEAK_TEMP_MIN_C &&
      day.dayTemperatureC <= OPTIMAL_TEMP_MAX_C
    );
  });
}

function hasCondensationNightCycle(samples: MildewDaySample[]): boolean {
  return samples.some((day) => {
    const nightHumidity = clampHumidity(day.nightHumidity ?? -1);
    if (nightHumidity < HUMIDITY_CONDENSATION_NIGHT) return false;

    if (
      typeof day.dewPointC === 'number' &&
      typeof day.nightTemperatureC === 'number'
    ) {
      const spread = Math.abs(day.nightTemperatureC - day.dewPointC);
      return spread <= CONDENSATION_DEW_SPREAD_C && day.nightTemperatureC <= CONDENSATION_NIGHT_TEMP_MAX_C;
    }

    return false;
  });
}

/**
 * Assess powdery mildew pressure from recent weather.
 *
 * Heuristic summary:
 * - Risk starts near 60% humidity.
 * - High risk from 65%+ in favorable temperatures.
 * - Very high risk at 70%+ for 2+ consecutive warm days.
 * - Humid night + warm day cycles increase risk.
 * - Risk is reduced when very cold (<12C) or very hot (>30C).
 */
export function assessPowderyMildewRisk(samples: MildewDaySample[]): MildewRiskAssessment {
  if (!samples.length) {
    return {
      level: 'low',
      shouldWarn: false,
      consecutiveVeryHumidWarmDays: 0,
      reasons: ['No weather samples provided.'],
    };
  }

  const current = samples[samples.length - 1];
  const currentHumidity = clampHumidity(current.dayHumidity);
  const currentTemp = current.dayTemperatureC;
  const currentWind = typeof current.windSpeedKph === 'number' ? clampWind(current.windSpeedKph) : null;
  const reasons: string[] = [];

  let severity = toSeverity(baseLevelByHumidity(currentHumidity));
  if (currentHumidity >= HUMIDITY_RISK_START) {
    reasons.push(`Humidity near ${Math.round(currentHumidity)}%.`);
  } else {
    reasons.push(`Humidity near ${Math.round(currentHumidity)}% (below risk start).`);
  }

  if (isOptimalTemp(currentTemp)) {
    reasons.push(`Temperature ${Math.round(currentTemp)}C is in the favorable mildew range.`);
  } else if (isSuppressedTemp(currentTemp)) {
    reasons.push(`Temperature ${Math.round(currentTemp)}C suppresses mildew activity.`);
    severity -= 1;
  } else {
    reasons.push(`Temperature ${Math.round(currentTemp)}C is moderate for mildew.`);
  }

  if (isPeakTemp(currentTemp) && currentHumidity >= HUMIDITY_HIGH) {
    reasons.push('Current conditions are in the peak mildew zone.');
  }

  // Airflow proxy: still humid air increases pressure, strong wind dries canopy surfaces.
  if (currentWind !== null) {
    if (currentWind >= HIGH_WIND_THRESHOLD_KPH) {
      reasons.push(`Wind near ${Math.round(currentWind)} km/h improves drying and lowers mildew pressure.`);
      severity -= 1;
    } else if (
      currentWind <= LOW_WIND_THRESHOLD_KPH &&
      currentHumidity >= HUMIDITY_HIGH &&
      isOptimalTemp(currentTemp)
    ) {
      reasons.push(`Low wind (~${Math.round(currentWind)} km/h) with humid mild weather traps moisture.`);
      severity += 1;
    }
  }

  const consecutiveVeryHumidWarmDays = countConsecutiveVeryHumidWarmDays(samples);
  if (consecutiveVeryHumidWarmDays >= 2) {
    reasons.push(
      `${consecutiveVeryHumidWarmDays} consecutive day(s) at >=70% humidity in warm range.`,
    );
    severity = Math.max(severity, 3);
  }

  const humidNightWarmDayCycle = hasHumidNightWarmDayCycle(samples);
  if (humidNightWarmDayCycle) {
    reasons.push('Humid nights with warm days create a mildew breeding cycle.');
    if (severity >= 2) severity = 3;
    else if (severity === 1) severity = 2;
  }

  const condensationNightCycle = hasCondensationNightCycle(samples);
  if (condensationNightCycle) {
    reasons.push('Night humidity and dew-point spread suggest condensation risk on leaves.');
    if (severity >= 2) severity = 3;
    else severity += 1;
  }

  if (severity < 0) severity = 0;
  if (severity > 3) severity = 3;

  const level = fromSeverity(severity);
  return {
    level,
    shouldWarn: level === 'high' || level === 'very_high',
    consecutiveVeryHumidWarmDays,
    reasons,
  };
}
