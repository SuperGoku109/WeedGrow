# WeedGrow - Math & logic audit

v7.4 | CORRECTIONS AND EXPLICIT FLAG CALCULATIONS | 30 OCTOBER 2026

This addendum audits the executable v7.3 reference and refines the calculations that produce flags. It takes precedence where it corrects v7.3; the42-factor input contract, full blueprint and low-burden workflow remain the baseline.

Real fixes were needed: missing rain could clear a canopy-context flag; recent rain was ignored by flower context; resolved log conflicts could still block replay; and a forecast projection could imply a finite upper wait despite horizon-censored trajectories.

The corrected reference passes 95 scenario tests plus1,000 seeded water-bank trials. Four before/after reproductions are supplied. No biological accuracy, disease-detection rate or prevention claim follows from those checks.

Routine client input remains basic setup and watering events, amount optional. No daily moisture checks, leaf temperatures, measured roots, PAR, internal-bud humidity or repeated height measurements are introduced. The profile release registry stays empty; synthetic decisions remain debug-only.

<!-- page break -->

# 01  Errors found and corrected

REPRODUCIBLE CHANGES, NOT A CLAIM THAT EVERY POSSIBLE BUG IS ELIMINATED

| Finding | Why it mattered | v7.4 correction |
| --- | --- | --- |
| W12 false negative on missing rain | With known canopy access but no rain values, v7.3 returned not_triggered. | Unknown unless supported coverage can establish the screen was absent. Shelter means direct-rain path not_applicable, not no disease. |
| W11 ignored recent rain | A dry forecast hid the fact that canopy rain occurred recently. | Recent24h and forecast24h rain evidence are separate; either can provide flower-weather context. |
| Log conflict remained sticky | A later authoritative revision did not clear an older same-revision conflict reason. | Evaluate conflicts at the final selected revision. Keep genuinely unresolved latest conflicts blocked. |
| Finite upper wait with censoring | Some forecast trajectories never crossed within24h, yet the displayed envelope had a finite upper endpoint. | Upper endpoint is null when any trajectory is horizon-censored. Preserve finite subset only as debug evidence. |
| Bank input validation gaps | Unknown order labels silently became inputs-first; invalid starting reserves could be normalized away. | Reject invalid order and initial reserve explicitly. |
| Forecast freshness unconfigured | An old issued forecast could still trigger from future-valid values. | Optional backend per-source TTL now rejects stale forecasts. Production must configure/test that policy; no universal freshness cutoff is invented. |

Also added: separate recent/forecast screen states, threshold exposure calculations, and an explicit ban on treating an hourly maximum gust as a sustained hour of wind. These changes affect interpretation and explainability, not fitted crop injury probabilities.

<!-- page break -->

# 02  Water calculations: units and threshold

THE AVAILABLE-WATER BANK IS NOT A MEASURED MOISTURE PERCENTAGE

```
C = V_accessible_L * (theta_FC - theta_lower)    [L]
RAW = p*C                                      [L depleted]
A = C - RAW = (1-p)*C                           [L remaining]

RainDelivered = rain_mm * catchment_m2 * deliveryFraction
IrrigationDelivered = applied_L * retainedFraction
PotentialLoss = ET0_mm * effectiveLoss_m2

excess = max(0, R + delivered - C)
stored = min(C, R + delivered)
extracted = min(stored, PotentialLoss)
nextR = stored - extracted
R + delivered = nextR + excess + extracted
```

One millimetre over one square metre is one litre. Pot litres are not a rain-catchment area. Accessible volume, retention properties, p, effective loss and refill ranges are backend profile quantities requiring validation; they are not new measurements requested from the user.

