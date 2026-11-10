import type { Plant, PlantLog } from '@/firestoreModels';
import { plantSetup } from './appAdapter';
import { evaluateShadow } from './evaluate';
import { normalizeWaterLog } from './logAdapter';
import { revisionFingerprint } from './revisions';
import { ENGINE_VERSION, type Evaluation, type Profile, type WaterResult, type WeatherSample } from './types';
import { normalizeOpenWeather } from './adapters';
import { evaluateWarnings, type WarningWindow } from './warnings';
import { meteoCareSamples, evaluateMeteoWater } from './meteoCare';
import type { WeatherResponse } from '@/lib/weather/weatherResponse';
import { openWeatherStormConditions, meteoStormConditions } from './stormConditions';
import { evaluateOutdoorCare } from './outdoorIntelligence';

export interface LocalCareSettings {
  profileMode?: 'automatic' | 'manual';
  weatherMode?: 'manual' | 'open-meteo';
  version: 1; enabled: boolean; anchorUtc: number; capacityL: number; thresholdL: number; initialReserveL: number;
  effectiveLossM2: number; catchmentM2: number; retainedFraction: number; et0MmPerDay: number; rainMmPerDay: number;
  extraWaterL: number; includeJournal: boolean;
}
/** Illustrative engineering inputs, not calibrated hops coefficients. Disabled until explicitly chosen. */
export function defaultLocalCareSettings(nowUtc: number): LocalCareSettings {
  return { version: 1, profileMode: 'automatic', weatherMode: 'open-meteo', enabled: false, anchorUtc: nowUtc - 86400, capacityL: 2, thresholdL: .8, initialReserveL: 1,
    effectiveLossM2: .2, catchmentM2: .08, retainedFraction: .8, et0MmPerDay: 4, rainMmPerDay: 0, extraWaterL: 0, includeJournal: true };
}
export function localCarePreset(kind: 'dry' | 'rainy', nowUtc: number): LocalCareSettings {
  return { ...defaultLocalCareSettings(nowUtc), profileMode: 'manual', weatherMode: 'manual', enabled: true, et0MmPerDay: kind === 'dry' ? 8 : 3, rainMmPerDay: kind === 'rainy' ? 30 : 0 };
}
export function localCareSettingsError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Invalid local test settings.';
  const s = value as LocalCareSettings;
  if (s.profileMode !== undefined && !['automatic', 'manual'].includes(s.profileMode)) return 'Invalid profile mode.';
  if (s.weatherMode !== undefined && !['manual', 'open-meteo'].includes(s.weatherMode)) return 'Invalid weather mode.';
  if (s.version !== 1 || typeof s.enabled !== 'boolean' || typeof s.includeJournal !== 'boolean') return 'Invalid local test settings.';
  for (const key of ['anchorUtc', 'capacityL', 'thresholdL', 'initialReserveL', 'effectiveLossM2', 'catchmentM2', 'retainedFraction', 'et0MmPerDay', 'rainMmPerDay', 'extraWaterL'] as const) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < 0) return 'Every test value must be a finite, non-negative number.';
  }
  if (s.capacityL <= 0 || s.capacityL > 10000 || s.thresholdL > s.capacityL || s.initialReserveL > s.capacityL) return 'Capacity must be positive; threshold and starting reserve cannot exceed capacity.';
  if (s.retainedFraction > 1 || s.effectiveLossM2 > 100 || s.catchmentM2 > 100 || s.et0MmPerDay > 50 || s.rainMmPerDay > 1000 || s.extraWaterL > 10000) return 'One or more test values exceed the supported range.';
  return null;
}
const timestamp = (value: unknown): number | null => {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
  try {
    const date: unknown = value.toDate();
    const time = date instanceof Date ? date.getTime() / 1000 : NaN;
    return Number.isFinite(time) ? time : null;
  } catch { return null; }
};
/** All water forcing here is explicitly user-assumed test forcing, never claimed as API observations. */
export function evaluateLocalCare(plant: Plant, logs: readonly PlantLog[], settings: LocalCareSettings, nowUtc: number,
  rawWeather?: unknown, weatherRetrievedUtc?: number, inputIssues: readonly string[] = [], automatic?: { profile?: Profile; basis: string[] }): Evaluation {
  if (!Number.isFinite(nowUtc)) throw new Error('invalid_evaluation_time');
  const setup = plantSetup(plant); const issues: string[] = [...inputIssues];
  if (automatic) {
    const native = (rawWeather as WeatherResponse | undefined)?._weedgrowMeteo;
    let samples: WeatherSample[] = [];
    if (rawWeather && typeof weatherRetrievedUtc === 'number') {
      try {
        samples = native ? meteoCareSamples(native, setup.locationRevision, weatherRetrievedUtc).map(s => s.kind === 'forecast' && s.valid_end_utc <= weatherRetrievedUtc
          ? { ...s, kind: 'occurred_estimate' as const, reason_codes: [...s.reason_codes, 'past_model_estimate_not_observed'] } : s)
          : normalizeOpenWeather(rawWeather, 'onecall_metric', { retrievedUtc: weatherRetrievedUtc, firstAvailableUtc: weatherRetrievedUtc, locationRevision: setup.locationRevision,
            sourceRevision: `local-weather-${weatherRetrievedUtc}`, modelSelection: 'onecall_metric' }).samples;
      } catch { /* Missing provider data never invalidates a direct soil observation. */ }
    }
    const outdoor = evaluateOutdoorCare({ plantId: (plant as Plant & { id?: string }).id ?? 'plant', plant, logs, samples, nowUtc,
      historyReliable: !inputIssues.includes('local_journal_read_failed') });
    const nextEvaluationUtc = Math.min(nowUtc + 300, ...(outdoor.nextCheckUtc !== null && outdoor.nextCheckUtc > nowUtc ? [outdoor.nextCheckUtc] : []), ...samples.map(s => s.retrieved_at_utc + 3600).filter(t => t > nowUtc));
    for (const r of outdoor.recommendations) r.expiresAt = Math.min(r.expiresAt, nextEvaluationUtc);
    outdoor.water.reasonCodes.push(...inputIssues.filter(code => code !== 'local_meteo_unavailable'));
    return { execution: 'local-experimental', outdoor, engineVersion: ENGINE_VERSION, policyVersion: 'outdoor-observation-v1', profileVersion: 'observation-rules-v1',
      evaluationUtc: nowUtc, locationRevision: setup.locationRevision, dataRevisionFingerprint: revisionFingerprint({ logs, configuration: outdoor.learning.configuration, weatherRetrievedUtc }),
      nextEvaluationUtc, water: outdoor.water, warnings: [], weatherPreparationEnabled: outdoor.recommendations.some(r => r.type === 'weather'),
      localInputs: { profileMode: 'automatic', weatherMode: settings.weatherMode, weatherRetrievedUtc, anchorUtc: settings.anchorUtc,
        includeJournal: true, journalEntries: logs.length } };
  }

  if (localCareSettingsError(settings)) issues.push('local_test_settings_invalid');
  if (!settings.enabled) issues.push('local_test_inputs_required');
  if (settings.anchorUtc > nowUtc) issues.push('local_test_anchor_future');
  if (nowUtc - settings.anchorUtc > 14 * 86400) issues.push('local_test_window_too_long');
  const profile: Profile = { id: 'local-experiment', version: 'local-test-v1', criterionId: 'interactive-test-only', validationEvidenceId: 'NOT-VALIDATED',
    stateAnchorBasis: 'user-entered-test-reserve', rootZoneKey: 'local-test-root-zone', transitionPolicy: 'current-setup-assumption',
    domain: { environment: setup.environment, plantedIn: setup.plantedIn ?? 'unknown', stages: [setup.stage], suns: [setup.sun], mediums: [setup.medium],
      potVolumeL: setup.plantedIn === 'pot' ? [.001, 100000] : null, sourceKeys: ['Local test/assumed-inputs/constant-rate-v1'] },
    scenarios: [{ id: 'user-test', capacityL: settings.capacityL, actionReserveL: settings.thresholdL, initialReserveL: [settings.initialReserveL, settings.initialReserveL],
      effectiveLossM2: settings.effectiveLossM2, catchmentM2: settings.catchmentM2, rainDelivery: 1, retainedFraction: settings.retainedFraction,
      unknownRefillL: [0, settings.capacityL], order: 'inputs_first' }] };
  const selectedLogs = settings.includeJournal ? logs.filter(log => log.type === 'watering') : [];
  const events = []; const ids = new Set<string>();
  for (const [index, log] of selectedLogs.entries()) {
    const id = 'journal:' + ('id' in log && typeof log.id === 'string' ? log.id : String(index));
    if (ids.has(id)) continue;
    ids.add(id);
    const occurred = timestamp(log.timestamp);
    if (occurred !== null && occurred > nowUtc) continue;
    // Dates completely before the test anchor cannot influence this run.
    if (occurred !== null && occurred < settings.anchorUtc - 2 * 86400) continue;
    const decoded = normalizeWaterLog(id, 1, { type: log.type, occurredUtc: occurred, recordedUtc: timestamp(log.recordedAt),
      assertedUtc: timestamp(log.editedAt), calendarDay: log.calendarDay, timeZone: log.timeZone || plant.locationTimeZone,
      precision: log.occurrencePrecision ?? 'unknown', waterMl: log.waterMl }, nowUtc);
    if (!decoded.event) issues.push(...decoded.reasonCodes);
    else if (decoded.event.deleted || decoded.event.endUtc >= settings.anchorUtc) events.push(decoded.event);
  }
  if (settings.extraWaterL > 0) events.push({ id: 'what-if:extra-water', revision: 1, startUtc: nowUtc, endUtc: nowUtc, appliedL: settings.extraWaterL, availableUtc: nowUtc });
  const weather: WeatherSample[] = [];
  if (!issues.length) for (let start = settings.anchorUtc; start < nowUtc; start += 3600) {
    const end = Math.min(start + 3600, nowUtc);
    for (const variable of ['et0_mm', 'liquid_rain_mm'] as const) weather.push({ schema_version: '8.4', provider: 'Local test', product: 'assumed-inputs',
      model_selection: 'constant-rate-v1', model_selection_basis: 'User-entered constant test rates; not provider measurements', source_revision: 'local-assumptions',
      location_revision: setup.locationRevision, retrieved_at_utc: nowUtc, available_at_utc: nowUtc, issued_at_utc: null,
      variable, value: (variable === 'et0_mm' ? settings.et0MmPerDay : settings.rainMmPerDay) * (end - start) / 86400,
      unit: 'mm', time_support: 'interval_sum', kind: 'occurred_estimate', valid_start_utc: start, valid_end_utc: end, quality: 'ok', reason_codes: ['experimental_assumed_forcing'] });
  }
  const source = { provider: 'Local test', product: 'assumed-inputs', modelSelection: 'constant-rate-v1', sourceRevision: 'local-assumptions' };
  let water: WaterResult = { decision: 'uncertain', needsWater: null, reasonCodes: issues };
  const native = (rawWeather as WeatherResponse | undefined)?._weedgrowMeteo;
  if (!issues.length && settings.weatherMode === 'open-meteo') {
    water = native && typeof weatherRetrievedUtc === 'number' ? evaluateMeteoWater({ setup, profile, anchorUtc: settings.anchorUtc, anchored: !automatic, evaluationUtc: nowUtc, events }, native, weatherRetrievedUtc)
      : { decision: 'uncertain', needsWater: null, reasonCodes: ['local_meteo_unavailable'] };
  } else if (!issues.length) {
    const result = evaluateShadow({ setup, profile, anchorUtc: settings.anchorUtc, anchored: true, evaluationUtc: nowUtc, weather, et0Source: source, rainSource: source, events });
    water = { decision: result.candidate, needsWater: result.candidate === 'uncertain' ? null : result.candidate === 'water', reasonCodes: result.reasonCodes,
      ...('evidence' in result && result.evidence ? { evidence: result.evidence } : {}), ...('coverageIssue' in result && result.coverageIssue ? { coverageIssue: result.coverageIssue } : {}) };
  }
  const windows: WarningWindow[] = [];
  const retrieved = weatherRetrievedUtc;
  if (rawWeather && typeof retrieved === 'number' && retrieved <= nowUtc && nowUtc - retrieved < (native ? 3600 : 1800)) {
    try {
      const decoded = native ? { samples: meteoCareSamples(native, setup.locationRevision, retrieved) } : normalizeOpenWeather(rawWeather, 'onecall_metric', { retrievedUtc: retrieved, firstAvailableUtc: retrieved, locationRevision: setup.locationRevision,
        sourceRevision: `local-weather-${retrieved}`, modelSelection: 'onecall_metric' });
      const current = decoded.samples.filter(s => s.kind === 'current_point' && s.valid_end_utc <= nowUtc && nowUtc - s.valid_end_utc < 900);
      const forecast = decoded.samples.filter(s => s.kind === 'forecast' && s.valid_start_utc > nowUtc && s.valid_end_utc <= nowUtc + 86400);
      if (current.length) windows.push({ phase: 'current', startUtc: nowUtc - 900, endUtc: nowUtc, completeVariables: [], samples: current });
      if (forecast.length) windows.push({ phase: 'forecast24h', startUtc: nowUtc, endUtc: nowUtc + 86400, completeVariables: [], samples: forecast });
    } catch { /* Invalid API data cannot turn into weather warnings. */ }
  }
  return { execution: 'local-experimental', localInputs: { profileMode: 'manual', weatherMode: settings.weatherMode ?? 'manual', weatherRetrievedUtc, anchorUtc: settings.anchorUtc, et0MmPerDay: settings.et0MmPerDay, rainMmPerDay: settings.rainMmPerDay,
    initialReserveL: settings.initialReserveL, extraWaterL: settings.extraWaterL, includeJournal: settings.includeJournal, journalEntries: ids.size },
    engineVersion: ENGINE_VERSION, policyVersion: 'on-device-testing-v1', profileVersion: profile.version, evaluationUtc: nowUtc,
    locationRevision: setup.locationRevision, dataRevisionFingerprint: revisionFingerprint({ settings, events, weatherRetrievedUtc }), nextEvaluationUtc: nowUtc + 300,
    water, warnings: evaluateWarnings(setup, windows, water), weatherPreparationEnabled: windows.length > 0,
    stormConditions: native && retrieved !== undefined ? meteoStormConditions(native, { sourceRevision: `meteo-${retrieved}`, locationRevision: setup.locationRevision, availableUtc: retrieved }, nowUtc) : windows.length && rawWeather && retrieved !== undefined ? openWeatherStormConditions(rawWeather,
      { sourceRevision: `local-weather-${retrieved}`, locationRevision: setup.locationRevision, availableUtc: retrieved }, nowUtc, 900, 86400) : [] };
}
