// Disposable local-only integration checks for the actual move repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const f = require('firebase/firestore');
const root = process.cwd();
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
function stub(file, exports) { const filename = path.join(root, file); require.cache[filename] = { id: filename, filename, loaded: true, exports }; }
(async () => {
  const app = initializeApp({ projectId: 'demo-weedgrow', apiKey: 'demo-api-key' }, `moves-${Date.now()}`);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `moves-${Date.now()}@example.test`, 'DisposableOnly2026!');
  const db = f.getFirestore(app); f.connectFirestoreEmulator(db, '127.0.0.1', 8080); f.setLogLevel('silent');
  stub('services/firebase.ts', { db }); stub('services/session.ts', { requireUserId: () => user.uid }); stub('services/gardenData.ts', { invalidatePlantCache() {} });
  const { movePlantToGarden } = require('../features/groups/api/movePlant.ts');
  const { gardenMoveSignature } = require('../features/groups/gardenMove.ts');
  const prefix = `move-${Date.now()}`;
  const pid = `${prefix}-plant`, a = `${prefix}-a`, b = `${prefix}-b`, c = `${prefix}-c`, indoor = `${prefix}-indoor`;
  const plantRef = f.doc(db, 'plants', pid);
  const groupRef = id => f.doc(db, 'groups', id);
  const point = { lat: -33.9, lng: 18.4 };
  const garden = (name, environment = 'outdoor', members = []) => ({ name, environment, plantIds: members, location: point, createdBy: user.uid });
  try {
    await f.setDoc(groupRef(a), { ...garden('Patio', 'outdoor', [pid]), weatherSourcePlantId: pid });
    for (const id of [b, c]) await f.setDoc(groupRef(id), garden(id));
    await f.setDoc(groupRef(indoor), garden('Tent', 'indoor'));
    await f.setDoc(plantRef, { name: 'Move test', strain: '', owners: [user.uid], status: 'active', growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot', groupId: a, locationMode: 'custom', location: { lat: -34, lng: 19 }, notes: 'Preserve me', wateringFrequency: 'Weekly', locationTimeZone: 'Africa/Johannesburg', createdAt: f.serverTimestamp(), updatedAt: f.serverTimestamp() });
    const historyRef = f.doc(db, 'plants', pid, 'weatherCache', '2026-10-01');
    await f.setDoc(historyRef, { temperature: 22, sourceCoordinates: point });
    const originalHistory = JSON.stringify((await f.getDoc(historyRef)).data());
    async function input(destinationId, requestId, followGarden = false) {
      const [plant, dest] = await Promise.all([f.getDoc(plantRef), f.getDoc(groupRef(destinationId))]);
      return { plantId: pid, destinationId, expectedGroupId: plant.data().groupId || null, expectedPlantUpdatedAt: plant.data().updatedAt?.toMillis() || null, destinationSignature: gardenMoveSignature(dest.data()), followGarden, requestId };
    }
    const first = await input(b, 'first');
    const competing = await input(c, 'competing');
    const outcomes = await Promise.allSettled([movePlantToGarden(first), movePlantToGarden(competing)]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1, 'Only one conflicting move can commit');
    const winner = outcomes[0].status === 'fulfilled' ? first : competing;
    await movePlantToGarden(winner);
    const current = (await f.getDoc(plantRef)).data();
    assert.equal(current.groupId, winner.destinationId);
    assert.equal(current.locationMode, 'custom');
    assert.deepEqual(current.location, { lat: -34, lng: 19 });
    assert.equal(current.notes, 'Preserve me'); assert.equal(current.wateringFrequency, 'Weekly');
    assert.deepEqual((await f.getDoc(groupRef(a))).data().plantIds, []);
    assert.equal((await f.getDoc(groupRef(a))).data().weatherSourcePlantId, null);
    assert.deepEqual((await f.getDoc(groupRef(winner.destinationId))).data().plantIds, [pid]);
    assert.equal((await f.getDocs(f.collection(db, 'plants', pid, 'logs'))).size, 1, 'A lost-response retry does not duplicate movement history');
    const staleDestination = await input(indoor, 'stale');
    await f.updateDoc(groupRef(indoor), { name: 'Changed tent' });
    await assert.rejects(movePlantToGarden(staleDestination), /settings changed/);
    await movePlantToGarden(await input(indoor, 'cross-environment'));
    const movedInside = (await f.getDoc(plantRef)).data();
    assert.equal(movedInside.environment, 'indoor'); assert.equal(movedInside.locationMode, 'space');
    assert.deepEqual(movedInside.location, point); assert.equal(movedInside.currentWeather, null);
    assert.equal(JSON.stringify((await f.getDoc(historyRef)).data()), originalHistory, 'Moves preserve historical weather byte for byte');
    const full = `${prefix}-full`;
    await f.setDoc(groupRef(full), garden('Full garden', 'outdoor', Array.from({ length: 80 }, (_, index) => `full-${index}`)));
    await assert.rejects(movePlantToGarden(await input(full, 'full')), /80/);
    assert.equal((await f.getDoc(plantRef)).data().groupId, indoor);
    await f.updateDoc(plantRef, { deleting: true });
    await assert.rejects(movePlantToGarden(await input(b, 'deleting')), /unavailable/);
    console.log('PASS: atomic concurrent moves, retry reconciliation, source cleanup, custom settings, cross-environment preview conflicts, capacity/deletion guards and historical preservation against local Firestore rules.');
  } finally { await f.terminate(db); await deleteApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
