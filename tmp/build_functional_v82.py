from pathlib import Path
import json,hashlib,zipfile
R=Path('C:/Users/Zane/dev/WeedGrow');S=R/'output/spec'
v=json.loads((S/'WeedGrow_Functional_Verification_v8.2.json').read_text());assert v['allPassed']
c=json.loads((S/'WeedGrow_Implementation_Contract_v8.1.json').read_text());original_facts=list(c['acceptedUserFacts']);c['version']='8.2'
c['weather']['referenceWaterFeed']='Open-Meteo forecast + separately classified archive/model-history; actual commercial/deployment configuration pending'
c['weather']['mappings']={
 'openmeteo_forecast':{'liquid_rain_mm':'rain + showers; either null -> null','et0_mm':'et0_fao_evapotranspiration preceding-hour sum','shortwave_w_m2':'shortwave_radiation preceding-hour mean','air_fields':'time points at returned time','kind':'forecast, including past_days'},
 'openmeteo_archive':{'liquid_rain_mm':'rain already includes local showers','kind':'historical_model_estimate, never onsite measurement','time_gate':'no valid timestamp later than retrieval'},
 'openweather_onecall':{'current':'separate point','hourly':'forecast points','daily':'forecast including daily[0], with IANA day bounds','rain_1h':'point rate mm/h, not generic daily amount','solar':'original UTC epoch unchanged'},
 'openweather_timemachine':{'envelope':'data[]','kind':'historical_weather_estimate','coverage':'one timestamp response is not a bulk daily history'},
 'openweather_alerts':{'action':'retain raw event records','classification':'requires approved regional source mapping; do not infer hail from free text'}}
c['profile']['initializationPolicy']={'noProfile':'uncertain/unsupported','savedSupportedState':'replay complete occurred/model-history to evaluation time','noAnchor':'available-bank range[0,C], not R=C; mark unanchored','knownWaterUnknownRetention':'delivered range[0,appliedL] unless supported tighter range','unknownWaterAmount':'conservative delivered-bank range[0,C], giving updated reserve[Rlow,C]; not a full-refill assertion','narrowing':'only supported profile/state/reference evidence, never compliance with reminders','meaning':'model bounds only, no probability or measured moisture'}
c['profile']['transitionImplementation']={'boundary':'replay old state to exact recorded change boundary first','compatibleDemandOrThresholdChange':'same root-zone/state definition and C, trusted compatibility ->carry R unchanged; update future demand/A only','physicalOrIncompatibleChange':'supported transformation or unknown reinitialization[0,newC]','approval':'new profile/version must pass release gate again; carrying R does not carry approval'}
c['presentation']['defaults']={'uncertainWater':'one stable nonpushing card per plant/reason category; no daily-check request','diseaseContext':'in-app factual preparation only; predictive push disabled','dueWater':'card/push only from approved production result','sourcePush':'only approved trusted severe source, consent and enabled policy; episode/cooldown layer still required','engineeringWeatherScreen':'in-app preparation; no default push or injury probability','sideEffects':'reference helpers send zero notifications'}
c['calibrationWork']=[
 {'parameter':'capacity/accessible water','value':None,'source':'CAL_REQUIRED','teamAction':'reference retention/root-domain studies with ordinary setup features used at inference'},
 {'parameter':'total effective loss','value':None,'source':'CAL_REQUIRED','teamAction':'fit only identifiable total loss; reference measurements account for drainage/input/mass changes'},
 {'parameter':'action reserve/care outcome criterion','value':None,'source':'CAL_REQUIRED','teamAction':'predefine independent agronomic care endpoint before holdout outcomes'},
 {'parameter':'retained refill and rain capture ranges','value':None,'source':'CAL_REQUIRED','teamAction':'evaluate known/omitted amount and reception scenarios without extra ordinary-user measurement requirements'}]
c['implementationEvidence']={'functionalReferenceTests':v['testsRun'],'capturedPayloads':4,'newRoutineUserInputs':0,'appIntegrationChanged':False,'calibratedProfilesAdded':0,'modelAccuracyValidated':False}
for case in c['acceptanceCases']:
 if case['id']=='I01':case['status']='captured_payload_reference_normalizers_pass_app_parser_integration_pending'
 if case['id']=='I03':case['status']='IANA_23_25h_day_bounds_reference_pass_log_backend_integration_pending'
 if case['id']=='I15':case['status']='compatible_carry_and_reinitialization_reference_pass_app_integration_pending'
 if case['id']=='I16':case['status']='nonpushing_deduplicated_display_reference_pass_retry_integration_pending'
