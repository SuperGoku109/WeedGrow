# Storm, hail and powdery mildew checks — 6 November 2026

The user's request prompted a review of the actual provider fields, independent hops pathology guidance, weather preparation and watering interactions. This increment adds usable thunderstorm preparation from existing API responses and boundary/regression cases. It does not create a disease predictor or claim a live hail-warning feed exists.

## Research used to choose cases

- The [March 2026 PNW hops powdery mildew handbook](https://pnwhandbooks.org/plantdisease/host-disease/hop-humulus-lupulus-powdery-mildew) describes infection of young growth, flowers/cones and persistence across conditions; its authors explicitly note that precise environmental conditions are not well characterized. [MSU's hops-specific guidance](https://msu-prod.dotcdn.io/news/managing-hop-powdery-mildew-in-michigan) explains that rain/dew leaf wetness is not a necessary powdery mildew infection gate. Therefore no rain, shelter, modest RH, a hot afternoon or wind must not produce a disease all-clear. These sources do not validate a numerical local infection probability.
- [MSU's hop downy mildew guidance](https://msu-prod.dotcdn.io/news/managing-hop-downy-mildew-in-michigan) describes a different pathogen and relationship to free moisture. The implementation does not reuse downy-mildew wetness criteria as a powdery-mildew detector. Ambient RH remains different from measured leaf wetness.
- [OpenWeather's documented condition IDs](https://openweathermap.org/api/weather-conditions) identify ten thunderstorm codes: 200, 201, 202, 210, 211, 212, 221, 230, 231 and 232. They do not independently identify hail, flood depth, damaging wind, an official severe warning or crop injury. No legacy/undocumented hail code or translated alert prose is accepted as structured hail evidence.
- [NWS thunderstorm safety guidance](https://www.weather.gov/safety/thunderstorm-during) supports separating advance preparation from instructions during lightning. Cards tell users to remain sheltered and follow local official warnings, rather than go outside to move containers during an active storm. U.S. severe-warning size/speed definitions are not installed as universal hops damage thresholds or assumed regional warning rules.

## Changes

`stormConditions.ts` extracts only documented numeric thunderstorm IDs from the existing OpenWeather current/hourly response. It independently checks acquisition availability, timestamp, current age, forecast horizon, location revision and bounded row/condition counts. It considers every weather entry, deduplicates retries and ignores unsupported prose/IDs. No extra API request or subscription is introduced.

The backend includes eligible conditions in the protected public care snapshot under the existing weather policy/freshness gates. `weatherCards.ts` creates at most one storm card per current/forecast phase. Current and future wording stays distinct. Numeric wind/rain hazards remain separate, since sharing a forecast window does not prove one source episode. These cards change neither bank state nor watering advice and send no push notifications. Inactive, expired, unavailable, incorrectly scoped or forged hail conditions cannot create a storm card.

The production `WateringInsight` fallback previously labeled unavailable mildew assessment as `low`. It now uses `unknown`; the legacy renderer produces an inactive unavailable assessment for this value. The old numerical heuristic remains historical regression support and is not called by production hops care. W10 remains disabled; weather preparation/context cannot become a disease diagnosis, infection percentage, pesticide recommendation or automatic disease all-clear.

`activeSourceEvents` previously discarded malformed newer updates before selecting the authoritative revision. That could revive an older hail/severe-weather warning. Identity/revision grouping now precedes validation of the latest payload, so a malformed correction blocks its identity. Valid later cancellation, expiry, scope changes and unresolved conflicts remove current positive evidence without declaring the weather safe.

## Case catalogue

| Group | Cases / expected behavior |
| --- | --- |
| Structured storms | All ten documented IDs; clear/cloud/rain/freezing-rain/snow/squall/tornado/legacy hail/unknown IDs; string/boolean/null IDs; alarming prose without a valid code. Only documented thunderstorm IDs create storm context. |
| Time/source boundaries | Current age and forecast endpoints, future current point, past forecast, future acquisition, invalid timestamp, bounded hourly list, secondary weather entries and duplicate retries. |
| Powdery mildew matrix | 42 combinations: 12/22/36°C, RH 0/30/60/89/90/100/missing, rain 0/1 mm. W10 remains disabled and no disease card/all-clear is produced. Independent supported bank outcomes remain `.60/.68 L` in these explicitly synthetic cases; neither humidity nor a disease context overrides watering. |
| Concurrent weather | Thunderstorm plus supported strong gust and heavy rain; retain distinct hazards and stable card IDs without duplicating biological effects or claiming root rot. |
| Card lifetime | Current/forecast grouping, policy disabled, expiry, wrong location, future availability, inactive lifecycle and a forged hail condition. |
| Mapped hail/storm hazards | Typed hail/wind/rain/flood events retain issuer severity; duplicate retry, cancellation, expiry, moved scope and same-revision conflicts. Five malformed latest-update cases must never reactivate old evidence. No inferred retained irrigation/rain water or unapproved push follows. |

The hail cases exercise the canonical mapped-event boundary, not a new live source integration. W05 remains unknown without a separately approved regional adapter. Thunderstorm codes alone cannot supply this missing hail evidence. A practical next integration would ingest a provider's structured hail hazard with tested regional mapping, updates/cancellation and source provenance; scraping alert prose is not substituted here.

No disease-performance, crop-damage accuracy or live delivery is established by these tests. Field outcome validation and actual regional source access remain separate work.

## Verification

Added **88 scenario tests**. Final whole-repository Jest run: **107 suites / 720 tests passed**. `npm run verify` passed backend/app types, backend build, lint, architecture and all Firebase integration checks with the first 86 cases (718 total). After adding the two final test-only cases, app types, scenario-file lint and the entire Jest suite were rerun successfully. Integration now checks that current/forecast storm conditions survive the real backend publication route using synthetic HTTP responses. `git diff --check` passed. No live API call, deployment, disease-model activation or hail-source activation was performed.
