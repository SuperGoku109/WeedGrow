import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const MAX_PHOTO_LENGTH = 180 * 1024;
export const MAX_THUMBNAIL_LENGTH = 20 * 1024;

/** Bounded JPEGs keep each asset well below Firestore's 1 MiB document limit. */
export async function preparePlantPhoto(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  try {
    const original = await context.renderAsync();
    const { width, height } = original;
    original.release();
    if (!(width > 0 && height > 0)) throw new Error('Invalid photo dimensions.');
    const encode = async (edges: number[], maxLength: number) => {
      for (const edge of edges) {
        const scale = Math.min(1, edge / Math.max(width, height));
        context.reset().resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) });
        const image = await context.renderAsync();
        try {
          const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
          if (!result.base64) throw new Error('Photo could not be encoded.');
          const dataUri = 'data:image/jpeg;base64,' + result.base64;
          if (dataUri.length <= maxLength) return dataUri;
        } finally { image.release(); }
      }
      throw new Error('This photo is too detailed. Choose a smaller photo.');
    };
    return {
      image: uri.startsWith('data:image/jpeg;base64,') && uri.length <= MAX_PHOTO_LENGTH ? uri : await encode([960, 720, 480, 320], MAX_PHOTO_LENGTH),
      thumbnail: await encode([240, 160, 100], MAX_THUMBNAIL_LENGTH),
    };
  } finally { context.release(); }
}
