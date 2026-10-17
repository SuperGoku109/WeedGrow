import { db } from '@/services/firebase';
import { doc, deleteDoc, collection, getDocs, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';
import { invalidatePlantCache } from '@/features/plants/hooks/usePlantList';
import logger from '@/lib/logger';
import type { Plant } from '@/firestoreModels';

// Main delete function for entire plant + subcollections
export async function deletePlantAndSubcollections(id: string) {
  const plantRef = doc(db, 'plants', id);

  const deleteSubcollection = async (sub: string) => {
    const subSnap = await getDocs(collection(db, 'plants', id, sub));
    // Photo assets add two documents per image; keep deletes below batch limits.
    for (let offset = 0; offset < subSnap.docs.length; offset += 450) {
      const batch = writeBatch(db);
      subSnap.docs.slice(offset, offset + 450).forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
  };

  await Promise.all([
    deleteSubcollection('logs'),
    deleteSubcollection('weatherCache'),
    deleteSubcollection('progressPics'),
    deleteSubcollection('photoAssets'),
  ]);

  await deleteDoc(plantRef);

  // Invalidate the plant cache so fresh data is fetched next time
  invalidatePlantCache();
}

export type UpdatePlantFields = Partial<Omit<Plant, 'createdAt' | 'updatedAt' | 'owners'>>;

export async function updatePlant(id: string, updates: UpdatePlantFields) {
  try {
    const plantRef = doc(db, 'plants', id);
    await updateDoc(plantRef, { ...updates, ...(updates.ageDays != null ? { ageKnown: true } : {}), updatedAt: serverTimestamp() });
    invalidatePlantCache();
  } catch (error) {
    logger.error('Error updating plant:', error);
    throw new Error('Failed to update plant. Please try again.');
  }
}
