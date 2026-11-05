from pathlib import Path
import json, math, re

ROOT=Path(__file__).resolve().parents[2]
# Load the existing content model in memory. Never render or overwrite v5.0.
base=(ROOT/'tmp/pdfs/build_spec_v5.py').read_text(encoding='utf-8').split('# Reuse only the previously reviewed presentation code, never its v4 content.',1)[0]
base=base.replace('v5.0','v5.1').replace('algorithmVersion: "5.0"','algorithmVersion: "5.1"')
exec(compile(base,'inherited_predictive_spec_content','exec'))
old_blocks=blocks[:]
refs.update({
'R19':('Penn State Extension: Powdery Mildew','https://extension.psu.edu/powdery-mildew','Humidity, free-water and dispersal relationships vary among powdery mildews. General context; no cannabis-specific infection threshold.'),
'R20':('UC IPM (2024): Damping-off Diseases in the Garden','https://ipm.ucanr.edu/home-and-landscape/damping-off-diseases-in-the-garden/','Vulnerable emerging seedlings, root-zone conditions and differences between air and soil temperature. General host evidence.'),
'R21':('National Weather Service: Dew and Frost Development','https://www.weather.gov/source/zhu/ZHU_Training_Page/fog_stuff/Dew_Frost/Dew_Frost.htm','Dew-point depression, radiational cooling, cloud and wind context; ambient conditions do not measure a leaf surface.'),
'R22':('University of Minnesota Extension (2026): Keep gardens thriving through the heat','https://extension.umn.edu/about/our-stories/news/yard-and-garden-news/keep-gardens-thriving-through-the-heat','Heat-related wilt can occur despite adequate soil water. General garden evidence; no universal cannabis injury temperature.'),
'R23':('National Weather Service: Understanding Wind Chill','https://www.weather.gov/safety/cold-wind-chill-chart','Human wind-chill index definition and skin-oriented assumptions; not a plant temperature model.'),
'R24':('NOAA JetStream: Thunderstorm Hazards - Hail','https://www.noaa.gov/jetstream/hail','Hail is a storm process; do not infer it from surface RH, rain chance or surface freezing temperature.'),
})
refs['R07']=(refs['R07'][0],'https://ask.ifas.ufl.edu/publication/PP379/pdf',refs['R07'][2])

warnings=[]
def warning(wid,title,family,route,requirements,predicate,factors,blocks_,missing,output,limits,refs_,cases):
    warnings.append(dict(id=wid,title=title,family=family,route=route,requirements=requirements,predicate=predicate,
        factors=[dict(factor=f,role=r,effect=e,missing=m) for f,r,e,m in factors],
        suppressions=blocks_,missingBehavior=missing,output=output,claimLimits=limits,references=refs_,acceptanceCases=cases))

warning('W01','Heat exposure','heat','weather_screen_or_official',
 'Active outdoor plant and usable actual air temperature or applicable official heat alert. A forecast uses its own valid time; duration needs a supported series.',
 'Official applicable heat event OR current paired/location-valid Tair >= heatAttentionC OR a covered forecast interval crossing the configured air-temperature screen. Current instant supports current hot conditions, not hours of exposure.',[
 ('Air temperature / duration','trigger','Higher T and longer covered exposure strengthen the stated weather exposure; a single maximum cannot establish duration.','No numeric branch without T; an official alert can remain an attributed regional alert.'),
 ('Radiation, sun exposure and acclimation','modifier','Reported direct exposure or a recent verified move from shade can make a protection message more relevant; no fixed leaf-temperature correction.','Keep local solar/acclimation uncertainty; do not assume all outdoor plants are in full sun.'),
 ('Stage / root establishment','routing','Developing plants may merit earlier attention and suitable wording; this does not change the air measurement.','Generic heat message remains eligible; no inferred seedling status from unknown age.'),
 ('Water reserve / root evidence','action_conflict','Supported low reserve can separately justify watering. Adequate/wet reserve does not remove heat exposure.','Keep watering state separate; heat alone cannot fill the missing water model.'),
 ('RH / VPD / wind','interaction','They alter atmospheric demand and cooling context; wind is not universally protective and human heat index is not tissue temperature.','No additive heat severity from duplicated T/RH/VPD votes.'),
 ('Pot/ground, size and shelter','routing','Change feasible protection and model uncertainty; pot litres or soil provenance do not supply a heat-injury threshold.','Generic event remains, with site uncertainty.')],
 ['Inactive/non-outdoor plant','Wrong-location or stale numeric weather','Human feels-like value used as actual air/tissue temperature'],
 'A missing modifier does not block a valid temperature/official event. If both trigger routes are unavailable, return insufficient_data.',
 'Hot conditions are forecast/current. Reduce avoidable exposure where practical; consult the independent watering estimate.',
 'Do not diagnose heat injury, infer root/leaf temperature, or prescribe water solely from wilt/heat. [R22] [R23]', ['R22','R23','R17'],
 ['Fresh T=33 C with wet roots: heat eligible, extra water not implied.','Only feels_like=38 C, actual T missing: numeric heat trigger unavailable.','No plant height or stage: a valid regional heat warning remains eligible.'])

warning('W02','Cold, frost and freeze exposure','cold','weather_screen_or_official',
 'Usable actual/forecast air temperature or an applicable official cold/frost/freeze product. Preserve hazard subtype.',
 'Actual/forecast T <= coldAttentionC gives a cold watch; T <= frostAttentionC gives possible frost context; T <= 0 C supports an air-freezing label. Official frost/freeze alerts qualify independently. These are exposure labels, not confirmed tissue damage.',[
 ('Air minimum / hourly T and duration','trigger','Lower actual T and longer known exposure affect the event description. Daily Tmin is a low point, not a duration.','Official alert route remains; numeric exposure subtype needs actual T.'),
 ('Cloud, wind and nighttime','interaction','Clear/calm nights can increase surface-cooling context; windy advective cold can also injure, so calm/clear is not a mandatory gate.','No automatic no-frost conclusion from missing sky/wind.'),
 ('Dew point / surface wetness','modifier','Supports frost/condensation context; it does not measure surface temperature, frost point or tissue ice.','Air freezing/cold branch does not require RH/dew point.'),
 ('Stage / establishment / acclimation','routing','Newly established or newly exposed plants can receive more cautious preparation copy; no universal cultivar cold tolerance.','Generic exposure notice; do not infer hardiness from age/strainType.'),
 ('Pot versus ground / pot size / cover','routing','Changes feasible protection and exposure uncertainty; pot dimensions alone do not compute a freezing time.','Do not assume a roof, windbreak or permanentProtection is frost-proof.'),
 ('Wind chill / feels-like','excluded','Human index is excluded from plant-temperature and air-freezing predicates.','A missing index is immaterial.')],
 ['Only wind chill below zero with actual T above screen and no official plant-relevant event','Tissue freezing asserted from ambient air alone'],
 'If only a generic human cold advisory exists, attribute that advisory without relabelling it confirmed plant frost/freeze.',
 'Cold/possible frost/air freezing is forecast. Prepare appropriate protection before the event if practical.',
 'Surface frost can differ from reported air temperature; above-zero air is not proof of no frost. No fixed roof/cover protection credit. [R11] [R21] [R23]', ['R11','R21','R23'],
 ['Tair=4 C and wind chill=-2 C: cold context only; no inferred air freeze.','Tair=-1 C with strong wind: freeze branch is not suppressed by lack of calm air.','Frost alert, sky/wind absent: attributed frost warning still eligible.'])

warning('W03','Strong wind and gust exposure','wind','weather_screen_or_official',
 'Usable sustained wind/gust or an applicable wind/storm alert, with units and timestamp. A missing gust is not zero gust.',
 'Official wind event OR gust >= gustAttentionMps OR sustained wind >= sustainedAttentionMps. Height/canopy/support are action modifiers, not prerequisites.',[
 ('Gust and sustained wind','trigger','Compare separate configured screens; gust is a peak, sustained wind is a different statistic.','Use the available branch without inventing the missing one.'),
 ('Wind height / coordinates / terrain','support','Provider wind is regional/reference-height exposure; it is not measured at the pot.','Disclose local uncertainty; do not apply a guessed fence multiplier.'),
 ('Wind shelter / direction','modifier','Verified relevant shelter changes protection relevance; direction-specific shelter requires both direction and geometry.','Generic exposure remains; no exact speed reduction.'),
 ('Height, canopy / flowers / supports','routing','Reported tall/heavy/unsupported growth changes securing/support advice. Flowering does not prove a heavy dense canopy.','Do not suppress without dimensions or assign a damage percentage.'),
 ('Pot geometry / stability / ground rooting','routing','Reported unstable pots can receive a tipping precaution; ground plants still have branch/root exposure.','Pot volume or height alone cannot establish mechanical failure.'),
 ('Humidity / rain / disease','interaction','Can affect drying and dispersal context; never cancel disease warnings because wind is high.','Independent warning families remain independent.')],
 ['Double conversion of already-km/h wind','Gust used as sustained wind in ET without method support'],
 'No valid wind value and no mapped event -> insufficient_data. Missing local shelter -> regional warning with qualified exposure.',
 'Strong wind/gusts are reported or forecast, with the valid window stated. Secure movable containers/supports and reduce avoidable exposure where feasible.',
 'No exact branch-breakage/tipping prediction or claim that wind guarantees healthy airflow. [R10] [R17]', ['R10','R17'],
 ['15 m/s gust, no height: eligible.','Provider 5 m/s equals 18 km/h exactly once.','Known sheltered plant retains regional warning with qualified local effect.'])

