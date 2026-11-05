"""Offline WeedGrow v7.3 algorithm reference. Python 3.10+, standard library.

NOT an agronomic calibration. No released profiles are bundled. Synthetic
candidate decisions are kept separate from the production water decision.
No network, notifications, accounts, sensors, or application writes occur.
Inputs are normalized UTC intervals; raw-provider parsing remains an adapter.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass, asdict
from math import exp, isfinite
import argparse
import json
from pathlib import Path

HOUR = 3600
DAY = 24 * HOUR
EPS = 1e-9  # Numerical tolerance only, not biological hysteresis.
RELEASED_PROFILES: frozenset[tuple[str, str]] = frozenset()
SCREEN = dict(heat_c=32, cold_c=5, frost_context_c=2, air_freeze_c=0,
              gust_ms=15, mean_wind_ms=10, rain_mm_h=10, rain_24h_mm=25,
              near_saturation_rh=90)
WARNING_IDS = tuple(f'W{i:02}' for i in range(1, 15))


class Unsupported(ValueError):
    pass


def num(x):
    return isinstance(x, (float, int)) and not isinstance(x, bool) and isfinite(x)


def require(condition, reason):
    if not condition:
        raise Unsupported(reason)


def vpd(air_c, rh):
    require(num(air_c) and -60 <= air_c <= 60 and num(rh) and 0 <= rh <= 100,
            'invalid_paired_air')
    return .6108 * exp(17.27 * air_c / (air_c + 237.3)) * (1-rh/100)


def flag(wid, code, state, reasons=(), **evidence):
    return dict(id=wid, code=code, state=state, reasons=list(reasons),
                evidence=evidence, probability=None, push_eligible=False)


def canonical_weather(records, now, location_revision):
    """Latest issue for exact same interval/source/nature; never sum versions.

    Differently overlapping intervals are not resolved by interpolation. Water
    replay/coverage rejects overlaps. Invalid individual variables become null,
    allowing unrelated valid hazard evidence to survive.
    """
    chosen = {}; issues = []
    bounds = {'temp_c':(-60,60), 'rh':(0,100), 'rain_mm':(0,1e4),
              'et0_mm':(0,1e3), 'wind_ms':(0,150), 'gust_ms':(0,200)}
    for raw in records:
        r=deepcopy(raw)
        if r.get('location_revision') != location_revision:
            issues.append('weather_location_mismatch'); continue
        kind=r.get('kind'); a=r.get('start'); b=r.get('end'); issue=r.get('issued_at')
        if kind not in ('occurred_estimate','forecast','current_point') or not all(num(x) for x in (a,b,issue)):
            issues.append('invalid_weather_interval'); continue
        if issue > now or a > b or (a == b and kind != 'current_point') or (kind=='current_point' and a!=b):
            issues.append('invalid_weather_time'); continue
        if kind in ('occurred_estimate','current_point') and b > now:
            issues.append('future_values_marked_occurred'); continue
        if not isinstance(r.get('source'), str) or not r['source']:
            issues.append('weather_source_missing'); continue
        for k,(lo,hi) in bounds.items():
            x=r.get(k)
            if x is not None and not (num(x) and lo <= x <= hi):
                issues.append('invalid_'+k); r[k]=None
        key=(kind,a,b,r['source'])
        if key in chosen and issue == chosen[key]['issued_at'] and r != chosen[key]:
            issues.append('conflicting_weather_revision')
            chosen[key]['conflicted']=True
        elif key not in chosen or issue > chosen[key]['issued_at']:
            chosen[key]=r
    return sorted(chosen.values(),key=lambda x:(x['start'],x['end'],x['source'])), sorted(set(issues))


def interval_rows(weather, start, end, kind):
    return [r for r in weather if r['kind']==kind and start <= r['start'] < r['end'] <= end]


def coverage(rows, start, end, keys):
    """Full per-variable interval coverage. Point samples never fill hours."""
    selected=sorted(rows,key=lambda x:x['start']); cursor=start; covered=0
    for r in selected:
        if r.get('conflicted') or r['start'] < cursor:
            return dict(complete=False,covered_hours=None,reason='overlap_or_conflict')
        if r['start']==cursor and all(r.get(k) is not None for k in keys):
            covered += r['end']-r['start']; cursor=r['end']
        else:
            # Continue counting usable non-overlapping bins; gap stays a gap.
            if all(r.get(k) is not None for k in keys): covered += r['end']-r['start']
            cursor=r['end']
    total=end-start
    exact=(bool(selected) and selected[0]['start']==start and cursor==end
           and covered==total and all(selected[i]['end']==selected[i+1]['start'] for i in range(len(selected)-1)))
    return dict(complete=exact,covered_hours=covered/HOUR,reason=None if exact else 'missing_intervals_or_values')


def canonical_logs(records, now):
    chosen={}; issues=[]
    for r in records:
        event_id=r.get('event_id'); revision=r.get('revision',0)
        if not isinstance(event_id,str) or not event_id or not num(revision):
            issues.append('invalid_log_identity'); continue
        if event_id in chosen and revision==chosen[event_id].get('revision',0) and r!=chosen[event_id]:
            issues.append('conflicting_log_revision'); continue
        if event_id not in chosen or revision>chosen[event_id].get('revision',0): chosen[event_id]=r
    answer=[]
    for r in chosen.values():
        if r.get('deleted'): continue
        lo=r.get('earliest'); hi=r.get('latest'); recorded=r.get('recorded_at',now)
        if not all(num(x) for x in (lo,hi,recorded)) or lo>hi or recorded>now or lo>recorded:
            issues.append('invalid_log_time'); continue
        r=deepcopy(r); r['latest']=min(hi,recorded,now)
        if r.get('amount_l') is not None and not (num(r['amount_l']) and r['amount_l']>=0):
            issues.append('invalid_water_amount'); continue
        answer.append(r)
    return sorted(answer,key=lambda x:(x['earliest'],x['event_id'])),sorted(set(issues))


def check_profile(plant, profile, now):
    require(profile is not None,'profile_unavailable')
    require(plant.get('environment')=='outdoor','environment_out_of_scope')
    scope=profile.get('scope',{})
    for k in ('planted_in','stage','medium','sun'):
        require(plant.get(k,'unknown') in scope.get(k,[]),'profile_scope_'+k)
    if plant.get('planted_in')=='pot' and 'pot_l_range' in scope:
        pot=plant.get('pot_l'); lo,hi=scope['pot_l_range']
        require(num(pot) and lo<=pot<=hi,'profile_scope_pot_volume')
    used={}
    if 'age_days_range' in scope:
        age=plant.get('age_days');asof=plant.get('age_asof')
        require(plant.get('age_known') is True and num(age) and age>=0 and num(asof) and asof<=now,'optional_age_unusable')
        require(plant.get('age_origin','unknown') in scope.get('age_origin',[]),'optional_age_origin_mismatch')
        effective=age+(now-asof)/DAY;lo,hi=scope['age_days_range']
        require(lo<=effective<=hi,'optional_age_out_of_scope');used['effective_age_days']=effective
    if 'height_cm_range' in scope:
        height=plant.get('height_cm');asof=plant.get('height_asof');maxage=scope.get('height_max_age_days')
        require(num(height) and height>0 and num(asof) and asof<=now and num(maxage) and maxage>=0 and (now-asof)/DAY<=maxage,'optional_height_unusable')
        lo,hi=scope['height_cm_range'];require(lo<=height<=hi,'optional_height_out_of_scope');used['height_cm']=height
    require(plant.get('location_revision')==profile.get('location_revision'),'profile_location_changed')
    require(bool(profile.get('scenarios')),'profile_has_no_scenarios')
    for s in profile['scenarios']:
        for k in ('capacity_l','initial_l','action_l','plant_loss_m2','surface_loss_m2',
                  'rain_catchment_m2','uncertain_soil_delivery','irrigation_retention'):
            require(num(s.get(k)) and s[k]>=0,'invalid_profile_'+k)
        require(s['capacity_l']>0 and 0<=s['initial_l']<=s['capacity_l'] and 0<=s['action_l']<=s['capacity_l'],
                'invalid_profile_storage')
        require(s['uncertain_soil_delivery']<=1 and s['irrigation_retention']<=1,'invalid_profile_fraction')
    ids=[s.get('id') for s in profile['scenarios']]
    require(all(isinstance(x,str) and x for x in ids) and len(set(ids))==len(ids),'invalid_scenario_ids')
    return used


def resolve_profile(plant, profile, now):
    """Only explicitly supplied, separately supported fallback profiles.

    No default age/height or invented multiplier. The real registry must have
    validation for both specialized and aggregate fallback domains.
    """
    visited=set();reasons=[]
    while profile is not None:
        key=(profile.get('id'),profile.get('version'))
        require(key not in visited,'profile_fallback_cycle');visited.add(key)
        try:return profile,dict(optional_features_used=check_profile(plant,profile,now),fallback_reasons=reasons)
        except Unsupported as e:
            reasons.append(str(e))
            if not profile.get('fallback'):raise
            profile=profile['fallback']
    raise Unsupported('profile_unavailable')


@dataclass
class Bank:
    reserve_l: float
    delivered_l: float=0
    extracted_l: float=0
    excess_l: float=0
    unmet_potential_l: float=0


def bank_step(bank, capacity, water, demand, order):
    require(all(num(x) and x>=0 for x in (capacity,water,demand)) and capacity>0,'invalid_bank_step')
    r=bank.reserve_l
    if order=='loss_first':
        loss=min(r,demand); stored=r-loss+water
        excess=max(0,stored-capacity); final=min(capacity,stored)
    else:
        excess=max(0,r+water-capacity); stored=min(capacity,r+water)
        loss=min(stored,demand); final=stored-loss
    require(abs(r+water-loss-excess-final)<1e-7,'water_balance_failure')
    bank.reserve_l=final; bank.delivered_l+=water;bank.extracted_l+=loss
    bank.excess_l+=excess;bank.unmet_potential_l+=demand-loss


def replay_water(plant, profile, weather, logs, log_issues, now):
    """Candidate replay only. Constant profile over the anchor window.

    Two event-timing branches and two within-bin input/loss orders retain model
    ordering uncertainty. No weather-based leaf/root/soil measurement is made.
    """
    empty=dict(candidate='uncertain',decision='uncertain',branches=[],reason=None,probability=None)
    try:
        profile,selection=resolve_profile(plant,profile,now)
        require(not log_issues,'log_ledger_requires_repair')
        start=profile.get('anchor_utc')
        require(num(start) and start<now,'unsupported_state_anchor')
        require(bool(profile.get('anchor_basis')),'state_anchor_basis_missing')
        require(not any(l.get('kind') in ('repot','move','medium_change','stage_change') and l['latest']>=start for l in logs),
                'profile_transition_requires_reinitialization')
        require(not any(l['earliest']<start<=l['latest'] for l in logs),'log_straddles_anchor')
        rows=interval_rows(weather,start,now,'occurred_estimate')
        rows=[r for r in rows if r['source']==profile.get('forcing_source')]
        keys=['et0_mm']+([] if plant.get('soil_rain')=='no' else ['rain_mm'])
        require(coverage(rows,start,now,keys)['complete'],'water_history_incomplete_or_conflicted')
        reception=plant.get('soil_rain','unknown')
        require(reception in ('yes','no','partial','unknown'),'invalid_soil_reception')
        if reception=='unknown':
            fractions=[s['uncertain_soil_delivery'] for s in profile['scenarios']]
            require(min(fractions)==0 and max(fractions)==1,'unknown_rain_reception_not_bracketed')
        if reception=='partial':
            bounds=profile.get('partial_reception_bounds')
            require(isinstance(bounds,list) and len(bounds)==2 and all(num(v) for v in bounds) and 0<=bounds[0]<bounds[1]<=1,
                    'partial_rain_reception_bounds_missing')
            fractions=[s['uncertain_soil_delivery'] for s in profile['scenarios']]
            require(min(fractions)<=bounds[0] and max(fractions)>=bounds[1],'partial_rain_reception_not_bracketed')
        relevant=[l for l in logs if l.get('kind')=='watering' and l['earliest']>=start]
        require(all(l['latest']<=now for l in relevant),'future_log')
        branches=[]
        for s in profile['scenarios']:
            if any(l.get('amount_l') is None for l in relevant):
                require(num(s.get('unknown_log_applied_l')) and s['unknown_log_applied_l']>=0,'unknown_refill_unbounded')
            frac=1 if reception=='yes' else 0 if reception=='no' else s['uncertain_soil_delivery']
            for timing in ('earliest','latest'):
                assigned={l['event_id']:l[timing] for l in relevant}
                for order in ('inputs_first','loss_first'):
                    b=Bank(s['initial_l']); trace=[]
                    for r in rows:
                        events=[l for l in relevant if r['start']<=assigned[l['event_id']]<r['end']]
                        irrigation=sum((l['amount_l'] if l.get('amount_l') is not None else s['unknown_log_applied_l'])*s['irrigation_retention'] for l in events)
                        rain=(r.get('rain_mm') or 0)*s['rain_catchment_m2']*frac
                        # ET0 already combines air T/RH/wind/energy. No extra bonuses.
                        demand=r['et0_mm']*(s['plant_loss_m2']+s['surface_loss_m2'])
                        bank_step(b,s['capacity_l'],irrigation+rain,demand,order)
                        trace.append({'end':r['end'],'reserve_l':b.reserve_l,'rain_delivered_l':rain,'irrigation_delivered_l':irrigation,'potential_loss_l':demand})
                    at_now=[l for l in relevant if assigned[l['event_id']]==now]
                    irrigation=sum((l['amount_l'] if l.get('amount_l') is not None else s['unknown_log_applied_l'])*s['irrigation_retention'] for l in at_now)
                    bank_step(b,s['capacity_l'],irrigation,0,'inputs_first')
                    branches.append(dict(id=s['id']+'/'+timing+'/'+order,scenario_id=s['id'],action_l=s['action_l'],capacity_l=s['capacity_l'],initial_l=s['initial_l'],**asdict(b),trace=trace))
        due=[b['reserve_l']<=b['action_l']+EPS for b in branches]
        candidate='water' if all(due) else 'not_due' if not any(due) else 'uncertain'
        approved=(profile['id'],profile['version']) in RELEASED_PROFILES
        return dict(candidate=candidate,decision=candidate if approved else 'uncertain',
                    branches=branches,reason='profile_not_released' if not approved else 'supported_scenario_replay',
                    probability=None,measured_moisture=None,profile_id=profile['id'],selection=selection)
    except (Unsupported,KeyError,TypeError) as e:
        return dict(empty,reason=str(e))


def project_thresholds(plant,profile,weather,water,now):
    """Debug-only, conditional forecast scenarios; never edits current decision.

    Rain branches are no-rain and provided amount, not probabilities or a full
    meteorological uncertainty envelope. Values beyond the provider forecast
    remain unrepresented. First crossing is an interval, never an exact time.
    """
    if not water.get('branches'):return dict(state='unavailable',reason='current_state_unavailable')
    try:
        profile,_=resolve_profile(plant,profile,now)
        rows=[r for r in interval_rows(weather,now,now+DAY,'forecast') if r['source']==profile.get('forcing_source')]
        keys=['et0_mm']+([] if plant.get('soil_rain')=='no' else ['rain_mm'])
        require(coverage(rows,now,now+DAY,keys)['complete'],'forecast_projection_incomplete')
        scenarios={s['id']:s for s in profile['scenarios']};crossings=[];not_crossed=0
        for branch in water['branches']:
            s=scenarios[branch['scenario_id']]
            frac=1 if plant.get('soil_rain')=='yes' else 0 if plant.get('soil_rain')=='no' else s['uncertain_soil_delivery']
            for rain_mode in ('no_rain','provided_forecast'):
                for order in ('inputs_first','loss_first'):
                    b=Bank(branch['reserve_l']);cross=(now,now) if b.reserve_l<=s['action_l']+EPS else None
                    for r in rows:
                        rain=(r.get('rain_mm') or 0)*s['rain_catchment_m2']*frac if rain_mode=='provided_forecast' else 0
                        loss=r['et0_mm']*(s['plant_loss_m2']+s['surface_loss_m2'])
                        before=b.reserve_l;bank_step(b,s['capacity_l'],rain,loss,order)
                        if cross is None and (b.reserve_l<=s['action_l']+EPS or (order=='loss_first' and max(0,before-loss)<=s['action_l']+EPS)):
                            cross=(r['start'],r['end'])
                    if cross:crossings.append(cross)
                    else:not_crossed+=1
        return dict(state='synthetic_candidate_only',first_crossing_interval_utc=[min(x[0] for x in crossings),max(x[1] for x in crossings)] if crossings else None,
                    trajectories_not_crossing_within_horizon=not_crossed,horizon_hours=24,probability=None,
                    warning='conditional_scenarios_not_a_calibrated_ETA_or_prediction_interval')
    except (Unsupported,KeyError,TypeError) as e:return dict(state='unavailable',reason=str(e))


def active_alerts(alerts, now, location_revision):
    """Adapter must establish mapping/location outside this offline function."""
    result=[];latest={}
    for a in alerts:
        if not isinstance(a.get('alert_id'),str) or not a['alert_id'] or not num(a.get('issued_at')):continue
        if a['issued_at']>now:continue
        if a['alert_id'] not in latest or a['issued_at']>latest[a['alert_id']]['issued_at']:latest[a['alert_id']]=deepcopy(a)
        elif a['issued_at']==latest[a['alert_id']]['issued_at'] and a!=latest[a['alert_id']]:latest[a['alert_id']]['conflicted']=True
    for a in latest.values():
        if not a.get('adapter_verified') or a.get('cancelled') or a.get('conflicted') or a.get('location_revision')!=location_revision: continue
        if not all(num(a.get(k)) for k in ('start','end','issued_at')): continue
        if a['start']>=a['end'] or a['issued_at']>now or a['end']<=now or a['start']>now+DAY: continue
        if a.get('hazard') not in ('heat','cold','wind','heavy_rain','hail','flood','thunderstorm'): continue
        result.append(a)
    return result


def weather_flag(wid,code,key,threshold,op,weather,alerts,now,hazard):
    source=[a for a in alerts if a['hazard']==hazard]
    if source: return flag(wid,code,'triggered',['applicable_source_event'],alerts=source)
    details=[]; any_unknown=False
    for phase,a,b,kind in [('recent',now-HOUR,now,'occurred_estimate'),('forecast',now,now+DAY,'forecast')]:
        rows=interval_rows(weather,a,b,kind)
        # Point readings may establish a crossing; never establish duration/full coverage.
        points=[r for r in weather if r['kind']=='current_point' and a<=r['start']<=b and phase=='recent']
        usable=[r for r in rows+points if r.get(key) is not None and not r.get('conflicted')]
        crossed=[r for r in usable if (r[key]>=threshold if op=='ge' else r[key]<=threshold)]
        complete=coverage(rows,a,b,[key])['complete']
        any_unknown |= not complete
        details.append(dict(phase=phase,threshold=threshold,known_crossings=len(crossed),complete=complete))
    state='triggered' if any(d['known_crossings'] for d in details) else 'unknown' if any_unknown else 'not_triggered'
    return flag(wid,code,state,['ENG_attention_screen'],phases=details)


def evaluate_wind(weather,alerts,now):
    gust=weather_flag('W03','WIND_PREPARATION','gust_ms',SCREEN['gust_ms'],'ge',weather,alerts,now,'wind')
    mean=weather_flag('W03','WIND_PREPARATION','wind_ms',SCREEN['mean_wind_ms'],'ge',weather,alerts,now,'wind')
    state='triggered' if 'triggered' in (gust['state'],mean['state']) else 'not_triggered' if gust['state']==mean['state']=='not_triggered' else 'unknown'
    return flag('W03','WIND_PREPARATION',state,['gust_OR_mean_OR_source'],gust=gust,mean=mean,alerts=[a for a in alerts if a['hazard']=='wind'])


def evaluate_rain(weather,alerts,now):
    source=[a for a in alerts if a['hazard'] in ('heavy_rain','flood')]
    rows=interval_rows(weather,now-DAY,now,'occurred_estimate')
    cov=coverage(rows,now-DAY,now,['rain_mm'])
    total=sum(r['rain_mm'] for r in rows if r.get('rain_mm') is not None) if cov['reason']!='overlap_or_conflict' else None
    peaks=[]
    for kind,a,b in [('occurred_estimate',now-HOUR,now),('forecast',now,now+DAY)]:
        for r in interval_rows(weather,a,b,kind):
            if r.get('rain_mm') is not None and not r.get('conflicted'):
                # Interval mean rate; not a measured within-hour peak.
                peaks.append(r['rain_mm']*HOUR/(r['end']-r['start']))
    frows=interval_rows(weather,now,now+DAY,'forecast');fcov=coverage(frows,now,now+DAY,['rain_mm'])
    ftotal=sum(r['rain_mm'] for r in frows if r.get('rain_mm') is not None) if fcov['reason']!='overlap_or_conflict' else None
    triggered=bool(source) or any(x>=SCREEN['rain_mm_h'] for x in peaks) or (total is not None and total>=SCREEN['rain_24h_mm']) or (ftotal is not None and ftotal>=SCREEN['rain_24h_mm'])
    state='triggered' if triggered else 'not_triggered' if cov['complete'] and fcov['complete'] else 'unknown'
    return flag('W04','HEAVY_RAIN_PREPARATION',state,['ENG_attention_screen'],known_rain_mm=total,
                historical_complete=cov['complete'],forecast_known_rain_mm=ftotal,forecast_complete=fcov['complete'],interval_mean_rates_mm_h=peaks,alerts=source)


def ambient_features(weather,now):
    answer={}
    for phase,start,end,kind in [('history',now-3*DAY,now,'occurred_estimate'),('forecast',now,now+DAY,'forecast')]:
        rows=interval_rows(weather,start,end,kind);cov=coverage(rows,start,end,['temp_c','rh'])
        paired=[r for r in rows if r.get('temp_c') is not None and r.get('rh') is not None and not r.get('conflicted')]
        # Refuse ambiguous time-integrated features, rather than double-count.
        if cov['reason']=='overlap_or_conflict': paired=[]
        values=[dict(start=r['start'],end=r['end'],air_c=r['temp_c'],rh=r['rh'],air_vpd_kpa=vpd(r['temp_c'],r['rh'])) for r in paired]
        near=sum((r['end']-r['start'])/HOUR for r in paired if r['rh']>=SCREEN['near_saturation_rh'])
        answer[phase]=dict(window_hours=(end-start)/HOUR,coverage=cov,paired_air=values,
                           near_saturated_air_hours=near if cov['reason']!='overlap_or_conflict' else None,
                           leaf_wet_hours=None,infection_probability=None)
    return answer


def evaluate_health(plant,weather,features,heat,problem_report,now):
    stage=plant.get('stage','unknown');foliage=stage in ('seedling','vegetative','flowering','clone')
    pm_state='disabled' if foliage else 'unknown' if stage=='unknown' else 'not_applicable'
    pm=flag('W10','POWDERY_MILDEW_PREDICTION',pm_state,['CAL_required_no_high_RH_gate'],ambient_context=features)
    humidity=any(x['near_saturated_air_hours'] is not None and x['near_saturated_air_hours']>0 for x in features.values())
    damp_state='context_only' if humidity else 'not_triggered' if all(x['coverage']['complete'] for x in features.values()) else 'unknown'
    damp=flag('W09','HUMID_AIR_CONTEXT',damp_state,
              ['not_measured_dew_or_leaf_wetness'],ambient_context=features)
    canopy=plant.get('canopy_rain','unknown')
    future=interval_rows(weather,now,now+DAY,'forecast')
    rain=[r for r in future if r.get('rain_mm') is not None and r['rain_mm']>0 and not r.get('conflicted')]
    direct_rain=(bool(rain) and canopy=='yes')
    if stage=='unknown':flower_state='unknown'
    elif stage!='flowering':flower_state='not_applicable'
    elif direct_rain or humidity:flower_state='context_only'
    elif rain and canopy in ('unknown','partial'):flower_state='unknown'
    else:flower_state='disabled'
    flower=flag('W11','FLOWER_WET_WEATHER_CONTEXT',flower_state,
                ['flowering_gate_no_infection_claim'],canopy_reception=canopy,direct_rain_forecast=direct_rain,ambient_context=features)
    leaf=flag('W12','WET_CANOPY_CONTEXT','context_only' if direct_rain else 'unknown' if canopy in ('unknown','partial') else 'not_triggered',
              ['generic_context_no_pathogen_detection'],direct_rain_forecast=direct_rain)
    pot_state=heat['state'] if plant.get('planted_in')=='pot' else 'not_applicable' if plant.get('planted_in')=='ground' else 'unknown'
    pot=flag('W08','CONTAINER_HEAT_CONTEXT',pot_state,
             ['merge_W01_no_root_temperature'])
    topics=set(problem_report.get('topics',[])) if isinstance(problem_report,dict) else set()
    root=flag('W07','EXCESS_ROOT_WATER_REVIEW','review_requested' if 'excess_root_water' in topics else 'disabled',['no_weather_only_root_saturation'])
    establishment_state=('review_requested' if 'establishment' in topics else 'disabled') if stage in ('germination','seedling','clone') else 'unknown' if stage=='unknown' else 'not_applicable'
    establishment=flag('W13','ESTABLISHMENT_PROBLEM_REVIEW',establishment_state,
                       ['no_weather_only_damping_off'])
    wilt=flag('W14','ROOT_WILT_PROBLEM_REVIEW','review_requested' if 'root_wilt' in topics else 'disabled',['symptoms_have_multiple_causes'])
    return [root,pot,damp,pm,flower,leaf,establishment,wilt]


def build_cards(flags):
    """Pure composition; no notification or external side effect."""
    groups={'W01':'heat','W08':'heat','W09':'wet_weather','W11':'wet_weather','W12':'wet_weather',
            'W07':'problem_review','W13':'problem_review','W14':'problem_review'}
    cards={}; source_ids={}
    for f in flags:
        if f['state'] not in ('triggered','context_only','review_requested'):continue
        key=groups.get(f['id'],f['id'])
        alerts=f['evidence'].get('alerts',[])
        already=[source_ids[a['alert_id']] for a in alerts if a.get('alert_id') in source_ids]
        # One source event can satisfy both a specific hazard and W05. Keep one
        # card while preserving every distinct source event and warning link.
        if alerts and len(already)==len(alerts) and len(set(already))==1:key=already[0]
        cards.setdefault(key,{'card':key,'warning_ids':[],'delivery':'in_app_candidate'})['warning_ids'].append(f['id'])
        for a in alerts:source_ids.setdefault(a['alert_id'],key)
    return list(cards.values())


def evaluate(payload):
    now=payload['now'];plant=payload['plant'];require(num(now),'invalid_now')
    wx,wx_issues=canonical_weather(payload.get('weather',[]),now,plant.get('location_revision'))
    logs,log_issues=canonical_logs(payload.get('logs',[]),now)
    alerts=active_alerts(payload.get('alerts',[]),now,plant.get('location_revision'))
    water=replay_water(plant,payload.get('profile'),wx,logs,log_issues,now)
    features=ambient_features(wx,now)
    heat=weather_flag('W01','HEAT_PREPARATION','temp_c',SCREEN['heat_c'],'ge',wx,alerts,now,'heat')
    cold=weather_flag('W02','COLD_FROST_PREPARATION','temp_c',SCREEN['cold_c'],'le',wx,alerts,now,'cold')
    cold['evidence']['possible_frost_context']=weather_flag('W02','POSSIBLE_FROST_AIR_CONTEXT','temp_c',SCREEN['frost_context_c'],'le',wx,[],now,'cold')
    cold['evidence']['air_freezing_context']=weather_flag('W02','AIR_FREEZING_CONTEXT','temp_c',SCREEN['air_freeze_c'],'le',wx,[],now,'cold')
    wind=evaluate_wind(wx,alerts,now);rain=evaluate_rain(wx,alerts,now)
    severe=flag('W05','SOURCE_HAZARD_EVENT','triggered' if alerts else 'unknown',
                ['source_only_no_all_clear_from_absent_coverage'],alerts=alerts)
    water_flag=flag('W06','WATERING_DUE','triggered' if water['decision']=='water' else 'not_triggered' if water['decision']=='not_due' else 'unknown',
                    [water['reason']],decision=water['decision'])
    health=evaluate_health(plant,wx,features,heat,payload.get('problem_report'),now)
    flags=sorted([heat,cold,wind,rain,severe,water_flag]+health,key=lambda x:x['id'])
    # External weather can be preparation for a shelter; not its internal climate.
    if plant.get('environment')!='outdoor':
        for f in flags:
            if f['id'] in ('W09','W10','W11','W12'):
                f['state']='not_applicable';f['reasons']=['outdoor_weather_not_internal_microclimate']
    if plant.get('status','active')!='active' or plant.get('deleting'):
        water.update(decision='uncertain',candidate='uncertain',reason='plant_inactive')
        for f in flags:
            f['state']='not_applicable';f['reasons']=['plant_inactive']
    require(tuple(f['id'] for f in flags)==WARNING_IDS,'warning_registry_incomplete')
    projection=project_thresholds(plant,payload.get('profile'),wx,water,now) if water['reason']!='plant_inactive' else dict(state='not_applicable')
    return dict(version='7.3',mode='offline_design_emulator',water=water,
                needs_water=True if water['decision']=='water' else False if water['decision']=='not_due' else None,
                debug_threshold_projection=projection,flags=flags,
                cards=build_cards(flags),data_issues=sorted(set(wx_issues+log_issues)),
                biological_accuracy_validated=False,notifications_sent=0)


def notification_plan(previous, candidate, *, now, cooldown_seconds, policy_enabled):
    """Pure proposed plan. Delivery authorization/subscription is outside model.

    Episode key/tier are supplied by a tested adapter or product policy. They
    are not disease severity/probability. Escalation bypasses repeat cooldown.
    """
    if not policy_enabled or not candidate.get('eligible') or candidate.get('state')!='triggered':return 'suppress'
    require(num(cooldown_seconds) and cooldown_seconds>=0,'invalid_cooldown')
    if not previous or previous['episode_key']!=candidate['episode_key']:return 'new_episode'
    if candidate['tier']>previous['tier']:return 'escalation'
    return 'repeat_after_cooldown' if now-previous['sent_at']>=cooldown_seconds else 'suppress'


def demo_payload():
    now=3*DAY
    plant=dict(id='DEMO_NOT_A_REAL_PLANT',environment='outdoor',planted_in='pot',pot_l=10,
               medium='potting_mix',stage='flowering',sun='full',soil_rain='yes',canopy_rain='yes',location_revision=1)
    scenario=dict(id='synthetic',capacity_l=2,initial_l=1.2,action_l=.8,plant_loss_m2=.15,
                  surface_loss_m2=.03,rain_catchment_m2=.07,uncertain_soil_delivery=0,
                  irrigation_retention=.8,unknown_log_applied_l=.25)
    profile=dict(id='SYNTHETIC_DO_NOT_DEPLOY',version='fixture1',origin='SYNTHETIC',anchor_utc=now-DAY,
                 anchor_basis='synthetic initial condition',location_revision=1,forcing_source='synthetic',
                 scope=dict(planted_in=['pot'],stage=['flowering'],medium=['potting_mix'],sun=['full'],pot_l_range=[9,11]),scenarios=[scenario])
    weather=[]
    for i in range(-72,24):
        start=now+i*HOUR;kind='occurred_estimate' if i<0 else 'forecast'
        weather.append(dict(source='synthetic',location_revision=1,issued_at=min(start,now),start=start,end=start+HOUR,
                            kind=kind,temp_c=25,rh=60,et0_mm=4/24,rain_mm=0,wind_ms=3,gust_ms=5))
    return dict(now=now,plant=plant,profile=profile,weather=weather,logs=[],alerts=[])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();payload=json.loads(args.input.read_text(encoding='utf-8')) if args.input else demo_payload()
    result=evaluate(payload);encoded=json.dumps(result,indent=2,allow_nan=False)
    if args.output:args.output.write_text(encoded,encoding='utf-8')
    else:print(encoded)


if __name__=='__main__': main()
