import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';

/**
 * Saves a compact photo and its gallery metadata atomically on the Spark plan.
 * @param plantId Plant ID
 * @param fileUri Local file URI
 * @param caption Optional caption
 * @returns The Firestore document reference
 */
export async function uploadProgressPic(plantId: string, fileUri: string, caption?: string) {
  const photo = await preparePhotoRecord(plantId, fileUri);
  const docRef = doc(collection(db, 'plants', plantId, 'progressPics'));
  const batch = writeBatch(db);
  for (const write of photo.writes) batch.set(write.ref, write.data);
  batch.set(docRef, {
    imageUrl: photo.uri,
    timestamp: serverTimestamp(),
    caption: caption || '',
  });
  await batch.commit();
  return docRef;
}
