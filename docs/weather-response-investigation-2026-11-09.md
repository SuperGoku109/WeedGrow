# Repeated temperatures investigation

**Follow-up:** deeper cross-location tests now show the configured key returns full forecasts for Berlin and Sydney but fails at all four sampled South African areas. General One Call access works. See [the deeper investigation](weather-provider-deep-investigation-2026-11-09.md) for the matrix, live Open-Meteo tests and recommendation.

Read-only provider checks on 9 November 2026 used the existing configured key and Milkshake's saved Somerset West pin. Keys and full URLs containing credentials were not logged. The user clarified that the phone's Somerset West forecast was a 32°C high and 16°C low; 34°C/14°C was for Brackenfell. This investigation does not independently verify either phone forecast.

## Evidence

- The saved current-day weather had current temperature 11.79°C, and the same 11.79°C in all six daily temperature fields.
- A fresh One Call 3.0 request returned HTTP 200 with precisely that repeated data: one daily row and one hourly row. The parser/UI were reproducing the response, rather than accidentally copying a current scalar into each daily field.
- A separate OpenWeather Current Weather request at the same pin returned 25.08°C, humidity 28%, with its own observation timestamp.
- OpenWeather's 5-day/3-hour forecast endpoint returned HTTP 200 with an empty list. This was a diagnostic request only; that endpoint was not added to app refreshes.
- These observations identify incomplete/inconsistent weather input. They do not establish an account/subscription cause or prove that the phone's daily forecast is correct.

## Implemented handling

The client detects the narrow repeated-point shape (one daily row, at most one hourly row, all six daily temperatures equal to current, and any hourly temperature also equal). Equal temperatures with a genuine multi-hour timeline do not trigger rejection. When this shape is detected, the app requests current conditions from the same provider's Current Weather endpoint. It discards the unusable daily/hourly rows, records `repeated_point_forecast`, and caches the limited current result normally. A failed fallback does not save the repeated forecast as a successful refresh.

Daily temperatures, UV, dew point, rain probability and nighttime humidity that the fallback does not provide stay unknown. In particular, Current Weather's `temp_min`/`temp_max` are not repurposed as daily forecast extrema. See [OpenWeather Current Weather documentation](https://openweathermap.org/api/current).

The shared parser also rejects the original repeated-point response if called directly, so backend collection cannot silently store that shape as a valid daily forecast. A schema marker causes existing client display caches to refresh once; raw cached repeated responses are ignored. Daily array position no longer determines whether a record is observed: only matching current-observation dates merge with today's forecast.

The UI distinguishes observed conditions and forecast segments, displays the observation time, leaves unavailable fields as dashes, and explains the limited response with a selectable diagnostic code. Historical journal weather is not rewritten. The existing interactive water calculation continues to use the explicitly labelled manual ET0/rain experiment.

## Verification and remaining gap

Live UI verification showed 25.1°C observed conditions and unavailable daily segments, with the source failure explained. Regression cases cover the exact reported response, normal distinct segments and 32°C/16°C daily extrema, legitimate flat multi-hour forecasts, next-day daily[0], current-only fallback, cache reuse and rejection of old bad cache entries. Full verification passed application/backend types, backend build, lint, architecture, 114 suites / 898 tests, and isolated Firebase emulator integration/ownership checks.

The remaining gap is a usable daily forecast response from the provider. No valid source for the claimed 32°C/16°C range was returned in these checks. No provider switch, billing change, subscription change or deployment was performed. Normal weather refreshes may make one additional Current Weather call only when One Call returns the rejected shape; cached fallback responses are reused for 30 minutes.
