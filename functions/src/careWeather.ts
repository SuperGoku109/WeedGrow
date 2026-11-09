import { createHash } from 'node:crypto';
import { normalizeOpenWeather } from '../../lib/careAlgorithm/adapters';
import type { WeatherSample } from '../../lib/careAlgorithm/types';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { validSample } from '../../lib/careAlgorithm/weather';
import { openMeteoUrl, decodeOpenMeteo } from '../../lib/weather/openMeteo';
import { meteoCareSamples } from '../../lib/careAlgorithm/meteoCare';

export interface CareWeatherPolicy {
  version: string; enabled: boolean; product: 'onecall_metric' | 'open_meteo_forecast';
  maxAcquisitionAgeSeconds: number; maxCurrentAgeSeconds: number; maxForecastLeadSeconds: number;
  requestTimeoutMs: number; licensingEvidenceId: string; adapterReviewId: string;
  retryAfterSeconds: number; retentionSeconds: number;
  maxRequestsPerDay: number;
}
export function readWeatherPolicy(value: unknown): CareWeatherPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as CareWeatherPolicy;
  if (p.enabled !== true || !['onecall_metric', 'open_meteo_forecast'].includes(p.product)
    || ![p.version, p.licensingEvidenceId, p.adapterReviewId].every(v => typeof v === 'string' && !!v.trim())
    || ![p.maxAcquisitionAgeSeconds, p.maxCurrentAgeSeconds, p.maxForecastLeadSeconds, p.requestTimeoutMs, p.retryAfterSeconds, p.retentionSeconds, p.maxRequestsPerDay].every(v => typeof v === 'number' && Number.isInteger(v) && v > 0)
    || p.requestTimeoutMs > 30000 || p.maxAcquisitionAgeSeconds > 86400 || p.maxCurrentAgeSeconds > 86400 || p.maxForecastLeadSeconds > 86400
    || p.retryAfterSeconds > 86400 || p.retentionSeconds < p.maxAcquisitionAgeSeconds || p.retentionSeconds > 365 * 86400
    || p.maxRequestsPerDay > 10000) return null;
  return p;
}
export interface AcquisitionRecord {
  schemaVersion: 1; revision: string; firstAvailableUtc: number; retrievedUtc: number;
  locationRevision: number; coordinates: { lat: number; lng: number }; policyVersion: string;
  raw: unknown; samples: WeatherSample[];
}
export function weatherScopeKey(location: { lat: number; lng: number }, locationRevision: number, policyVersion: string) {
  return createHash('sha256').update(JSON.stringify([location.lat, location.lng, locationRevision, policyVersion])).digest('hex');
}
export const rawWeatherRevision = (raw: unknown) => createHash('sha256').update(revisionFingerprint(raw)).digest('hex');
export function validAcquisition(record: AcquisitionRecord | undefined, location: { lat: number; lng: number }, revision: number, policy: CareWeatherPolicy): record is AcquisitionRecord {
  return !!record && record.schemaVersion === 1 && record.policyVersion === policy.version && record.locationRevision === revision
    && record.coordinates?.lat === location.lat && record.coordinates?.lng === location.lng
    && Number.isFinite(record.firstAvailableUtc) && Number.isFinite(record.retrievedUtc) && record.firstAvailableUtc <= record.retrievedUtc
    && record.revision === rawWeatherRevision(record.raw) && Array.isArray(record.samples) && record.samples.length > 0 && record.samples.length <= 600
    && record.samples.every(s => validSample(s) && (policy.product !== 'open_meteo_forecast' || s.provider === 'Open-Meteo') && s.source_revision === record.revision && s.location_revision === revision
      && s.available_at_utc === record.firstAvailableUtc && s.retrieved_at_utc === record.retrievedUtc);
}
/** Key stays server-side. No caller-controlled URL, unlimited body, retries, or provider error text. */
export async function acquireCareWeather(location: { lat: number; lng: number }, locationRevision: number, policy: CareWeatherPolicy,
  key: string, request: typeof fetch = fetch, clock: () => number = () => Date.now() / 1000): Promise<AcquisitionRecord> {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180
    || !Number.isInteger(locationRevision) || locationRevision < 0 || !readWeatherPolicy(policy) || policy.product === 'onecall_metric' && !key) throw new Error('care_weather_unconfigured');
  const url = policy.product === 'open_meteo_forecast' ? new URL(openMeteoUrl(location.lat, location.lng, 0, 2)) : new URL('https://api.openweathermap.org/data/3.0/onecall');
  if (policy.product === 'onecall_metric') url.search = new URLSearchParams({ lat: String(location.lat), lon: String(location.lng), units: 'metric', exclude: 'minutely,daily,alerts', appid: key }).toString();
  let response: Response;
  try { response = await request(url.toString(), { signal: AbortSignal.timeout(policy.requestTimeoutMs), redirect: 'error' }); }
  catch { throw new Error('care_weather_unavailable'); }
  if (!response.ok) throw new Error(`care_weather_http_${response.status === 401 || response.status === 429 ? response.status : 'error'}`);
  // Stream into a bounded buffer rather than allocating an untrusted response before checking its length.
  if (!response.body) throw new Error('care_weather_empty');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 384000) { await reader.cancel(); throw new Error('care_weather_body_limit'); }
      chunks.push(value);
    }
  } catch { throw new Error('care_weather_invalid_body'); }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('care_weather_invalid_json'); }
  const retrievedUtc = clock();
  if (!Number.isFinite(retrievedUtc)) throw new Error('care_weather_invalid_time');
  const revision = rawWeatherRevision(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('care_weather_invalid_envelope');
  const payload = raw as Record<string, unknown>;
  if (policy.product === 'open_meteo_forecast') {
    const samples = meteoCareSamples(decodeOpenMeteo(raw), locationRevision, retrievedUtc).map(s => ({ ...s, source_revision: revision }));
    if (!samples.length || samples.length > 600) throw new Error('care_weather_sample_limit');
    return { schemaVersion: 1, revision, firstAvailableUtc: retrievedUtc, retrievedUtc, locationRevision, coordinates: { ...location }, policyVersion: policy.version, raw, samples };
  }
  // Only requested paths are processed. Oversized hourly paths are quarantined before allocating samples;
  // valid independent current fields survive, and daily totals cannot enter the hourly path.
  const normalizedInput = { ...payload, daily: undefined, hourly: Array.isArray(payload.hourly) && payload.hourly.length > 96 ? [] : payload.hourly };
  const decoded = normalizeOpenWeather(normalizedInput, 'onecall_metric', { retrievedUtc, firstAvailableUtc: retrievedUtc, locationRevision,
    sourceRevision: revision, modelSelection: 'provider_unspecified' });
  // A provider exceeding the documented two-day hourly envelope is not allowed to grow storage unboundedly.
  if (decoded.samples.length > 600 || !decoded.samples.length) throw new Error('care_weather_sample_limit');
  return { schemaVersion: 1, revision, firstAvailableUtc: retrievedUtc, retrievedUtc, locationRevision,
    coordinates: { ...location }, policyVersion: policy.version, raw, samples: decoded.samples };
}

/** Current points retain point semantics. Forecast points stay forecasts; no hourly RH exposure is invented. */
export function weatherWarningWindows(record: AcquisitionRecord, policy: CareWeatherPolicy, now: number) {
  if (!validAcquisition(record, record.coordinates, record.locationRevision, policy)) return [];
  if (record.policyVersion !== policy.version || record.firstAvailableUtc > now || now < record.retrievedUtc
    || now - record.retrievedUtc >= policy.maxAcquisitionAgeSeconds) return [];
  const current = record.samples.filter(s => s.kind === 'current_point' && s.valid_end_utc <= now && now - s.valid_end_utc < policy.maxCurrentAgeSeconds);
  const forecast = record.samples.filter(s => s.kind === 'forecast' && s.valid_start_utc > now && s.valid_end_utc <= now + policy.maxForecastLeadSeconds);
  return [
    ...(current.length ? [{ phase: 'current' as const, startUtc: now - policy.maxCurrentAgeSeconds, endUtc: now, samples: current, completeVariables: [] }] : []),
    ...(forecast.length ? [{ phase: 'forecast24h' as const, startUtc: now, endUtc: now + policy.maxForecastLeadSeconds, samples: forecast, completeVariables: [] }] : []),
  ];
}
