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
    const batch = writeBatch(db);
    subSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  };

  await Promise.all([
    deleteSubcollection('logs'),
    deleteSubcollection('weatherCache'),
    deleteSubcollection('progressPics'),
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
