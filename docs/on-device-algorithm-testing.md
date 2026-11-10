> Automatic care now uses the [observation-driven outdoor engine](outdoor-intelligence-refactor.md). The reserve and weather-only rules described below are retained research/manual testing references, not the automatic recommendation path.

# On-device algorithm testing

**Automatic care update:** normal care now derives an experimental profile from saved plant details and runs with Open-Meteo weather and journal records automatically. No preset or technical input is required. See [automatic care estimates](automatic-care-estimates.md) for assumptions and limits. The manual controls described below are available only under **Advanced testing**. See [the integration notes](open-meteo-integration.md) for weather field mappings and uncertainty.

**Practical advice update:** automatic care also applies hot/dry-spell, recent-watering and recent-soaking-rain rules. It can recommend watering from weather and journal history without proving an exact reserve. Missing pot capacity or starting wetness does not block these rules. Their explanations describe the assumption and the reason to water or wait; exact cutoffs and regression scenarios are documented in the automatic care notes.

Implemented 9 November 2026. The interactive Home and Plant Journal care paths explicitly select local experimental execution. The protected backend reader and worker remain available for later hosting work; local results are rejected by the backend snapshot decoder.

## Try it

Open an active outdoor plant → Journal → Today → **Advanced testing** → Algorithm controls to select **Dry test** or **Rain test**. These actions activate manual overrides. **Use automatic care** restores the normal plant-derived estimate. The existing v8.4 water-bank engine calculates on this device. No deployed Firebase function, billing upgrade, weather release configuration or production watering-profile approval is needed for this experiment.

Open the care note for an explanation and **Show diagnostic details** for starting reserve, forcing assumptions, replay start, included journal count, estimated reserve bounds and the action threshold. If rain reception is unknown, the engine preserves zero-to-full rain bounds; the rainy preset can correctly produce an uncertain decision.

Change ET0, rain, starting reserve or extra simulated water and select **Apply and recalculate**. **Edit profile parameters** exposes capacity, threshold, demand area, catchment area and retention. Presets reset the replay start to 24 hours ago. Changing replay hours resets it to that many hours ago. Otherwise applying edits preserves the start. Replay is limited to 14 days; reset the start when the window expires. Results expire after five minutes; use **Refresh care advice** to recalculate. Opening a plant, editing watering records, refreshing weather or saving test settings also recalculates.

For a controlled case, turn off **Include recorded watering**. Extra simulated water is applied at evaluation time and is never written to the journal. With journal inclusion enabled, current quantities, corrections and deletions are replayed; missing quantities and date-only timing remain uncertain where they affect the threshold. Failed journal reads and cache-only partial snapshots produce a specific unavailable result, never an assumed empty history.

## Inputs and meaning

- ET0 and rain are **manual constant test rates**, not weather API observations. Partial intervals receive the corresponding fraction of those assumed rates. This intentionally tests the model without claiming to reconstruct missing historical weather.
- Starting reserve and coefficients are explicit engineering assumptions. Defaults are illustrative and are not calibrated hops recommendations. Pot volume still needs an explicit unit in Growing setup. The current plant setup is assumed throughout the test window; this mode does not replay historical setup changes.
- Open-Meteo supplies weather preparation screens and WMO thunderstorm condition codes. Stale/future data cannot create fresh warnings. Manual ET0 and rain do not generate weather warnings. Missing sustained evidence does not imply a mildew diagnosis or hail forecast.
- The underlying bank uses litres: demand = ET0 in mm × demand area in m²; rain = liquid rain in mm × catchment area, bounded by root-zone reception; logged/simulated watering is multiplied by retention. Capacity and operation order apply at each replay interval. It is not equivalent to adding a whole day of rain after a whole day of evaporation. The preset uses the engine's `inputs_first` order.
- A definite result only describes this experiment. There are no new automatic watering notifications, background jobs, actuator commands, production approvals or protected care writes.

## Persistence, cost and boundaries

Test settings are stored per account and plant in AsyncStorage on this device/browser. They do not sync to other devices and are cleared from memory on account reset. Normal journal records remain in the existing Firestore service. Local care makes one journal range query when enabled and including records; it skips the display-weather query. Disabled and journal-excluded tests make no journal query. Cached weather is read without an additional provider request.

No billing or provider subscription was changed. Weather now uses the public Open-Meteo API subject to its non-commercial terms and quotas. The app still uses Firebase for authentication, journals and other saved data. This is interactive testing, not unattended background care.

## Verification

New regression coverage exercises preset outcomes, hand-derived reserve values, partial hours, rain reception bounds, known/unknown/zero/future watering, edits/deletion, ID deduplication, invalid settings, stale weather, moderate wind versus thunderstorm codes, settings isolation/persistence, journal failure, projected screen inputs, local routing, backend snapshot rejection and control input validation. The full verification command is `npm run verify` (types, backend build, lint, architecture, unit/scenario tests and isolated Firebase emulator integration checks).

Live UI checks on Milkshake verified due, uncertain rain reception and not-due after simulated watering. No journal records were changed; the local Dry test preset was left selected.

Final verification: **113 suites / 891 tests passed**, application types and lint passed. The complete `npm run verify` gate also passed backend types/build, architecture checks and all isolated Firebase integration/ownership scenarios. The final cache-only journal guard was followed by another complete unit run plus application types/lint checks.
