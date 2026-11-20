import { Platform } from 'react-native';

function normalizeImageUri(imageUri?: string | null): string | null {
  const trimmed = imageUri?.trim();
  return trimmed ? trimmed : null;
}

function getUriScheme(imageUri: string): string | null {
  const match = /^([a-z0-9.+-]+):/i.exec(imageUri);
  return match?.[1]?.toLowerCase() ?? null;
}

function isLocalOnlyPlantImageUri(imageUri?: string | null): boolean {
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

export function getRenderablePlantImageUri(imageUri?: string | null): string | null {
  const normalized = normalizeImageUri(imageUri);
  if (!normalized) return null;
  if (Platform.OS === 'web' && isLocalOnlyPlantImageUri(normalized)) {
    return null;
  }
  return normalized;
}
