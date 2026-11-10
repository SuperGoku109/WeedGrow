# Local weather accuracy comparison

Read-only checks on 9 November 2026. No application/provider/model setting was changed.

The user reported Weather.com showing 32°C current/high and 16°C low for Somerset West, compared with the app's Open-Meteo 23.5°C current and 28.2°C/15.8°C daily range.

## Matched Open-Meteo requests

The saved plant pin and a Somerset West town-centre point about 6.1 km away returned the same default forecast grid and temperatures. Therefore, changing the text label from City of Cape Town to Somerset West would not resolve the discrepancy. The response timezone was Africa/Johannesburg and temperature units were Celsius.

At a matched 14:30 SAST valid time:

| Model selection at the plant pin | Current °C | Today's high °C | Today's low °C |
| --- | ---: | ---: | ---: |
| Automatic/default | 23.4 | 28.2 | 15.8 |
| ECMWF IFS 0.25° | 25.5 | 31.3 | 13.5 |
| GFS Seamless | 25.9 | 31.4 | 15.7 |
| ICON Seamless | 28.5 | 32.0 | 14.7 |

Requests returned successful responses. These are alternative model estimates from the same API, not four independent thermometer observations. The default's lower temperatures are reproduced in raw data outside the app; displaying or parsing the number differently would not correct the estimate. Evidence: `tmp/weather-accuracy-comparison-results.json` and its credential-safe comparison script.

## Weather.com comparison

The live [Somerset West page](https://weather.com/en-ZA/za/western-cape/city/somerset-west/today) was also loaded in the browser. At its displayed 14:27 SAST update it showed **85°F (about 29.4°C)**, high 86°F (30°C) and low 60°F (about 15.6°C). Earlier hourly entries on that page reached 88°F (about 31.1°C). These observations do not establish what the user's particular page showed earlier or at a different point; they record the page and time actually checked. The temperature gap remains material even with this near-matched comparison.

Open-Meteo documents its current conditions as model-based, not direct on-site readings. Its selected forecast grid may cover an area rather than the precise plant location. [Open-Meteo definitions](https://open-meteo.com/en/docs).

The Weather Company describes a different current-conditions system that blends surface observations and other meteorological inputs with models. That provides a plausible explanation for differences between the products, but does not independently establish which value is correct at this plant. [The Weather Company FAQ](https://developer.weather.com/docs/faqs).

## Interpretation and next step

Functional integration tests establish correct fields, units, dates, uncertainty handling and algorithm execution. They do **not** validate local meteorological accuracy. No single accuracy percentage or temperature-error guarantee can be assigned from this one comparison.

The observations demonstrate model-choice sensitivity. They do not justify automatically choosing whichever model best matches a single Weather.com reading. Coastal, terrain, local weather, assimilation and model-update differences are possible contributors; the comparison has not isolated one physical cause.

A reasonable next validation is to record forecasts at fixed lead times and compare them with time-matched, quality-controlled local observations over multiple days. Current readings and daily extrema must be assessed separately. ET0 and rainfall inputs also need review: a better temperature match alone does not prove better watering inputs. Until then, the weather-driven care result remains an explicitly experimental model estimate with an uncalibrated plant profile.
