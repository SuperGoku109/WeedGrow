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
  const app = initializeApp({ projectId: 'demo-weedgrow', apiKey: 'demo-api-key' }, `garden-weather-${Date.now()}`);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `garden-weather-${Date.now()}@example.test`, 'DisposableOnly2026!');
  const db = f.getFirestore(app); f.connectFirestoreEmulator(db, '127.0.0.1', 8080); f.setLogLevel('silent');
  stub('services/firebase.ts', { db }); stub('services/session.ts', { requireUserId: () => user.uid });
  stub('features/location/locationService.ts', { validCoordinates: value => !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180, coordinateLabel: value => `${value.lat}, ${value.lng}` });
  let calls = 0;
  stub('lib/weather/fetchWeather.ts', { fetchWeather: async () => { calls++; return { timezone: 'Africa/Johannesburg', timezone_offset: 7200, current: { dt: Math.floor(Date.now() / 1000), temp: 22, humidity: 60, wind_speed: 2, uvi: 3 } }; } });
  const { createGarden } = require('../features/home/api/createGarden.ts');
  const { refreshGardenWeather } = require('../lib/weather/refreshGardenWeather.ts');
  const id = `weather-${Date.now()}`, location = { lat: -26, lng: 28 };
  const ref = f.doc(db, 'groups', id);
  try {
    await assert.rejects(createGarden(id, 'Patio', 'outdoor', null), /Choose a location/);
    await createGarden(id, 'Patio', 'outdoor', location, 'Johannesburg');
    await Promise.all([refreshGardenWeather(id), refreshGardenWeather(id)]);
    let saved = (await f.getDoc(ref)).data();
    assert.deepEqual(saved.plantIds, []); assert.deepEqual(saved.location, location);
    assert.equal(saved.currentWeather.temperature, 22);
    let history = await f.getDocs(f.collection(db, 'groups', id, 'weatherCache'));
    assert.equal(history.size, 1); assert.deepEqual(history.docs[0].data().sourceCoordinates, location);
    await refreshGardenWeather(id); assert.equal(calls, 1, 'Fresh garden weather avoids another provider request');
    await createGarden(id, 'Retry', 'indoor', { lat: 0, lng: 0 });
    saved = (await f.getDoc(ref)).data(); assert.equal(saved.name, 'Patio'); assert.deepEqual(saved.location, location);
    const oldRef = f.doc(db, 'groups', id, 'weatherCache', '2000-01-01'); await f.setDoc(oldRef, { temperature: 17 });
    await f.updateDoc(ref, { location: { lat: -25, lng: 29 } });
    await refreshGardenWeather(id);
    assert.equal((await f.getDoc(oldRef)).data().temperature, 17);
    history = await f.getDocs(f.collection(db, 'groups', id, 'weatherCache'));
    assert.equal(history.docs.find(d => d.id !== '2000-01-01').data().previousLocations.length, 1);
    await createUserWithEmailAndPassword(auth, `foreign-weather-${Date.now()}@example.test`, 'DisposableOnly2026!');
    await assert.rejects(f.getDoc(ref), /permission/i);
    await assert.rejects(f.getDocs(f.collection(db, 'groups', id, 'weatherCache')), /permission/i);
    await assert.rejects(f.setDoc(f.doc(db, 'groups', id, 'weatherCache', '2001-01-01'), { temperature: 99 }), /permission/i);
    console.log('PASS: Required pin, empty-garden weather collection, retry identity, fresh-cache deduplication, location history, and account isolation with actual Firestore rules.');
  } finally { await deleteApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
