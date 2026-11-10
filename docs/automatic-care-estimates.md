> Automatic care now uses the [observation-driven outdoor engine](outdoor-intelligence-refactor.md). The reserve and weather-only rules described below are retained research/manual testing references, not the automatic recommendation path.

# Automatic care estimates

The default interactive care path now derives its inputs from the saved plant, Open-Meteo hourly model weather and recorded watering. No test preset, reserve entry or engineering parameter is required. Advanced testing retains explicit manual overrides and a **Use automatic care** action restores the default. Existing settings without an explicit manual mode migrate to automatic mode.

## Practical recommendations

Normal automatic care first applies practical weather/history rules when their conditions match. It does not require proof of an exact soil reserve. `lib/careAlgorithm/practicalWatering.ts` contains the versioned `practical-estimates-v1` rules:

- **Recommend watering:** the last two rolling 24-hour periods each contain at least three completed hours at 28°C or warmer, OR at least 4 mm total model ET0 in each period; less than 2 mm total liquid rain over the whole period; and no positive or unspecified-quantity watering log overlaps the period. Mostly shaded plants and pots over 40 L require three periods instead. If the plant is explicitly sheltered from rain, outside rainfall does not interrupt its dry spell. Ground plants and unknown pot volumes can receive this advice without an invented storage capacity.
- **Pause after watering:** a watering record whose entire possible occurrence window is within the last 12 hours makes more watering probably unnecessary for now. The explanation explicitly assumes normal watering. An unknown quantity can count; zero cannot. Known quantities below max(50 ml, 2% of known pot volume) do not establish a normal watering. A tiny positive log interrupts the no-watering rule but does not claim the soil is wet.
- **Pause after rain:** at least 5 mm liquid rain in the last 12 hours, known direct soil rain exposure, and at most 1.5 mm ET0 in that period makes watering probably unnecessary for now. Unknown/partial rain exposure does not establish replenishment.

These are tunable product heuristics, not sourced physiological thresholds or measured root-zone moisture. [University of Minnesota Extension](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/fertilizing-and-watering-container-plants) explains that containers can need frequent watering in hot, dry weather and that container size affects demand. [Oregon State's hops guide](https://extension.oregonstate.edu/sites/extd8/files/documents/em9115.pdf) supports consistent watering with care against waterlogging. Those references support the general approach, not these exact app cutoffs.

Only completed past hours count. Actual model ET0 already incorporates humidity, wind and radiation effects; these are not multiplied again. A strong temperature signal can work without ET0. Missing rain cannot become zero unless the plant is explicitly sheltered. Forecast rain does not count as water already received. Stale/future weather, missing required hours, failed journal reads, malformed records, recent location moves, inactive plants, indoor plants and greenhouses do not qualify for this shortcut. The bank remains a fallback when no practical rule matches. A recommended watering result explains that unlogged watering or moist soil should override the estimate. No exact dose is prescribed.

## Estimated inputs

The implementation is `lib/careAlgorithm/automaticProfile.ts`. These are uncalibrated engineering priors for testing, not validated hops coefficients or measured substrate properties:

| Input | Assumption |
| --- | --- |
| Available water capacity | Pot litres × medium fraction: soil 0.10–0.24, soilless mix 0.15–0.35, coco 0.18–0.38; unknown medium 0.08–0.38 |
| Pot mouth | Cylinder whose height equals diameter, derived from pot litres |
| Effective demand area | Mouth area × 3.5 × growth-stage factor × sunlight factor |
| Growth-stage factor | Germination 0.15–0.35; clone 0.2–0.5; seedling 0.25–0.6; vegetative 0.75–1.25; flowering 0.9–1.5; unknown 0.15–1.5 |
| Sunlight factor | Full sun 0.85–1; partial sun 0.55–0.85; mostly shade 0.3–0.6; unknown 0.3–1 |
| Rain catchment | Mouth area × 0.7–1.3, further bounded by the plant's root-zone rain reception |
| Retained fraction | 0.6–0.9 |
| Watering threshold | 0.35–0.55 of available water capacity |
| Starting reserve | Unknown: zero to each scenario's capacity |

The bank's five binary parameter ranges generate 32 scenarios. Each also carries reserve bounds. A definite **bank** result requires agreement across all scenarios and bounds; practical recommendations above do not require that agreement. The ranges are sensitivity assumptions, not statistical confidence intervals or guaranteed bounds on real plants/weather. In particular pot volume does not establish canopy size or root mass; the demand-area multiplier needs real-world validation.

The water-bank structure follows the concept of available water storage, crop demand and replenishment described in [FAO-56](https://www.fao.org/4/X0490E/x0490e0e.htm). That reference does **not** validate the numerical priors above for hops in pots.

## Replay and missing facts

Replay begins at local midnight seven calendar days ago, or a more recent recorded location move. It uses the current plant setup throughout; historical setup changes are not reconstructed. Existing journal timing, missing-quantity, rain-reception and unfinished-weather-hour uncertainty remain intact. Simulated extra water is zero and journal inclusion is always on in automatic mode.

For the bank fallback, pot volume must include a supported unit and be between 0.05 and 1000 L. Missing/unsupported pot volume produces a specific request to update Growing setup when no practical rule applies. Ground root-zone storage cannot be derived from these fields, so the bank fallback cannot decide ground watering. Practical rules and supported weather advice still work. Unknown medium/sunlight widen the bank rather than requiring new expert inputs. Actual initial wetness cannot be inferred from a plant name or stage.

Automatic estimates remain on-device experimental evaluations. They do not approve a production watering profile, actuate irrigation, introduce background jobs or change Firebase billing. Diagnostics show the derived profile, plant details used and initial reserve assumption. No derived parameters are written to Firestore.

## Verification

Regression cases cover pot-size scaling, stage/sun/medium sensitivity, missing/unitless volumes, unknown ground storage, local-calendar and location-move anchors, unknown starting wetness, strong synthetic depletion, recorded refill, automatic service routing and a normal screen without technical fields. The synthetic depletion/refill quantities exercise the calculation and are not recommended watering amounts.

After adding practical rules, the full unit/scenario run passed 118 suites / 954 tests. The 29 practical-rule cases cover hot/dry spells, recent normal/zero/tiny/unspecified watering, uncertain dates, deleted/future logs, rain exposure, trace versus soaking rain, strong drying demand, brief heat spikes, forecast exclusion, missing fields/hours, shade/large pots, stale or moved-location inputs, unsupported environments, ground/unknown-pot integration and failed journal reads. Earlier live UI verification on the existing 10 L plant confirmed automatic evaluation, no visible technical inputs, and controls revealed only by Advanced testing. No plant or journal records were changed.
