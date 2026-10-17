import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Platform } from 'react-native';
import logger from '@/lib/logger';
import { db } from '@/services/firebase';
import { isStoredPhoto, preparePhotoRecord } from './photoRepository';

const migrationPromises = new Map<string, Promise<string | null>>();

function normalizeImageUri(imageUri?: string | null): string | null {
  const trimmed = imageUri?.trim();
  return trimmed ? trimmed : null;
}

function getUriScheme(imageUri: string): string | null {
  const match = /^([a-z0-9.+-]+):/i.exec(imageUri);
  return match?.[1]?.toLowerCase() ?? null;
}

export function isHostedPlantImageUri(imageUri?: string | null): boolean {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) return false;

  const scheme = getUriScheme(normalized);
  return scheme === 'http' || scheme === 'https';
}

export function isLocalOnlyPlantImageUri(imageUri?: string | null): boolean {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) return false;

  const scheme = getUriScheme(normalized);
  return (
    scheme === 'file' ||
    scheme === 'content' ||
    scheme === 'ph' ||
    scheme === 'asset' ||
    scheme === 'assets-library'
  );
}

export function shouldUploadPlantImageUri(imageUri?: string | null): boolean {
  const normalized = normalizeImageUri(imageUri);
  return !!normalized && !isHostedPlantImageUri(normalized) && !isStoredPhoto(normalized);
}

export function getRenderablePlantImageUri(imageUri?: string | null): string | null {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) return null;
  if (Platform.OS === 'web' && isLocalOnlyPlantImageUri(normalized)) {
    return null;
  }
  return normalized;
}

export async function migrateStoredPlantImageIfNeeded(
  plantId: string,
  imageUri?: string | null,
): Promise<string | null> {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized || Platform.OS === 'web' || !isLocalOnlyPlantImageUri(normalized)) {
    return null;
  }

  const existingPromise = migrationPromises.get(plantId);
  if (existingPromise) {
    return existingPromise;
  }

  const migrationPromise = (async () => {
    try {
      const photo = await preparePhotoRecord(plantId, normalized);
      const batch = writeBatch(db);
      for (const write of photo.writes) batch.set(write.ref, write.data);
      batch.update(doc(db, 'plants', plantId), {
        imageUri: photo.uri,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return photo.uri;
    } catch (error) {
      logger.warn('Failed to migrate plant image URI', { plantId, imageUri: normalized, error });
      return null;
    } finally {
      migrationPromises.delete(plantId);
    }
  })();

  migrationPromises.set(plantId, migrationPromise);
  return migrationPromise;
}