warning('W04','Heavy rain and possible runoff exposure','rain','weather_screen_or_official',
 'Valid rain rate/interval accumulation or an applicable heavy-rain/flood product. Occurrence source and units must be known.',
 'Official event OR supported rain rate >= rainRateAttentionMmH OR complete rolling-24h amount >= rainDayAttentionMm. Daily amount does not reconstruct peak intensity. Site runoff/flooding is an additional, separately evidenced claim.',[
 ('Intensity, total and duration','trigger','High rate and high total are separate event branches. Coverage determines which branch can be evaluated.','No rate warning from a daily total alone.'),
 ('Probability / issue time','support','Occurrence chance qualifies forecast wording; amount is not multiplied into retained water by default.','Missing probability is unknown; it is not 0 or 100%.'),
 ('Soil rainReception','reception','Changes plausible root input and drainage/erosion actions; sheltered roots can coexist with exposed foliage.','Keep root reception unknown; regional event notice can remain.'),
 ('Canopy rain exposure','reception','Separately changes foliage/flower wetting implications. A soil answer cannot establish this.','Conditional foliage wording only; no measured canopy wetness.'),
 ('Drainage, slope/run-on, ground/container','routing','Reported blocked drainage, slope/run-on or erosion susceptibility changes the precaution; these are not derived from soilType alone.','Warn about rain, not local flooding/saturation.'),
 ('Stage / rooting / stature','routing','Developing plants can receive soil-disturbance/support wording. No fixed rainfall damage threshold by age.','Generic practical preparation.'),
 ('Rain already retained / water model','independent_state','Actual occurred input may replenish a supported model. Future rain cannot update current storage.','No universal water-timer reset.')],
 ['Adding overlapping hourly and daily amounts','Claiming root saturation/local flood from regional mm alone','Low rain chance interpreted as amount confidence'],
 'Incomplete totals remain partial; missing local reception does not falsify the regional event. A definitely unexposed route removes that route-specific claim, not all weather context.',
 'Heavy rain is forecast/reported. Check relevant drainage/runoff exposure and protect vulnerable setups where practical.',
 'Attention bands are ENG event screens, not local flood criteria or cannabis saturation thresholds.', ['R13','R03','R12'],
 ['30 mm daily total, rate absent: amount watch only.','Roof shelters soil but flowers are exposed: root and canopy paths differ.','High forecast rain with dry roots now: current water estimate unchanged.'])

warning('W05','Severe storm, including explicitly supported hail','storm','official_or_explicit_hazard_product',
 'An applicable authoritative severe-weather event or explicit documented severe/hail product. Preserve source subtype, location and validity.',
 'Emit the source-supported event. Hail-specific wording requires explicit hail evidence in a mapped field or verified source message. Generic thunderstorm/rain likelihood does not establish hail.',[
 ('Hazard type / source','trigger','Hail, damaging wind and flooding remain distinct subtypes even within one storm.','Unknown generic event may be shown verbatim with attribution, not guessed into hail.'),
 ('Alert validity / geography / updates','gate','Include only applicable, uncancelled current/upcoming events; revisions replace earlier versions.','Stale/unmatched events are not active plant warnings.'),
 ('Regional lead time / stated severity','routing','Controls prepare-now versus watch wording, preserving the authority scale without inventing plant damage probability.','Keep authority metadata unknown where unavailable.'),
 ('Roof / cover / wind shelter','modifier','May change protective actions; protection strength is unknown unless characterized. Mesh is not assumed hail-proof.','Do not suppress authoritative regional event on a vague cover label.'),
 ('Flowering / size / pot-ground','routing','Changes what can be secured or moved; not needed for storm eligibility.','Generic relevant protection remains.'),
 ('Surface T / humidity / rain probability','excluded','None is a substitute for a hail/severe-storm product.','No inference from these alone.')],
 ['Hail predicted from clouds or rain chance only','US severe-storm thresholds silently treated as global crop-damage limits','User asked to go outside during an active dangerous event'],
 'Unavailable hail capability is unassessed, not no hail risk. The reviewed app does not currently retain alerts; adapter work is required.',
 'Source-attributed storm/hail warning. Prepare beforehand where feasible and follow local weather guidance.',
 'No guarantee of hail striking this plant or of a cover preventing damage. [R24] [R13]', ['R24','R13'],
 ['Thunderstorm code + 90% rain, no hail field: no hail-specific warning.','Explicit applicable hail alert qualifies without plant size.','Cancelled or wrong-location alert is not active.'])

warning('W06','Low reserve / drying soon','water_need','supported_water_model_or_qualified_observation',
 'A supported, initialized water model or qualified root-relevant evidence. Daily user moisture logging is not required. Current and projected states are separate.',
 'Current supported water_now -> main watering action. If current state is not_due and a supported future path crosses the action threshold within needHorizonHours, emit an explicitly projected/conditional drying-soon notice. Forecast rain is never current input.',[
 ('Reserve / action threshold / uncertainty','trigger','Compatible reserve-threshold comparisons determine current need. Overlap requires a validated decision rule or uncertain.','No supported state -> no definite drought/need claim.'),
 ('Watering time, amount or saved pattern','state_input','Recent application can increase reserve according to its event model. A timestamp or small top-up is not guaranteed full refill.','Broad input uncertainty; no elapsed-days substitution.'),
 ('Occurred rain and soil reception','state_input','Characterized actual rain can replenish reserve. Unknown reception/capture widens state.','No automatic rain reset; future input remains separate.'),
 ('ET, weather and actual loss','state_input','Compatible atmospheric demand drives an assessed system-loss model; stomatal limits and components are accounted once.','Use validated gap bounds or mark unsupported; no zero demand.'),
 ('Pot/ground, medium/drainage, roots and canopy','model_domain','Determine accessible storage and loss within a supported profile. Size effects interact; larger pot alone is not a longer safe interval.','Missing critical profile property limits the model, not every independent warning.'),
 ('Age/stage, transplant/pruning/movement','model_context','Development changes supported parameter ranges; material setup changes trigger a new domain/state update.','No exact root volume or leaf area from age.'),
 ('Current wet or dry observation / wilt','action_conflict','Reconcile a credible observation before an incompatible model action. Wilt alone does not distinguish drought, heat or root stress.','Optional observations improve state; their absence is not a daily-check gate.')],
 ['Hot/dry weather alone called proven dry soil','Same-day watering forces not_due despite failed wetting','Forecast rain cancels supported current need'],
 'Return the explicit watering exception if the model is unidentifiable; do not generate a drought alert to fill the UI. Hazard modules with usable inputs continue.',
 'Estimated low reserves now, or an explicitly projected need window; explain the main event/weather cause.',
 'No exact soil percentage, dose or guaranteed safe-until time without the separately validated feature. [R01] [R03] [R05]', ['R01','R03','R05','R16'],
 ['Hot day but supported sufficient reserve: no current drought warning.','Unknown top-up cannot be treated as a full reset.','Dry now plus rain tomorrow: current need remains.'])

warning('W07','Persistent excess water / drainage concern','root_environment','supported_excess_model_or_qualified_site_evidence',
 'A model with an assessed excess/drainage state beyond its normal drain window, or credible current root-zone pooling/blocked-drainage/excess evidence. Wet air or regional rain alone is insufficient.',
 'Observed abnormal root-zone pooling/failed drainage OR supported excess state above its profile watch bound for longer than its normal drainage window. Ordinary moist post-watering medium does not qualify. Do not equate field capacity with saturation.',[
 ('Excess state / normal drainage window','trigger','Persistent abnormal excess raises the environmental concern; root-zone hydraulic meaning must be defined.','No calibrated drain state -> no model-based persistence assertion.'),
 ('Current pooling / blocked drainage / active-root saturation','trigger','Qualified abnormal site evidence can support an immediate drainage inspection. A reservoir designed for self-watering is not automatically abnormal.','A vague wet reading alone is weak context, not confirmed waterlogging.'),
 ('Actual input / reception / runoff and reservoir','state_input','Repeated received water or extra supply can sustain excess; each input needs its control-volume treatment.','Unknown event amounts/reception widen the assessment.'),
 ('Medium, structure and pot/ground','model_domain','Determine drainage/air-water context. store/native/raised/custom do not specify hydraulic properties.','No clay=saturated or shop mix=free-draining rule.'),
 ('Loss, root development and weather','interaction','May alter dry-down within the model; high humidity/cool air is not proof of saturated roots.','Do not require an arbitrary cool-air temperature.'),
 ('Time after watering / repeated observations','support','Distinguishes transient normal wetness from a persistent issue. Source depth/scope and actual chronology matter.','No known persistence across missing periods.'),
 ('Wilt, pH/EC, pests, root damage','diagnostic_context','Can help frame alternatives when measured/reported, but do not establish oxygen concentration or pathogen identity.','No inferred deficiency, root rot or exact cause.')],
 ['A single normal moist check just after watering','High rainfall/low ET by itself diagnosed as root rot','Excess above a drained reference silently clipped out of the model'],
 'Weather-only conditions may support a rain precaution, not this present root finding. Retain insufficient_data when root excess is unsupported.',
 'Possible persistent wet-root/drainage issue. Check current drainage or additional water supply before adding more water.',
 'This is a possible aeration/drainage environment, not measured low oxygen or a root-rot diagnosis. It shares one card with W14.', ['R03','R12','R20'],
 ['Moist immediately after watering: no persistent-excess warning.','Observed abnormal pooling at active roots can qualify without weather.','Self-watering reservoir full alone is not root waterlogging.'])

