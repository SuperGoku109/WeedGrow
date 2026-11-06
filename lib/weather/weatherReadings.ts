/** General weather inspection. No care decisions, inferred durations or missing-as-zero rules. */
export interface WeatherReading {
  value: number | null;
  quality: 'ok' | 'missing' | 'invalid';
  reason: 'not_provided' | 'explicit_null' | 'not_finite_number' | 'out_of_range' | null;
}

export interface WeatherConditions {
  path: string;
  /** Provider valid time, in UTC seconds; never an issue/retrieval time. */
  validAtUtc: number;
  origin: 'current' | 'hourly' | 'daily' | 'data';
  temperatureC: WeatherReading;
  humidityPct: WeatherReading;
  dewPointC: WeatherReading;
  windSpeedMs: WeatherReading;
  windGustMs: WeatherReading;
  cloudCoveragePct: WeatherReading;
  uvIndex: WeatherReading;
  precipitationProbability: WeatherReading;
  sunriseUtc: WeatherReading;
  sunsetUtc: WeatherReading;
  /** Raw rain fields stay separate: no summing or rate-to-volume conversion. */
  rain: WeatherReading;
  rain1h: WeatherReading;
  snow1h: WeatherReading;
}

export interface WeatherReadingsReport {
  schemaVersion: 1;
  readings: WeatherConditions[];
  issues: { path: string; reason: 'invalid_envelope' | 'invalid_array' | 'invalid_time_axis' }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
// The same representable calendar range used by the legacy weather decoder.
const MIN_EPOCH = -62135596800;
const MAX_EPOCH = 253402214399;

function measurement(value: unknown, min = -Infinity, max = Infinity): WeatherReading {
  if (value === undefined) return { value: null, quality: 'missing', reason: 'not_provided' };
  if (value === null) return { value: null, quality: 'missing', reason: 'explicit_null' };
  if (!finite(value)) return { value: null, quality: 'invalid', reason: 'not_finite_number' };
  if (value < min || value > max) return { value: null, quality: 'invalid', reason: 'out_of_range' };
  return { value, quality: 'ok', reason: null };
}

function component(value: unknown, key: string): WeatherReading {
  if (value == null) return measurement(value);
  return record(value) ? measurement(value[key], 0) : measurement(false);
}

/**
 * Inspect supported OpenWeather-shaped records independently of the strict legacy cache parser.
 * Callers must supply/verify provider units separately (these names assume metric payloads).
 * This is a diagnostic reader, not the v8.3 provenance store or a trusted source adapter.
 */
export function inspectWeatherReadings(input: unknown): WeatherReadingsReport {
  const report: WeatherReadingsReport = { schemaVersion: 1, readings: [], issues: [] };
  if (!record(input)) {
    report.issues.push({ path: '$', reason: 'invalid_envelope' });
    return report;
  }

  function append(value: unknown, origin: WeatherConditions['origin'], path: string) {
    if (!record(value) || !finite(value.dt) || value.dt < MIN_EPOCH || value.dt > MAX_EPOCH) {
      report.issues.push({ path, reason: 'invalid_time_axis' });
      return;
    }
    const temperature = origin === 'daily' && record(value.temp) ? value.temp.day : value.temp;
    report.readings.push({
      path,
      origin,
      validAtUtc: value.dt,
      temperatureC: measurement(temperature, -273.15),
      humidityPct: measurement(value.humidity, 0, 100),
      dewPointC: measurement(value.dew_point, -273.15),
      windSpeedMs: measurement(value.wind_speed, 0),
      windGustMs: measurement(value.wind_gust, 0),
      cloudCoveragePct: measurement(value.clouds, 0, 100),
      uvIndex: measurement(value.uvi, 0),
      precipitationProbability: measurement(value.pop, 0, 1),
      sunriseUtc: measurement(value.sunrise, MIN_EPOCH, MAX_EPOCH),
      sunsetUtc: measurement(value.sunset, MIN_EPOCH, MAX_EPOCH),
      rain: record(value.rain) ? measurement(undefined) : measurement(value.rain, 0),
      rain1h: component(value.rain, '1h'),
      snow1h: component(value.snow, '1h'),
    });
  }

  if (input.current !== undefined) append(input.current, 'current', '$.current');
  for (const origin of ['hourly', 'daily', 'data'] as const) {
    if (input[origin] === undefined) continue;
    const rows = input[origin];
    // Bound work for malformed/untrusted responses without silently truncating a path.
    if (!Array.isArray(rows) || rows.length > (origin === 'daily' ? 16 : 168)) {
      report.issues.push({ path: `$.${origin}`, reason: 'invalid_array' });
      continue;
    }
    rows.forEach((row, index) => append(row, origin, `$.${origin}[${index}]`));
  }
  return report;
}
