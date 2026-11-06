const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) throw new Error('Efficiency tests require disposable emulators.');
const { initializeApp } = backend('firebase-admin/app');
const sdk = backend('firebase-admin/firestore');
const { getFirestore, Timestamp } = sdk;
initializeApp({ projectId: process.env.GCLOUD_PROJECT + '-efficiency' });
const { synchronizeWaterEvents, refreshPlantCare, readCareConfiguration, careConfigurationKey } = require('../functions/dist/careOperations.js');
const { runMaintenance, rebuildCareSummary } = require('../functions/dist/operations.js');
const { measureFirestoreOperations } = require('./firestore-operation-meter.cjs');
const meter = action => measureFirestoreOperations(sdk, action);
(async () => {
  const db = getFirestore(); const now = Math.floor(Date.now() / 1000);
  const plants = db.collection('plants');
  const parent = plants.doc('ledger');
  const clock = () => now;
  const model = { name: 'Synthetic efficiency fixture', owners: ['test'], status: 'active', environment: 'outdoor', plantedIn: 'pot', growthStage: 'vegetative', careSummary: { version: 1 } };
  const noNetwork = async () => { throw new Error('No external network is allowed in efficiency tests.'); };
  // This independent demo project is used exclusively by this script.
  await db.recursiveDelete(plants); await db.recursiveDelete(db.collection('maintenance'));
  try {
    await parent.set(model);
    for (let i = 0; i < 10; i++) await parent.collection('logs').doc(`water-${i}`).set({ type: 'watering', waterMl: 100,
      occurrencePrecision: 'time', timestamp: Timestamp.fromMillis((now - 3600) * 1000), recordedAt: Timestamp.fromMillis((now - 3500) * 1000) });
    assert.equal((await synchronizeWaterEvents(parent.id, 2000, clock)).complete, true);
    const unchanged = await meter(() => synchronizeWaterEvents(parent.id, 2000, clock));
    assert.equal(unchanged.value.complete, true);
    assert.equal(unchanged.value.events.length, 10);
    assert.equal(unchanged.metrics.reads, 31, 'One parent plus one consistent source/head/revision view; no per-log repair transactions');
    assert.equal(unchanged.metrics.writes, 0);
    await parent.collection('logs').doc('water-0').update({ description: 'Caption only' });
    const caption = await meter(() => synchronizeWaterEvents(parent.id, 2000, clock));
    assert.equal(caption.metrics.reads, 31); assert.equal(caption.metrics.writes, 0);
    const cacheOptions = { useVerifiedCache: true, cacheVerifiedResult: true };
    await synchronizeWaterEvents(parent.id, 2000, clock, cacheOptions);
    const cached = await meter(() => synchronizeWaterEvents(parent.id, 2000, clock, cacheOptions));
    assert.equal(cached.metrics.reads, 2, 'Routine runs read only the parent and its protected verified event view');
    assert.equal(cached.metrics.queries, 0); assert.equal(cached.metrics.writes, 0);
    const edit = db.batch();
    edit.update(parent.collection('logs').doc('water-0'), { waterMl: 250 });
    edit.update(parent, { careRevision: 1 });
    await edit.commit();
    const invalidated = await meter(() => synchronizeWaterEvents(parent.id, 2000, clock, cacheOptions));
    assert.equal(invalidated.value.events.filter(event => event.id === 'water-0').at(-1).appliedL, .25);
    assert.ok(invalidated.metrics.queries >= 3, 'Atomic journal revision invalidates the fast path before a trigger arrives');
    const past = await meter(() => synchronizeWaterEvents(parent.id, 2000, () => now - 1, cacheOptions));
    assert.ok(past.metrics.queries >= 3, 'An older as-of request cannot reuse newer acquired evidence');
    assert.equal(past.value.events.length, 0);
    await parent.collection('logs').doc('water-0').update({ waterMl: 500 });
    const corrected = await meter(() => synchronizeWaterEvents(parent.id, 2000, clock));
    assert.equal(corrected.value.complete, true);
    assert.equal(corrected.metrics.writes, 3, 'Only the changed log gets a revision, head and parent invalidation');
    assert.equal(corrected.value.events.filter(event => event.id === 'water-0').at(-1).appliedL, .5);
    await parent.collection('logs').doc('water-1').delete();
    assert.equal((await synchronizeWaterEvents(parent.id, 2000, clock)).complete, true);
    await parent.collection('logs').doc('water-2').update({ waterMl: -1 });
    assert.equal((await synchronizeWaterEvents(parent.id, 2000, clock)).complete, false);
    await parent.collection('logs').doc('water-2').update({ type: 'note' });
    assert.equal((await synchronizeWaterEvents(parent.id, 2000, clock)).complete, true, 'An invalid watering changed to a note must get a tombstone');
    assert.equal((await synchronizeWaterEvents(parent.id, 2, clock)).complete, false, 'Limits never silently truncate history');
    await rebuildCareSummary(parent.id);
    const summary = await meter(() => rebuildCareSummary(parent.id));
    assert.equal(summary.metrics.writes, 0, 'Duplicate summary triggers do not rewrite a plant');
    await parent.update({ status: 'archived' });
    await db.doc('careConfiguration/weather').delete(); await db.doc('careConfiguration/watering').delete();
    const lease = db.doc('maintenance/gardenCollection');
    await lease.set({ careQueueVersion: 1, careConfigKey: careConfigurationKey(await readCareConfiguration()), careRepairDay: Math.floor(now / 86400), careRepairComplete: true });
    const batch = db.batch();
    for (let i = 0; i < 20; i++) batch.set(plants.doc(`fresh-${i}`), { ...model, careNextEvaluationUtc: now + 86400 });
    const due = plants.doc('due'); batch.set(due, { ...model, careNextEvaluationUtc: now - 1 });
    await batch.commit();
    const maintenance = await meter(() => runMaintenance('test-only', noNetwork));
    assert.equal(maintenance.metrics.paths.some(path => path === 'plants/fresh-0'), false, 'Fresh plants are not individually loaded');
    assert.equal(maintenance.metrics.writes, 5, 'Only due publication and bounded maintenance bookkeeping write');
    assert.equal((await due.get()).data().careNextEvaluationUtc, null);
    assert.equal((await due.collection('care').doc('current').get()).exists, true);
    const idle = await meter(() => runMaintenance('test-only', noNetwork));
    assert.equal(idle.metrics.writes, 3, 'Idle timer only updates bounded maintenance bookkeeping');
    const legacy = plants.doc('legacy'); await legacy.set(model);
    await lease.update({ careRepairDay: -1 });
    await runMaintenance('test-only', noNetwork);
    assert.equal((await legacy.collection('care').doc('current').get()).exists, true, 'Daily repair discovers plants without a due field');
    assert.equal((await lease.get()).data().careRepairComplete, true);
    await db.doc('careConfiguration/weather').set({ enabled: false, version: 'changed-policy' });
    await runMaintenance('test-only', noNetwork);
    assert.equal((await legacy.collection('care').doc('current').get()).data().configurationRevision > 0, true, 'Policy changes restart reconciliation before the next daily pass');
    // A legacy fresh snapshot gets its missing due index backfilled, not a new evaluation.
    const current = (await legacy.collection('care').doc('current').get()).data();
    await legacy.update({ careNextEvaluationUtc: 1 });
    assert.equal(await refreshPlantCare(legacy.id, 'test-only', noNetwork, () => Date.now() / 1000), false);
    assert.equal((await legacy.get()).data().careNextEvaluationUtc, current.evaluation.nextEvaluationUtc);
    const failed = plants.doc('temporary-failure'); await failed.set(model);
    await lease.update({ careRepairDay: -1 });
    const originalGet = sdk.DocumentReference.prototype.get;
    let failOnce = true;
    sdk.DocumentReference.prototype.get = function (...args) {
      if (this.path === failed.path && failOnce) { failOnce = false; return Promise.reject(new Error('Synthetic transient read failure')); }
      return originalGet.apply(this, args);
    };
    try { await assert.rejects(runMaintenance('test-only', noNetwork), /could not refresh/); }
    finally { sdk.DocumentReference.prototype.get = originalGet; }
    assert.ok((await failed.get()).data().careNextEvaluationUtc > now, 'Failed legacy work remains queued after the scan advances');
    await failed.update({ careNextEvaluationUtc: 0 });
    await runMaintenance('test-only', noNetwork);
    assert.equal((await failed.collection('care').doc('current').get()).exists, true, 'A transient failure retries without another full reconciliation');
    console.log(`PASS: unchanged ten-entry ledger ${unchanged.metrics.reads} reads/0 writes; protected fast path ${cached.metrics.reads} reads/0 writes; changed-only repairs; due-only maintenance ${maintenance.metrics.reads} SDK reads; idle ${idle.metrics.reads} SDK reads; policy/bootstrap reconciliation; duplicate-write avoidance.`);
  } finally {
    await db.recursiveDelete(plants); await db.recursiveDelete(db.collection('maintenance')); await db.recursiveDelete(db.collection('careConfiguration'));
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
