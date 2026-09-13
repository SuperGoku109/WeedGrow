import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/services/firebase';
import { cacheDirectory, copyAsync } from 'expo-file-system/legacy';

/**
 * Uploads a progress picture to Firebase Storage and saves metadata to Firestore.
 * @param plantId Plant ID
 * @param fileUri Local file URI
 * @param caption Optional caption
 * @returns The Firestore document reference
 */
export async function uploadProgressPic(plantId: string, fileUri: string, caption?: string) {
  try {
    let localUri = fileUri;
    // If Android content URI, copy to cache as file://
    if (localUri.startsWith('content://')) {
      if (!cacheDirectory) {
        throw new Error('FileSystem cacheDirectory is unavailable on this platform.');
      }
      const fileName = `${Date.now()}_progresspic.jpg`;
      const destPath = `${cacheDirectory}${fileName}`;
      await copyAsync({ from: localUri, to: destPath });
      localUri = destPath;
    }
    const filename = `${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
    const storageRef = ref(storage, `progressPics/${plantId}/${filename}`);

    // Fetch the file as a blob
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();

    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    // Save metadata to Firestore
    const docRef = await addDoc(collection(db, 'plants', plantId, 'progressPics'), {
      imageUrl: downloadUrl,
      timestamp: serverTimestamp(),
      caption: caption || '',
    });
    return docRef;
  } catch (err) {
    console.error('uploadProgressPic error:', err);
    throw err;
  }
}