warning('W08','Container/root-zone heat exposure precaution','heat','contextual_container_subwarning',
 'plantedIn=pot and a valid heat exposure trigger plus reported direct solar exposure of the pot/hot-contact context; alternatively a relevant sensor crossing a supported root-temperature screen. Plant Full Sun alone does not locate the pot wall in sun.',
 'plantedIn=pot AND ((W01 heat context AND (explicit potSolarExposure=exposed OR reported hot hard-surface/contact exposure)) OR a relevant root sensor crossing its supported threshold). Dark walls add context, not a mandatory gate. The sensor needs correct depth, calibration and a supported threshold.',[
 ('Pot versus ground','gate','This container-specific card requires pot. Ground retains general heat/root-context advice if relevant.','Unknown planting branch -> no specific hot-pot assertion.'),
 ('Solar exposure of pot / hot surface','trigger_context','Verified local exposure supports the precaution. Canopy shade can protect the pot wall even if the plant is in sun.','No pot-specific trigger from plant sunlight category alone.'),
 ('Air heat / radiation / duration','trigger_context','Supplies the regional heat setting, not a measured root temperature.','No numeric root-temperature extrapolation.'),
 ('Material, wall colour and insulation','modifier','Heat absorption/transfer context; porosity can also alter evaporative loss. Do not assign one universal material multiplier.','No assumed black plastic or measured thermal response.'),
 ('Pot size / geometry / ground contact','modifier','May change heat exchange/buffering in an assessed model; volume alone cannot determine root temperature.','Keep effect uncertain, not monotonic size points.'),
 ('Root sensor / measured root zone','optional_trigger','A compatible sensor supplies a local measurement, not proof of tissue injury; thresholds remain domain-specific.','Sensor absent does not invalidate a qualified exposure precaution.')],
 ['Ground plant shown a container-only warning','Outdoor full sun + unknown container colour/exposure used as confirmed hot roots'],
 'Unknown pot exposure -> generic W01 only, or qualified optional context in its details; no extra recurring setup prompt.',
 'Exposure branch: the exposed container/hot surface may add root-zone heat exposure. Sensor branch: state the measured root-zone temperature and supported screen separately. Reduce avoidable container heating where practical.',
 'Do not claim root temperature or injury from air/colour/volume. This is folded into the heat card rather than a duplicate push. [R12]', ['R12','R22'],
 ['Ground plant with heat: W01 possible, W08 not relevant.','Plant Full Sun but pot wall shaded: no inferred pot heating.','Unknown pot material does not become black plastic.'])

warning('W09','Possible dew/fog dampness','dampness','weather_proxy_or_direct_fog_evidence',
 'Compatible paired Tair/Tdew/night window for the dew proxy, or an explicit local observation/documented fog product. Fog does not require the nighttime dew proxy.',
 'Dew branch: covered nighttime Tair-Tdew in [0, dewSpreadC] for dewHours, with above-freezing liquid-dew wording only where supported. Fog branch: explicit fog evidence. Neither establishes actual leaf-wetness duration.',[
 ('Paired air/dew point and time','trigger','Smaller nonnegative spread indicates closer air saturation; source quality and concurrent pairing are mandatory.','No pairing -> no precise spread; daily minimum and unrelated dew point cannot be combined.'),
 ('Night / sky view / cloud','modifier','Clear sky can strengthen radiational-dew context; actual leaf surface and sky exposure are unknown.','No cloud gate for explicit fog; no invented clear-sky condition.'),
 ('Wind / advection','interaction','Light wind can favour radiational dew; fog can have other mechanisms and occur with wind/daylight.','Do not suppress explicit fog on a breezy or cloudy day.'),
 ('Roof / cover / canopy position','modifier','May alter radiational cooling and surface exposure; a soil rain shelter answer cannot describe all canopy surfaces.','No automatic dew immunity under a roof.'),
 ('Temperature near/below freezing','routing','Use W02 frost/freezing context where liquid dew is not supported. Do not infer actual frost merely from this proxy.','Keep liquid/ice nature uncertain.'),
 ('Rain / irrigation / water balance','excluded_input','No rain is needed for dew/fog context. Condensation is not credited as root irrigation without a separate measured model.','No water replenishment or disease diagnosis from this warning.')],
 ['abs(Tair-Tdew) hides a physically inconsistent pair','Zero rain means no dampness','A rain-hours counter presented as leaf-wetness hours'],
 'No proxy data does not prove dry leaves. Retain unassessed/insufficient_data and keep explicit fog branch independent.',
 'Conditions may favour dew, or fog is forecast/reported. Surfaces may remain damp; actual leaf wetness is unmeasured.',
 'Air saturation, surface dew, fog and frost are distinct. The proxy cannot pinpoint which leaves are wet. [R21]', ['R21','R11'],
 ['0 rain with T/Tdew close at night: dew proxy may qualify.','Tdew materially above Tair: quality failure, not abs shortcut.','Daytime explicit fog can qualify without a nighttime interval.'])

warning('W10','Powdery-mildew-conducive conditions','leaf_disease','informational_exposure_screen',
 'Foliage context plus a source/time-compatible exposure episode or a credible current powdery-growth report. History alone changes context, not a new active trigger. Unemerged germination with no foliage is not a leaf-inspection target.',
 'An enabled PM exposure policy counts valid simultaneous temperature/RH conditions in its declared window; a credible current powdery-growth report routes to symptom review independently. Candidate humidity/temperature bands are ENG screens, not necessary/sufficient infection criteria.',[
 ('Foliage / stage','gate','Leafed stages support a leaf scout. Flowering is not required; germination with explicitly no emerged tissue is not relevant.','Unknown foliage -> conditional tissue wording, not an assumed leaf inspection.'),
 ('Paired temperature and humidity / duration','trigger','Covered favourable ambient episodes support an informational conditions watch; do not use Tmax plus night RH.','Insufficient matching coverage -> no exposure conclusion.'),
 ('Shade / local airflow / crowding','modifier','Reported shade, crowding and limited local airflow can increase practical scouting relevance. These are local facts, not inferred from a group weather pin.','No assumption of a dense/still canopy; regional wind is a weak local proxy.'),
 ('Rain / free leaf water / overhead watering','nonmonotonic','Free water is not required; rain is not a monotone mildew multiplier or proof of elimination. Root watering is not foliage wetting.','Do not infer leaf wetness from soil reception or a generic watering log.'),
 ('Wind','interaction','May affect drying and dispersal in different directions; high wind cannot be an automatic protective veto.','No numeric wind protection credit.'),
 ('Cultivar/history / prior symptoms','context','A recent credible history can prioritize inspection; strain marketing/type does not quantify resistance. Current symptoms are separately labelled reports.','Unknown inoculum/susceptibility remains unknown.'),
 ('Negative inspection / age / pot and soil','scope_only','A dated negative check affects current symptom history, not future exposure. Pot size, age and soil class do not independently trigger airborne leaf mildew.','No low-risk or immunity assertion from missing symptoms.')],
 ['Rain required for mildew eligibility','RH below the pilot screen interpreted as no mildew possible','Fixed infection odds from weather','Root water withheld because mildew watch is active'],
 'An informational exposure warning may run with explicitly qualified regional context. Disabled/insufficient policy cannot be mapped to low disease risk.',
 'Exposure branch: recent/forecast conditions may favour powdery mildew; inspect leaf surfaces if warranted. Symptom branch: powdery growth was reported; review the finding and keep its cause unconfirmed. Both may include feasible airflow advice.',
 'Hemp powdery mildew does not require free leaf water; broader powdery mildews differ in moisture/dispersal responses. No universal cannabis infection band is established here. [R07] [R19]', ['R07','R19','R10'],
 ['Vegetative leafed plant can qualify; flowering not required.','Zero rain does not block a compatible PM episode.','High wind cannot automatically cancel a PM watch.'])

