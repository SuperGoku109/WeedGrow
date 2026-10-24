import { collection, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { requireUserId } from '@/services/session';
export async function uploadProgressPic(plantId: string, fileUri: string, caption?: string, requestId?: string, onProgress?: (stage: 'preparing' | 'saving' | 'complete') => void) {
  const uid = requireUserId();
  if ((caption?.length || 0) > 1000) throw new Error('Keep captions under 1,000 characters.');
  onProgress?.('preparing');
  const photo = await preparePhotoRecord(plantId, fileUri);
  const ref = requestId ? doc(db, 'plants', plantId, 'progressPics', requestId) : doc(collection(db, 'plants', plantId, 'progressPics'));
  onProgress?.('saving');
  await runTransaction(db, async tx => {
    const plantRef = doc(db, 'plants', plantId);
    const plant = await tx.get(plantRef);
    const existing = await tx.get(ref);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || plant.data().deleting) throw new Error('This plant is not available in your account.');
    if (existing.exists()) {
      // A previous attempt may have committed even when its response was lost.
      // Caption changes update that same photo rather than creating another.
      tx.update(ref, { caption: caption || '' });
      tx.set(doc(db, 'plants', plantId, 'logs', `photo_${ref.id}`), { type: 'photo', photoUri: existing.data().imageUrl, timestamp: existing.data().timestamp || serverTimestamp(), updatedBy: uid, description: caption || 'Progress photo added.' }, { merge: true });
      return;
    }
    for (const write of photo.writes) tx.set(write.ref, write.data);
    tx.set(ref, { imageUrl: photo.uri, timestamp: serverTimestamp(), caption: caption || '' });
    tx.set(doc(db, 'plants', plantId, 'logs', `photo_${ref.id}`), { type: 'photo', photoUri: photo.uri, description: caption || 'Progress photo added.', timestamp: serverTimestamp(), updatedBy: uid });
    tx.update(plantRef, { updatedAt: serverTimestamp() });
  });
  onProgress?.('complete'); return ref;
}
