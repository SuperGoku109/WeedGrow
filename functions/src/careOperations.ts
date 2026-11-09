import { createHash } from 'node:crypto';
import { getFirestore, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import type { Plant } from '../../firestoreModels';
import { careInputKey, type CareSnapshot } from '../../lib/careAlgorithm/snapshot';
import { evaluateCare } from '../../lib/careAlgorithm/evaluate';
import { plantSetup } from '../../lib/careAlgorithm/appAdapter';
import { acquireCareWeather, readWeatherPolicy, validAcquisition, weatherScopeKey, weatherWarningWindows, type AcquisitionRecord } from './careWeather';
import { readWaterPolicy } from './careWaterPolicy';
import { preparePlantWater } from './careWatering';
import { synchronizeWaterEvents } from './careEventLedger';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { openWeatherStormConditions, meteoStormConditions } from '../../lib/careAlgorithm/stormConditions';
import { decodeOpenMeteo } from '../../lib/weather/openMeteo';
import { ENGINE_VERSION } from '../../lib/careAlgorithm/types';
export { acquireCareWeather, readWeatherPolicy } from './careWeather';
export { captureWaterEvent, readWaterEvents, synchronizeWaterEvents } from './careEventLedger';
export { captureSetupTransition, readSetupTransitions, recordShadowWaterRun } from './careStateLedger';
export { readWaterPolicy, approvedWaterProfiles } from './careWaterPolicy';
export { acquireWaterHistory } from './careWaterHistory';

/** Weather acquisition and watering releases have separate protected configuration and race fences. */
export interface CareConfiguration { weather: DocumentSnapshot; watering: DocumentSnapshot; useVerifiedLedgerCache?: boolean }
export function careConfigurationKey(configuration: CareConfiguration) {
  return revisionFingerprint([configuration.weather.updateTime?.toMillis() ?? null, configuration.watering.updateTime?.toMillis() ?? null, ENGINE_VERSION]);
}
export async function readCareConfiguration(): Promise<CareConfiguration> {
  const db = getFirestore();
  const [weather, watering] = await Promise.all([db.doc('careConfiguration/weather').get(), db.doc('careConfiguration/watering').get()]);
  return { weather, watering };
}
export async function refreshPlantCare(plantId: string, weatherKey: string, request: typeof fetch = fetch, clock: () => number = () => Date.now() / 1000,
  configuration?: CareConfiguration) {
  const db = getFirestore(); const ref = db.doc(`plants/${plantId}`); const configRef = db.doc('careConfiguration/weather');
  const waterConfigRef = db.doc('careConfiguration/watering');
  const { weather: config, watering: waterConfig } = configuration ?? await readCareConfiguration();
  const waterPolicy = readWaterPolicy(waterConfig.data());
  const synchronized = waterPolicy ? await synchronizeWaterEvents(plantId, 2000, clock,
    { useVerifiedCache: configuration?.useVerifiedLedgerCache === true, cacheVerifiedResult: true }) : undefined;
  const first = await ref.get();
  if (!first.exists || first.data()?.deleting) return false;
  const plant = first.data() as Plant; const inputKey = careInputKey(plant);
  const configUpdate = config.updateTime?.toMillis() ?? null; const policy = readWeatherPolicy(config.data());
  const waterConfigUpdate = waterConfig.updateTime?.toMillis() ?? null;
  const now = clock(); if (!Number.isFinite(now)) throw new Error('invalid_care_evaluation_time');
  const existingSnapshot = (await ref.collection('care').doc('current').get()).data() as CareSnapshot | undefined;
  if (existingSnapshot?.inputKey === inputKey && existingSnapshot.configurationRevision === configUpdate
    && existingSnapshot.evaluation.engineVersion === ENGINE_VERSION
    && (existingSnapshot.waterConfigurationRevision ?? null) === waterConfigUpdate
    && existingSnapshot.evaluation.evaluationUtc <= now
    && (existingSnapshot.evaluation.nextEvaluationUtc === null || existingSnapshot.evaluation.nextEvaluationUtc > now)) {
    // Upgrade old snapshots into the due index without recomputing advice.
    if (plant.careNextEvaluationUtc !== existingSnapshot.evaluation.nextEvaluationUtc) await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.exists && !latest.data()?.deleting && careInputKey(latest.data() as Plant) === inputKey
        && latest.data()?.careEvaluationRevision === existingSnapshot.revision) {
        tx.update(ref, { careNextEvaluationUtc: existingSnapshot.evaluation.nextEvaluationUtc });
      }
    });
    return false;
  }
  const pin = plant.location; const revision = plant.locationRevision ?? 0;
  const scope = policy && pin ? weatherScopeKey(pin, revision, policy.version) : null;
  const cacheRef = scope ? ref.collection('careWeather').doc(scope) : null;
  const previous = cacheRef ? await cacheRef.get() : null;
  let record = previous?.data() as AcquisitionRecord | undefined; let weatherFailure = false;
  if (policy && pin && !validAcquisition(record, pin, revision, policy)) record = undefined;
  const eligible = plant.status === 'active' && plant.environment === 'outdoor' && !!pin && !!policy;
  const leaseToken = db.collection('maintenance').doc().id; let leased = false;
  if (eligible && (!record || !weatherWarningWindows(record, policy!, now).length)) {
    leased = await db.runTransaction(async tx => {
      const usageRef = db.doc(`careUsage/weather_${Math.floor(now / 86400)}`);
      const [cachedDoc, usageDoc] = await Promise.all([tx.get(cacheRef!), tx.get(usageRef)]);
      const cached = cachedDoc.data(); const usage = usageDoc.data()?.reservedRequests ?? 0;
      if ((cached?.leaseUntilUtc ?? 0) > now || (cached?.retryAfterUtc ?? 0) > now) return false;
      if (!Number.isInteger(usage) || usage < 0 || usage >= policy!.maxRequestsPerDay) return false;
      tx.set(usageRef, { reservedRequests: usage + 1, policyVersion: policy!.version,
        expiresAt: Timestamp.fromMillis((now + policy!.retentionSeconds) * 1000) });
      tx.set(cacheRef!, { leaseToken, leaseUntilUtc: now + 2 * policy!.requestTimeoutMs / 1000,
        expiresAt: Timestamp.fromMillis((now + policy!.retentionSeconds) * 1000) }, { merge: true }); return true;
    });
    if (!leased && !waterPolicy) return false;
    if (leased) {
      try { record = await acquireCareWeather(pin!, revision, policy!, weatherKey, request, clock); }
      catch { record = undefined; weatherFailure = true; }
    }
  }
  let water: Awaited<ReturnType<typeof preparePlantWater>> | undefined;
  let waterFailure = false;
  if (waterPolicy) {
    try { water = await preparePlantWater(plantId, plant, waterPolicy, clock(), request, clock, synchronized); }
    catch { waterFailure = true; }
  }
  const evaluatedAt = water?.replay?.evaluationUtc ?? clock();
  const windows = eligible && record ? weatherWarningWindows(record, policy!, evaluatedAt) : [];
  const expiry = eligible && record && windows.length ? Math.min(record.retrievedUtc + policy!.maxAcquisitionAgeSeconds,
    ...windows.flatMap(w => w.samples.map(s => s.kind === 'current_point' ? s.valid_end_utc + policy!.maxCurrentAgeSeconds : s.valid_start_utc)).filter(t => t > evaluatedAt)) : null;
  const weatherNext = expiry !== null && expiry > evaluatedAt ? expiry : eligible ? evaluatedAt + policy!.retryAfterSeconds : null;
  const waterNext = waterPolicy ? evaluatedAt + (water?.checkpoint ? waterPolicy.refreshSeconds : waterPolicy.retryAfterSeconds) : null;
  const nextTimes = [weatherNext, waterNext].filter((t): t is number => t !== null);
  const evaluation = evaluateCare({ setup: plantSetup(plant), evaluationUtc: evaluatedAt, profile: water?.profile ?? null,
    approvedProfiles: water?.approvedProfiles, replay: water?.replay,
    policyVersion: `${policy?.version ?? 'weather-unconfigured'}|${waterPolicy?.version ?? 'water-unconfigured'}`,
    nextEvaluationUtc: nextTimes.length ? Math.min(...nextTimes) : null, warningWindows: windows });
  if (water) evaluation.water.reasonCodes.push(...water.reasonCodes);
  if (waterFailure) evaluation.water.reasonCodes.push('water_input_acquisition_unavailable');
  if (evaluation.water.needsWater !== null && water?.profile) {
    const approved = water.approvedProfiles[`${water.profile.id}@${water.profile.version}`];
    evaluation.waterRelease = { approvalRecordId: approved.approvalRecordId, profileId: water.profile.id, profileVersion: water.profile.version };
  }
  // Publish an identity, not raw replay inputs or protected release configuration.
  evaluation.dataRevisionFingerprint = createHash('sha256').update(evaluation.dataRevisionFingerprint).digest('hex');
  evaluation.weatherPreparationEnabled = eligible && windows.length > 0;
  if (evaluation.weatherPreparationEnabled && record && policy) evaluation.stormConditions = policy.product === 'open_meteo_forecast'
    ? meteoStormConditions(decodeOpenMeteo(record.raw), { sourceRevision: record.revision, locationRevision: revision, availableUtc: record.firstAvailableUtc }, evaluatedAt)
    : openWeatherStormConditions(record.raw,
    { sourceRevision: record.revision, locationRevision: record.locationRevision, availableUtc: record.firstAvailableUtc }, evaluatedAt,
    policy.maxCurrentAgeSeconds, policy.maxForecastLeadSeconds);
  if (weatherFailure) evaluation.water.reasonCodes.push('weather_acquisition_unavailable');
  // The revision binds the entire evaluation and all real plant dependencies; no private configuration/keys are published.
  const snapshotRevision = createHash('sha256').update(JSON.stringify([inputKey, configUpdate, waterConfigUpdate, evaluation])).digest('hex');
  const snapshot: CareSnapshot = { schemaVersion: 1, revision: snapshotRevision, inputKey, evaluation, configurationRevision: configUpdate, waterConfigurationRevision: waterConfigUpdate };
  return db.runTransaction(async tx => {
    const [latest, currentConfig, currentWaterConfig] = await Promise.all([tx.get(ref), tx.get(configRef), tx.get(waterConfigRef)]);
    if (!latest.exists || latest.data()?.deleting || careInputKey(latest.data() as Plant) !== inputKey
      || (currentConfig.updateTime?.toMillis() ?? null) !== configUpdate
      || (currentWaterConfig.updateTime?.toMillis() ?? null) !== waterConfigUpdate) return false;
    const current = await tx.get(ref.collection('care').doc('current'));
    if ((current.data()?.evaluation?.evaluationUtc ?? -Infinity) > evaluatedAt) return false;
    const old = leased && cacheRef ? await tx.get(cacheRef) : null;
    if (leased && old?.data()?.leaseToken !== leaseToken) return false;
    const immutableRef = leased && record && scope ? ref.collection('careWeather').doc(`${scope}_${record.revision}`) : null;
    const immutable = immutableRef ? await tx.get(immutableRef) : null;
    if (leased && eligible && record && cacheRef) {
      const prior = immutable?.data() as AcquisitionRecord | undefined;
      // Content-identical refetches preserve first acquisition, including concurrent retries.
      const firstAvailableUtc = prior?.revision === record.revision ? Math.min(prior.firstAvailableUtc, record.firstAvailableUtc) : record.firstAvailableUtc;
      const stored = { ...record, firstAvailableUtc, samples: record.samples.map(s => ({ ...s, available_at_utc: firstAvailableUtc })),
        expiresAt: Timestamp.fromMillis((record.retrievedUtc + policy!.retentionSeconds) * 1000) };
      if (Buffer.byteLength(JSON.stringify(stored)) > 800000) throw new Error('care_weather_storage_limit');
      tx.set(cacheRef, stored);
      // Immutable content and acquisition record survive later corrections. Retrieval updates live on the scoped cache.
      if (!immutable?.exists && immutableRef) tx.set(immutableRef, stored);
    } else if (leased && cacheRef) {
      tx.set(cacheRef, { leaseUntilUtc: 0, retryAfterUtc: evaluatedAt + policy!.retryAfterSeconds,
        expiresAt: Timestamp.fromMillis((evaluatedAt + policy!.retentionSeconds) * 1000) }, { merge: true });
    }
    tx.set(ref.collection('care').doc('current'), snapshot);
    if (water?.checkpoint) tx.set(ref.collection('careWaterState').doc('checkpoint'), JSON.parse(revisionFingerprint({ checkpoint: water.checkpoint, evaluationUtc: evaluatedAt })));
    tx.update(ref, { careEvaluationRevision: snapshotRevision, careNextEvaluationUtc: evaluation.nextEvaluationUtc });
    return true;
  });
}
