# Backend deployment attempt — 6 November 2026

User explicitly requested deployment to the running app's Firebase project, `weed-grow`.

## Deployed successfully

`firebase deploy --only "firestore:rules,firestore:indexes" --project weed-grow --non-interactive` completed successfully. Firebase compiled and released the rules and deployed the index definitions. A subsequent live read reported four composite indexes and 15 field overrides. The pre-existing ascending log timestamp index was preserved, not deleted; it is now also represented locally. No `--force` deletion was used.

## Functions blocked by billing

Firebase reports that `weed-grow` must be upgraded to **Blaze (pay-as-you-go)** before the required Artifact Registry and Secret Manager APIs can be enabled. Functions deployment preflight completed local typechecking/build, then stopped at that provider restriction. The repeatable deployment command also stopped at Secret Manager metadata checking, before uploading any secret or creating a function.

Final read-only inventory still reports **zero deployed functions**. The user must enable billing using [the project's usage/billing page](https://console.firebase.google.com/project/weed-grow/usage/details). No billing account was created/linked and no plan upgrade was performed by the agent. This restriction is consistent with [Firebase's deployment requirements](https://firebase.google.com/docs/functions/manage-functions).

## Prepared for continuation

- Added the missing `functions` section and predeploy typecheck/build hooks to `firebase.json`.
- Set all four function exports to `africa-south1`, matching the existing Firestore database location (Johannesburg).
- Confirmed the Node 22 prebuilt bundle exists and its four exported endpoints declare the expected region/triggers.
- Added empty `gcp-build` so the cloud buildpack uses the prebuilt bundle rather than rerunning a local build that depends on parent-repository TypeScript sources. See [Node runtime build behavior](https://docs.cloud.google.com/run/docs/runtimes/nodejs).
- Added `npm run deploy:care`. It targets only `weed-grow`, removes emulator flags from the child environment, checks secret **metadata** first, and only creates a missing weather secret by piping the existing local key to the official Firebase CLI's stdin. It does not print the key, write a key temporary file, rotate an existing secret, upgrade billing, use `--force`, or deploy Hosting.

After Blaze is enabled, rerun `npm run deploy:care`, verify all function deployments, then check scheduled maintenance/initial evaluation for existing plants. Further IAM/provider prerequisites may still be reported by Firebase after the billing restriction is removed; live function success cannot be claimed before that attempt.

Protected weather/watering policies and genuine approved hops profiles are still separate configuration requirements. No synthetic profile or made-up scientific approval was installed. Deploying functions alone does not guarantee a determinate watering recommendation.

## Checks

Backend typecheck and build passed after the region change; all four exported endpoint regions/triggers were inspected locally. Deployment helper syntax/lint, deployment manifest/entrypoint checks and `git diff --check` passed. The prior full algorithm/application gate passed 110 suites / 860 tests plus Firebase integrations; this deployment increment changed deployment/package configuration, preserved an existing index and set endpoint region, without altering care calculations.