warning('W11','Bud-rot / Botrytis conditions watch','flower_disease','flower_tissue_and_informational_exposure',
 'Flowering tissue is recorded or explicitly confirmed for the bud-rot label. Valid damp/humid exposure evidence or a current flower-symptom report is needed. Botrytis can affect other tissues, but that does not make a bud warning relevant before flowers exist.',
 'hasFlowers AND (an enabled covered humid-exposure screen OR qualified current flower-dampness evidence OR a credible current flower-condition report). Humidity is a conditions watch; dampness states observed wetting; symptoms route to cause-unknown flower review. Forecast episodes stay forecast-only. Rain hours never become measured wetness.',[
 ('Flowers / stage','gate','Recorded flowering or verified flowers enables a bud-focused watch. Dense/mature flowers are not inferred merely from that enum.','Unknown flowers -> no definite bud-specific eligibility; generic damp/leaf/root context may remain.'),
 ('Temperature, humidity and duration','trigger','Compatible covered episodes support conducive-condition messaging; no greenhouse threshold is a validated outdoor infection model.','No matched interval -> insufficient exposure evidence.'),
 ('Canopy rain, dew/fog and overhead irrigation','trigger_context','Can produce a damp-tissue pathway if supported. Rain at soil and a root-watering log do not establish flower wetting.','If canopy reception is unknown, use conditional/regional dampness wording only.'),
 ('Flower/canopy density, airflow and shelter','modifier','Reported dense tissue or limited airflow can increase inspection relevance; local airflow is not regional wind.','No fixed ambient-to-flower RH offset or assumed heavy buds.'),
 ('Wounds / recent handling / damage','modifier','Current dated tissue damage can add context for a susceptible-tissue concern. Old training tags do not prove a fresh wound.','No assumed injury from undated training/pest labels.'),
 ('Symptom history / negative inspection','context','A report of deteriorating flowers routes to symptom review; previous absence does not prevent new exposure.','No confirmed infection without independent evidence.'),
 ('Root moisture / irrigation need','action_conflict','A root-dry plant can still need irrigation while flower wetting is minimized. Humid weather does not imply wet roots.','Keep main watering model and this scout independent.')],
 ['Bud-rot title for a verified flowerless plant','A fixed RH offset simulates flower interior humidity','Rain shelter for soil suppresses all flower/humidity risk','Blanket do-not-water instruction from disease watch'],
 'Missing flower tissue blocks this specific label; missing canopy microclimate limits support, not a claim of absence. A broader Botrytis symptom report needs tissue-aware review.',
 'Exposure/wetness branch: damp/humid conditions warrant attention to flowering tissue; reduce avoidable prolonged flower wetting. Symptom-only branch: a flower-health problem was reported; review it without asserting recent humid conditions or Botrytis. Improve feasible airflow where appropriate.',
 'Botrytis-favouring tissue/environment relationships do not supply an infection probability or guarantee prevention. Flower microclimate can differ from ambient. [R08] [R18]', ['R08','R18','R09'],
 ['Vegetative and explicitly no flowers: no bud-rot watch.','Flowering plus humidity under a rain roof: humidity pathway can remain.','Dry-root need and flower watch coexist without contradictory water advice.'])

warning('W12','Wet-weather leaf-spot conditions watch','leaf_disease','foliage_and_informational_wet_weather',
 'Foliage context and a documented wet-weather proxy/leaf-wetness observation or a credible new leaf-spot report. The output is a broad leaf-spot scout, not a Septoria identification.',
 'An enabled policy evaluates warm/humid paired periods with occurred canopy-rain/explicit wetness or a labelled dew/wet-weather proxy. A high-RH scalar alone does not assert actual leaf wetness. Current spots can route to review independently of the weather screen.',[
 ('Foliage / stage','gate','Leaf-bearing plants can qualify at multiple stages. Lower/inner foliage is an inspection target, not evidence that it is infected.','Unknown tissue -> conditional message or not relevant when no foliage is confirmed.'),
 ('Leaf wetness / canopy rain / dew','trigger_context','Supported wetting and time in humid conditions add exposure context; leaf-wetness sensor hours differ from provider rainy hours.','Unknown canopy path -> qualified regional wet-weather message only.'),
 ('Paired temperature and humidity / time','trigger','An explicit exposure band counts only matched covered intervals. Exact favourable limits vary among leaf-spot pathogens.','Do not fill missing hours or interpret an out-of-band day as no disease.'),
 ('Airflow, canopy position / shade','modifier','Reported slow-drying/crowded context can prioritize a scout.','No inferred inner-canopy moisture from a daily mean.'),
 ('Debris/splash/history / cultivar','modifier','Reported current disease history or splash context can add relevance; soilType or strainType is not evidence of inoculum/resistance.','Absent history is unknown, not proof of a clean site.'),
 ('Symptoms / previous negative check','context','Dated new spots allow symptom review. Similar appearances have different causes; a prior negative is scoped in time.','No species/deficiency diagnosis or fake odds.')],
 ['Automatic Septoria diagnosis from rain/RH','Soil rainReception treated as leaf wetness','Leaf spots inferred from generic notes without confirmation'],
 'No exposure data -> unassessed, not low leaf-spot risk. Symptom reports can still be reviewed without weather.',
 'Exposure branch: recent/forecast wet-weather conditions warrant attention to foliage. Symptom-only branch: new leaf spots were reported; review their cause without asserting wet weather. Neither branch identifies a pathogen.',
 'Rutgers/UF describe multiple leaf-spot diseases with overlapping symptoms and wetness associations. A regional weather proxy cannot distinguish them. [R09] [R07]', ['R09','R07'],
 ['Root drip watering alone is not a leaf-wetting event.','Rain hours cannot be printed as leaf-wetness hours.','Leaf spots reported on a dry day still allow symptom review.'])

warning('W13','Wet conditions during germination/establishment','establishment','vulnerable_stage_and_root_environment',
 'Recorded germination/seedling stage or explicitly confirmed susceptible rooting/establishment context, plus supported abnormal root-zone wet/drainage conditions or a current relevant symptom report. A mature transplant is not automatically a seedling.',
 'Vulnerable context AND (W07-style abnormal/persistent active-zone excess OR a credible current failed-emergence/seedling-collapse report). Excess supports a wet-establishment precaution; a symptom-only route is cause-unknown review. Neither diagnoses damping-off. An unknown-rooted clone enum alone is insufficient.',[
 ('Germination / seedlings / rooting context','gate','Emerging tissue is the relevant scope; age alone does not define it. Explicit tissue/rooting facts override vague chronology.','Unknown clone establishment -> general root-context advice, no automatic damping-off eligibility.'),
 ('Active germination/root-zone excess and drainage','trigger','Abnormal persistent wetness or supported drainage failure warrants a wet-establishment precaution. Normal moisture for germination is not pathological.','No exposure claim from outside RH/rain alone.'),
 ('Root/soil temperature versus air','modifier','Actual soil/root readings can frame establishment context. Ambient cold does not measure substrate temperature; pathogen responses differ.','No cool-air-only damping-off trigger.'),
 ('Sanitation, reused medium / history','context','A dated user report can support hygiene/contextual advice; native/store/custom does not identify pathogen content.','No inference of contamination from medium origin alone.'),
 ('Light, growth speed / salts','context','Measured/reported constraints can frame alternative causes and slow establishment, without numerical disease points.','No low-light/EC assumption from weather UV or nutrient mL/L.'),
 ('Collapse / failed emergence / negative checks','symptom_review','Current reports warrant a differential inspection; mechanical damage, pests and other stresses can look similar.','No pathogen identity or assurance from missing reports.')],
 ['Flowering established plant receives a damping-off card from rain alone','Normal moist seed medium called waterlogged','Root temperature copied from air'],
 'If vulnerable stage or root excess is unknown, preserve that limitation. Independent heat/cold/rain preparation warnings remain available.',
 'Excess branch: the young/germinating root zone may be staying excessively wet; review drainage. Symptom-only branch: an establishment problem was reported; investigate without asserting excess moisture. Keep the cause unconfirmed.',
 'Damping-off affects seeds/young seedlings and involves several organisms; established plants are less susceptible to that syndrome. General sources do not prove a cannabis threshold. [R20]', ['R20','R07'],
 ['Established flowering plant with rain: no seedling-damping-off warning.','Seedling with normal moist medium: no abnormal-wetness trigger.','Unknown-rooted clone is not silently treated as a newly germinated seed.'])

