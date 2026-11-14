# Phone preview from GitHub

BudBuddy can be opened as a hosted web app on a phone. Firebase Hosting serves it
independently of the development PC. A successful push to `main` builds the Expo
web app and publishes it to the same live URL; opening or refreshing that URL loads
the latest deployed version. This is a web app shortcut, not an App Store or Play
Store install. It needs an internet connection and browser-supported features.

## One-time setup

1. In the Firebase console for project `weed-grow`, enable **Hosting** and confirm
   the app's Firebase Authentication sign-in provider is enabled. The app needs
   the configured Firebase client values at build time.
2. In GitHub repository settings, add Actions secrets with the names used by
   `.github/workflows/deploy-web.yml`:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`,
   `FIREBASE_MEASUREMENT_ID`, and `OPENWEATHERMAP_API_KEY` (if weather is wanted).
   These should match the local `.env` values. The Firebase web config is client
   configuration and is visible in a browser bundle; Firestore security rules and
   Firebase Authentication must continue to protect user data.
3. Create a Firebase Hosting deploy service account and save its JSON key as the
   GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_WEED_GROW`. Give it only the
   permissions needed to deploy Hosting. Never commit the key to the repository.
4. Push this workflow and the Hosting config to `main`. The workflow will build
   and deploy the site. Firebase's default public site URL is
   `https://weed-grow.web.app` (or `https://weed-grow.firebaseapp.com`).
5. Open the URL on the phone and use the browser's **Add to Home Screen** or
   **Install app** action. Share the URL with people you want to show it to.

For a simpler credential setup, Firebase CLI's `firebase init hosting:github`
can create the repository's deploy service-account secret. If you use that flow,
keep this workflow as the only live deploy workflow to avoid duplicate deploys.

## Updating it

Push or merge a change to `main`. GitHub Actions exports the web build and deploys
it to Firebase Hosting. The phone does not need to be near the PC or connected to
the development server. If the browser kept an old tab open, reload it to fetch
the latest deployment.

Changes that need native device APIs or native modules may not work on the web
version. Those cases need a separate native phone build. The web build should be
checked on the target phone before relying on device-specific features such as
camera capture, notifications, or location.
