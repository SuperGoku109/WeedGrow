# Install BudBuddy on Android

This uses an Android APK installed directly on your phone. It does not publish
BudBuddy to the Play Store or create a public website. The first APK is built
once with Expo Application Services (EAS). Compatible JavaScript and asset
changes merged to `main` are then sent to the installed app through EAS Update.
Native dependency, permission, or SDK changes need a new APK build.

## One-time setup

1. Make sure the local `.env` file has the Firebase values listed in
   `.env.example`, and set `USE_FIREBASE_EMULATORS=false`. Do not commit `.env`.
2. Create or sign in to a free Expo account at https://expo.dev. From this repo,
   run `npx eas-cli login`, then verify the account with `npx eas-cli whoami`.
3. Create and link the Expo project with `npx eas-cli init`. This repo uses a
   dynamic `app.config.js`, so EAS may print the new project ID without writing
   it into the config. Add the ID to the local `.env` as
   `EXPO_PROJECT_ID=<project-id>`, then run
   `npx eas-cli init --id <project-id>` and confirm with
   `npx eas-cli project:info`.
4. In the Expo project settings, turn off **Unauthenticated access to internal
   builds** before building. The build download page will then require an
   authorized Expo account.
5. In the Expo dashboard, open the **BudBuddy** project (`@supergoku109/budbuddy`)
   and go to **Environment variables**. Create these variables in the **preview**
   environment. Use **Plain text** visibility, and copy values from the local
   `.env` file except where a value is specified below:
   - `EXPO_PROJECT_ID`: the project ID printed by `npx eas-cli init`.
   - `USE_FIREBASE_EMULATORS`: `false`.
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
     `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`,
     and `FIREBASE_MEASUREMENT_ID`.
   - `OPENWEATHERMAP_API_KEY` if weather lookups are used.
   Do not add `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST`; those
   are only used in emulator mode. Firebase client settings are included in the
   app bundle and are not admin credentials.
6. In the Expo dashboard, create an access token at
   https://expo.dev/settings/access-tokens. In GitHub, open this repo's
   **Settings → Secrets and variables → Actions** and add:
   - Secret `EXPO_TOKEN`: the Expo access token.
   - Variable `EXPO_PROJECT_ID`: the EAS project ID.
   - Secrets `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
     `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`,
     and `FIREBASE_MEASUREMENT_ID`: copy these values from the local `.env`.
     Add secret `OPENWEATHERMAP_API_KEY` if you want weather lookups.
7. Apply Expo Update settings to the existing Android project:
   `npx expo prebuild --platform android --no-install`. Review the Android file
   changes; do not use the `--clean` option.
8. Build the installable APK with `npm run android:preview`. If EAS asks about
   Android signing credentials, choose the option to create a new keystore and
   keep it with this Expo project.
9. Open the completed build page on your Android phone while signed in to the
   same Expo account, download the APK, and install it. Android may ask you to
   allow the browser to install apps from this source; allow it for the install.

## Automatic updates

After the first APK is installed, open GitHub's **Actions** tab and run
**Publish Android preview update** once using **Run workflow**. Confirm the run
succeeds, then open and restart BudBuddy while the phone has internet access.
After that, each change merged to `main` publishes a compatible update to the
`preview` channel. The app downloads it on launch and applies it after restart.
If the workflow skips publishing, its notice lists missing GitHub values.

This project uses a manually managed runtime version because its Android native
project is committed. For native dependency, permission, or SDK changes, change
`runtimeVersion` in `app.config.js`, rebuild with `npm run android:preview`, and
install the APK over the existing app. JavaScript and asset changes that remain
compatible can use the GitHub-triggered update.

The app still uses Firebase Authentication and account-scoped Firestore rules.
An installed app is not a substitute for backend access controls; never make
Firestore rules public. Expo's free EAS plan has monthly build and update limits.
On the free plan, reaching a limit pauses further builds or updates until the
quota resets rather than creating usage overage charges.