warning('W14','Root aeration / root-health context','root_environment','alias_or_symptom_context',
 'Use W07 evidence for the environmental route, or a credible current root/foliage symptom report for an explicitly uncertain symptom-review route. This is not a second independent weather risk score.',
 'Environmental route inherits W07 only. Symptom route records that the cause is unresolved and may request targeted review; wilt alone does not establish oxygen loss or justify watering. Merge environmental child reasons into one root-environment card.',[
 ('Persistent excess / drainage evidence','inherited_trigger','Same root condition and evidence as W07; never count it twice to increase severity.','No weather-only root-rot fallback.'),
 ('Current wilt / discoloured roots / root injury report','symptom_review','Can justify investigation when credible, with source and tissue scope. It does not identify drought versus root damage, oxygen, salt or disease.','No silent NLP diagnosis from old notes/photo URI.'),
 ('Root-zone T, EC/pH and physical injury','diagnostic_context','Compatible actual measurements can support a differential; sample type/time matter. They are not all available today.','Do not derive EC or toxicity from fertilizer name/concentration.'),
 ('Watering / rainfall / supported reserve','action_conflict','A current credible wet/saturated root finding blocks a weather-only more-water instruction. Reconcile later dry evidence and intervening events chronologically.','An old wet observation is not a permanent veto.'),
 ('Stage / root establishment / medium','routing','Change relevant inspection scope and model domain. Poor drainage is not inferred from every soil label.','No age or strain disease coefficient.'),
 ('Regional RH / cold weather / prior needsWater','excluded','None establishes present root oxygen or a pathogen, and prior app output is not observational evidence.','These cannot supply the missing root trigger.')],
 ['Root-rot score increases because needsWater=false','W07 and W14 count as two independent root hazards','Named Pythium/Fusarium diagnosis from weather'],
 'No usable root evidence -> no present aeration/pathogen assertion. A symptom-only branch stays explicitly cause_unknown.',
 'Possible root-environment problem or reported symptoms: investigate drainage/current roots and keep the cause unconfirmed.',
 'Environmental conditions, symptoms and confirmed disease are different claims. Heat alone can cause wilt even with adequate water. [R22] Root-disease organisms do not share one universal weather threshold.', ['R22','R03','R20'],
 ['needsWater=false alone does not qualify.','W07 and W14 merge into one root card with preserved reasons.','Wilt without root evidence yields cause_unknown, not automatic drought or root rot.'])

# Canonical fields are mapped to actual/proposed storage in the common crosswalk.
input_maps={
'W01':(['weather.airTempC','official.heatEvent'],['weather.shortwave','plant.sunlightExposure','plant.growthStage','setup.rootingStatus','setup.acclimation','model.reserve','root.observation','weather.RH','weather.airVPD','weather.wind','setup.windShelter','plant.plantedIn']),
'W02':(['weather.airTempC','weather.dailyMinC','official.coldEvent'],['weather.cloud','weather.wind','weather.dewPointC','weather.nightWindow','plant.growthStage','setup.rootingStatus','setup.acclimation','plant.plantedIn','plant.potSize','setup.frostProtection']),
'W03':(['weather.windMps','weather.gustMps','official.windEvent'],['weather.windHeight','weather.windDirection','setup.windShelter','plant.height','setup.canopySize','setup.structuralSupport','setup.potGeometry','setup.potStability','plant.growthStage']),
'W04':(['weather.rainRateMmH','weather.rainAccumulationMm','official.rainEvent'],['weather.pop','setup.soilRainReception','setup.canopyRainExposure','setup.drainageClass','setup.runOnSlope','plant.plantedIn','plant.growthStage','model.reserve']),
'W05':(['official.severeEvent','official.explicitHailEvidence'],['official.validInterval','official.geometry','official.sourceSeverity','setup.hailProtection','setup.windShelter','plant.growthStage','plant.plantedIn']),
'W06':(['model.currentDecision','model.currentMargins','model.futureThresholdCrossing','root.observation'],['event.watering','event.carrierWater','weather.historyET0','weather.actualRain','weather.forecastRain','setup.soilRainReception','setup.mediumProfile','setup.rootingStatus','setup.canopySize','plant.age','plant.growthStage','setup.changeEvents']),
'W07':(['model.excessState','model.normalDrainWindow','root.abnormalPooling','root.failedDrainage'],['event.watering','setup.soilRainReception','setup.mediumProfile','setup.drainageClass','setup.additionalSupply','root.observation','root.symptomReport','diagnostic.sample']),
'W08':(['plant.plantedIn','context.heatEvent','setup.potSolarExposure','setup.hotSurface','sensor.rootTempC'],['setup.containerMaterial','setup.containerColor','setup.potGeometry','setup.groundContact','plant.potSize','weather.shortwave']),
'W09':(['weather.airTempC','weather.dewPointC','weather.nightWindow','weather.fogCode','site.fogObservation'],['weather.cloud','weather.wind','setup.skyExposure','setup.canopyRainExposure','setup.frostProtection']),
'W10':(['plant.foliageContext','weather.pairedTempRH','feature.pmExposure','symptom.powderyGrowth'],['plant.sunlightExposure','setup.canopyDensity','setup.localAirflow','weather.actualRain','weather.wind','setup.irrigationMethod','symptom.history','symptom.negativeInspection']),
'W11':(['plant.flowerContext','feature.flowerHumidExposure','symptom.flowerCondition'],['setup.canopyRainExposure','weather.actualRain','feature.possibleDewFog','setup.irrigationMethod','setup.canopyDensity','setup.localAirflow','event.tissueDamage','symptom.history','model.currentDecision']),
'W12':(['plant.foliageContext','feature.wetWeatherExposure','symptom.leafSpots'],['sensor.leafWetness','setup.canopyRainExposure','weather.actualRain','feature.possibleDewFog','setup.irrigationMethod','setup.localAirflow','symptom.history','setup.debrisSplash']),
'W13':(['plant.establishmentContext','root.abnormalWetEnvironment','symptom.establishmentProblem'],['plant.growthStage','setup.rootingStatus','sensor.rootTempC','setup.sanitationHistory','diagnostic.EC','setup.localLight']),
'W14':(['context.W07','root.symptomReport'],['diagnostic.rootTemp','diagnostic.EC','diagnostic.pH','event.rootInjury','root.observation','model.currentDecision','plant.growthStage','setup.rootingStatus'])
}
for w in warnings:
    required,optional=input_maps[w['id']]
    w['canonicalTriggerInputs']=required
    w['canonicalContextInputs']=optional
    w['triggerInputMeaning']='Alternative branches as stated in predicate; this flat list is not an all-fields-required gate.'
    w['sourceStatus']='canonical fields; consult existing/API/new-field crosswalk; not a claim all fields are currently stored'
    w['diseaseProbabilityAvailable']=False
    w['dailyMoistureCheckRequired']=False

# Replace the two broad warning-table chapters with the normative audit contracts.
start=next(i for i,b in enumerate(old_blocks) if b[0]=='title' and b[1].startswith('12  Hazards'))
end=next(i for i,b in enumerate(old_blocks) if b[0]=='title' and b[1].startswith('14  Predictions'))
while start>0 and old_blocks[start-1][0]=='break': start-=1
before=old_blocks[:start]
after=old_blocks[end:]
blocks=before[:]

page('12  Warning inventory and audit result','14 ORIGINAL WARNING ROWS COVERED; ROOT-ENVIRONMENT DUPLICATES MERGED')
p('This section is authoritative for warning eligibility, factors and claim limits in v5.1. It replaces the broad v5.0 hazard/disease tables. Watering remains predictive with normal watering logs; this audit does not reintroduce routine manual moisture checks.')
table(['ID / warning','Evaluation route','Output limit'],[[w['id']+' '+w['title'],w['route'].replace('_',' '),'Environmental/condition warning; no diagnosis' if w['id'] in ['W07','W10','W11','W12','W13','W14'] else 'Source/model-qualified exposure or estimate'] for w in warnings],[0.40,0.34,0.26])
h('Important corrections')
p('Soil and canopy wetting, wind shelter and sky exposure are separate. Human feels-like is not plant temperature. Bud-rot wording needs flowers; mildew does not. Root-excess/aeration cards merge. Missing data and no threshold observed never establish low disease probability. Full rules follow.')

