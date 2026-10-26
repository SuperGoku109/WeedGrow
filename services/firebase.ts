import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { readFirebaseConfiguration } from './firebaseConfig';
const config = readFirebaseConfiguration(Constants.expoConfig, Constants.manifest);
export const app = initializeApp(config.firebase);
export const db = getFirestore(app);
if (config.emulator) {
  const [host, port] = config.firestoreHost.split(':');
  connectFirestoreEmulator(db, typeof window !== 'undefined' && host === '127.0.0.1' ? 'localhost' : host, Number(port));
}
export const storage = getStorage(app);
