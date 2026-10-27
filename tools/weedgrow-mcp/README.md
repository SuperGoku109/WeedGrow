# WeedGrow MCP Server (Emulator-Only)

Minimal MCP server for WeedGrow that exposes three tools for Codex:

- `emulatorResetAndSeed(profile?)`
- `describeCollection(collection, sample?)`
- `runQuery(input)`

This server **refuses to run** unless `FIRESTORE_EMULATOR_HOST` is set to a local host (for example, `127.0.0.1:8080`) without any protocol.

## Prereqs
- Node.js `>=18.19.0`
- Firebase CLI (`firebase`)
- Firebase Emulator Suite

## Environment Variables
Required:
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` (no `http://` or `https://`)

Optional:
- `WEEDGROW_MCP_HOST=127.0.0.1`
- `WEEDGROW_MCP_PORT=8787`
- `WEEDGROW_EMULATOR_STATE_DIR=<repo>/.firebase-emulator/state`
- `WEEDGROW_SEED_PROFILE=full` (or `lite`)
- `WEEDGROW_MCP_ENV_FILE=<absolute path to .env>`

If you use the Auth emulator in other scripts, set:
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`

### Loading `.env`
This MCP package auto-loads a `.env` file at startup (first match wins):
1. `WEEDGROW_MCP_ENV_FILE` if provided
2. `tools/weedgrow-mcp/.env`
3. `<repo>/.env`
4. `<repo>/WeedGrowApp/.env`

If you changed `.env`, restart the MCP server and re-run any seed command.

## Start Emulators
From repo root:

```bash
firebase emulators:start --only firestore --project your-project-id --import .firebase-emulator/state --export-on-exit .firebase-emulator/state
```

Suggested ports:
- Firestore: `8080`
- Auth (if used): `9099`

## Quick Start (Fresh System)
1. Install Node.js (LTS) and verify `node -v` and `npm -v` work.
2. Install JDK 21 and verify `java -version` works.
3. Install Firebase CLI:
   `npm install -g firebase-tools`
4. From repo root:
   `C:\Users\Zane\dev\WeedGrow`
   run `firebase init` and `firebase init emulators` (select Firestore, port 8080).
5. Start emulator from repo root (Terminal A):
   `firebase emulators:start --only firestore --project your-project-id`
6. In Terminal B, set env vars for MCP server (or put them in `.env` as described above):
   `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
   `GOOGLE_CLOUD_PROJECT=your-project-id`
7. From `tools/weedgrow-mcp` (Terminal B):
   `npm install`
   `npm run dev`
8. Verify MCP server health:
   `http://127.0.0.1:8787/health` should return `ok`.
9. Verify emulator UI:
   `http://127.0.0.1:4000/` should load the Emulator UI.

## Your Current Setup (Documented)
You reported:
- JDK 21 installed and `java -version` works.
- Firestore emulator running on `127.0.0.1:8080` and Emulator UI on `http://127.0.0.1:4000/`.
- MCP server running via `npm run dev` and listening on `http://127.0.0.1:8787/mcp`.
- Environment variables set in `WeedGrowApp/.env` (auto-loaded by this MCP package).
If any of these change, re-run the Quick Start above.

## Seed Emulator Data
From `tools/weedgrow-mcp`:

```bash
npm install
npm run build
npm run seed:emulator
```

You can run the TypeScript seed directly during development:

```bash
npm run seed:emulator:dev
```

What the seed does:
- Connects to the Firestore emulator only (refuses to run without `FIRESTORE_EMULATOR_HOST`).
- Default profile is `full`, which seeds a realistic dataset that matches your app schema:
  - `users/demo_user_zane` and `users/demo_user_friend`
  - user settings: `users/{userId}/settings/preferences`
  - `plants/plant_demo_northern_lights` and `plants/plant_demo_amnesia_haze`
  - `plants/{plantId}/logs/{autoId}`
  - `plants/{plantId}/weatherCache/{YYYY-MM-DD}`
  - `plants/{plantId}/progressPics/{autoId}`
  - `sensorProfiles/sensor_demo_tent`
  - `groups/group_demo_main_tent`
  - `notifications/{userId}`
  - `analytics/{userId}_year_2025`
  - `invites/invite_demo_1`
- If you want a minimal dataset, set `WEEDGROW_SEED_PROFILE=lite`.

Edit the seed behavior in `tools/weedgrow-mcp/src/seedEmulator.ts`.

## Run MCP Server
From `tools/weedgrow-mcp`:

```bash
npm run build
npm start
```

Or for live-reload:

```bash
npm run dev
```

The server listens on `http://127.0.0.1:8787/mcp` by default.

## Connect Codex
Codex reads MCP servers from a `config.toml` file. You can scope it to this project in `.codex/config.toml` or use `~/.codex/config.toml` globally. Example snippet is provided in the main response.

## Connect VS Code Workspace
Add `.vscode/mcp.json` (example snippet provided in the main response).

## Common Errors
- `FIRESTORE_EMULATOR_HOST` includes `http://`:
  - Fix: use `127.0.0.1:8080` (no protocol).
- Emulator not running:
  - Fix: start emulators with `firebase emulators:start`.
- Project ID mismatch:
  - Fix: ensure the emulator `--project` matches `GOOGLE_CLOUD_PROJECT` or set `FIREBASE_PROJECT_ID`.
- MCP server running but tools fail:
  - Fix: make sure `FIRESTORE_EMULATOR_HOST` is set in the same terminal that started the MCP server.
- Seed script says `FIRESTORE_EMULATOR_HOST is required`:
  - Fix: put `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` in `WeedGrowApp/.env` or set it in the terminal before running the seed.

## Tool Notes
- `emulatorResetAndSeed` deletes only `.firebase-emulator/state` by default and then runs `npm run seed:emulator`.
- `describeCollection` samples up to 200 docs and infers dot-paths, types, presence, and enum-like strings.
- `runQuery` supports safe operators and structured values like timestamps, GeoPoints, and document references.
