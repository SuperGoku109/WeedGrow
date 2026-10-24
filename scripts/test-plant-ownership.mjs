// Disposable local integration test. This script refuses production endpoints.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp, writeBatch, terminate, runTransaction, arrayUnion, setLogLevel } from 'firebase/firestore';

const projectId = 'demo-weedgrow';
setLogLevel('silent');
const apps = [];
async function account(label) {
  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, `${label}-${Date.now()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = (await createUserWithEmailAndPassword(auth, `${label}-${Date.now()}@example.test`, 'LocalTestOnly2026!')).user;
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { uid: user.uid, db };
}
function denied(promise) { return assert.rejects(promise, error => error.code === 'permission-denied'); }
try {
  const alice = await account('owner-a'); const bob = await account('owner-b');
  const plantId = `ownership-check-${Date.now()}`;
  const plant = { name: 'Rules verification', owners: [alice.uid], growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(alice.db);
  batch.set(doc(alice.db, 'plants', plantId), plant);
  batch.set(doc(alice.db, 'plants', plantId, 'photoAssets', 'cover'), { dataUri: 'data:image/jpeg;base64,AAAA' });
  batch.set(doc(alice.db, 'plants', plantId, 'logs', 'setup'), { type: 'note', updatedBy: alice.uid, timestamp: serverTimestamp() });
  await batch.commit();
  const spaceRef = doc(alice.db, 'groups', plantId + '-space');
  await setDoc(spaceRef, { name: 'Owned space', createdBy: alice.uid, plantIds: [], environment: 'outdoor' });
  const transactionPlant = doc(alice.db, 'plants', plantId + '-transaction');
  await runTransaction(alice.db, async transaction => {
    assert.equal((await transaction.get(transactionPlant)).exists(), false);
    const space = await transaction.get(spaceRef);
    assert.equal(space.data().createdBy, alice.uid);
    transaction.set(transactionPlant, plant);
    transaction.set(doc(alice.db, 'plants', transactionPlant.id, 'photoAssets', 'cover'), { dataUri: 'data:image/jpeg;base64,AAAA' });
    transaction.update(spaceRef, { plantIds: arrayUnion(transactionPlant.id) });
  });
  assert.ok((await getDoc(spaceRef)).data().plantIds.includes(transactionPlant.id));
  await denied(getDoc(doc(bob.db, 'groups', spaceRef.id)));
  await denied(getDocs(collection(alice.db, 'plants')));
  assert.equal((await getDoc(doc(alice.db, 'plants', plantId))).data().name, plant.name);
  assert.ok((await getDocs(query(collection(alice.db, 'plants'), where('owners', 'array-contains', alice.uid)))).docs.some(item => item.id === plantId));
  await denied(getDoc(doc(bob.db, 'plants', plantId)));
  await denied(getDoc(doc(bob.db, 'plants', plantId, 'photoAssets', 'cover')));
  await denied(updateDoc(doc(bob.db, 'plants', plantId), { name: 'Stolen' }));
  await denied(updateDoc(doc(alice.db, 'plants', plantId), { owners: [bob.uid] }));
  await denied(setDoc(doc(bob.db, 'plants', 'spoofed'), { ...plant, owners: [alice.uid] }));
  await denied(setDoc(doc(alice.db, 'plants', plantId, 'photoAssets', 'oversized'), { dataUri: 'data:image/jpeg;base64,' + 'A'.repeat(184320) }));
  await denied(setDoc(doc(alice.db, 'plants', plantId, 'logs', 'forged-actor'), { updatedBy: bob.uid, type: 'watering' }));
  const failed = writeBatch(alice.db);
  const failedId = `${plantId}-atomic`;
  failed.set(doc(alice.db, 'plants', failedId), plant);
  failed.set(doc(alice.db, 'plants', failedId, 'photoAssets', 'bad'), { dataUri: 'not-an-image' });
  await denied(failed.commit());
  assert.equal((await getDoc(doc(alice.db, 'plants', failedId))).exists(), false);
  const unsignedApp = initializeApp({ projectId, apiKey: 'demo-api-key' }, `unsigned-${Date.now()}`); apps.push(unsignedApp);
  const unsignedDb = getFirestore(unsignedApp); connectFirestoreEmulator(unsignedDb, '127.0.0.1', 8080);
  await denied(getDoc(doc(unsignedDb, 'plants', plantId)));
  console.log('PASS: owned atomic saves and queries; foreign reads/writes, actor spoofing, oversized photos, unsigned access and partial writes are blocked.');
} finally {
  await Promise.all(apps.map(async app => { await terminate(getFirestore(app)); await deleteApp(app); }));
}
