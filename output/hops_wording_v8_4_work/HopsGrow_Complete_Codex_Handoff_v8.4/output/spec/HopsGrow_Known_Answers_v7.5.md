# Fixed expected-answer catalogue - v7.5

These are exact conclusions within explicitly supplied synthetic model assumptions. They are not observations of actual plant water need.

All cases use capacity2L, action reserve0.8L, effective loss coefficient0.20m2, rain catchment0.08m2 and irrigation retention0.80. These are backend test values, not required user inputs or calibrated hops constants. The history under test is one hour. Current-time watering follows that history.

| Case | Expected modeled reserve (L) | Candidate result | Independent arithmetic / reason |
| --- | --- | --- | --- |
| B01_dry | [0.7] | water | 1.0 - 1.5*(0.15+0.05) = 0.7 < 0.8 action reserve |
| B02_still_available | [1.0] | not_due | 1.3 - 0.3 = 1.0 > 0.8 |
| B03_exact_action_boundary | [0.8] | water | 1.1 - 0.3 = 0.8; declared rule includes equality |
| B04_zero_demand | [1.2] | not_due | Zero forcing and no inputs leave reserve unchanged |
| B05_exposed_rain | [1.0] | not_due | 5 mm * 0.08 m2 = 0.4 L; 0.7+0.4-0.1=1.0; neither clipping bound reached |
| B06_sheltered_rain | [0.6] | water | Direct rain delivery zero; 0.7 - 0.1 = 0.6 |
| B07_known_refill_now | [0.9] | not_due | 1.0-0.3 + 0.25*0.8 = 0.9; watering exactly now follows historical loss |
| B08_small_refill_now | [0.78] | water | 1.0-0.3 + 0.1*0.8 = 0.78; watering today does not force not_due |
| B09_unknown_refill | [0.78, 1.02] | uncertain | Small scenario:0.7+0.08=0.78; large:0.7+0.32=1.02; they straddle0.8 |
| B10_storage_overflow | [1.5, 2.0] | not_due | Rain delivers3L. Inputs-first:min(2,1+3)-0.5=1.5; loss-first:min(2,1-0.5+3)=2.0 |
| B11_depleted_then_watered | [0.8] | water | Bank clips at0 after0.5 potential loss, then1*0.8=0.8. Does not assert actual plant transpiration0.5L |
| B12_no_double_weather_bonus | [0.7] | water | Same supplied ET0/profile as B01 means same bank; heat still independently raises a weather flag |
| B13_forecast_not_current | [0.7] | water | Tomorrow's96mm does not change today's1.0-0.3 reserve; W04 can still trigger for forecast rain |

The release registry is empty: production needs_water remains null in every synthetic case. Only candidate calculations are tested against these answers.

The expected-answer JSON is the fixed oracle. Do not replace its values with new engine outputs. Changes to assumptions require an independently justified change to the case definition.

The additional tests independently verify the air-VPD numerical relation, exposure arithmetic, event-order invariance, retry handling and the absence of invented disease probabilities. The exhaustive discrete oracle checks96 parameter sets and every within-step addition/removal order for each set.

Seven deliberate in-memory faults were each detected. The report records the exact target engine hash, test counts and fault outcomes. This is error-detection evidence, not a horticultural accuracy score.