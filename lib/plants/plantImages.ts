import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Platform } from 'react-native';
import logger from '@/lib/logger';
import { db, storage } from '@/services/firebase';

const migrationPromises = new Map<string, Promise<string | null>>();

function normalizeImageUri(imageUri?: string | null): string | null {
  const trimmed = imageUri?.trim();
  return trimmed ? trimmed : null;
}

function getUriScheme(imageUri: string): string | null {
  const match = /^([a-z0-9.+-]+):/i.exec(imageUri);
  return match?.[1]?.toLowerCase() ?? null;
}

function getFileExtension(imageUri: string): string {
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(imageUri);
  const extension = match?.[1]?.toLowerCase();
  return extension ? extension.slice(0, 5) : 'jpg';
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
  return !!normalized && !isHostedPlantImageUri(normalized);
}

export function getRenderablePlantImageUri(imageUri?: string | null): string | null {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) return null;
  if (Platform.OS === 'web' && isLocalOnlyPlantImageUri(normalized)) {
    return null;
  }
  return normalized;
}

export async function uploadPlantImageUri(
  plantId: string,
  imageUri: string,
): Promise<string> {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) {
    throw new Error('Plant image URI is empty.');
  }

  if (isHostedPlantImageUri(normalized)) {
    return normalized;
  }

  const filename = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${getFileExtension(
    normalized,
  )}`;
  const storageRef = ref(storage, `plantImages/${plantId}/${filename}`);
  const response = await fetch(normalized);

  if (!response.ok) {
    throw new Error(`Failed to load plant image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const upload = uploadBytesResumable(storageRef, blob);
  const timeout = setTimeout(() => upload.cancel(), 25000);
  try {
    await upload;
  } finally {
    clearTimeout(timeout);
  }
  return getDownloadURL(storageRef);
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
      const uploadedImageUri = await uploadPlantImageUri(plantId, normalized);
      await updateDoc(doc(db, 'plants', plantId), {
        imageUri: uploadedImageUri,
        updatedAt: serverTimestamp(),
      });
      return uploadedImageUri;
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
