# Open-Meteo integration

**Automatic care:** the normal interactive path now derives an experimental profile from saved plant details and includes journal watering automatically. Technical inputs are optional under **Advanced testing**. See [automatic care estimates](automatic-care-estimates.md) for the uncalibrated assumptions and missing-data behavior.

**Accuracy follow-up:** a same-time local comparison found substantial temperature spread between the default and other models. Functional integration is verified; local meteorological accuracy is not. See [the 9 November comparison](weather-accuracy-comparison-2026-11-09.md). No model was changed solely to match a single reading.

Implemented 9 November 2026 for the confirmed non-commercial hobby/community app. The app now requests Open-Meteo directly, without a provider key, paid subscription or hosted worker. Firebase remains the data backend. No cloud deployment or billing change was made.

## Weather data and accuracy

The public Forecast API supplies a bundle with 14 past days and seven forecast days. Native Unix timestamps, units, named timezone and model-grid coordinates are retained. Best Match is explicitly recorded as an unpinned model selection; returned grid estimates are not on-site measurements. The display adapter preserves the native payload for care calculations and makes a separate daily/current display DTO.

| Input | Handling |
| --- | --- |
| Current temperature/RH/dew point/clouds | Provider current model values and valid time; daily values never fill missing current fields. |
| Daily high/low | Provider aggregates using the requested location's named timezone. No current scalar is cloned into extrema. |
| Morning/noon/evening/night | Actual hourly values at local 06:00/12:00/18:00/23:00; unavailable slots remain unknown. |
| Wind/gusts | Explicit `wind_speed_unit=ms`; invalid units quarantine the affected variable. Existing preparation thresholds remain 10 m/s wind or 15 m/s gusts. |
| Rain | Rain plus showers. Current amount retains the provider's short interval (usually 15 minutes); it is not multiplied into an invented hourly observation. Daily totals remain forecasts. |
| Liquid-rain fallback | Total precipitation can replace missing rain components only when the same interval explicitly has zero snowfall. Missing snow or positive snow does not permit that substitution. |
| ET0 | Provider FAO reference evapotranspiration in mm per preceding hour. Missing ET0 is not inferred from temperature alone or replaced with zero. |
| Radiation | Hourly mean W/m² retained in native/canonical samples. It is not an instantaneous radiation or leaf-temperature measurement. |
| UV | Latest supported hourly mean for the current card; daily maximum for daily forecasts. Missing hourly UV is not replaced with the daily maximum. |
| Rain probability | Daily maximum remains forecast context, never actual rainfall or a bank refill. |
| Night RH | Displayed as a forecast-night mean; point RH samples do not create sustained humid exposure, leaf wetness or disease evidence. |
| Thunderstorms | WMO 95/96/97/99 mapped explicitly to thunderstorm context. Ordinary wind/cloud/rain codes cannot become thunderstorm alerts. Hail-coded context is not a confirmed injury or a regional official alert. |
| Other unavailable fields | Stay unknown independently. Valid daily extrema survive missing noon/RH/wind details. Bad axes fail clearly; misaligned arrays and wrong units do not silently zip to other hours. |

The UI includes source attribution and identifies modelled conditions, valid time, forecast segments and rain interval. The provider's current conditions are themselves model estimates. [Field and time-support definitions](https://open-meteo.com/en/docs).

## Interactive watering calculation

Existing enabled local settings without a weather-mode field migrate to Open-Meteo mode. New experiments can choose **Use Open-Meteo weather**; **Dry test** and **Rain test** still select explicit manual forcing. The mode is visible in Algorithm controls and care explanations. Starting reserve, water capacity, threshold, areas and retention remain editable experimental profile assumptions, not validated hops coefficients.

The local mode reuses the v8.4 pure engine:

1. Completed past model intervals are identified as `Open-Meteo/interactive_model_estimate`, with provenance indicating past model estimates rather than observations. They are not labelled as archive observations or accepted as production releases.
2. Current-hour ET0 and rain timing is unknown. Two coherent replay paths bound timing conditionally: full predicted hourly demand/zero rain and zero demand/full predicted hourly rain. A uniform fraction is not asserted. These are bounds **conditional on the model totals**, not validated bounds on forecast error or actual plant water.
3. If the resulting reserve range crosses the watering threshold, the answer is uncertain with a specific explanation. Future hours after the current hour cannot refill the present bank. Missing ET0/rain history remains unavailable instead of becoming zero.
4. Journal quantities, date-only timing bounds, corrections/deletions, unknown amounts and simulated water still pass through existing replay rules. Rain reception bounds remain active.

Weather acquisition completes before the evaluation timestamp is chosen. Home freshness uses the render-time clock, so a just-computed result is not rejected merely because it is newer than the last minute-clock sample. Results still expire after five minutes and can be refreshed on demand. No automatic watering or new scheduled notifications were added.

This implements a useful model-driven experiment. It does not calibrate the profile, measure soil moisture or guarantee real-world watering accuracy. Production snapshots retain their existing approval boundary; they reject local experimental results.

## Caching and provider retirement

- Separate `weedgrow.meteo.v1` raw cache prevents old OpenWeather payloads from being reused as Open-Meteo data. Cache reuse is one hour per exact location; in-flight requests are coalesced and storage is bounded to 16 locations. Manual refresh bypasses the cache.
- Plant/garden current-day display caches refresh after one hour; future daily forecast records can be reused for six hours. Refreshes happen through existing foreground flows, not a new background polling loop.
- Existing saved historical weather is preserved. Only current/future eligible records are refreshed, with existing location-race and same-day move protections.
- OpenWeather's key is no longer exposed through Expo configuration. Hosted function entry points and deployment tooling no longer require/create its secret. Existing `.env` credentials were not deleted or rotated.
- Future hosted weather configuration uses `product: open_meteo_forecast` with a new reviewed policy version. Legacy One Call parsing/configuration support remains for old records and regression tests; live function entry points supply no legacy key. An old One Call policy must be replaced before hosted care weather can run. No protected configuration was installed.

Open-Meteo's public API is free for eligible non-commercial use, with attribution and request limits; weighted requests, retries and user traffic still need budgeting. The 21-day/multiple-variable bundle can count as several quota units. Rate limiting is reported explicitly, and a failed request is not cached as successful weather. [Terms](https://open-meteo.com/en/terms), [quota accounting](https://open-meteo.com/en/pricing).

## Verification

New tests cover the live-provider request contract without keys, cache sharing/migration, local-day boundaries, missing and misaligned fields, wrong units, liquid rain versus snow, preserving distinct daily temperatures, model-driven ET0/rain, current-hour bounds, future-rain exclusion, journal/simulated water, WMO storm codes, stale input, asynchronous acquisition time, control mode selection and current-cache expiry. Backend emulator checks also acquire Open-Meteo without a secret and preserve existing ownership/history guarantees.

Live UI verification on Milkshake showed 23.5°C modelled current conditions, daily 28.2°C / 15.8°C, and 06:00/18:00/23:00 values of 16.5°C/20.4°C/17.4°C, with Open-Meteo attribution and a model-driven watering result. These are provider estimates at verification time, not a claim that the phone's different forecast is incorrect. No journal records were changed.

Final validation: the complete `npm run verify` gate passed **116 suites / 917 tests**, backend/application types, backend build, lint, architecture and isolated Firebase emulator integration/ownership checks. The final Home asynchronous-freshness correction was additionally checked with its targeted regression suite, application types and lint.
