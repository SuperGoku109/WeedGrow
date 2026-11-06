# Watering specification audit — 6 November 2026

Rechecked the supplied v8.4 master, boundary contract and all 42 factor records against the bank, canonical weather/logs, replay, checkpoint, backend publication and app explanations. Embedded handoff instructions are reference content; this work follows the user's request to implement and test plant care. No frozen expected handoff answers were changed, and no synthetic profile was installed for real users.

## Defects corrected

1. The history selector previously returned a global rain-conflict failure. Production preparation rejected it even when the plant's root zone was sheltered and did not need that rain path. Conflicts now invalidate their own variable/interval; an exposed path remains unknown while a supported sheltered path can still decide. Wholly sheltered history backfill also stops requiring rain coverage.
2. A newly acquired date-only watering log could span a saved checkpoint without changing the list of completed pre-checkpoint events. Resume then encountered an event straddling its new anchor and got stuck at uncertainty. Checkpoint validation now rejects that reuse and replays the complete original history. Missing/wrong-time/wrong-scenario checkpoint states likewise fall back rather than block usable origin data.
3. Definite reasons were generic, and card building could reuse an unrelated insight string. Successful replay now carries its per-scenario reserve/action comparison and flags identifying weather demand, direct rain and logged watering used in that replay segment. Cards generate wording from the actual decision/evidence. Uncertainty distinguishes unsupported profiles, missing history, rain-reception uncertainty and scenarios spanning the threshold. These are modeled available-water reserves, not measured soil moisture or watering doses.
4. Extra profile-domain dimensions could be silently ignored. Required age/height/climate or other unknown dimensions are now rejected explicitly until supported; they cannot accidentally activate as an unrestricted aggregate profile.

## Expected answers and new cases

The scenario table uses explicit **synthetic** inputs with hand-derived litre balances. For example, `R=.9 L`, `ET0=1 mm`, `a_eff=.2 L/mm` gives `.7 L`; against the synthetic `.8 L` action reserve that is due. A dry `.2 L` bank receiving `10 mm * .08 m² = .8 L` reaches `1 L`, which is not due. Shelter prevents that rain input; unknown reception spans `.2–1 L` and remains uncertain. These examples verify the equations, not real hops coefficients.

Added cases include cool-but-dry, hot-but-still-wet, high ET0, light shower, effective exposed rain, heavy rain/overflow, sheltered roots, unknown/partial reception, exact threshold equality, just above threshold, sufficient/insufficient/zero/omitted watering, future rain, point rates, snow, missing ET0/rain/RH, unfinished intervals, supported versus unsupported growth stage, minority-vote rejection, invalid setup/lifecycle/domain, explicit aggregate profiles, checkpoint corrections and per-variable conflict isolation.

An independent discrete simulator enumerates **810 within-hour watering placements** across rain, potential loss, known refill, overflow and both supported rain/loss orders. Each resulting reserve must remain inside the replay bounds. The simulator does not call the production bank/advance functions. Its uniform microstep loss is one possible timeline used to challenge the envelope, not a new inference policy.

