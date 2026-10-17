import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { preparePlantPhoto } from './preparePlantPhoto';

const PREFIX = 'firestore-photo:';
const PATH = /^plants\/[^/]+\/photoAssets\/[^/]+$/;
export function isStoredPhoto(uri: string) { return uri.startsWith(PREFIX) && PATH.test(uri.slice(PREFIX.length)); }

// Preparation has no remote side effects. Callers commit these records together
// with their plant/gallery metadata, so failed saves never leave orphan photos.
export async function preparePhotoRecord(plantId: string, uri: string) {
  if (isStoredPhoto(uri) || /^https?:\/\//i.test(uri)) return { uri, writes: [] };
  const photo = await preparePlantPhoto(uri);
  const imageRef = doc(collection(db, 'plants', plantId, 'photoAssets'));
  const thumbnailRef = doc(db, 'plants', plantId, 'photoAssets', imageRef.id + '_thumb');
  return {
    uri: PREFIX + imageRef.path,
    writes: [
      { ref: imageRef, data: { dataUri: photo.image } },
      { ref: thumbnailRef, data: { dataUri: photo.thumbnail } },
    ],
  };
}

// Deduplicate concurrent reads and bound memory. Failed reads remain retryable.
const cache = new Map<string, Promise<string>>();
export function loadPhoto(uri: string, fullSize = false): Promise<string> {
  if (!isStoredPhoto(uri)) return Promise.resolve(uri);
  const path = uri.slice(PREFIX.length) + (fullSize ? '' : '_thumb');
  const cached = cache.get(path);
  if (cached) { cache.delete(path); cache.set(path, cached); return cached; }
  const request = getDoc(doc(db, path)).then(snapshot => {
    const dataUri = snapshot.data()?.dataUri;
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/jpeg;base64,')) throw new Error('Photo unavailable.');
    return dataUri;
  }).catch(error => { if (cache.get(path) === request) cache.delete(path); throw error; });
  cache.set(path, request);
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return request;
}