page('12A  What eligibility actually means','RELEVANCE, TRIGGER, SUPPORT, PRIORITY AND DELIVERY ARE SEPARATE')
table(['Concept','Normative interpretation'],[
['Relevance gate','Does the warning apply to this plant/tissue/setup? Example: the container subwarning requires pot; the bud label requires flowers.'],
['Trigger','Has a valid source, model or versioned exposure rule produced the stated event? A relevant plant does not automatically have a triggered warning.'],
['Modifier','Changes action wording, local relevance or evidence support. It is not an extra independent trigger or hidden numeric multiplier.'],
['Interaction','The effect depends on context, such as wind drying surfaces while also dispersing spores. No universal up/down vote is assigned.'],
['Support','How well the source represents the claim: on-site, regional, model-based, forecast, limited or unassessed. It is not a measured infection probability.'],
['Priority','How soon action is useful, based on valid event timing/source importance. It does not automatically rise because many correlated fields are present.'],
['Delivery','Grouping, deduplication, snooze, quiet hours and notification preferences applied after evaluation. Snooze cannot alter biology or truth of an event.']
],[0.22,0.78])
code('''WarningEvaluation = {
  warningId, family, asOf, rulesetVersion,
  relevance: relevant | not_relevant | unknown,
  evaluation: triggered | not_triggered | insufficient_data | disabled_policy,
  sourceNature, exposureWindow, sourceRefs, support,
  factorTrace: [{factor, role, knownValue?, fieldRef?, effect, limitation}],
  missingCriticalInputs[], unusedOrExcludedInputs[],
  outputClaim, actionPriority, dedupeKey, delivery
}''')
p('Use three-valued logic for unknown inputs. A known false required tissue gate yields not_relevant. An unknown required gate stays unknown. Missing a noncritical modifier does not invalidate an otherwise supported generic warning. OR branches must be evaluated separately; an absent gust cannot block a valid sustained-wind event.')
p('The chosen branch controls the message. Weather-only evidence permits a qualified conditions watch. A symptom-only report permits Reported problem - cause unconfirmed, not a claim that conducive weather occurred. Direct wetness/sensor evidence states that measurement or observation, within its scope. Preserve independent evidence when multiple branches qualify.')
p('In each contract, a hard scope/source failure blocks its own branch. A listed prohibited inference forbids that unsupported claim; it does not suppress an independently supported branch. These review contracts are descriptive rules, not executable code.')
p('No annual strain label, age, soil pH, fertilizer name, companion-plant name, previous score or number of available fields is converted into an unsupported hazard multiplier. The full factor crosswalk below records their valid roles and limits.')

page('12B  Data availability: actual app versus proposed','CANONICAL INPUTS DO NOT MEAN THESE DATA ALREADY EXIST')
table(['Input family / canonical fields','Existing source','Gap / required treatment'],[
['Air T/RH/dew, wind/gust, cloud, daily min/max','WeatherCacheEntry and raw weather current/hourly/daily fields.','Legacy cache mixes time/source and drops raw hourly validity. New interval/provenance adapter required for duration rules.'],
['Rain rate/accumulation/probability','rainfall/pop in legacy cache; distinct raw provider rain fields.','One stored rainfall value is not enough. Retain rate/sum, interval, nature and units.'],
['Radiation, ET0, wind height','Not guaranteed by current app schema; candidate weather product.','New provider/canonical fields and benchmarked method. Never replace radiation with UV.'],
['Official weather events / hail subtype','Raw provider alert capability.','Reviewed fetch excludes alerts; WeatherResponse decoder and persistence omit them. Add extraction, mapping, validity and scope.'],
['Fog code / observed fog','Raw documented weather condition IDs or optional site observation.','Current app keeps description, not typed IDs. Preserve typed code; do not turn English summary into a precise fog measurement.'],
['Stage, age, pot/ground, pot litres, height, sun','Existing Plant fields and journal heightCm.','Use recorded context and verified units; no tissue density/leaf area/root depth derived without support.'],
['Soil rain reception','Proposed Plant.rainReception and dated changes from v5.0.','Still a proposed field, not implemented by this document. Retain exposed/partial/sheltered/unknown.'],
['Canopy wetting, wind shelter, pot solar exposure','Optional proposed setup facts; permanentProtection is ambiguous.','Separate fields with source/time; unknown remains valid and does not create a new mandatory setup form.'],
['Medium/drainage/reserve/excess model','Broad existing soilType; detailed profiles/models proposed.','Store profile version/domain and predictions with uncertainty. Broad soilType cannot initialize saturated roots.'],
['Tissue presence/density/support, rooting and damage','Existing stage/training/pests plus optional proposed typed facts.','Only current confirmed facts count; tags/free text are not a dated wound/density measurement.'],
['Symptoms, root observations and physical sensors','Current soilMoisture is an uncalibrated manual percent; inspectionResult only no_symptoms.','New typed positive/uncertain observations and instrument metadata needed; current photo URI is not interpreted evidence.'],
['Diagnostics: root T, leaf wetness, EC/sample pH','Not guaranteed today.','Optional real measurements with method/depth/sample/time. Do not derive EC from nutrientMlPerL.']
],[0.32,0.28,0.40])
p('The source API can provide national alerts, but availability is not identical to implemented app capability. OpenWeather lists SAWS among sources while also warning that agency feeds can cease. Verify actual regional delivery; an empty alert response does not establish safety. [R13]')

page('12C  Shared source and time gates','VALID TIME AND ACTUAL COVERAGE GOVERN THE CLAIM')
bullets(['All plant warnings require current authorization, active/not-deleting status and correct outdoor routing. Recheck before sending queued notifications.', 'Weather-based branches require compatible location/time/units. Missing GPS invalidates the weather join only; qualified site/model evidence can still support its own branch.', 'Pilot current-weather freshness is at most two hours by valid time. Forecasts for the next 24 hours use a declared issue age at most three hours; received time may be an explicitly qualified proxy if issue time is unavailable.', 'Official events use their own validity/cancellation/scope and update-age contract. A retrieved alert can remain valid longer than current weather; expiry removes the active-event claim, not the possibility of later symptom review.', 'Do not mix past observations/current estimates with future forecasts in one measured exposure window. Keep retrospective and projected warnings labelled separately.', 'For hourly point data, a documented interpolation/aggregation method is required. Pilot interpolation bridges only matched adjacent records at most 90 minutes apart, with an estimate flag. No invented hours beyond the series.', 'Duration screens need at least 80% expected-duration coverage. A gap interrupts a claimed consecutive run; nonconsecutive qualifying exposure must be named accumulated exposure.', 'Store lower/upper qualifying exposure bounds where gaps could change the result. If observed qualifying duration already meets the rule, it may trigger subject to coverage. If missing time could change a failure to success, return insufficient_data rather than a confident negative.', 'Daily minima/maxima permit extrema context, not hours above a cutoff. Current rain rates and daily amounts have different meanings; deduplicate overlapping precipitation.'])
h('Currentness is claim-specific - ENG')
p('Historical weather windows are not invalid simply because they are old; their nature/completeness and relevance matter. A recent fetch may hold old observations. A fresh root/site observation carries its own method/scope/time relevance. No single weather expiry erases every independent warning.')
h('Coverage and support are not disease probability')
p('An 80% covered episode is not 80% infection confidence. A regional rain probability is not flower wetness probability. A disabled rule or unavailable source is unassessed, never low risk. Unknown modifiers should be visible in the factor trace rather than silently treated as protective false values.')

page('12D  Explicit attention screens and maturity','ENG SETTINGS ARE TESTABLE DECISIONS, NOT BIOLOGICAL DAMAGE OR INFECTION LIMITS')
table(['Screen key','Pilot setting','Scope and status'],[
['heatAttentionC','32 C actual air; current instant or supported future interval','Heat attention only. Duration is separately reported; not a cannabis injury threshold.'],
['coldAttentionC / frostAttentionC','5 C / 2 C; air-freezing label at <=0 C','Cold/possible surface-frost context. Calm/clear/RH are not required for air freezing.'],
['gustAttentionMps / sustainedAttentionMps','15 m/s / 10 m/s','Physical wind attention. Not an official global severe-wind definition or guaranteed damage speed.'],
['rainRateAttentionMmH / rainDayAttentionMm','10 mm/h / 25 mm per complete rolling 24 h','Rain event attention. Not infiltration, saturation, flood or cultivar damage thresholds.'],
['dewSpreadC / dewHours','0 to 2 C paired spread / 2 covered night hours','Possible saturation/dew context. Not observed leaf wetness or fog diagnosis.'],
['needHorizonHours','6 hours, with separate current decision','Future model projection/action planning. No forecast input credited now.'],
['PM candidate exposure','T 15-28 C and RH >=85%, 4 covered hours in 24 h','Disabled production disease screen until pilot review; an informational exposure rule, not infection probability.'],
['Flower humid candidate exposure','T 10-28 C and RH >=90%, 4 covered hours in 24 h; flowers required','Same maturity restriction. Direct symptom/wetness observations are distinct branches.'],
['Leaf-spot candidate exposure','T 15-30 C and RH >=85%, 4 covered hours in 24 h plus a supported wet-weather pathway','Same maturity restriction. No pathogen identification; canopy route uncertainty must be disclosed.'],
['Persistent root excess','Profile-specific abnormal-excess bound and normal drainage window','CAL, no universal numeric default. Current abnormal pooling/failed drainage is an independent observation route.'],
['Root-temperature sensor route','Only a supported setup/sensor-specific screen; no default supplied','CAL, disabled without a supported threshold and instrument scope. A measured temperature alone does not prove injury.'],
['Operational source/coverage gates','2 h current, 3 h forecast age, 90 min interpolation gap, 80% duration coverage','ENG pilot service settings; test regional update cadence, gaps and user burden.']
],[0.29,0.30,0.41])
p('Official, site-observed and model-supported routes remain independent of numeric weather screens. The pilot bands make exposure logic reproducible; being outside them never establishes that injury or disease is impossible. Disease-screen output is limited to conducive-condition scouting. Do not ship predicted infection odds from these numbers.')
p('Each policy stores enabled status, version, rationale, source domain, units and acceptance evidence. Production promotion requires correct inputs and prospective usefulness/burden checks. Weather attention screens can be evaluated as informational notices; model-dependent warnings require the corresponding model calibration.')

