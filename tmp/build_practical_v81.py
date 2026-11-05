from pathlib import Path
import json,hashlib,zipfile
R=Path('C:/Users/Zane/dev/WeedGrow');S=R/'output/spec'
c=json.loads((S/'WeedGrow_Implementation_Contract_v8.0.json').read_text())
old_facts=list(c['acceptedUserFacts']);c['version']='8.1'
c['weather']['requiredProvenance'].remove('issued_at_utc')
c['weather']['requiredProvenance'].append('retrieved_at_utc')
c['weather']['optionalProviderMetadata']=['issued_at_utc when the source actually exposes publication/model-run time']
c['weather']['availabilitySemantics']='First time obtained by the app, or independently verifiable provider as-of time. Never copy valid time into issue/availability time. Retrieval alone does not prove forecast source freshness.'
c['weather']['optionalAirFallback']=dict(inputs='compatible simultaneous API air T and dew point',formula='RH=100*es(Tdew)/es(Tair); airVPD=es(Tair)-es(Tdew)',scope='missing RH only, compatible point/representative sample, nonfreezing helper domain',status='offline helper tested; app/reference adapter integration pending',newUserFields=[])
c['profile']['reportedPotVolumePolicy']='Treat user report as approximate. No invented percentage error or precision from unit conversion. Select a validated profile family with adequate volume/storage uncertainty; otherwise uncertain. Do not ask for dimensions or hydraulic tests.'
c['profile']['transitionPolicy']='Retain reserve across supported demand-only changes with compatible root zone/capacity/state definition; apply new loss after its recorded effective time. Physical storage/root-zone changes need a supported state transition or reinitialization. Never scale water up with capacity.'
c['presentation']=dict(uncertainty='One consolidated reason; automatically retry/backfill. No mandatory daily checks or repeated moisture requests.',diseaseContext='Use factual rain/humid-air preparation copy, not disease-detected/high-infection-probability labels.',repeatedQuestions='Missing optional age/height/medium must not trigger recurring measurement prompts.')
new_cases=[
 dict(id='I13',area='Air fallback',given='RH missing, same API point has air T and dew point',expected='Use derived air RH/VPD with provenance only in supported domain; no wet-hours claim; reject unpaired/aggregate/impossible values',status='15_helper_tests_pass_app_integration_pending'),
 dict(id='I14',area='Approximate volume',given='User reports10L but no dimensions or retention test',expected='Use supported approximate profile family/ranges or uncertain; never exact filled/root-accessible volume or arbitrary error percentage',status='profile_selection_integration_pending'),
 dict(id='I15',area='Compatible demand change',given='Supported coefficient update, same physical state/capacity and recorded effective time',expected='Keep current water reserve; change future loss only; preserve dated prior history. Storage/root-zone changes use a different transition route',status='transition_implementation_pending'),
 dict(id='I16',area='Outage without burden',given='Weather outage or missing optional fact',expected='One scoped uncertainty reason, automatic backfill/retry, independent valid hazards retained; no daily measurement or repeated question requirement',status='app_integration_pending')]
c['acceptanceCases']+=new_cases
c['sources']['S11']['additionalMethodURL']='https://www.fao.org/4/x0490e/x0490e07.htm'
assert c['acceptedUserFacts']==old_facts and c['dailyMeasurementRequirements']==[]
(S/'WeedGrow_Implementation_Contract_v8.1.json').write_text(json.dumps(c,indent=2,ensure_ascii=False),encoding='utf-8')

