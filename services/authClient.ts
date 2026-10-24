import { connectAuthEmulator, getAuth } from 'firebase/auth';
import Constants from 'expo-constants';
import { app } from './firebase';
export const auth = getAuth(app);
if (Constants.expoConfig?.extra?.USE_FIREBASE_EMULATORS) {
  const host = Constants.expoConfig.extra.FIREBASE_AUTH_EMULATOR_HOST.replace(/^127\.0\.0\.1:/, 'localhost:');
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
}
