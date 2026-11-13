const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp } = backend('firebase-admin/app');
const { getFirestore, Timestamp } = backend('firebase-admin/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) throw new Error('Use the disposable demo emulator.');
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const { recordDueWatering, runRepeatingWatering } = require('../functions/dist/repeatingWatering.js');
(async () => {
  const db = getFirestore(), ref = db.doc(`plants/repeat-${Date.now()}`);
  const now = Date.parse('2026-11-16T06:05:00Z'), due = now - 300000;
  const routine = { enabled: true, everyDays: 3, time: '08:00', waterMl: 500, timeZone: 'Africa/Johannesburg', startOn: '2026-11-13', nextAt: due };
  await ref.set({ owners: ['test'], status: 'active', growthStage: 'vegetative', careRevision: 0, wateringRepeat: routine });
  await Promise.all([recordDueWatering(ref.id, now), recordDueWatering(ref.id, now)]);
  let logs = await ref.collection('logs').get();
  assert.equal(logs.size, 1); assert.equal(logs.docs[0].data().waterMl, 500);
  assert.equal(logs.docs[0].data().recordingSource, 'schedule');
  assert.equal(logs.docs[0].data().timestamp.toMillis(), due);
  assert.equal((await ref.get()).data().careRevision, 1);
  assert.equal((await ref.get()).data().wateringRepeat.nextAt, Date.parse('2026-11-19T06:00:00Z'));
  await ref.update({ wateringRepeat: routine }); await runRepeatingWatering(now);
  assert.equal((await ref.collection('logs').get()).size, 1, 'Retry must preserve the daily entry');
  await logs.docs[0].ref.delete();
  const manual = ref.collection('logs').doc('legacy-manual');
  await manual.set({ type: 'watering', waterMl: 250, timestamp: Timestamp.fromMillis(due - 1000) });
  await ref.update({ wateringRepeat: routine }); await recordDueWatering(ref.id, now);
  assert.equal((await ref.collection('logs').get()).size, 1); assert.equal((await manual.get()).data().waterMl, 250);
  await ref.update({ wateringRepeat: null }); await recordDueWatering(ref.id, now);
  assert.equal((await ref.get()).data().wateringRepeat, null, 'Stopped schedules remain stopped');
  for (const ending of [{ status: 'harvested' }, { status: 'active', growthStage: 'drying' }, { status: 'active', growthStage: 'vegetative', harvest: { date: '2026-11-15' } }, { deleting: true }]) {
    await ref.update({ wateringRepeat: routine, ...ending }); await recordDueWatering(ref.id, now);
    assert.equal((await ref.get()).data().wateringRepeat, null);
  }
  await db.recursiveDelete(ref);
  console.log('PASS: repeating watering concurrency, retries, local times, manual entries, stop and ended-cycle handling.');
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
