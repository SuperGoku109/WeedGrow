# WeedGrow

WeedGrow is a grow/plant tracking mobile app built with Expo (React Native).
Data and compact photos are stored in Firebase Firestore, with optional weather lookups via
OpenWeatherMap.

## Domain Overview

The mobile app's core data model (see `firestoreModels.ts`) centers around "plants" and grow
activities:

- Plants track fields like `name`, `strain`, `growthStage` (germination/seedling/vegetative/flowering),
  `environment` (outdoor/greenhouse/indoor), and optional metadata (pot size, watering frequency, pests,
  training tags, notes, location, etc.).
- Plant logs capture events like watering, fertilizing, training, stage changes, photos, and harvest.

## Repo Layout

Primary app: repo root (Expo app using Expo Router for iOS/Android/Web).

## Project Status (Verified)

- The Expo app is the primary app in this repo. It reads/writes Firestore collections like `plants`, `groups`,
  and `sensorProfiles`.
- Authentication is not wired up yet (no Firebase Auth usage in app code). Some writes currently use placeholder
  IDs like `demoUser` (for example: plant `owners` and group `createdBy`).

## Prerequisites

- Node.js + npm (this workspace is currently being developed with Node `v22.19.0` / npm `10.9.3`).
  - TODO: Document the minimum supported Node version.
- For native builds:
  - Android: Android Studio + JDK are required for `npm run android`.
  - iOS: Xcode is required for `npm run ios`.
  - TODO: Document exact versions and setup steps.

## Quick Start

### Mobile App (Expo)

```bash
npm install
npm start
```

Useful commands (see `package.json`):

```bash
npm run android
npm run ios
npm run web
npm run lint
npm run typecheck
```

Optional helper (PowerShell on Windows):

```powershell
.\scripts\dev.ps1 start
.\scripts\dev.ps1 lint
.\scripts\dev.ps1 typecheck
```

## Environment Variables

### App (.env)

The app loads environment variables from `.env` via `app.config.js` and exposes
them to the runtime via `expo.extra` (read in `services/firebase.ts`).

Required keys (see `app.config.js`):

```bash
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...

# Used by lib/weather/fetchWeather.ts
OPENWEATHERMAP_API_KEY=...
```

See `.env.example` for a template (do not commit secrets).

## Firestore Data Model

Source of truth for app-facing types:

- `firestoreModels.ts`
- `CONTEXT.md` (schema overview + query notes; TODO: keep in sync with the code/types)

Collections used by the mobile app code today:

- `plants/{plantId}`
  - `logs/{logId}`
  - `weatherCache/{YYYY-MM-DD}` (doc IDs are dates)
  - `progressPics/{picId}`
- `groups/{groupId}`
- `sensorProfiles/{sensorProfileId}`

Other collections/types exist in `firestoreModels.ts` (for example: `users`, `notifications`,
`analytics`, `invites`), but there is currently no mobile app code that reads/writes them.
TODO: Confirm which of these are planned vs should be removed or implemented.

## Where To Look (Humans + AI)

- Mobile routes: `app/` (Expo Router file-based routing)
- Mobile feature modules: `features/`
- Shared mobile UI: `ui/` and `components/ui/`
- Mobile import alias: `@/` maps to the repo root (see `tsconfig.json`)
- Firebase client (mobile): `services/firebase.ts`
- Weather logic: `lib/weather/`
- Log utilities: `lib/logs/`
- Progress photo uploads: `lib/progressPics/uploadProgressPic.ts`

## Photos without a paid Storage plan

New photos use Firestore's Spark quota, without Firebase Storage or a billing upgrade.
`lib/plants/preparePlantPhoto.ts` generates aspect-preserving JPEGs up to 960 pixels
and 180 KiB encoded, plus thumbnails up to 240 pixels and 20 KiB encoded. Originals
are not retained. This is intended for a small personal grow journal, not a large
or full-resolution photo archive; database storage and read quotas still apply.

Photo bytes live in `plants/{plantId}/photoAssets/{assetId}`. Plant and gallery
records contain a `firestore-photo:` reference only. Saves commit the metadata,
image and thumbnail atomically. `ui/PlantImage.tsx` loads thumbnails by default,
full images on request, and deduplicates reads with a bounded cache. Existing
HTTPS image links remain supported, but this does not restore access to files
in a Firebase Storage bucket blocked by billing.

Firestore rules must authorize the plant's photoAssets subcollection under the
same ownership policy as its other data. Do not make storage or database rules
public to enable photos. A future object-storage implementation can replace the
photo repository without changing plant/journal screens.

## Firestore Admin Scripts (Optional)

These scripts use the Firebase Admin SDK and require a service account key JSON file.
The repo ignores this file on purpose.

- Put your service account JSON at: `serviceAccountKey.json`

Seed example data:

```bash
node seedFirestore.js
```

TODO: `seedFirestore.js` currently updates a plant's `sensorProfileId` before `plantId` is defined.
Verify/fix before relying on it.

Delete all plants and their subcollections (`logs`, `weatherCache`, `progressPics`):

```bash
node scripts/deleteAllPlantsAndSubcollections.js
```

Warning: These scripts can modify/delete real Firestore data. Use a test Firebase project unless you are sure.

## License

TODO: Choose a license.
