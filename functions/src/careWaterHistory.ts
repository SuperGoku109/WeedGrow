import { getFirestore } from 'firebase-admin/firestore';
import { normalizeMeteo } from '../../lib/careAlgorithm/adapters';
import type { WeatherSample } from '../../lib/careAlgorithm/types';
import { rawWeatherRevision, weatherScopeKey } from './careWeather';
import { selectWaterHistory } from '../../lib/careAlgorithm/historySelection';
import type { WaterPolicy } from './careWaterPolicy';

export const historyModelSelection = (policy: WaterPolicy) => policy.historyModel === 'best_match' ? 'provider_best_match_unpinned' : policy.historyModel;
const day = (utc: number) => new Date(utc * 1000).toISOString().slice(0, 10);
/** Archive is an occurred grid/model estimate. Forecast/past_days data never enters this store. */
export async function acquireWaterHistory(location: { lat: number; lng: number }, locationRevision: number, startUtc: number, endUtc: number,
  policy: WaterPolicy, request: typeof fetch = fetch, clock: () => number = () => Date.now() / 1000) {
  if (![location.lat, location.lng, startUtc, endUtc].every(Number.isFinite) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180
    || startUtc > endUtc || endUtc - startUtc > policy.backfillDays * 86400 || !Number.isInteger(locationRevision) || locationRevision < 0) throw new Error('invalid_water_history_request');
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.search = new URLSearchParams({ latitude: String(location.lat), longitude: String(location.lng), start_date: day(startUtc), end_date: day(endUtc),
    hourly: 'et0_fao_evapotranspiration,rain', models: policy.historyModel, timezone: 'UTC', timeformat: 'unixtime' }).toString();
  let response: Response;
  try { response = await request(url.toString(), { signal: AbortSignal.timeout(policy.requestTimeoutMs), redirect: 'error' }); }
  catch { throw new Error('water_history_unavailable'); }
  if (!response.ok || !response.body) throw new Error('water_history_unavailable');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 384000) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
  } catch { throw new Error('water_history_body_limit'); }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('water_history_invalid_json'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('water_history_invalid_envelope');
  const payload = raw as { hourly?: { time?: unknown[] } };
  if (!Array.isArray(payload.hourly?.time) || payload.hourly.time.length > (policy.backfillDays + 2) * 24) throw new Error('water_history_row_limit');
  const retrievedUtc = clock(); if (!Number.isFinite(retrievedUtc) || endUtc > retrievedUtc) throw new Error('water_history_invalid_time');
  const revision = rawWeatherRevision(raw); const modelSelection = historyModelSelection(policy);
  const decoded = normalizeMeteo(raw, 'archive', { retrievedUtc, firstAvailableUtc: retrievedUtc, locationRevision, sourceRevision: revision, modelSelection });
  const samples = decoded.samples.filter(s => ['et0_mm', 'liquid_rain_mm'].includes(s.variable)
    && s.valid_end_utc > startUtc && s.valid_start_utc < endUtc);
  return { schemaVersion: 1, revision, coordinates: location, locationRevision, modelSelection, raw, samples, retrievedUtc, firstAvailableUtc: retrievedUtc };
}

