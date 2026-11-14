# Install BudBuddy on Android

This uses an Android APK installed directly on your phone. It does not publish
BudBuddy to the Play Store or create a public website. The first APK is built
once with Expo Application Services (EAS). Compatible JavaScript and asset
changes merged to `main` are then sent to the installed app through EAS Update.
Native dependency, permission, or SDK changes need a new APK build.

## One-time setup

1. Create or sign in to a free Expo account at https://expo.dev.
2. From the project directory, run `npx eas-cli login`, then
   `npx eas-cli init`. This creates and links the EAS project. Copy its project
   ID into your local `.env` as `EXPO_PROJECT_ID=...`.
3. Run `npx expo prebuild --platform android --no-install` to enable Expo Update
   in the checked-in Android project, then `npm run android:preview` to build
   the first APK. EAS will create an Android signing key for this app.
4. In Expo project settings, turn off **Unauthenticated access to internal
   builds**. That makes the APK download page require an authorized Expo login.
5. Create an Expo access token at https://expo.dev/settings/access-tokens and
   add it to the GitHub repository as the Actions secret `EXPO_TOKEN`.
6. Add the EAS project ID to GitHub repository **Variables** as
   `EXPO_PROJECT_ID` (it is an identifier, not a password).
7. Add the Firebase client configuration values from your local `.env` to GitHub
   Actions **Secrets**: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`,
   `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`,
   `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, and
   `FIREBASE_MEASUREMENT_ID`. Add `OPENWEATHERMAP_API_KEY` if weather lookups
   should be available in the phone build.
8. Open the completed EAS build page on the Android phone and install the APK.

## Automatic updates

The `Publish Android preview update` GitHub workflow runs on pushes to `main`.
After the required Expo and Firebase GitHub values are set, it publishes a
compatible OTA update to the `preview` channel. Open the app with internet access
to download it; it is applied after the app restarts. If the workflow skips the
publish step, check its notice for missing GitHub values.

The app still uses Firebase Authentication and account-scoped Firestore rules.
An installed app is not a substitute for backend access controls; never make
Firestore rules public. Expo's free EAS plan has monthly build and update limits.
On the free plan, reaching a limit pauses further builds or updates until the
quota resets rather than creating usage overage charges.
