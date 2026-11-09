# Weather-provider investigation and recommendation

**Implementation follow-up:** the recommended switch is now implemented locally. See [Open-Meteo integration](open-meteo-integration.md). The comparisons and recommendation below record the investigation before that implementation.

Investigation: 9 November 2026, Africa/Johannesburg. Scope: read-only network comparisons, source review, existing-adapter checks and current provider terms. No production provider, account, subscription, billing or app settings were changed. No messages were sent to a provider. API keys and credential-bearing URLs were not logged.

## Finding

The failure is reproducible for the sampled South African locations. The same configured OpenWeather key and request construction return complete forecasts for Berlin and Sydney. This substantially narrows the diagnosis: the key has working One Call forecast access, while the returned weather data for the sampled South African coordinates is defective/incomplete.

This does not establish a nationwide outage, an official vendor incident, or an exact internal cause. Regional model-data coverage, ingestion, routing or fallback behavior are possible explanations, not confirmed facts. OpenWeather would need to inspect its internal service/account logs to distinguish them. The investigation found no authoritative public incident notice identifying this exact failure.

The earlier suggestion that the key might simply lack One Call access is not supported by the new cross-location tests. General forecast access works with this key.

## Controlled requests

| Test with the same configured key | HTTP | Hourly rows | Daily rows | Result |
| --- | --- | --- | --- | --- |
| Somerset West area | 200 | 1 | 1 | 11.78°C copied into every daily temperature |
| Cape Town | 200 | 1 | 1 | 14.51°C copied into every daily temperature |
| Brackenfell | 200 | 1 | 1 | 11.16°C copied into every daily temperature |
| Somerset West town centre | 200 | 1 | 1 | 11.50°C copied into every daily temperature |
| Johannesburg | 200 | 1 | 1 | 15.37°C copied into every daily temperature |
| Berlin | 200 | 48 | 8 | Distinct daily extrema and segments |
| Sydney | 200 | 48 | 8 | Distinct daily extrema and segments |

Additional controls:

- No API key and a deliberately invalid diagnostic key both produced normal HTTP 401 responses. No alternative real credentials were used.
- Switching Somerset West to standard/Kelvin units retained the broken one-row shape; values converted consistently. This is not a Celsius conversion error.
- Removing `exclude` did not restore the forecast. The app excludes minutely data and alerts, not hourly/daily data.
- Explicitly asking the 5-day/3-hour forecast endpoint for 40 rows returned zero rows for Somerset West and 40 rows for Berlin.
- Native Node HTTPS and `fetch` reproduced the result independently of the app, parser, Firestore and UI cache. HTTPS had a valid `*.openweathermap.org` certificate with no TLS authorization error. No Node preload or standard proxy environment setting was configured.