page('12E  Factor crosswalk: development and setup','WHERE EACH FACTOR CAN MATTER; WHERE IT MUST NOT BECOME A POINT')
table(['Factor','Valid effect on warnings','Eligibility / unknown handling'],[
['Age / age basis','Context for establishment only when meaning is known; elapsed calendar time may advance a supported model.','Not an exact root-depth/canopy/tolerance predictor; age unknown is not seedling.'],
['Recorded stage / tissue','Routes leaves, flowers and vulnerable establishment; heat/wind/rain apply more broadly.','Flowers gate W11, vulnerable establishment gates W13, pot gates W08. Stage does not supply tissue density.'],
['Height / canopy size','Supported water-loss domain; wind-support action context.','No wind-warning prerequisite or linear water/temperature multiplier.'],
['Pot litres / geometry','Storage/loss profile and practical handling.','Pot litres alone do not establish accessible water, opening area, stability or root temperature.'],
['Ground / raised bed','Changes root control volume/drainage/run-on context.','Ground never receives a pot-only thermal/storage rule; raised does not mean sealed container.'],
['Medium / drainage / root establishment','Model domain and root-excess evidence; germination zone differs from whole pot.','Broad soilType is not hydraulic capacity or proof of blocked drainage.'],
['Soil rainReception','Current/future root input uncertainty and rain/drainage advice.','Does not measure canopy wetness, local humidity, hail protection or frost protection.'],
['Canopy rain exposure / irrigation method','Wetting pathway for flower/leaf exposure.','Optional separate fact; root watering is not automatically overhead; unknown yields conditional pathway.'],
['Wind shelter / cover / sky exposure','Warning-specific local relevance, protection and radiational context.','No universal shelter effectiveness. A net/roof/fence can affect wind, rain, sunlight and cooling differently.'],
['Container material/colour / hot surface','W08 contextual relevance and assessed loss/heat model properties.','No assumed black pot or known root heat; plant Full Sun does not prove pot wall solar exposure.'],
['Pruning/training/repot/movement','Dated model changes, tissue-damage context, location path.','Undated tags are not fresh wounds; moved pots carry their water; mature transplant is not a seedling.'],
['Strain/strainType / companion names','Reported history/possible competition only with relevant evidence.','No fixed resistance, heat tolerance or water coefficient from names; companion plants can have competing effects.']
],[0.27,0.39,0.34])

page('12F  Factor crosswalk: weather and observations','EACH QUANTITY HAS A SPECIFIC ROLE AND SOURCE LIMIT')
table(['Factor','Valid effect','Wrong inference to block'],[
['T / duration / minimum/maximum','Event screens and matched atmospheric features; extrema are point summaries.','Daily Tmax paired with night RH; a peak turned into hours of heat; air copied to roots.'],
['RH / dew point / VPD','Matched demand or dampness exposure, with time/quality.','Three independent votes for the same air moisture; RH converted to soil moisture.'],
['Wind / gust / direction','Separate event statistics; local flow uncertainty and conditional drying/dispersal.','Gust substituted for mean ET wind; strong wind proves no fungus.'],
['Rain rate / accumulation / probability','Separate actual input and forecast event routes.','Probability becomes confidence; mm becomes saturation; overlapping totals summed.'],
['Cloud / radiation / UV / daylight','Radiation/sky-view context and supported ET; astronomical night routing.','UV is PAR/Rn; daylight is direct sun; clear regional sky proves unshaded pot.'],
['History / forecasts / issue age / coordinates','Different time scopes and source support; model paths before/after movements.','Forecast ages into observed history; new fetch makes old observation current.'],
['Watered / feeding carrier water','State input under the supported event profile, with dates and uncertainty.','A watering is a dry label/full refill; nutrient mL/L is water volume.'],
['Root checks / sensors / pot weights','Optional relevant measurements or calibration support.','Uncalibrated percentage has a universal dry/wet limit; mixed depths averaged.'],
['Symptoms / photos / pests / damage','Current confirmed reports can trigger review and context.','Photo URI, old tags or free text automatically identifies a pathogen.'],
['pH / EC / nutrition','Typed current samples can frame differential causes.','Fertilizer schedule/name/concentration proves root salinity or explains wilt.'],
['Negative inspections / snoozes / skips','Negative observation is time/tissue scoped; snooze/skip controls delivery only.','No symptoms means future immunity; snooze or not_due means healthy roots.'],
['Official events / feels-like','Attributed event metadata and actual hazard type; human index limitations.','Human wind chill becomes plant freezing; generic storm becomes hail.']
],[0.29,0.37,0.34])

for w in warnings:
    page(w['id']+'  '+w['title'],'NORMATIVE WARNING CONTRACT  |  FAMILY: '+w['family'].upper())
    h('Required scope and source')
    p(w['requirements'])
    h('Decision rule')
    p(w['predicate'])
    table(['Factor / role','How it changes the warning','When missing'],[[f['factor']+' ('+f['role']+')',f['effect'],f['missing']] for f in w['factors']],[0.25,0.46,0.29])
    h('Blocks, prohibited inferences and missing data')
    p('; '.join(w['suppressions'])+'. '+w['missingBehavior'])
    h('Allowed message and limit')
    p(w['output']+' '+w['claimLimits'])
    p('Regression checks: '+' | '.join(w['acceptanceCases']))

page('13A  Cross-warning precedence and delivery','ONE FACT CAN AFFECT DIFFERENT WARNINGS IN DIFFERENT WAYS')
table(['Combination','Required resolution'],[
['Heat + adequate/wet roots','Keep W01 heat exposure. Do not invent current drought or order more water. A supported future dry path may be stated separately.'],
['Current dry estimate + mildew/flower watch','Needed root irrigation can coexist with a canopy precaution. Do not issue a blanket avoid-watering instruction from disease-conducive weather.'],
['Heavy rain + sheltered soil','Keep regional storm context, qualify root input; do not assume flowers sheltered or local humidity low.'],
['W07 excess + W14 root context','One root-environment card/dedupe key, distinct child reasons. No double scoring or repeated push.'],
['W01 heat + W08 container heat','One heat card with container-specific context if supported. Root temperature remains unknown unless measured.'],
['W09 dew/fog + leaf/flower watches','Share the weather episode as evidence. Dampness is not a second independent infection vote; combine practical inspection wording.'],
['Storm wind + rain + explicit hail','One source/event storm card can preserve separate substantiated hazards. Never upgrade generic thunderstorm into all three automatically.'],
['Leafed seedlings with leaf and root conditions','Tissue-aware messages can coexist; route W13 only with establishment/root conditions, W10/W12 only with foliage evidence.'],
['Old stage conflicts with current tissue report','Resolve dated evidence. A current explicit flower report can establish flowers even if a stale stage says vegetative; an uninspected photo URI cannot.'],
['New observation during cooldown','Recompute immediately. User notification settings still govern delivery; cooldown cannot preserve a stale state.'],
['No current hazard threshold met','Record not_triggered for that policy and covered window. Never show no disease or guaranteed safe as a consequence.']
],[0.32,0.68])
p('Current verified root findings, a source-attributed official event and a model projection are different claims. Do not convert their support levels into a single all-purpose confidence percentage. Delivery severity is action urgency and source context; it is not pathogen likelihood.')
p('Maintain source/event identity, valid interval, location epoch and ruleset version for deduplication. Forecast revisions and genuinely changed observations may update a card; identical unresolved evidence should not create daily duplicate warnings. Routine user effort remains watering logs, with optional exception or symptom feedback.')

