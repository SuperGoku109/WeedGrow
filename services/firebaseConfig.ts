import { isRecord } from '@/lib/data/recordDecoders';
import type { FirebaseOptions } from 'firebase/app';
export function readFirebaseConfiguration(modern: unknown, legacy: unknown) {
  const config = isRecord(modern) && isRecord(modern.extra) ? modern : legacy;
  const extra = isRecord(config) && isRecord(config.extra) ? config.extra : {};
  const field = (key: string, required = false) => { const value = extra[key]; if (value == null && !required) return undefined; if (typeof value !== 'string' || !value.trim()) throw new Error(`App configuration ${key} is missing or invalid.`); return value; };
  const firebase: FirebaseOptions = { apiKey: field('FIREBASE_API_KEY', true), projectId: field('FIREBASE_PROJECT_ID', true), authDomain: field('FIREBASE_AUTH_DOMAIN'), storageBucket: field('FIREBASE_STORAGE_BUCKET'), messagingSenderId: field('FIREBASE_MESSAGING_SENDER_ID'), appId: field('FIREBASE_APP_ID'), measurementId: field('FIREBASE_MEASUREMENT_ID') };
  const emulator = extra.USE_FIREBASE_EMULATORS === true;
  const firestoreHost = emulator ? field('FIRESTORE_EMULATOR_HOST', true)! : '';
  if (emulator && !/^[a-zA-Z0-9.-]+:\d{1,5}$/.test(firestoreHost)) throw new Error('The local Firestore host is invalid.');
  return { firebase, emulator, firestoreHost };
}
