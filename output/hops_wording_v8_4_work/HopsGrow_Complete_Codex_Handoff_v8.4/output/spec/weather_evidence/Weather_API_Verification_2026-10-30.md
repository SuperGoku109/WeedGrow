# HopsGrow - verified weather payloads and implementation decision

30 October 2026, about12:44 UTC. Live requests used a public Johannesburg
city-centre test coordinate (-26.2041,28.0473), not a private plant location.
The configured local OpenWeather credential stayed in memory and was not
printed or included in these artifacts. No account/subscription/app changes.

## Live results

| Product actually requested | HTTP | Captured result |
| --- | --- | --- |
| OpenWeather One Call3.0, same exclusions/units as app | 200 | current,48 hourly forecasts,8 daily forecasts |
| OpenWeather One Call3.0 Time Machine,20October2026 noon UTC | 200 | data[] containing one timestamp record |
| Open-Meteo Forecast,2past days +2forecast days | 200 | 96 hourly rows with T/RH/dew point, wind/gust, rain/showers, radiation and ET0 |
| Open-Meteo Archive,20-22October2026 | 200 | 72 hourly rows including T/RH/dew point, wind/gust, liquid rain, radiation and ET0 |

Both Open-Meteo responses had aligned hourly arrays,3600-second spacing and no
null requested hourly values in these fixtures. Verified units: Celsius,
percent RH, m/s wind, mm rain/ET0 and W/m2 radiation. Four successful requests
demonstrate these products/fields were accessible at this time and location;
they do not establish quotas, deployed-secret configuration, uptime or local
plant-care accuracy. The historical OpenWeather response was one point, not a
complete day's weather. Current OpenWeather conditions were dry; wetter
OpenWeather parsing cases below are explicitly controlled schema fixtures.

## Actual repository integration

`lib/weather/fetchWeather.ts` and `functions/src/operations.ts` both request:

```text
api.openweathermap.org/data/3.0/onecall
lat=...&lon=...&exclude=minutely,alerts&units=metric&appid=[not recorded]
```

The client caches raw decoded forecasts for30minutes. The server collector has
a6-hour recent-cache guard and persists daily summaries. Raw future hourly
rows are not a durable occurred-weather ledger.

Running captured payloads through the actual TypeScript decoder/parser found:

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Historical envelope unsupported | Actual data[] record parses to zero date entries | Add a dedicated historical adapter; current parser cannot ingest it |
| Solar instant shifted | Raw sunrise03:19:56Z becomes05:19:56Z | Keep true UTC epoch; convert only for display |
| Forecast context mixed into current | Today's nonforecast entry contains future nightHumidity33 | Keep phase/provenance per feature, not one Boolean for a mixed daily object |
| Alerts unavailable to current pipeline | Request excludes alerts; controlled documented alerts fixture is dropped by decoder | Enable/persist a typed source-event route if shipping source hazards |
| Rate and total share one rainfall field | Controlled fixture current2mm/h and daily25mm yields generic today.rainfall2 | Separate rate, interval amount and daily forecast amount |
| No ET0 or shortwave fields | Actual One Call payload contains neither field | Add a supported data source rather than use UV/cloud as exact energy |

The raw sample decoder preserves extra sample keys at runtime, including
weather IDs; the current type does not expose them and normalized daily
entries retain descriptions only. Top-level alerts/data are dropped. This
distinction matters when extending the adapter.

Actual-code reproductions are in `actual_parser_audit.json`. The controlled
rain/alert fixtures are labelled separately from live values. Eight offline
captured-payload tests pass by confirming availability and these known
defects; `parserReadyForAlgorithm` is explicitly false. These are not eight
successful production-integration tests.

## Provider rules that now need explicit adapter mappings

- OpenWeather current/hourly rain.1h is documented in mm/h; daily rain is a
  different period/quantity. The provider documents omission of non-occurring
  phenomena. Recognize absent rain as zero only for a valid complete sample
  under that product's tested omission contract; preserve the zero reason.
  Do not apply that rule to failed requests, missing records or other APIs.
  [Official One Call3.0 docs](https://openweathermap.org/api/one-call-3)
- Open-Meteo Forecast liquid rainfall is rain+showers. Archive rain already
  includes local showers. In the captured forecast, rain summed to0mm and
  showers to0.6mm: rain alone would lose all predicted liquid precipitation.
  Use product-specific mappings; total precipitation can include snow.
  [Forecast](https://open-meteo.com/en/docs),
  [Archive](https://open-meteo.com/en/docs/historical-weather-api)
- Open-Meteo ET0 is a preceding-hour sum for reference well-watered grass;
  shortwave is a preceding-hour mean. Use separate amount/point intervals and
  retain the effective model/grid. ET0 is not actual pot consumption.
  [Variable definitions](https://open-meteo.com/en/docs)
- Forecast past_days returns archived forecasts, not station observations.
  Archive products also differ: ERA5/ERA5-Land have a documented5-day delay;
  IFS is listed separately with no delay. Choose and preserve product lineage;
  do not silently splice them as equivalent measurements or evaluate past
  forecasts using later-revised data without declaring the difference.
  [Archive availability](https://open-meteo.com/en/docs/historical-weather-api)

## Recommended implementation path

My recommendation is a coherent Open-Meteo forcing feed for water balance:
request its air/weather, liquid rain, radiation and ET0 together. Preserve the
existing OpenWeather integration where useful for display/geocoding and
supported source hazards. This avoids manufacturing radiation/ET0 from the
current One Call fields. Validate the chosen source/model profile before
activation; do not mix OpenWeather rain and Open-Meteo ET0 accidentally.

An alternative is to retain OpenWeather for current/forecast/history and add
Open-Meteo only for ET0/radiation. The local key successfully accessed the two
tested OpenWeather endpoints. That path needs deliberate cross-provider
validation and more careful alignment, so it is not the simplest water-model
forcing contract. No provider migration was performed here.

For recent history, persist typed interval records plus issue/retrieval/source
metadata and explicitly backfill from the chosen product. Do not relabel a
forecast as observed merely because its timestamp has passed. A timestamp-only
Time Machine response is not a bulk multi-day backfill.

Open-Meteo permits free evaluation/prototyping and offers commercial licensing
through subscriptions. Select an appropriate commercial plan for production;
no purchase or plan change was made during these probes.
[Official pricing/licensing](https://open-meteo.com/en/pricing)

All of these changes are backend collection/normalization work. They add zero
routine user measurements. Remaining untested integration areas include active
local hazard delivery, outage/rate-limit handling and wider wet/cold/regional
fixtures. These should now be tested against concrete adapters, not left as a
generic question about whether useful weather fields are obtainable.

## Re-run offline fixture checks

```powershell
python weather_evidence/captured_payload_tests.py
```

The four captured response files contain no credentials. The probe report
records statuses and retrieval times. Reproducing the application-parser
findings requires the repo and its installed TypeScript dependency; it does
not require another network call.

Handoff v8.4 note: run the above from output/spec. The shipped offline script verifies frozen payloads and recorded historical parser findings. It does not rerun the current app parser; the current repository still needs WG-003/027 integration checks.