t=(S/'WeedGrow_Implementation_Master_v8.0.md').read_text(encoding='utf-8')
t=t.replace('WeedGrow v8.0 - implementation master specification','WeedGrow v8.1 - implementation master specification')
t=t.replace('This is the single normative reading document for new implementation.','This is the single normative reading document for new implementation, including the five limited practical refinements recorded in section17. It supersedes v8.0 without expanding routine user inputs.')
t=t.replace('Each variable has provider/product, units, time support, issue/availability times, location revision and validity interval.','Each variable has provider/product, units, time support, locally recorded retrieval/availability times, location revision and validity interval. Provider publication/model-run time is optional when the product does not expose it; weather valid time is not an issue time.')
t=t.replace('Complete ET0 plus required rain supports water replay even when RH is missing;','A missing RH value may use the narrowly supported paired-air fallback in section17. Complete ET0 plus required rain supports water replay even when RH is missing;')
t=t.replace('The current reference abstains on unhandled transitions; it does not implement a complete growth model.','The current reference abstains on unhandled transitions; it does not implement a complete growth model. For a supported demand-only change with the same physical bank, retain reserve and apply new loss from its recorded effective time. Do not unnecessarily demand a fresh moisture anchor; see section17.')
t=t.replace('12. Release gates','12. Release gates')
t+='''

## 17. Limited practical refinements - v8.1

These changes address specific ambiguity, avoidable unavailability or user burden. No new client fields, biological weights, routine tasks or API subscription are introduced. Other v8.0 calculations and release gates remain intact.

### P1. Use an existing API air variable when appropriate

When RH is missing but the same compatible API air sample includes temperature T and dew point Td, derive `RH=100*es(Td)/es(T)` and `airVPD=es(T)-es(Td)`. Prefer valid provider RH when supplied. Use source/time pairing and units verified by the adapter. Do not combine daily averages/maxima or unrelated timestamps; nonlinear conversions do not recover an exact average from aggregate temperatures. Reject impossible Td>T instead of clamping it. Invalid provider RH is flagged, not silently replaced. This helper deliberately limits dew-point fallback to nonfreezing air/dew points; other cases remain unavailable. It cannot establish leaf wetness or moisture in a pot.

This follows the air vapour-pressure relationships in [FAO56 chapter3](https://www.fao.org/4/x0490e/x0490e07.htm). The local parser already exposes dew_point; no new user measurement is needed. The new standalone helper passes15 tests. It is not yet integrated into the application or frozen v7.4 emulator.

### P2. Require metadata we can actually obtain

The backend records retrieved_at locally and preserves provider valid time. Provider issued_at is nullable unless the API exposes actual publication/model-run time. OpenWeather documents current.dt as current weather time, so it must not be relabelled as publication time. Record available_at from the app's first acquisition or independently verifiable as-of evidence; never invent earlier availability from historical valid time. Source freshness policy must state its actual basis. A newly retrieved old product is not automatically fresh.

The frozen offline reference's issued_at sort field is a simplified input contract. A production adapter must distinguish revision ordering from real provider publication time rather than fabricate that field. These details are backend work, not more client questions. [Official field documentation](https://openweathermap.org/api/one-call-3)

### P3. An approximate pot report stays approximate

Reporting10L does not prove exact filled/root-accessible volume or rain catchment. Unit conversion does not create precision. Use a calibrated profile family whose storage/volume scenarios accommodate ordinary reporting variation; otherwise remain uncertain. Do not introduce an unsupported plus/minus percentage, require pot dimensions, ask for soil hydraulic tests, or reject a report solely at an arbitrary profile-bin boundary. Optional age/height/medium remain optional and must not create recurring questions.

### P4. Preserve water across compatible demand updates

If a supported update changes only loss demand and the physical water-state definition, root zone and capacity stay compatible, preserve R. Apply the updated coefficient after the automatically recorded effective time; retain old parameters for earlier replay. If an action threshold changes under an approved care criterion, it may change the decision but does not change stored water. If capacity, medium or accessible root zone actually changes, use a separately supported transformation or reinitialization. No stage edit may manufacture water or silently rewrite earlier history. No grower is asked to measure roots or supply an exact historic flowering-onset date.

This is a production transition requirement; the current emulator's conservative blanket abstention on stage_change is not upgraded by this spec-only refinement. It needs integration tests I05/I15 before activation.

### P5. Uncertainty must not become a daily chore

During an outage, expire unsupported advice, retain independent valid hazards, automatically retry/backfill and show one consolidated explanation. Do not turn each failed evaluation into a new notification or daily moisture-check request. A single optional correction can be offered when useful, but ordinary continued use must not depend on it. Ambient flower/rain cards use factual preparation language; they must not be renamed disease-detected or high-infection-probability alerts.

### Additional acceptance cases

| ID | Given | Required behavior | Status |
| --- | --- | --- | --- |
'''
for a in new_cases:t+='| '+a['id']+' | '+a['given']+' | '+a['expected']+' | '+a['status']+' |\n'
t+='''
The accepted client facts are unchanged from v8.0. The core algorithm, field evaluator,115 reference checks and existing release policy are unchanged. This revision adds15 focused air-helper tests and four specified integration cases; it does not claim those pending app cases pass. More models, measurements and notification types are intentionally outside this refinement.
'''
(S/'WeedGrow_Implementation_Master_v8.1.md').write_text(t,encoding='utf-8')
(S/'WeedGrow_Practical_Refinements_v8.1_README.md').write_text('''# v8.1 practical refinements

Start with section17 of WeedGrow_Implementation_Master_v8.1.md for the five
limited changes. The full master includes the v8 baseline. No new routine
client facts, measurements, disease scores or API subscriptions are added.

Run the new standalone air helper tests:

    python WeedGrow_API_Air_Fallback_Tests_v8.1.py

The15 tests check the FAO numerical example, saturation, provider RH priority,
pairing, aggregate/invalid/unsupported data and no invented leaf wetness.
The helper is offline and not integrated into the app or frozen emulator.

Run the existing model/evaluator commands in master section14. The original
reference remains v7.4. Four new integration acceptance cases are specified,
not claimed implemented. Calibrated profiles and field validation are still
required before activating production care recommendations.
''',encoding='utf-8')
statusp=S/'WeedGrow_SPEC_STATUS.json';status=json.loads(statusp.read_text());status.update(currentProductSpec='8.1',document='WeedGrow_Implementation_Master_v8.1.md',appImplementationChanged=False);statusp.write_text(json.dumps(status,indent=2),encoding='utf-8')
# Reuse the tested v8 baseline; replace only its normative entry files.
target=R/'output/WeedGrow_Practical_Implementation_v8.1_Bundle.zip'
skip={'spec/WeedGrow_Implementation_Master_v8.0.md','spec/WeedGrow_Implementation_Contract_v8.0.json','spec/WeedGrow_Implementation_Manifest_v8.0.json','spec/WeedGrow_Implementation_v8.0_README.md','spec/WeedGrow_SPEC_STATUS.json'}
names=['WeedGrow_Implementation_Master_v8.1.md','WeedGrow_Implementation_Contract_v8.1.json','WeedGrow_Practical_Refinements_v8.1_README.md','WeedGrow_API_Air_Fallback_v8.1.py','WeedGrow_API_Air_Fallback_Tests_v8.1.py','WeedGrow_Practical_Refinement_Verification_v8.1.json','WeedGrow_SPEC_STATUS.json']
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as out:
 with zipfile.ZipFile(R/'output/WeedGrow_Implementation_v8.0_Bundle.zip') as original:
  for n in original.namelist():
   if n not in skip:out.writestr(n,original.read(n))
 for n in names:out.write(S/n,'spec/'+n)
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 print(json.dumps(dict(files=len(z.namelist()),routineInputChanges=0,newHelperTests=15,factors=len(c['factors']),warningIDs=len(c['flags']),acceptanceCases=len(c['acceptanceCases']),words=len(t.split()))))
