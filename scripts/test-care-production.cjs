const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp } = backend('firebase-admin/app');
const { getFirestore, Timestamp } = backend('firebase-admin/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) throw new Error('Care tests require disposable local emulators.');
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const { refreshPlantCare, readCareConfiguration, acquireCareWeather, readWeatherPolicy, captureWaterEvent, readWaterEvents, synchronizeWaterEvents,
  captureSetupTransition, readSetupTransitions, recordShadowWaterRun, acquireWaterHistory } = require('../functions/dist/careOperations.js');
const { initializeApp: clientApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore: clientDb, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, terminate, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const policy = { enabled: true, version: 'SYNTHETIC-INTEGRATION-ONLY', product: 'onecall_metric', maxAcquisitionAgeSeconds: 900,
  maxCurrentAgeSeconds: 900, maxForecastLeadSeconds: 86400, requestTimeoutMs: 1000, retryAfterSeconds: 60, retentionSeconds: 86400,
  licensingEvidenceId: 'TEST-NOT-A-LICENSE', adapterReviewId: 'TEST-NOT-AN-APPROVAL', maxRequestsPerDay: 100 };
const clients = [];
async function verifyMeteoAcquisition() {
  const at = Date.now() / 1000; const meteoPolicy = { ...policy, product: 'open_meteo_forecast', version: 'TEST-METEO' };
  const fixture = require('./fixtures/open-meteo.cjs')(at);
  for (const [field, values] of Object.entries(fixture.hourly)) fixture.hourly[field] = values.slice(48, 96);
  const record = await acquireCareWeather({ lat: -34, lng: 18 }, 1, meteoPolicy, '', async url => {
    assert.equal(new URL(url).hostname, 'api.open-meteo.com'); assert.equal(new URL(url).searchParams.has('appid'), false);
    return new Response(JSON.stringify(fixture));
  }, () => at);
  assert.ok(record.samples.length > 0 && record.samples.length <= 600);
  assert.ok(record.samples.every(s => s.provider === 'Open-Meteo' && s.source_revision === record.revision));
}
async function account(label) {
  const app = clientApp({ projectId: process.env.GCLOUD_PROJECT, apiKey: 'demo' }, `care-${label}-${Date.now()}`); clients.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = (await createUserWithEmailAndPassword(auth, `${label}-${Date.now()}@example.test`, 'LocalOnlyCare2026!')).user;
  const db = clientDb(app); connectFirestoreEmulator(db, '127.0.0.1', 8080); return { db, uid: user.uid };
}
const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
(async () => {
  await verifyMeteoAcquisition();
  const db = getFirestore(); const config = db.doc('careConfiguration/weather'); const priorConfig = await config.get();
  const waterConfig = db.doc('careConfiguration/watering'); const priorWaterConfig = await waterConfig.get();
  const alice = await account('owner'); const bob = await account('foreign');
  const id = `care-production-${Date.now()}`; const plant = db.doc(`plants/${id}`);
  const clock = { now: 1793364275 }; let calls = 0;
  const provider = async () => { calls++; return new Response(JSON.stringify({ current: { dt: clock.now, temp: 40, humidity: 95, wind_speed: 16, rain: { '1h': 20 }, weather: [{ id: 211 }] },
    hourly: [{ dt: clock.now + 3600, temp: 35, humidity: 90, wind_speed: 12, weather: [{ id: 202 }] }], timezone: 'UTC' }), { status: 200 }); };
  const run = (request = provider) => refreshPlantCare(id, 'TEST-ONLY-SECRET', request, () => clock.now);
  const read = async () => (await plant.collection('care').doc('current').get()).data();
  try {
    await waterConfig.delete();
    await plant.set({ name: 'Hops', strain: '', owners: [alice.uid], status: 'active', environment: 'outdoor', plantedIn: 'pot', growthStage: 'flowering',
      location: { lat: -26, lng: 28 }, locationRevision: 1, rainReception: { soil: 'yes', canopy: 'yes' }, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await config.delete();
    assert.equal(await run(), true); let snapshot = await read();
    assert.equal(snapshot.evaluation.water.needsWater, null); assert.equal(snapshot.evaluation.weatherPreparationEnabled, false); assert.equal(calls, 0);
    assert.equal(await run(), false, 'Unconfigured stable care avoids repeated writes');
    await config.set(policy); assert.equal(await run(), true); snapshot = await read();
    assert.equal(calls, 1); assert.equal(snapshot.evaluation.weatherPreparationEnabled, true);
    assert.equal(snapshot.evaluation.water.needsWater, null, 'Weather release cannot activate watering');
    for (const wid of ['W01', 'W03', 'W04']) assert.equal(snapshot.evaluation.warnings.find(w => w.id === wid).state, 'triggered');
    assert.equal(snapshot.evaluation.warnings.find(w => w.id === 'W10').state, 'disabled');
    assert.equal(snapshot.evaluation.warnings.find(w => w.id === 'W11').state, 'context_only');
    assert.deepEqual(snapshot.evaluation.stormConditions.map(c => c.phase), ['current', 'forecast24h'], 'Structured storm conditions survive backend acquisition/publication');
    assert.equal(snapshot.evaluation.stormConditions.every(c => c.hazard === 'thunderstorm' && c.locationRevision === 1), true);
    assert.equal(await run(), false); assert.equal(calls, 1, 'Fresh cache avoids another billable request');
    const records = await plant.collection('careWeather').get(); assert.equal(records.size, 2, 'Scoped cache and immutable revision are separate');
    const original = records.docs.find(d => d.id.includes('_')); const originalData = original.data();
    clock.now += 901;
    await run(async () => { calls++; return new Response(JSON.stringify(originalData.raw)); });
    const immutable = (await original.ref.get()).data();
    assert.equal(immutable.firstAvailableUtc, originalData.firstAvailableUtc); assert.equal(immutable.retrievedUtc, originalData.retrievedUtc);
    const stored = (await plant.collection('careWeather').doc(records.docs.find(d => !d.id.includes('_')).id).get()).data();
    assert.equal(stored.firstAvailableUtc, originalData.firstAvailableUtc, 'Refetch preserves original availability');

    clock.now += 901; let release; let entered;
    const enteredPromise = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const beforeCalls = calls;
    const slow = async () => { entered(); await held; return provider(); };
    const first = run(slow); await enteredPromise;
    assert.equal(await run(provider), false, 'Distributed lease suppresses concurrent acquisition');
    release(); assert.equal(await first, true); assert.equal(calls, beforeCalls + 1);

    clock.now += 901; const oldRevision = (await plant.get()).data().careEvaluationRevision;
    assert.equal(await run(async () => { await plant.update({ locationRevision: 2, location: { lat: -27, lng: 29 } }); return provider(); }), false);
    assert.equal((await plant.get()).data().careEvaluationRevision, oldRevision, 'Moved facts reject in-flight publication');
    assert.equal(await run(), true);
    clock.now += 901;
    assert.equal(await run(async () => { await config.update({ enabled: false }); return provider(); }), false, 'Policy changes reject in-flight publication');
    assert.equal(await run(), true); assert.equal((await read()).evaluation.weatherPreparationEnabled, false);

    await config.set({ ...policy, version: 'FAILURE-TEST' }); clock.now += 1;
    let failures = 0;
    assert.equal(await run(async () => { failures++; return new Response('secret provider detail', { status: 429 }); }), true);
    const outage = await read(); assert.equal(outage.evaluation.water.needsWater, null); assert.equal(outage.evaluation.weatherPreparationEnabled, false);
    assert.equal(await run(async () => { failures++; throw new Error('should not execute'); }), false); assert.equal(failures, 1);
    await assert.rejects(acquireCareWeather({ lat: -26, lng: 28 }, 1, policy, 'TEST-ONLY-SECRET', async () => new Response('x'.repeat(384001)), () => clock.now), /invalid_body/);
    assert.equal(readWeatherPolicy({ ...policy, enabled: 'true' }), null);
    assert.equal(readWeatherPolicy({ ...policy, retryAfterSeconds: 0 }), null);

    const carePath = doc(alice.db, 'plants', id, 'care', 'current');
    assert.equal((await getDoc(carePath)).exists(), true);
    await denied(getDoc(doc(bob.db, 'plants', id, 'care', 'current')));
    await denied(setDoc(carePath, { evaluation: { water: { needsWater: true } } }));
    await denied(updateDoc(doc(alice.db, 'plants', id), { careEvaluationRevision: 'forged' }));
    await denied(updateDoc(doc(alice.db, 'plants', id), { careNextEvaluationUtc: 0 }));
    await denied(updateDoc(doc(alice.db, 'plants', id), { careEventProtocol: 1 }));
    await denied(setDoc(doc(alice.db, 'careConfiguration', 'weather'), { enabled: true }));
    await denied(getDoc(doc(alice.db, 'plants', id, 'careWeather', original.id)));
    await denied(deleteDoc(carePath));
    await config.set({ ...policy, version: 'BUDGET-EXHAUSTED', maxRequestsPerDay: 1 }); clock.now += 901;
    const budgetCalls = calls; assert.equal(await run(), false); assert.equal(calls, budgetCalls, 'Care request budget fails closed without spending another provider call');
    await plant.update({ potSize: '10 L' });
    const a = plant.collection('logs').doc('water-a'); const b = plant.collection('logs').doc('water-b');
    const water = { type: 'watering', occurrencePrecision: 'time', timestamp: Timestamp.fromMillis((clock.now - 1000) * 1000),
      recordedAt: Timestamp.fromMillis((clock.now - 900) * 1000), waterMl: 100, updatedBy: alice.uid };
    await a.set(water);
    assert.equal((await readWaterEvents(id, clock.now)).complete, false, 'Uncaptured raw logs cannot masquerade as complete empty history');
    const captured = await Promise.all([captureWaterEvent(id, a.id, () => clock.now), captureWaterEvent(id, a.id, () => clock.now)]);
    assert.equal(captured.filter(Boolean).length, 1, 'Concurrent retries create one authoritative revision');
    assert.equal((await plant.get()).data().waterLedgerRevision, 1);
    clock.now += 1; await a.update({ waterMl: 200 }); await captureWaterEvent(id, a.id, () => clock.now);
    let ledger = await readWaterEvents(id, clock.now);
    assert.equal(ledger.complete, true); assert.equal(ledger.events.length, 2);
    assert.equal(ledger.events.at(-1).appliedL, .2);
    assert.equal((await readWaterEvents(id, clock.now - 1)).events.length, 1, 'Future corrections are absent from an earlier as-of read');
    await b.set(water); await captureWaterEvent(id, b.id, () => clock.now);
    await a.delete(); assert.equal((await readWaterEvents(id, clock.now)).complete, false);
    await captureWaterEvent(id, a.id, () => clock.now);
    assert.equal((await readWaterEvents(id, clock.now)).complete, true);
    await b.update({ type: 'note' }); assert.equal((await synchronizeWaterEvents(id, 2000, () => clock.now)).complete, true);
    const c = plant.collection('logs').doc('water-c'); await c.set({ ...water, waterMl: -1 });
    await captureWaterEvent(id, c.id, () => clock.now); assert.equal((await readWaterEvents(id, clock.now)).complete, false);
    await c.update({ waterMl: 100 }); await captureWaterEvent(id, c.id, () => clock.now);
    const currentPlant = (await plant.get()).data(); const vegetative = { ...currentPlant, growthStage: 'vegetative' };
    await captureSetupTransition(id, vegetative, currentPlant, clock.now - 8000, 'setup-change', () => clock.now);
    await captureSetupTransition(id, null, vegetative, clock.now - 10000, 'setup-origin', () => clock.now);
    assert.equal(await captureSetupTransition(id, null, vegetative, clock.now - 10000, 'setup-origin', () => clock.now), false);
    const setupFacts = await readSetupTransitions(id, clock.now); assert.equal(setupFacts.complete, true);
    assert.deepEqual(setupFacts.facts.map(row => row.sourceRevision), ['setup-origin', 'setup-change'], 'Effective source time wins over arrival order');
    const origin = clock.now - 3600;
    const testScenario = { id: 'TEST-SCENARIO', capacityL: 2, actionReserveL: .8, effectiveLossM2: .2, catchmentM2: .08, rainDelivery: 1,
      retainedFraction: .8, initialReserveL: [.5, .5], unknownRefillL: [0, 2], order: 'inputs_first' };
    const testProfile = { id: 'SYNTHETIC-NOT-APPROVED', version: 'test', criterionId: 'TEST-NOT-REAL-OUTCOMES', validationEvidenceId: 'TEST-ONLY',
      stateAnchorBasis: 'synthetic fixture', rootZoneKey: 'test', transitionPolicy: 'test',
      domain: { environment: 'outdoor', plantedIn: 'pot', stages: ['flowering'], suns: [null], mediums: [null], potVolumeL: [1, 20], sourceKeys: ['test/archive/test'] }, scenarios: [testScenario] };
    const sample = variable => ({ schema_version: '8.4', provider: 'test', product: 'archive', source_revision: 'r1', model_selection: 'test', model_selection_basis: 'test',
      location_revision: currentPlant.locationRevision, retrieved_at_utc: clock.now, available_at_utc: clock.now, issued_at_utc: null, variable,
      value: 0, unit: 'mm', valid_start_utc: origin, valid_end_utc: clock.now, time_support: 'interval_sum', kind: 'occurred_estimate', quality: 'ok', reason_codes: [] });
    const selection = { provider: 'test', product: 'archive', modelSelection: 'test', sourceRevision: 'r1' };
    const plan = { profile: testProfile, anchorUtc: origin, anchored: true, et0Source: selection, rainSource: selection, weather: [sample('et0_mm'), sample('liquid_rain_mm')] };
    const publicPointer = (await plant.get()).data().careEvaluationRevision;
    assert.equal(await recordShadowWaterRun(id, plan, () => clock.now), true);
    const shadow = (await plant.collection('careShadow').get()).docs.at(-1).data();
    assert.equal(shadow.mode, 'shadow'); assert.equal(shadow.output.candidate, 'water'); assert.ok(shadow.checkpoint);
    assert.equal((await plant.get()).data().careEvaluationRevision, publicPointer, 'Unapproved shadow water never replaces public care advice');
    await denied(updateDoc(doc(alice.db, 'plants', id), { waterLedgerRevision: 0 }));
    await denied(updateDoc(doc(alice.db, 'plants', id), { setupLedgerRevision: 0 }));
    await denied(setDoc(doc(alice.db, 'plants', id, 'careWaterCheckpoints', 'latest'), { checkpoint: { reserveL: [2, 2] } }));

    // End-to-end watering release uses real provider field semantics with synthetic values/approval in emulators only.
    await config.delete(); clock.now = Math.ceil(clock.now / 3600) * 3600;
    const releaseProfile = { ...testProfile, domain: { ...testProfile.domain, sourceKeys: ['Open-Meteo/archive/era5'] } };
    const waterPolicy = { enabled: true, version: 'EMULATOR-ONLY-NOT-A-RELEASE', historyModel: 'era5', licensingEvidenceId: 'TEST-ONLY', adapterReviewId: 'TEST-ONLY',
      requestTimeoutMs: 1000, retryAfterSeconds: 60, refreshSeconds: 900, maxRequestsPerDay: 20, backfillDays: 2, historyRecheckDays: 1,
      profiles: [{ profile: releaseProfile, approved: true, approvalRecordId: 'TEST-APPROVAL-NOT-REAL', outcomeCriterionId: releaseProfile.criterionId,
        validationEvidenceId: releaseProfile.validationEvidenceId, statisticalReviewId: 'TEST-ONLY', policyLockedBeforeHoldout: true,
        sourceAdapterContractsPassed: true, consumerIntegrationPassed: true, numericTargets: { minimumIndependentPlants: 1, minimumPositiveCases: 1,
          minimumNegativeCases: 1, minimumDecisionCoverage: .5, maximumFalseWaterRate: .5, maximumUnaddressedDueRate: .5 } }] };
    await waterConfig.set(waterPolicy);
    let historyCalls = 0;
    const historyProvider = async url => {
      assert.equal(new URL(url).hostname, 'archive-api.open-meteo.com'); historyCalls++;
      return new Response(JSON.stringify({ latitude: -27, longitude: 29, elevation: 1000, utc_offset_seconds: 0,
        hourly_units: { time: 'unixtime', et0_fao_evapotranspiration: 'mm', rain: 'mm' },
        hourly: { time: [Math.floor(clock.now / 3600) * 3600], et0_fao_evapotranspiration: [10], rain: [0] } }));
    };
    const waterRun = () => run(historyProvider);
    assert.equal(await waterRun(), true); assert.equal((await read()).evaluation.water.needsWater, null);
    assert.equal(historyCalls, 0, 'Activation starts unknown at the real current boundary, without inventing a full bank');
    clock.now += 3600;
    assert.equal(await waterRun(), true); let released = await read();
    assert.equal(released.evaluation.water.needsWater, true, 'Complete ET0/rain history depletes every supported unanchored scenario');
    assert.equal(released.evaluation.water.evidence.effects.weatherDemand, true);
    assert.equal(released.evaluation.water.evidence.scenarios[0].reserveL[1], 0);
    assert.equal(released.evaluation.warnings.find(w => w.id === 'W06').state, 'triggered');
    assert.equal(released.evaluation.waterRelease.approvalRecordId, 'TEST-APPROVAL-NOT-REAL');
    assert.equal(released.evaluation.dataRevisionFingerprint.length, 64, 'Public snapshot carries a hash, not private replay/configuration');
    assert.equal(historyCalls, 1);
    const actual = plant.collection('logs').doc('release-watering');
    await actual.set({ ...water, timestamp: Timestamp.fromMillis(clock.now * 1000), recordedAt: Timestamp.fromMillis(clock.now * 1000), waterMl: 3000 });
    assert.equal(await waterRun(), true); released = await read();
    assert.equal(released.evaluation.water.needsWater, false, 'Known exact-now retained watering updates the bank after occurred history');
    assert.equal(released.evaluation.water.evidence.effects.loggedWatering, true);
    assert.equal(historyCalls, 1, 'Authoritative log edits reuse selected occurred history');
    await actual.update({ waterMl: 0 }); assert.equal(await waterRun(), true);
    assert.equal((await read()).evaluation.water.needsWater, true, 'Amount correction invalidates checkpoint and replays original history');
    await actual.update({ waterMl: null }); assert.equal(await waterRun(), true);
    assert.equal((await read()).evaluation.water.needsWater, null, 'Omitted amount never becomes a full refill');
    await actual.delete(); assert.equal(await waterRun(), true); assert.equal((await read()).evaluation.water.needsWater, true);
    clock.now += 600;
    const context = { ...await readCareConfiguration(), useVerifiedLedgerCache: true };
    const { measureFirestoreOperations } = require('./firestore-operation-meter.cjs');
    const cachedRun = await measureFirestoreOperations(backend('firebase-admin/firestore'),
      () => refreshPlantCare(id, 'TEST-ONLY-SECRET', historyProvider, () => clock.now, context));
    assert.equal(cachedRun.value, false, 'Fresh cache retains its original evaluation timestamp');
    assert.equal(cachedRun.metrics.reads, 4, 'Warm unchanged care checks use four document reads, independent of watering-history length');
    assert.equal(cachedRun.metrics.queries, 0); assert.equal(cachedRun.metrics.writes, 0);
    clock.now += 301; assert.equal(await waterRun(), true);
    assert.equal((await read()).evaluation.water.needsWater, null, 'Archive trailing gap/unfinished hour cannot be bridged using forecasts or zero loss');
    await waterConfig.set({ ...waterPolicy, profiles: [{ ...waterPolicy.profiles[0], statisticalReviewId: '' }] });
    assert.equal(await waterRun(), true); assert.equal((await read()).evaluation.water.needsWater, null, 'Incomplete approval revokes definite care');
    await waterConfig.set({ ...waterPolicy, version: 'EMULATOR-RACE-ONLY' });
    const pointerBeforeWaterRace = (await plant.get()).data().careEvaluationRevision;
    assert.equal(await run(async url => { await waterConfig.update({ enabled: false }); return historyProvider(url); }), false,
      'Water configuration changed in flight cannot publish the old approved decision');
    assert.equal((await plant.get()).data().careEvaluationRevision, pointerBeforeWaterRace);
    await waterConfig.set({ ...waterPolicy, enabled: false });
    assert.equal(await waterRun(), true); assert.equal((await read()).evaluation.water.needsWater, null);
    assert.equal((await plant.get()).data().careEventProtocol, 1, 'Verified history enrolls the revision-protected protocol');
    const protectedPlant = doc(alice.db, 'plants', id); const clientWater = doc(alice.db, 'plants', id, 'logs', 'protocol-water');
    const clientFact = { type: 'watering', waterMl: 100, occurrencePrecision: 'time', timestamp: new Date(clock.now * 1000), recordedAt: new Date(clock.now * 1000), updatedBy: alice.uid };
    await denied(setDoc(clientWater, clientFact));
    const revision = (await plant.get()).data().careRevision || 0;
    const create = writeBatch(alice.db); create.set(clientWater, clientFact); create.update(protectedPlant, { careRevision: revision + 1, careSummary: null }); await create.commit();
    await denied(updateDoc(clientWater, { waterMl: 200 }));
    await denied(deleteDoc(clientWater));
    await denied(updateDoc(protectedPlant, { careRevision: revision }));
    await denied(updateDoc(protectedPlant, { careEventProtocol: 0 }));
    const remove = writeBatch(alice.db); remove.delete(clientWater); remove.update(protectedPlant, { careRevision: revision + 2, careSummary: null }); await remove.commit();
    await denied(setDoc(doc(alice.db, 'careConfiguration', 'watering'), waterPolicy));
    await denied(setDoc(doc(alice.db, 'plants', id, 'careWaterState', 'origin'), { anchorUtc: clock.now, reserveL: [2, 2] }));
    await denied(setDoc(doc(alice.db, 'plants', id, 'careWaterHistory', 'fake'), { samples: [] }));
    await assert.rejects(acquireWaterHistory({ lat: -26, lng: 28 }, 1, clock.now - 3600, clock.now, waterPolicy,
      async () => new Response('x'.repeat(384001)), () => clock.now), /body_limit/);
    await plant.update({ deleting: true, status: 'archived' });
    assert.equal(await run(), false);
    await deleteDoc(carePath); await deleteDoc(doc(alice.db, 'plants', id, 'careWeather', original.id));
    console.log('PASS: protected care/weather, authoritative events, shadow isolation, production ET0/rain to due/not-due/unknown, checkpoint correction, source gaps, approval revocation and ownership.');
  } finally {
    if (priorConfig.exists) await config.set(priorConfig.data()); else await config.delete();
    if (priorWaterConfig.exists) await waterConfig.set(priorWaterConfig.data()); else await waterConfig.delete();
    await Promise.all(clients.map(async app => { await terminate(clientDb(app)); await deleteApp(app); }));
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
