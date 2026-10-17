import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function deleteSubcollection(docRef, subcollectionName) {
  const subSnap = await docRef.collection(subcollectionName).get();
  if (!subSnap.empty) {
    const deletes = subSnap.docs.map((doc) => doc.ref.delete());
    await Promise.all(deletes);
    console.log(`🗑️ Deleted ${subcollectionName} (${deletes.length} docs)`);
  }
}

async function deleteAllPlantsAndSubcollections() {
  const snapshot = await db.collection('plants').get();

  for (const docSnap of snapshot.docs) {
    const plantRef = docSnap.ref;

    // Delete subcollections in parallel
    await Promise.all([
      deleteSubcollection(plantRef, 'logs'),
      deleteSubcollection(plantRef, 'weatherCache'),
      deleteSubcollection(plantRef, 'progressPics'),
      deleteSubcollection(plantRef, 'photoAssets'),
    ]);

    // Then delete the plant document itself
    await plantRef.delete();
    console.log(`✅ Deleted plant ${plantRef.id}`);
  }

  console.log('🎉 All plant documents and subcollections deleted.');
}

deleteAllPlantsAndSubcollections().catch(console.error);
