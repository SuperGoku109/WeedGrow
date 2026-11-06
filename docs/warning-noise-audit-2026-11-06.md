# Warning relevance and boundary review — 6 November 2026

Reviewed current/forecast weather flags, source-condition codes, expiry, card grouping and the previous storm/disease cases in response to the user's concern about unnecessary warnings. No new agronomic thresholds or storm severity classifications were invented.

## Trigger validity

| Output | Required positive evidence | Does not trigger it |
| --- | --- | --- |
| Thunderstorm preparation | A documented OpenWeather numeric thunderstorm ID in an eligible current or future row | Medium wind, ordinary rain, cloud, RH, translated descriptions, severe-sounding prose, an unknown code or legacy hail code |
| Wind preparation | Reported wind **at least 10 m/s (36 km/h)** OR gust **at least 15 m/s (54 km/h)**, as specified by W03 | Both wind and gust below their separate thresholds; wrong units, missing/invalid data, strings or booleans |
| Heavy rain preparation | Known rate **at least 10 mm/h** OR nonoverlapping known liquid amount **at least 25 mm** within the declared window of up to 24 hours | Light/medium rain below both thresholds, a thunderstorm label alone, missing amounts inferred as zero, or duplicate/overlapping sums |
| Heat/cold preparation | The existing W01/W02 32°C/5°C boundaries with valid applicable data | Below-heat/above-cold values, invalid support or stale/moved evidence |
| Humid/flower context | Supported W09/W11 context; informational severity only | An automatic powdery mildew diagnosis, a storm prediction or a watering override |
| Hail | A separately trusted and regionally mapped hail source would be required | Wind, heavy rain or a generic thunderstorm code; no live hail adapter is installed |

The threshold values remain the handoff's engineering preparation criteria. They are not official severe-weather warning thresholds or validated hops injury predictions. The title is now **Wind preparation** rather than classifying every threshold crossing as “strong wind.” The card explains the numerical wind/gust criteria.

OpenWeather identifies thunderstorms independently of numeric wind thresholds in its [condition-code contract](https://openweathermap.org/api/weather-conditions), including light thunderstorm code 210. Consequently, modest wind alone yields no storm card, while an explicit valid thunderstorm code can still justify lightning preparation. Suppressing that independent evidence merely because wind is modest would be incorrect.

## Clutter and freshness fixes

- Current and forecast thunderstorms now share one stable plant/card identity. Current conditions take the title; future context is retained in the summary and metrics. Forecast changes do not create another card.
- A forecast condition whose valid time has elapsed is no longer described as upcoming by the renderer, even if the overall snapshot has a longer validity interval.
- Current source observations now expire exactly at `maxCurrentAgeSeconds`, consistent with the consumer's expiry rule. Previously an observation exactly at its deadline could survive after the deadline was excluded from the next-expiry calculation.
- W03 and W04 choose current positive evidence before forecast evidence regardless of input-window order, avoiding “expected” wording while the threshold is already crossed now.
- Ordinary canopy rain (W12 alone) stays in canonical context but no longer creates a standalone card. Supported flowering/humidity context remains informational; W12 can join that grouped card. This is a display-noise change, not a claim that rain is absent or that diseases are ruled out.
- Distinct supported wind/rain hazards remain visible with a thunderstorm. Sharing a forecast window does not establish one severe episode, so they are not collapsed into an inferred severity or hail warning.

## Additional negative/boundary cases

Added **124 tests**: 48 wind/gust combinations, 49 rate/amount combinations, five moderate-wind/light-rain combinations, one modest-wind explicit-thunderstorm case, six invalid numeric/coercion cases, one wrong-unit case, six temperature boundaries, five humidity boundaries, current/forecast ordering, elapsed-forecast/deduplication and exact source expiry. Expectations check actual emitted cards, not just internal flags. Existing storm tests were updated to expect one grouped card and no ordinary-rain-only card.

The matrix includes just-below, exactly-at and just-above values. Known legitimate threshold crossings remain visible; missing or bad evidence never becomes a positive alert or a weather all-clear. The code cannot guarantee a provider forecast will be correct in reality, and test counts do not establish a measured field false-alarm rate.

Final `npm run verify` passed all stages: backend/app types, backend build, repository lint, architecture checks, **108 suites / 844 tests**, and Firebase integration/ownership checks. `git diff --check` passed. No cloud deployment or live provider request was performed.