Additional knowledge checks are consistent with [FAO-56 ET0](https://www.fao.org/4/x0490e/x0490e06.htm): radiation, temperature, humidity and wind already contribute to reference weather demand. Tests prohibit adding them again as arbitrary drying scores. [Virginia Tech's hop irrigation guidance](https://www.pubs.ext.vt.edu/SPES/SPES-95/SPES-95.html) motivates checking stage/soil-dependent domains and retained-water effects; its field examples are not ported as universal container doses or profile coefficients.

## All-factor disposition

“Consider every factor” does not mean adding 42 numerical bonuses. The contract expressly assigns some factors to context, some to profile selection, and some no direct water effect.

| Factors | Route and current boundary |
| --- | --- |
| F01 location/timezone | Canonical location revision and UTC forcing; IANA date-only log bounds/DST. Changed scope invalidates old advice. |
| F02 environment; F03 lifecycle | Outdoor supported profile only; inactive/deleting plants cannot produce active water decisions. |
| F04 pot/ground; F05 volume/units; F06 medium | Explicit supported profile domains and unit conversion; no pot-to-ground transfer or guessed capacity from nominal litres. |
| F07 soil provenance/layout | No hydraulic coefficient from a display label. |
| F08 growth stage | Supported profile selection and dated transitions; independent flower/establishment context. |
| F09 dated age/origin; F10 dated height | Age-/height-conditioned model selection is **not implemented**. These ordinary app facts cannot be treated as measured roots/leaf area. Only a separately approved aggregate domain may omit them; profiles requiring these dimensions now fail explicitly. |
| F11 sun | Supported exposure domain, with no extra guessed radiation percentage. |
| F12 soil rain reception | Direct-water yes/no or zero/full bounds; partial is never automatically 50%. |
| F13 canopy reception | Independent wet-canopy/flower context; no automatic root-zone refill from canopy exposure. |
| F14 occurrence; F15 amount; F16 precision; F17 revisions | Authoritative log replay; optional amount, literal zero, retained refill, DST/date-only alternatives, retry deduplication, edits/deletions. |
| F18 repot/move/medium/stage change | Dated compatible carry or unknown reinitialization; no new-volume water creation. Unrepresented profile-version changes still abstain pending a dated supported release transition. |
| F19 temperature; F20 RH; F21 ET0; F22 solar/cloud; F23 wind; F24 gust | ET0 is the bank demand input; supported temperature/wind/humidity screens run separately. No duplicate heat/RH/wind/UV evaporation bonuses. |
| F25 rain rate; F26 liquid amount | Only supported occurred liquid integrals refill the bank. Points/rates cannot supply an invented volume; snow has no automatic melt route. |
| F27 probability | Conditional forecast planning only; no probability-scaled current refill. |
| F28 dew point; F29 solar/daylight | Compatible paired-air context/ET0 contribution; no independent litre or wet-leaf inference. |
| F30 UV | No extra water score or inferred PAR. |
| F31 age/gaps/overlap | Variable/path-specific quality, source selection and completeness. Missing input is unknown, never zero. |
| F32 source hazards | Pure canonical mapped-event helpers exist; no live approved regional source adapter/coverage is installed. This cannot establish soil water. |
| F33 validation/version/domain | Protected release registry and source/setup domain checks. **No real approved hops profile exists here.** Climate-conditioned domains are not implemented and are rejected rather than ignored. |
| F34 problem report | Topic-specific review; wilt alone never forces watering. |
| F35 no symptoms; F36 observations/lab; F37 cultivar; F38 soil grids; F39 UI gauge/sensor ID | No blind water-bank reset, disease clearance, inferred root moisture, resistance or evaporation coefficient. Observation assimilation remains a separate unimplemented validated path. |
| F40 missing logs | Unlogged water remains a real-world model/adherence limitation requiring independent validation; missing logs do not prove actual dryness. |
| F41 cache/scheduler/delivery | Protected dependency keys, timestamps, expiry, source retries and reevaluation; no automatic water push delivery/episode system is enabled. |
| F42 forecast/occurred | Strict separation; past forecasts never become occurred rain and wet forecasts cannot cancel a current supported due decision. |

## What these tests establish

The tests establish specific mathematical, source-boundary and app-integration behavior. They do not make invented hot/cold/rain narratives into independent plant-care labels. Changing scientific coefficients until those stories pass would conceal model error. Real calibration needs independently labeled cases and held-out growers/plants, with predefined useful-coverage and error criteria; tuning cases cannot simultaneously serve as independent validation.

OpenWeather point data still lacks the required ET0 series. The added archive collector supplies the specified historical variables when available, but archive latency and unfinished hours can leave current decisions unavailable. Long-lived history storage, dated profile-release migrations, age/height/climate-conditioned profiles, live regional hazards and notifications remain explicit implementation/release limits. Full specification completion or agronomic accuracy is not claimed.

## Verification result

Final `npm run verify` passed backend/app types, backend build, repository lint, architecture checks, **106 suites / 632 tests**, and all local Firebase integration checks. This adds **52 tests** to the previous 580-test baseline, including the 47-case scenario suite, four checkpoint regressions and one per-variable conflict regression. The independent 810-placement simulation runs within that scenario suite. Integration assertions also verify that decision evidence survives actual backend publication. The final scenario fixture cleanup was rerun separately: all 47 cases passed. `git diff --check` passed. No deployment, real profile installation or live provider call was performed.