For example, C2L and p0.6 give RAW1.2L and A0.8L. Compare remaining water R with A, not RAW. The study-selected p0.6 is not a universal cannabis watering target. [S34](https://www.mdpi.com/2073-4395/16/6/649)

The equations above show inputs-first. The reference also evaluates loss-first and earliest/latest log timing for the simple fixed-loss bank. Those branches bound modeled ordering, not real-world moisture uncertainty. Evaporation, roots and soil redistribution are not fully simulated.

ET0 already combines weather demand. Do not add a second temperature, humidity, wind, UV or daylength multiplier on top without a separately validated profile. If fitted total loss already includes evaporation, do not add evaporation again. FAO distinguishes soil evaporation from transpiration stress. [S11](https://www.fao.org/4/X0490E/x0490e0e.htm)

<!-- page break -->

# 03  Calling W06: due, not due or uncertain

NO UNVALIDATED DEFAULTS OR FORECAST-RAIN OVERRIDES

```
for coherent scenario j:
  margin_j = reserve_j - actionReserve_j

if state/history/profile unsupported: UNCERTAIN
else if all(margin_j <= numericTolerance): WATER
else if all(margin_j > numericTolerance): NOT_DUE
else: UNCERTAIN

needsWater = true / false / null
productionResult = approvedProfile ? candidate : UNCERTAIN
```

| Input condition | Actual effect |
| --- | --- |
| Known watering amount | Replay delivered amount, capped by supported retention/storage, at occurrence time. |
| Watering with omitted amount | Use supported refill scenarios or abstain. Never assume full storage. |
| Soil rain access=no | Zero direct rain contribution; other weather still affects loss. |
| Unknown rain access | Keep zero/full delivery alternatives; partial access requires supported bounds. |
| Age/height/sun/medium | Select supported profiles and fallbacks. No universal added litres/day or fixed days modifier. |
| Repot, stage, medium or location change | Supported dated transition or reinitialization; never manufacture water from increased capacity. |
| Forecast rain | Conditional future projection only. It cannot change present reserve or cancel already-supported watering need. |

Missing logs remain an unobserved source of uncertainty. The reference cannot discover unlogged watering from weather. Initial reserve, unknown refill amounts and real-world logging adherence are still central calibration gaps. Routine reminders must remain labelled reminders.

<!-- page break -->

# 04  Exposure calculations behind weather flags

DESCRIPTIVE METRICS, NOT CALIBRATED INJURY SCORES

```
For supported interval i of dt_i hours:
  crossing_i = x_i >= threshold       // reverse for cold
  H = sum(dt_i * crossing_i)          [modeled hours]
  D = sum(dt_i * max(x_i-threshold,0)) [units * hours]
  L = longest contiguous crossing episode

A gap, unknown value or non-crossing bin breaks the episode.
Overlap/conflict -> integral unavailable, never double-count.
Point crossing can trigger; it supplies zero duration.
Interval maxima do not establish sustained exposure hours.
```

At a32C screen,34C for1h followed by36C for2h gives H3h, L3h and D10C-hours. If a missing hour separates two1h crossing bins, known H2h but longest known episode1h. At exactly32C the screen is met while exceedance dose is0; these are different quantities.

Temperature/RH values must have a time-support definition. Hourly representative values give a modeled bin approximation; a point is not a measured full hour. v7.4 labels this assumption. A gust maximum cannot supply sustained duration. Separate24h historical exposure from the recent1h/current crossing and forecast window: yesterday's heat is not automatically a current warning.

| Flag | Boolean screen / source path | What exposure adds |
| --- | --- | --- |
| W01 heat | Any supported air T>=32C OR applicable source heat event. | Separate recent/forecast peak/crossings, H/L/D where time support permits. |
| W02 cold | T<=5C; nested possible-frost context<=2C; air-freezing context<=0C; or source event. | Cold D=sum(max(5-T,0)*dt). Air context is not tissue freezing. |
| W03 wind | Gust>=15m/s OR mean wind>=10m/s OR source wind event. | Preserve gust maxima separately. Mean-wind bin exposure is descriptive only. |

These thresholds remain ENG attention screens. Duration/exceedance describes severity of the weather departure; no retrieved evidence justifies converting them into cannabis damage probability or assigning a universal65/35 damage weighting.

<!-- page break -->

# 05  Rain and severe-weather calculations

RATE, AMOUNT, WINDOW AND DATA NATURE MUST REMAIN DISTINCT

```
meanRate_mm_per_hour = amount_mm * 3600 / intervalSeconds
knownWindowRain = sum(nonoverlapping known liquid amounts)

W04 = recognized rain/flood source event
   OR known interval mean rate >=10mm/h
   OR known rain in declared24h window >=25mm

Below all screens + complete relevant windows -> NOT_TRIGGERED
Below all screens + gaps/conflict -> UNKNOWN
Known lower bound already above screen -> TRIGGERED
```

For6mm in30minutes, mean intensity is12mm/h. For25mm over24hours, the amount screen can trigger without a10mm/h interval. A supported current point rate can also trigger W04; it supplies no retained-water amount without a known integration interval. Liquid rain cannot automatically include snowmelt.

Recent and forecast windows are evaluated separately and labelled. A partial known sum over the24h window can establish at least25mm; it cannot establish a complete total or prove the whole window stayed below25mm. Rolling windows cutting across provider bins need a validated interval adapter; uniform rainfall prorating is not assumed by the reference.

```
W05 = latest verified mapped source hazard
       AND matching location
       AND valid current/upcoming interval
       AND not cancelled/conflicted

No source coverage -> UNKNOWN, not no hail/severe weather.
```

Source phase is now retained as current or forecast. Source issuer severity is preserved; a source event is not automatically destructive. Freshness is a backend service policy, independently versioned and tested, not something the grower logs.

<!-- page break -->

# 06  Ambient context and disease-related flags

COMPUTABLE EXPOSURE MUST NOT BE MISLABELLED AS INFECTION

```
es(T) = 0.6108 * exp(17.27*T/(T+237.3))      [kPa]
airVPD = es(Tair) * (1-RH/100)
H90 = sum(dt where paired representative RH>=90%)

W09 context = known H90>0
W11 context = reported flowering AND (
    known recent/forecast rain reaching canopy OR H90>0)
W12 context = known recent/forecast rain reaching canopy

Missing rain with canopy access=yes -> UNKNOWN
Canopy access=no -> direct-rain path NOT_APPLICABLE
Unknown/partial access never silently becomes dry.
```

At30C, RH40% gives about2.55kPa air VPD; RH80% gives0.85kPa. This combines obtainable air conditions without estimating leaf temperature. VPD is atmospheric context, not measured soil moisture or plant water consumption. [S11](https://www.fao.org/4/X0490E/x0490e0e.htm)

RH90% and the72h history/24h forecast windows are ENG descriptive choices. H90 is not leaf-wet hours, a biological infection threshold or a statement that lower humidity is safe. The code labels interval-duration assumptions and keeps concurrent air pairs rather than joining daytime maximum temperature with nighttime humidity.

```
W10 predictive mildew model:
  if no validated native low-input response model:
    DISABLED + ambient context, never LOW_RISK

W07/W13/W14:
  optional topic-specific problem review only
  never weather/log-only root rot or damping-off prediction
```

PM can occur in studies with moderate average RH; that evidence does not identify a portable weather-to-incidence function. Neither air VPD, H90 nor a temperature band can safely be assigned disease-probability weights from these designs. [S38](https://apsjournals.apsnet.org/doi/10.1094/PDIS-09-22-2094-RE)

<!-- page break -->

# 07  Remaining warning calls and practical inputs

ALL FOURTEEN IDS RETAINED; NO NEW DAILY CLIENT OBLIGATIONS

| Flag | Calculation / route | Boundary |
| --- | --- | --- |
| W07 excess root water | Review only when user requests excess-root-water topic. | Bank overflow is not actual saturation or infection. |
| W08 container heat | Pot context + W01 state; merge into heat card. | No root/pot-wall temperature calculation. Unknown pot/ground remains unknown. |
| W09 damp-air context | H90>0, with phase/coverage and approximation metadata. | No measured dew or leaf wetness. |
| W10 PM | Disabled predictive route until a validated coefficient surface exists. | No obligatory high-RH/rain gate, strain-resistance guess or infection odds. |
| W11 flower context | Flowering AND(reachable recent/forecast rain OR near-saturated-air context). | No fixed internal-bud offset or exact flower day from age. |
| W12 wet-canopy context | Positive reachable liquid rain in declared recent/forecast windows. | Missing values do not clear it; shelter only removes direct rain exposure. |
| W13 establishment | Known establishment stage + requested establishment problem topic. | Unknown stage is unknown; no automatic damping-off detector. |
| W14 root/wilt | Requested root-wilt problem topic opens review. | Wilt does not automatically mean water is needed. |

Comfortable client facts remain location, pot/ground and approximate pot size, stage, sun, rain reception and optional known medium/dated size or age. Weather/history/ET0 and source events are backend data. Internal model parameters are learned separately, not shifted to growers as extra questions.

<!-- page break -->

# 08  Verification and unresolved limits

AN AUDIT CAN REMOVE BUGS WITHOUT PROVING BIOLOGICAL ACCURACY

Executed: 95 scenario tests, including16 added regression cases, plus1,000 seeded bank trials. The carried-forward79 cases still pass. Four old/new reproductions are saved in JSON. New checks cover missing/recent rain, log conflicts, censored horizons, phase separation, exposure, gap/overlap, gust support, freshness, current rain rate and invalid bank arguments.

| Remaining gap | Required implementation or evidence |
| --- | --- |
| Profile/initial/refill calibration | Independent reference data for the actual low-input workflow. No production profiles bundled. |
| Stress and evaporation physics | Fixed-loss bank is incomplete outside its validated operating region. A depleted bank does not mean modeled potential transpiration actually occurred. |
| Weather timing/support | Provider contracts for points, means, maxima, amounts and intervals; boundary-bin handling and IANA/DST tests remain adapter work. |
| Climate/source/freshness domains | Backend per-source TTL and profile applicability must be configured/tested. Optional TTL support in the emulator is not a complete production policy. |
| Growth/root expansion/repot | Dated transition/state ranges; new capacity cannot create water. |
| Prediction uncertainty | No-rain/provided-rain branches do not exhaust forecast error. Censoring remains explicit rather than producing a false deadline. |
| Disease discrimination/prevention | Prospective confirmed/followed outcomes, useful alert burden and intervention evaluation; no inferred coefficients in this revision. |

No application source was changed. The bundle includes the prior full blueprint for context and the corrected reference/tests. These repairs should be ported and tested with real adapters and consumers before any product activation.

## [S11](https://www.fao.org/4/X0490E/x0490e0e.htm) FAO Irrigation and Drainage Paper 56: water balance

[Open primary source](https://www.fao.org/4/X0490E/x0490e0e.htm)

## [S33](https://open-meteo.com/en/docs) Open-Meteo: weather/radiation/reference ET definitions

[Open primary source](https://open-meteo.com/en/docs)

## [S34](https://www.mdpi.com/2073-4395/16/6/649) Angelaki et al. (2026). Integrating Hydraulic Properties into Irrigation Management of Industrial Hemp (Felina 32) Under Mediterranean Conditions

[Open primary source](https://www.mdpi.com/2073-4395/16/6/649)

## [S38](https://apsjournals.apsnet.org/doi/10.1094/PDIS-09-22-2094-RE) Akinrinlola and Hansen (2023). Efficacy of Organic Fungicides Against Hemp Powdery Mildew Caused by Golovinomyces ambrosiae in a Greenhouse in Tennessee

[Open primary source](https://apsjournals.apsnet.org/doi/10.1094/PDIS-09-22-2094-RE)