assert c['acceptedUserFacts']==original_facts and c['dailyMeasurementRequirements']==[]
(S/'WeedGrow_Implementation_Contract_v8.2.json').write_text(json.dumps(c,indent=2,ensure_ascii=False),encoding='utf-8')
t=(S/'WeedGrow_Implementation_Master_v8.1.md').read_text(encoding='utf-8')
t=t.replace('WeedGrow v8.1 - implementation master specification','WeedGrow v8.2 - implementation master specification')
t=t.replace('It supersedes v8.0 without expanding routine user inputs.','It supersedes v8.0/v8.1 without expanding routine user inputs. Section18 folds in the verified provider mappings and implements the feasible adapter/state/display reference requirements.')
t=t.replace('The current reference abstains on unhandled transitions; it does not implement a complete growth model.','The frozen v7.4 emulator abstains on unhandled transitions. The v8.2 state helper now specifies and tests compatible carry/reinitialization; neither supplies a complete growth model.')
t=t.replace('Current replay credits only occurred water.','Current replay credits only supported occurred/model-history water, with its product lineage retained.')
t=t.replace('This is a production transition requirement; the current emulator\'s conservative blanket abstention on stage_change is not upgraded by this spec-only refinement. It needs integration tests I05/I15 before activation.','The v8.2 helper now tests compatible carry, replay-to-boundary and unknown physical reinitialization. The frozen v7.4 orchestrator still abstains on stage_change; wiring the helper into a production engine needs I05/I15 integration tests before activation.')
t+='''

## 18. Feasible requirements completed - v8.2

This section is normative where it sharpens earlier language. It adds no client facts or routine work. It supplies a tested standalone implementation reference, not an activated app integration. Calibrated plant parameters and production release evidence remain explicitly unassigned.

### A. Verified source decision and exact mappings

The recommended water-model feed is Open-Meteo weather/rain/ET0 together, with a separately selected archive/history product and preserved lineage. Existing OpenWeather display/geocoding/source-hazard functionality can remain. This is a reference/configuration choice; no subscription, purchase or migration was made. The backend must select appropriate commercial access before production. Actual successful probes were made30October2026 using public Johannesburg coordinates: OpenWeather48 hourly/8 daily; timestamp history1record; Open-Meteo96 forecast/past-day hourly rows and72 archive rows.

| Product | Required normalization | Avoided mistake |
| --- | --- | --- |
| Open-Meteo Forecast | Liquid rain=rain+showers; either missing ->unknown. ET0 is preceding-hour mm sum; shortwave preceding-hour W/m2 mean. Air values remain points. | Captured forecast had0mm rain and0.6mm showers; rain alone misses all liquid precipitation. |
| Open-Meteo Archive | rain already includes showers; historical model estimates retain source/model selection. No future row may be classified historical. | No double addition of showers, no future historical data. |
| OpenWeather One Call | Current point, hourly forecast points, daily forecasts including today remain separate. Rate stays mm/h. | No daily[0] observed flag, rate-as-daily-volume or forecast-night-RH attached to a current observation. |
| OpenWeather Time Machine | Dedicated data[] adapter, historical timestamp point, no invented full-day coverage. | The existing app parser currently discards this envelope. |
| OpenWeather solar/source events | Preserve UTC solar epochs; retain raw alerts/codes separately. Regional hazard mapping requires approval. | No two-hour UTC shift; source prose is not a tested hail classifier. |

The live-payload evidence and controlled parser reproductions are retained separately in the weather audit. Omitted OpenWeather point rain can be zero only under the documented valid product sample contract; incomplete/malformed data is unknown. A point rate never supplies retained litres without an interval. [OpenWeather documentation](https://openweathermap.org/api/one-call-3)

Open-Meteo past_days forecasts remain forecasts even after time passes. Archive/history products are regional estimates, not plant observations; ERA5/ERA5-Land latency differs from IFS. The captured archive used provider selection, not a pinned operational model. Production must choose and test a recent-history product, backfill policy and climate/source profile; the helper records provider_best_match_unpinned rather than inventing model/run provenance. Do not splice datasets as interchangeable observations. [Forecast](https://open-meteo.com/en/docs), [Archive](https://open-meteo.com/en/docs/historical-weather-api)

The new normalize_meteo and normalize_openweather helpers implement these mappings on captured real payloads. They are independent of the app's current parser, which remains to be corrected/wired in. Daily boundaries use IANA timezone data, including23/25hour days; the backend runtime must include that data. No grower supplies timezone offsets or provider metadata.

### B. Initialization and unknown amounts are now specified

1. Without a supported profile, output uncertain/unsupported. Never substitute a universal pot coefficient or timer.
2. With a supported saved state, replay the declared history to evaluation time. Gaps or unhandled transitions cannot be silently filled.
3. With capacity C known to the profile but no defensible anchor, start with available-bank range[0,C] and mark unanchored. This means unknown, not full. If even C is unsupported, remain unsupported.
4. For an omitted watering amount, a conservative bank-delivery bound[0,C] updates reserve range[L,U] to[L,C]. The lower endpoint does not magically become moist. A validated profile may justify tighter ranges; a reminder or user compliance does not.
5. For known applied volume V and unknown retention, delivered bounds[0,V] update to[min(C,L),min(C,U+V)]. With supported retention bounds[a,b], update to[min(C,L+aV),min(C,U+bV)]. Literal zero causes no refill.
6. These are model envelopes, not probabilities or measured moisture intervals. Narrowing/releasing a care decision requires validated state/profile coverage; missing/unlogged watering remains an assumption to evaluate in the low-input cohort.

The initialize_bank and logged_water_update helpers implement these steps without asking users for initial moisture or mandatory amounts. The conservative ranges may leave uncertain; the spec makes that consequence explicit instead of fabricating precision.

### C. State transitions have executable behavior

Replay the old state to the recorded transition boundary before applying a change. For a trusted compatible demand-only or action-threshold update with the same physical bank/root-zone key and C, carry reserve unchanged and apply the new demand/threshold forward. The root-zone key is a backend profile identity, not a root measurement requested from the user.

For a physical or incompatible change, use a supported transformation; when absent, reinitialize unknown[0,newC]. An upper bound of newC does not assert water was added. Never multiply old reserve by a new capacity ratio. Every profile/version change rechecks approval; carrying water must not carry authorization. Existing dated stage edits need no exact historic flowering date from the grower.

The transition_bank helper tests these rules. Wiring dated parameter segments into the full replay engine remains application/reference-orchestrator integration work. The helper does not pretend to estimate root growth or the actual water introduced during repotting.

### D. Concrete display and delivery defaults

| Situation | Default behavior |
| --- | --- |
| Water estimate unknown | One stable in-app explanation per plant/reason category. No uncertainty push or daily-check request. Automatic retry/backfill is backend work. |
| Ambient flower/rain/humidity context | Factual preparation card, grouped with related weather context. No predictive disease push or infection-probability language. |
| Water candidate from unapproved model | No production due card/push. Debug candidate stays internal. |
| Approved production watering due | Estimated-care card; push additionally needs consent, enabled policy and episode/cooldown checks. |
| Verified severe source event | Preserve issuer severity. Push requires approved regional adapter, valid trusted event, consent, enabled policy and episode/cooldown checks. |
| Engineering-only weather screen | Preparation card; no default push or crop injury probability. |

The display_plan helper implements eligibility and stable card keys; it sends nothing. The existing episode planner still handles repeat cooldown/cancellation/escalation. Real source mapping, app permissions, delivery retries and background scheduling require integration tests; helper tests do not claim those services are live.

### E. Calibration work retained as explicit blockers

| Parameter/evidence | What is required | Ordinary user burden |
| --- | --- | --- |
| Effective capacity and initial-state coverage | Reference retention/access-domain measurements and prospective state coverage. | Existing setup only; no root-depth or water-holding test. |
| Total effective loss coefficient | Fit identifiable total loss with independent reference accounting for input/drainage/mass changes; validate deployment weather/source domain. | Automatic API plus existing setup, not leaf/PAR measurements. |
| Action reserve and care endpoint | Predefine a defensible care criterion, label independently and evaluate useful decision coverage and errors. | No daily moisture logging. |
| Unknown refill and rain capture/delivery ranges | Study exposed/sheltered setups and known/omitted amounts in a separate cohort; evaluate real logging adherence. | Routine watering log; amount remains optional. |
| Activation and disease prediction | Held-out outcomes, preregistered acceptance targets, statistical/domain review and completed app integration. | No extra routine client fields. |

Those parameters remain null/unapproved. Generic bounds complete uncertainty handling; they do not constitute calibrated profiles. The reference cannot prove a particular real plant needs water from a hypothetical bank threshold.

### F. What to run and what passed

```powershell
python WeedGrow_Functional_Tests_v8.2.py
python WeedGrow_Independent_Tests_v7.5.py --include-existing
python WeedGrow_Field_Evaluator_Tests_v8.0.py
python WeedGrow_API_Air_Fallback_Tests_v8.1.py
```

The new functional suite checks real captured payload mappings, units, point/amount separation, UTC solar times, historical envelopes, DST day bounds, initialization/refill bounds, transitions and nonpushing context/uncertainty behavior. Existing suites retain their earlier purposes. None measures plant-care accuracy. The new helper is an offline implementation reference; app source and live subscriptions remain unchanged.
'''
t+=f'\nNew functional reference checks passed: {v["testsRun"]}. The42 factors,14 warning IDs and accepted client facts are unchanged.\n'
(S/'WeedGrow_Implementation_Master_v8.2.md').write_text(t,encoding='utf-8')
(S/'WeedGrow_Functional_v8.2_README.md').write_text('''# v8.2 functional handoff

The master specification is consolidated; section18 records exactly what was
completed and what still requires evidence/integration. The JSON contract is
the machine-readable companion. Start with the section18 tables.

The functional reference implements provider normalization, IANA daily bounds,
unknown-state/refill bounds, compatible transitions and display eligibility.
It reads captured payload fixtures locally. It makes no API requests or app
writes and sends no notifications. Tests run with Python3.10+; zoneinfo needs
IANA timezone data (available in the tested bundled runtime; Windows Python
deployments may need the tzdata package). No grower installs or supplies this.

Run the four test commands in master section18. For the older v7.4 emulator,
use its bundled independent test harness. The new helpers are not wired into
that frozen orchestrator or production app. All fixture coordinates/weather
are the public Johannesburg audit sample captured30October2026, not user
plant measurements. Plant-state test values are synthetic.

No scientific coefficients, approval records or accuracy targets were invented.
No new client facts, daily measurements, factor types or warning IDs were added.
Source products are preserved; archived forecasts do not become observations.
Unknown ranges remain unknown until supported profiles/state evidence exist.

The reference water feed uses Open-Meteo mappings with retained OpenWeather
support; commercial access and production activation are not configured by
this package. Read the source audit for exact live-payload evidence and known
defects still present in the app parser.
''',encoding='utf-8')
statusp=S/'WeedGrow_SPEC_STATUS.json';status=json.loads(statusp.read_text());status.update(currentProductSpec='8.2',document='WeedGrow_Implementation_Master_v8.2.md',functionalReference='WeedGrow_Functional_Reference_v8.2.py',appImplementationChanged=False,productionActivationReady=False);statusp.write_text(json.dumps(status,indent=2),encoding='utf-8')
oldskip={'spec/WeedGrow_Implementation_Master_v8.1.md','spec/WeedGrow_Implementation_Contract_v8.1.json','spec/WeedGrow_Practical_Refinements_v8.1_README.md','spec/WeedGrow_SPEC_STATUS.json'}
names=['WeedGrow_Implementation_Master_v8.2.md','WeedGrow_Implementation_Contract_v8.2.json','WeedGrow_Functional_Reference_v8.2.py','WeedGrow_Functional_Tests_v8.2.py','WeedGrow_Functional_Verification_v8.2.json','WeedGrow_Functional_v8.2_README.md','WeedGrow_SPEC_STATUS.json']
target=R/'output/WeedGrow_Functional_Implementation_v8.2_Bundle.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as out:
 with zipfile.ZipFile(R/'output/WeedGrow_Practical_Implementation_v8.1_Bundle.zip') as old:
  for name in old.namelist():
   if name not in oldskip:out.writestr(name,old.read(name))
 for name in names:out.write(S/name,'spec/'+name)
 for f in sorted((S/'weather_fixtures').glob('*.json')):out.write(f,'spec/weather_fixtures/'+f.name)
 for name in ['Weather_API_Verification_2026-10-30.md','actual_parser_audit.json','live_probe_report.json']:
  out.write(R/'output/weather_api_audit'/name,'spec/weather_evidence/'+name)
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 print(json.dumps(dict(bundle=str(target),files=len(z.namelist()),functionalChecks=v['testsRun'],factors=42,warnings=14,newRoutineInputs=0,appChanges=False)))
