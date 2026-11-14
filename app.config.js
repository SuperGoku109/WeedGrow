// app.config.js
import "dotenv/config"; // loads .env into process.env

const easProjectId = process.env.EXPO_PROJECT_ID;

export default {
  expo: {
    name: "BudBuddy",
    slug: "budbuddy",
    version: "1.0.0",
    // This repo commits its native Android project, so runtime versions must be managed manually.
    // Bump this value and rebuild the native app whenever native code/config changes.
    runtimeVersion: "1.0.0",
    ...(easProjectId
      ? {
          updates: {
            url: `https://u.expo.dev/${easProjectId}`,
            checkAutomatically: "ON_LOAD",
            fallbackToCacheTimeout: 0
          }
        }
      : {}),
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: ["budbuddy", "weedgrowapp"],
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.zg.weedgrow",
      googleServicesFile: "./android/google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      name: "BudBuddy",
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-updates",
      "expo-notifications",
      "expo-document-picker",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
      USE_FIREBASE_EMULATORS: process.env.USE_FIREBASE_EMULATORS === 'true',
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
      OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,

    }
  }
};