OpenWeather documents 48 hourly and eight daily forecast entries. Its documented access/quota errors are 401/429. A 200 response does not guarantee usable coverage. [One Call documentation](https://openweathermap.org/api/one-call-3)

Evidence: `tmp/weather-deep-investigation-results.json`, `tmp/weather-regional-investigation-results.json`, and the credential-safe scripts `tmp/weather-deep-investigation.cjs` and `tmp/check-weather-transport.cjs`.

## Live Open-Meteo evaluation

A public endpoint request, with no API key or account setup, returned 144 hourly rows for a six-day window containing three past days and three forecast days. All requested past ET0/rain/showers values were non-null. The response also supplied temperature, RH, dew point, wind, gusts, radiation and weather codes.

A separate daily request with `timezone=Africa/Johannesburg` returned today's Somerset West forecast as **28.2°C / 15.8°C**, with a current model estimate around **23.8°C**. The user reported **32°C / 16°C** from the phone's Somerset West forecast. These are different forecasts; the phone's number is not a ground-truth measurement, and a functioning API must not be selected merely to match it. This short comparison establishes usable structure and coverage, not superior forecast accuracy.

The archive endpoint also returned HTTP 200 for `models=ecmwf_ifs`, with 96 hourly ET0/rain entries for 6–9 November. The latest non-future entry at check time was 11:00 UTC. A preliminary diagnostic used the incorrect model identifier `ifs` and received HTTP 400; retrying with `ecmwf_ifs`, which the app's existing policy already permits, succeeded. No application model-ID bug was found.

The app's actual `normalizeMeteo` adapter was executed against both captured payloads:

- Forecast: 1,152 normalized samples; 144 valid ET0 samples and 144 valid liquid-rain samples; no adapter issues.
- Archive: 672 normalized samples; 84 valid ET0 and 84 valid rain samples at the check time. Twelve future archive rows were correctly rejected, rather than being used as past weather.

The initial request used UTC for compatibility with the existing algorithm adapter. The daily comparison used the plant's local timezone. A migration must preserve this distinction; forecast-day boundaries must not accidentally use UTC midnight for a South African local-day card.

Open-Meteo's ET0 is a reference-grass model estimate, not hops water use or a moisture measurement. The plant profile still converts it into demand. Recent forecast `past_days` rows and archive estimates must retain their respective provenance. A completed hourly timeline also does not establish the unfinished portion of the current hour. [Forecast definitions](https://open-meteo.com/en/docs), [archive availability](https://open-meteo.com/en/docs/historical-weather-api)

Evidence: `tmp/open-meteo-investigation-response.json`, `tmp/meteo-local-day-response.json`, `tmp/meteo-archive-ifs-response.json`, `tmp/meteo-archive-ifs-summary.json`.

## Free alternatives

| Provider | Free offer and constraints | Fit for this app |
| --- | --- | --- |
| **Open-Meteo — recommended** | Non-commercial public API; no key needed. Under 10,000/day, 5,000/hour and 600/minute; pricing also lists 300,000/month. Attribution required; no uptime guarantee. Large variable/time requests count as multiple units. | Direct ET0 and rain history/forecasts; existing domain adapter; live Somerset West checks succeeded. Best fit for the confirmed hobby/community app. |
| WeatherAPI.com | Free 100,000 requests/month, 3-day forecast, past day of history. Commercial use allowed. Free quota exhaustion stops service unless the owner chooses additional paid capacity. | Good general weather-card option, but direct ET0 is listed under the paid Business plan. Less suitable for this water model without additional data/calculation. No live test: a separate API key would be needed. |
| MET Norway Locationforecast | Open licensed forecast data; attribution, identifying requests and efficient caching required; no delivery/SLA guarantee. | Credible general-weather option, but its standard documented forecast fields do not provide the existing model's ET0 input directly. Less direct integration, especially for a browser app. Documentation reviewed; not live tested here. |

Sources: [Open-Meteo terms](https://open-meteo.com/en/terms), [pricing and weighted calls](https://open-meteo.com/en/pricing), [WeatherAPI plans](https://www.weatherapi.com/pricing), [MET terms](https://api.met.no/doc/TermsOfService), [MET license](https://docs.api.met.no/doc/License.html), [MET forecast fields](https://docs.api.met.no/doc/ForecastJSON.html).

For sizing, 500 users fetching six location bundles a day means 3,000 HTTP requests/day before weighted-call adjustments, retries, archive requests or other endpoints. At 1.5 units per request that illustrative load is 4,500/day and 135,000 over 30 days. Actual accounting depends on the selected fields, days, models and locations. Continuous hourly polling for all 500 users is 12,000 HTTP requests/day and would exceed the stated daily free allowance before weighting. Use foreground fetching, per-location caching and in-flight coalescing; one plant must not cause another weather fetch when its pin already has a fresh response.

The free Open-Meteo endpoint requires no payment subscription. Quota blocking/availability remains possible. Keeping the whole app free still depends on its separate Firebase/photo/service limits; changing the weather provider does not change those plans.

## Recommended implementation scope

Switch the weather layer to Open-Meteo while retaining Firebase, the pure plant-care engine and on-device execution. No backend worker is required just to fetch weather and run the interactive algorithm.

The implementation should:

1. Add a typed Open-Meteo client and separate raw/display normalization from the algorithm adapter. Keep real model-derived weather distinct from manual test rates.
2. Populate daily extrema from the correctly bounded local day, and derive explicitly timed morning/evening/night display values from actual hourly fields. Never clone one current value into unavailable segments.
3. Supply ET0 and liquid rain with units, interval bounds, model identity, retrieval time and quality. Keep an explicit policy for recent/unfinished hours; do not silently reinterpret forecasts as occurred observations.
4. Map WMO weather codes to preparation screens. Existing OpenWeather storm IDs cannot simply consume WMO codes. Do not promise official alert coverage or confirmed hail/disease from missing evidence.
5. Keep editable test profiles, reserve assumptions, rainfall reception bounds and journal replay. Changing providers does not calibrate or validate hops coefficients.
6. Reuse cached location bundles, apply bounded refreshes/retries, add attribution, and test daily boundaries, gaps, unit conversions, forecast provenance and conservative warnings against recorded provider payloads.

The app remains on OpenWeather with the protective current-weather fallback until an actual migration is implemented. This document and the live comparisons are a recommendation, not a claim that the switch has already happened.