page('13B  Implementation readiness by capability','A WARNING CONTRACT IS NOT A CLAIM THAT THE CURRENT APP ALREADY SUPPORTS IT')
table(['Warnings','Minimum implementation gap before reliable evaluation'],[
['W01/W02/W03','Retain valid timestamps/nature/units; use actual T, sustained/gust separation and source-specific official event mapping. Generic point warnings can use fewer fields than duration branches.'],
['W04','Separate rain rate/sum, full/partial interval and forecast/history; implement per-plant soil rain reception and qualified canopy path.'],
['W05','Enable alerts or an explicit severe/hail product; extend decoding/storage/type contracts and verify agency coverage for actual launch regions.'],
['W06','Implement and validate the v5 predictive reserve/profile model; optional observations cannot be replaced by the old dryness ratio as ground truth.'],
['W07/W14','Assessed excess/drainage state or qualified abnormal site/symptom evidence; retire circular rootRot score and introduce deduplication.'],
['W08','Optional explicit pot solar/hot-surface context or calibrated root-temperature route. Pot size and Full Sun alone are insufficient.'],
['W09','Matched hourly T/dew/time or explicit typed fog code/site observation, with correct night and freezing distinctions.'],
['W10/W11/W12','Time-compatible hourly exposure and coverage, appropriate tissue context, accepted informational pilot policy; no field-tested infection model is claimed.'],
['W13','Explicit susceptible establishment context plus qualified root-zone excess/symptoms. Old clone enum cannot supply precise rooting state.'],
['All cards / migrations','SuggestionKind currently has only watering/powderyMildew/rootRot. Add explicit typed warnings/outputs and update UI, queues, backup, rules, ownership and offline handling.']
],[0.25,0.75])
h('Minimal-burden proposed additions')
p('The agreed rainReception question remains the primary new outdoor setup question. Other facts are optional/progressive: canopyRainExposure, irrigationMethod, windShelter, potSolarExposure/hotSurface, drainage/additional supply, rootingStatus, tissue presence/density and structural support. Never request all of them merely to populate warning cards. An absent optional fact should reduce specificity or leave a branch unassessed.')
p('Positive/unsure symptom and abnormal-wetness reports need typed occurrence time, tissue/root scope and method. They are exception observations, not daily tasks. Sensor values need instrument/units/depth/calibration. A static manual profile/default is not live evidence.')
p('Inspect actual source fill rates and new normalizer fixtures. The four previously reproduced parser problems are still code work to fix/retest; the research audit does not change production records. Human attention screen values and regional source service settings also need practical validation.')

page('13C  Verification of factors and warning rules','RESEARCH CHECK, CONTRACT COMPLETENESS AND IMPLEMENTATION FIXTURES ARE DISTINCT')
p('Each W01-W14 contract has prerequisites, an explicit evaluation route, factor roles/directions, missing-data handling, suppressions, allowed wording, claim limits, primary-source references and three regression scenarios. The structured registry preserves those fields for engineering review. It does not contain a calibrated infection probability.')
table(['Check performed','Result / boundary'],[
['Existing data/schema cross-check','Reviewed Plant/PlantLog/WeatherCacheEntry, WeatherResponse/normalizer and SuggestionKind. Existing, raw-API and proposed fields are separated.'],
['Disease mechanism cross-check','Rechecked hemp disease guidance, Botrytis, leaf spots, powdery mildew distinctions and seedling damping-off scope. Numeric exposure screens remain ENG.'],
['Weather mechanism cross-check','Rechecked dew/frost, human wind-chill limitations, heat/wilt context, API field semantics and severe/hail capability.'],
['Factor completeness','All 14 original warning rows have contracts. Soil/canopy wetting and protection dimensions are separated; each missing modifier has a defined consequence.'],
['Duplicate evidence','W07/W14 root family and W01/W08 heat family explicitly deduplicate; shared dew/humidity evidence is not independent infection votes.'],
['Structured registry validation','Unique IDs, required keys, factor roles/effects/missing handling, source IDs and 42 scenario descriptions are mechanically checked by the builder.'],
['Predictive biology','No new measured hazard/infection accuracy, root profile calibration or prospective trial outcome is claimed.'],
['Application tests','42 warning regression scenarios and inherited 48 v5 cases are specified, not executed app tests. The earlier 15 algebra fixtures remain separate numerical checks.']
],[0.31,0.69])
p('Double-checking the mechanisms can reject invalid inferences; it cannot make the ENG threshold values experimentally proven. Promotion needs prospective event usefulness, false-alert burden, normal watering-decision accuracy and appropriate coverage/abstention metrics in target climates and setups.')

for lo,hi in [(0,14),(14,28),(28,42)]:
    page(f'13D  Warning regression scenarios {lo+1:02}-{hi:02}','SPECIFIED SEMANTIC CASES - NOT EXECUTED AGAINST AN IMPLEMENTED WARNING ENGINE')
    all_cases=[(w['id'],c) for w in warnings for c in w['acceptanceCases']]
    table(['Case','Warning','Input / expected semantic behaviour'],[[f'WARN-{i+1:02}',wid,c] for i,(wid,c) in enumerate(all_cases) if lo<=i<hi],[0.16,0.14,0.70])

# Attach unchanged predictive-core continuation, excluding the obsolete evidence ledger.
ledger_at=next(i for i,b in enumerate(after) if b[0]=='title' and b[1].startswith('Evidence ledger:'))
if ledger_at>0 and after[ledger_at-1][0]=='break': ledger_at-=1
blocks.append(('break',None)); blocks.extend(after[:ledger_at])
# Update explicit summary/version language and warning references in inherited text.
for i,(typ,value) in enumerate(blocks):
    if isinstance(value,str):
        value=value.replace('Reference-cohort evaluation.','Reference-cohort evaluation.')
        value=value.replace('SPECIFICATION v5.1  |  29 OCTOBER 2026  |  WATERING-LOG-FIRST PRODUCT','SPECIFICATION v5.1  |  29 OCTOBER 2026  |  WARNING ELIGIBILITY AUDITED')
        if typ=='p' and value.startswith('This version supersedes the inspection-first product contract'):
            value += ' The v5.1 warning contracts now define relevance, trigger, factor effect, missing-data outcome and claim limits for every listed warning.'
        blocks[i]=(typ,value)

for lo,hi in [(1,7),(7,13),(13,19),(19,25)]:
    page(f'Evidence ledger: R{lo:02}-R{hi-1:02}','PRIMARY SOURCES RECHECKED FOR WARNING MECHANISMS  |  29 OCTOBER 2026')
    for k in range(lo,hi):
        key=f'R{k:02}'; title,url,note=refs[key]
        h(f'[{key}] {title}'); p(note); blocks.append(('link',(url,'Open primary source')))
    if lo==19:
        p('The low-effort predictive-water product contract from v5.0 is retained. This revision audits warning mechanisms and data contracts; it does not establish prospective accuracy or implement application changes. Sources support mechanisms within their stated context, not WeedGrow-specific disease probabilities.')

roles={'trigger','modifier','routing','action_conflict','interaction','support','excluded','gate','reception','independent_state','state_input','model_domain','model_context','trigger_context','optional_trigger','excluded_input','nonmonotonic','context','scope_only','symptom_review','inherited_trigger','diagnostic_context'}
assert len(warnings)==14 and {w['id'] for w in warnings}=={f'W{i:02}' for i in range(1,15)}
assert sum(len(w['acceptanceCases']) for w in warnings)==42
for w in warnings:
    assert all(w[k] for k in ['requirements','predicate','factors','suppressions','missingBehavior','output','claimLimits','references','canonicalTriggerInputs'])
    assert len(w['factors'])>=6
    assert all(f['role'] in roles and f['effect'] and f['missing'] for f in w['factors'])
    assert all(ref in refs for ref in w['references'])
    assert not w['dailyMoistureCheckRequired'] and not w['diseaseProbabilityAvailable']
report={'revision':'5.1','warnings':len(warnings),'factorMappings':sum(len(w['factors']) for w in warnings),'warningScenariosSpecified':42,'v5CoreScenariosSpecified':48,'registryChecksPassed':True,'appWarningTestsExecuted':False,'biologicalPredictionValidated':False}
screens=next(value[1] for typ,value in blocks if typ=='table' and value[0]==['Screen key','Pilot setting','Scope and status'])
registry={'contractVersion':'5.1','reviewDate':'2026-10-29','executableRules':False,
    'guardrailMeaning':'Suppressions include hard branch failures and prohibited inferences; do not negate independent supported branches.',
    'attentionScreenStatus':'ENG pilot screens are not injury/infection thresholds. Disease weather screens remain production-disabled pending pilot review. Root-profile/sensor parameters need CAL support.',
    'attentionScreens':[dict(key=row[0],setting=row[1],scopeAndStatus=row[2]) for row in screens],
    'sources':{key:dict(title=value[0],url=value[1],scope=value[2]) for key,value in refs.items()},
    'warnings':warnings,'verification':report}
SRC.joinpath('WeedGrow_Warning_Registry_v5.1.json').write_text(json.dumps(registry,indent=2),encoding='utf-8')
verpath=SRC/'WeedGrow_Outdoor_Algorithm_v5.1_Verification.json'
verification=json.loads(verpath.read_text(encoding='utf-8')); verification['warningAudit']=report
verpath.write_text(json.dumps(verification,indent=2),encoding='utf-8')

renderer=(ROOT/'tmp/pdfs/build_spec.py').read_text(encoding='utf-8').split('# Render one shared content model to an editable Markdown spec and a linked PDF.\n',1)[1]
renderer=renderer.replace('v4.0','v5.1').replace("'v4_acceptance_cases':64","'warning_contracts':14,'warning_scenarios':42,'inherited_v5_cases':48")
renderer=renderer.replace('SCIENCE + CODE REVIEW; FIELD VALIDATION PENDING','WARNING ELIGIBILITY AUDITED; FIELD VALIDATION PENDING')
renderer=renderer.replace("fontSize=8.8,leading=17,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0","fontSize=8.0,leading=12.4,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0")
exec(compile(renderer,'reviewed_pdf_renderer_v51','exec'))
print(json.dumps(report,indent=2))