/** Bounded immutable history/backfill. Active anchor history has no weather-cache TTL. */
export async function loadWaterHistory(plantId: string, location: { lat: number; lng: number }, locationRevision: number, originUtc: number, nowUtc: number,
  policy: WaterPolicy, request: typeof fetch, clock: () => number, requiresRain = true) {
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`); const history = parent.collection('careWaterHistory');
  const stored = await history.limit(33).get();
  const model = historyModelSelection(policy);
  if (stored.size > 32) return { samples: [] as WeatherSample[], reasonCodes: ['water_history_storage_read_limit'] };
  let samples = stored.docs.flatMap(doc => {
    const data = doc.data();
    return data.coordinates?.lat === location.lat && data.coordinates?.lng === location.lng && data.locationRevision === locationRevision
      && data.modelSelection === model && data.revision === rawWeatherRevision(data.raw) && Array.isArray(data.samples)
      && data.samples.every((s: WeatherSample) => s.source_revision === data.revision && s.location_revision === locationRevision && s.model_selection === model
        && s.available_at_utc === data.firstAvailableUtc && s.retrieved_at_utc === data.retrievedUtc) ? data.samples as WeatherSample[] : [];
  });
  if (samples.length > 16384) return { samples: [], reasonCodes: ['water_history_sample_read_limit'] };
  const current = selectWaterHistory(samples, model, locationRevision, nowUtc);
  // Revisit the first missing/invalid interval; do not advance past a recent archive gap.
  let cursor = originUtc;
  const rows = current.samples.filter(s => s.variable === 'et0_mm' && s.quality === 'ok').sort((a, b) => a.valid_start_utc - b.valid_start_utc);
  const rainIntervals = new Set(current.samples.filter(s => s.variable === 'liquid_rain_mm' && s.quality === 'ok').map(s => `${s.valid_start_utc}:${s.valid_end_utc}`));
  for (const row of rows) {
    if (row.valid_end_utc <= cursor) continue;
    if (row.valid_start_utc > cursor) break;
    if (requiresRain && !rainIntervals.has(`${row.valid_start_utc}:${row.valid_end_utc}`)) break;
    cursor = row.valid_end_utc;
  }
  const scope = weatherScopeKey(location, locationRevision, `water:${policy.version}:${model}`);
  const cache = parent.collection('careWaterState').doc(`acquisition_${scope}`);
  const token = db.collection('maintenance').doc().id;
  const leased = await db.runTransaction(async tx => {
    const usage = db.doc(`careUsage/water_${Math.floor(nowUtc / 86400)}`);
    const [cached, used, plant] = await Promise.all([tx.get(cache), tx.get(usage), tx.get(parent)]);
    if (!plant.exists || plant.data()?.deleting || (cached.data()?.nextAttemptUtc ?? 0) > nowUtc || (cached.data()?.leaseUntilUtc ?? 0) > nowUtc) return false;
    const count = used.data()?.reservedRequests ?? 0;
    if (!Number.isInteger(count) || count < 0 || count >= policy.maxRequestsPerDay) return false;
    tx.set(usage, { reservedRequests: count + 1, policyVersion: policy.version });
    tx.set(cache, { token, leaseUntilUtc: nowUtc + policy.requestTimeoutMs / 500 }); return true;
  });
  if (!leased) return { samples, reasonCodes: cursor < nowUtc ? ['history_backfill_pending_or_budget'] : [] };
  const start = Math.min(nowUtc, Math.max(originUtc, cursor - policy.historyRecheckDays * 86400));
  const end = Math.min(nowUtc, start + policy.backfillDays * 86400);
  let record: Awaited<ReturnType<typeof acquireWaterHistory>> | null = null;
  try { record = await acquireWaterHistory(location, locationRevision, start, end, policy, request, clock); } catch { /* Publish explicit uncertainty; provider details stay private. */ }
  const acquired = record;
  const wrote = await db.runTransaction(async tx => {
    const [cached, plant] = await Promise.all([tx.get(cache), tx.get(parent)]);
    if (cached.data()?.token !== token || !plant.exists || plant.data()?.deleting) return null;
    const immutable = acquired ? history.doc(`${scope}_${acquired.revision}`) : null;
    const previous = immutable ? await tx.get(immutable) : null;
    if (acquired && immutable && !previous?.exists) {
      if (Buffer.byteLength(JSON.stringify(acquired)) > 800000) throw new Error('water_history_storage_size_limit');
      tx.set(immutable, acquired);
    }
    tx.set(cache, { leaseUntilUtc: 0, nextAttemptUtc: clock() + (acquired ? policy.refreshSeconds : policy.retryAfterSeconds) });
    return previous?.exists ? previous.data()?.samples as WeatherSample[] : acquired?.samples ?? null;
  });
  if (wrote) samples = [...samples, ...wrote];
  return { samples, reasonCodes: acquired ? [] : ['water_history_acquisition_unavailable'] };
}
