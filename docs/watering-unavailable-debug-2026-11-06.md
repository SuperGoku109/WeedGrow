# Live unavailable-estimate investigation — 6 November 2026

## Observed cause

Investigated the user's running Milkshake plant preview using its existing authenticated page. The app is connected to Firebase project `weed-grow` with emulator mode off. A read-only `firebase functions:list --project weed-grow --json` completed successfully and returned an empty function array: **zero deployed functions** at investigation time.

The updated live care diagnostics independently confirmed `server_evaluation_missing`, a missing plant backend revision pointer, no backend evaluation timestamp and eight daily journal-weather entries in the requested read (31 October–7 November, including tomorrow's display entry). Therefore this failure is not evidence that those journal dates have no weather. The newly implemented care backend was local code, not a running deployment in that project. The separate client weather/display path can populate the journal without publishing a canonical watering evaluation.

The previous generic profile-unavailable message misrepresented this particular failure. No profile decision has been evaluated by a backend here; the UI now says so explicitly.

## Changes

- Snapshot inspection returns a typed reason instead of collapsing missing documents, missing pointers, expiry, changed inputs/location, wrong revisions/version, future timestamps, invalid release metadata and malformed payloads into `null` without explanation.
- The data service preserves stable access/network/read failure codes without returning raw SDK messages, request URLs or credentials. The original evaluation/expiry timestamps survive fallback.
- Local fallback reports the actual publication/read status and counts the journal-weather dates it inspected. It does not present placeholder `profile: null` as a confirmed backend profile failure.
- The minimized care card shows its specific explanation. Expanded watering notes include an opt-in **Show diagnostic details** section with selectable reason codes, result source, backend pointer, timestamps, journal date/format information and profile status.
- Genuine history failures carry the affected ET0/rain variable, cause and first unsupported UTC interval. This is diagnostic evidence only; missing input is never filled or reclassified.
- A current protected care estimate is no longer invalidated merely because the independent daily weather-display cache is stale. Its own backend validity/expiry still applies.

## Remaining operational fix

The running Firebase project needs the reviewed care functions/rules/indexes deployed and the appropriate protected source/watering release configuration. Existing plants need an initial evaluation (scheduled maintenance/real input trigger). Real approved hops profiles and adequate canonical source coverage are still necessary for determinate watering guidance. Deploying code alone cannot supply missing validated parameters, and journal daily temperature/RH/rain summaries cannot be substituted as ET0 history.

No cloud function was deployed, release/profile installed or security policy weakened during this investigation. The read-only inventory and observed missing pointer establish the current deployment/publication problem, not the state of a future configured deployment. The app's refresh button rereads current advice; it cannot deploy or configure the missing server process.

## Verification

`npm run verify` passed backend/app types, backend build, lint, architecture, **110 suites / 860 tests**, and Firebase integration/ownership checks. Added regressions cover SDK failure classification/redaction, missing pointer/document, expired snapshots, genuine ET0/rain gaps, journal data present with no backend result, and the diagnostic disclosure UI. The live preview was checked on the named plant; a screenshot was saved in `tmp/watering-diagnostics-preview.png`. `git diff --check` passed.
