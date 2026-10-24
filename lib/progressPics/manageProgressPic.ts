import { collection, doc, getDoc, getDocs, query, runTransaction, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { ProgressPic } from '@/features/plants/hooks/useProgressGallery';
export async function manageProgressPic(plantId: string, pic: ProgressPic, action: 'cover' | 'caption' | 'delete', caption = '') {
  const uid = requireUserId();
  if (caption.length > 1000) throw new Error('Keep captions under 1,000 characters.');
  const before = await getDoc(doc(db, 'plants', plantId));
  const logs = action === 'delete' ? await getDocs(query(collection(db, 'plants', plantId, 'logs'), where('photoUri', '==', pic.imageUrl))) : null;
  const references = action === 'delete' ? await getDocs(query(collection(db, 'plants', plantId, 'progressPics'), where('imageUrl', '==', pic.imageUrl))) : null;
  const shared = references?.docs.some(item => item.id !== pic.id);
  if ((logs?.size || 0) > 380) throw new Error('This image has too many linked journal entries to delete in one action.');
  await runTransaction(db, async tx => {
    const plantRef = doc(db, 'plants', plantId);
    const picRef = doc(db, 'plants', plantId, 'progressPics', pic.id);
    const plant = await tx.get(plantRef);
    const current = await tx.get(picRef);
    if (!plant.exists() || !plant.data().owners?.includes(uid) || !current.exists()) throw new Error('This photo is no longer available. Refresh the gallery.');
    if (plant.data().updatedAt?.toMillis?.() !== before.data()?.updatedAt?.toMillis?.()) throw new Error('This plant changed while loading photo references. Refresh and try again.');
    if ((current.data().imageUrl || current.data().url) !== pic.imageUrl || (current.data().caption || '') !== (pic.caption || '')) throw new Error('This photo changed. Refresh before editing it.');
    tx.update(plantRef, { updatedAt: serverTimestamp() });
    if (action === 'cover') tx.update(plantRef, { imageUri: pic.imageUrl });
    else if (action === 'caption') tx.update(picRef, { caption: caption.trim() });
    else {
      tx.delete(picRef);
      if (plant.data().imageUri === pic.imageUrl) tx.update(plantRef, { imageUri: null, updatedAt: serverTimestamp() });
      if (!shared) {
        logs?.docs.forEach(log => tx.delete(log.ref));
        const path = pic.imageUrl.startsWith('firestore-photo:') ? pic.imageUrl.slice(16) : '';
        if (path.startsWith(`plants/${plantId}/photoAssets/`) && path.split('/').length === 4) {
          tx.delete(doc(db, path)); tx.delete(doc(db, path + '_thumb'));
        }
      }
    }
  });
}
