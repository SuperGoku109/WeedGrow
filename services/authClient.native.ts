import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { app } from './firebase';
import Constants from 'expo-constants';

// Metro selects Firebase's RN entry point, which includes this export. The web
// declaration omits it, so describe the platform-specific signature explicitly.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence(storage: typeof AsyncStorage): FirebaseAuth.Persistence;
};
function initialize() {
  try { return FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return FirebaseAuth.getAuth(app);
    throw error;
  }
}
export const auth = initialize();
if (Constants.expoConfig?.extra?.USE_FIREBASE_EMULATORS) FirebaseAuth.connectAuthEmulator(auth, `http://${Constants.expoConfig.extra.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
