"""Offline adapter/state/delivery reference. No network or notifications.
No calibrated profiles or production integration are supplied.
"""
from copy import deepcopy
from datetime import datetime,time,timedelta,timezone
from math import isfinite
from zoneinfo import ZoneInfo

def valid(x):return isinstance(x,(int,float)) and not isinstance(x,bool) and isfinite(x)
def require(condition,reason):
    if not condition:raise ValueError(reason)

def local_day_bounds(timestamp,zone):
    z=ZoneInfo(zone);day=datetime.fromtimestamp(timestamp,z).date()
    start=datetime.combine(day,time(),z);end=datetime.combine(day+timedelta(days=1),time(),z)
    return start.timestamp(),end.timestamp()

def normalize_meteo(payload,*,product,retrieved_at,location_revision):
    """Product explicitly distinguishes Forecast from Archive rain semantics.
    Forecast past_days stays forecast. No implicit observed-history conversion.
    Point air variables and preceding-hour integrals have different supports.
    """
    require(product in ('forecast','archive'),'unsupported_product')
    require(payload.get('utc_offset_seconds')==0,'request_UTC_for_this_adapter')
    require(valid(retrieved_at),'invalid_retrieval_time')
    h=payload['hourly'];u=payload['hourly_units'];times=h['time'];n=len(times)
    require(u.get('time')=='unixtime','unix_time_required')
    fields={'temperature_2m':('air_temperature_c','°C','point'),
            'relative_humidity_2m':('air_rh_pct','%','point'),
            'dew_point_2m':('air_dewpoint_c','°C','point'),
            'wind_speed_10m':('wind_10m_ms','m/s','point'),
            'wind_gusts_10m':('gust_10m_ms','m/s','reported_gust'),
            'shortwave_radiation':('shortwave_w_m2','W/m²','interval_mean'),
            'et0_fao_evapotranspiration':('et0_mm','mm','interval_sum')}
    required=list(fields)+['rain']+(['showers'] if product=='forecast' else [])
    for k in required:
        require(k in h and len(h[k])==n,'missing_or_misaligned_'+k)
    require(u.get('rain')=='mm' and (product!='forecast' or u.get('showers')=='mm'),'rain_units')
    require(all(valid(t) for t in times) and all(b-a==3600 for a,b in zip(times,times[1:])),'nonhourly_or_duplicate_times')
    result=[]
    def emit(name,value,unit,support,t):
        if value is not None:require(valid(value),'invalid_'+name)
        if value is not None and name in ('et0_mm','liquid_rain_mm','wind_10m_ms','gust_10m_ms'):require(value>=0,'negative_'+name)
        if value is not None and name=='air_rh_pct':require(0<=value<=100,'invalid_rh_range')
        interval=support in ('interval_sum','interval_mean')
        result.append(dict(variable=name,value=value,unit=unit,time_support=support,
                           valid_start_utc=t-3600 if interval else t,valid_end_utc=t,
                           provider='Open-Meteo',product=product,model_selection='provider_best_match_unpinned',
                           kind='forecast' if product=='forecast' else 'historical_model_estimate',
                           retrieved_at_utc=retrieved_at,available_at_utc=retrieved_at,issued_at_utc=None,
                           location_revision=location_revision,grid_latitude=payload.get('latitude'),grid_longitude=payload.get('longitude')))
    for i,t in enumerate(times):
        if product=='archive':require(t<=retrieved_at,'future_bin_in_historical_product')
        for k,(name,unit,support) in fields.items():
            require(u.get(k)==unit,'unexpected_units_'+k);emit(name,h[k][i],unit,support,t)
        rain=h['rain'][i]
        if product=='forecast':
            shower=h['showers'][i];rain=None if rain is None or shower is None else rain+shower
        emit('liquid_rain_mm',rain,'mm','interval_sum',t)
    return result

def normalize_openweather(payload,*,product,retrieved_at,location_revision):
    """Current/forecast endpoint and timestamp-history have distinct envelopes.
    Rate fields are retained as rates, not invented accumulated root water.
    No request is made. Payload caller must have requested units=metric.
    """
    require(product in ('onecall_metric','timemachine_metric'),'unsupported_product')
    require(valid(retrieved_at),'invalid_retrieval_time')
    rows=[]
    if product=='timemachine_metric':
        sources=[(x,'historical_weather_estimate') for x in payload.get('data',[])]
    else:
        sources=([(payload['current'],'current_point')] if payload.get('current') else [])+[(x,'forecast') for x in payload.get('hourly',[])]
    fields={'temp':('air_temperature_c','°C'),'humidity':('air_rh_pct','%'),'dew_point':('air_dewpoint_c','°C'),'wind_speed':('wind_ms','m/s'),'wind_gust':('gust_ms','m/s')}
    for x,kind in sources:
        t=x['dt'];require(valid(t),'invalid_valid_time')
        if product=='timemachine_metric':require(t<=retrieved_at,'future_point_in_historical_product')
        values={}
        for raw,(name,unit) in fields.items():
            value=x.get(raw);require(value is None or valid(value),'invalid_'+raw);values[name]=dict(value=value,unit=unit)
            if raw=='humidity' and value is not None:require(0<=value<=100,'invalid_humidity_range')
            if raw in ('wind_speed','wind_gust') and value is not None:require(value>=0,'negative_wind')
        # Omission-as-zero is specific to the documented valid sample contract.
        complete=all(valid(x.get(k)) for k in ('dt','temp','humidity','wind_speed'))
        rain=x.get('rain');rate=rain.get('1h') if isinstance(rain,dict) else None
        require(rain is None or isinstance(rain,dict),'invalid_point_rain_structure')
        require(rate is None or valid(rate) and rate>=0,'invalid_rain_rate')
        reason='provider_value'
        if rain is None and complete:rate=0;reason='documented_no_phenomenon_omission'
        values['rain_rate_mm_h']=dict(value=rate,unit='mm/h',zero_reason=reason if rate==0 else None)
        rows.append(dict(valid_at_utc=t,kind=kind,values=values,sunrise_utc=x.get('sunrise'),sunset_utc=x.get('sunset'),
                         weather_codes=deepcopy(x.get('weather',[])),provider='OpenWeather',product=product,
                         retrieved_at_utc=retrieved_at,available_at_utc=retrieved_at,issued_at_utc=None,location_revision=location_revision))
    daily=[]
    for x in payload.get('daily',[]) if product=='onecall_metric' else []:
        a,b=local_day_bounds(x['dt'],payload['timezone'])
        amount=x.get('rain');require(amount is None or valid(amount) and amount>=0,'invalid_daily_rain')
        daily.append(dict(valid_start_utc=a,valid_end_utc=b,kind='forecast',rain_total_mm=amount,
                          original=deepcopy(x)))
    return dict(points=rows,daily_forecasts=daily,raw_source_events=deepcopy(payload.get('alerts',[])),
                source_event_coverage='unknown',hazard_mapping='requires_tested_regional_source_adapter')

def initialize_bank(capacity,action,*,state_time,root_zone_key,initial_range=None,anchor_basis=None):
    require(valid(capacity) and capacity>0 and valid(action) and 0<=action<=capacity,'invalid_bank_profile')
    require(valid(state_time) and isinstance(root_zone_key,str) and root_zone_key,'invalid_state_identity')
    if initial_range is None:lo,hi=0,capacity;basis='unanchored_full_available_bank_range'
    else:
        require(anchor_basis,'initial_range_requires_basis');lo,hi=initial_range;basis=anchor_basis
    require(valid(lo) and valid(hi) and 0<=lo<=hi<=capacity,'invalid_initial_range')
    return dict(capacity_l=capacity,action_l=action,reserve_range_l=[lo,hi],state_time_utc=state_time,
                root_zone_key=root_zone_key,anchor_basis=basis,release_approved=False)

def logged_water_update(state,*,applied_l=None,retention_range=None):
    """An unquantified log supplies only a conservative bank bound, not refill.
    Range endpoints are engineering/model bounds, never probabilities.
    """
    s=deepcopy(state);C=s['capacity_l'];lo,hi=s['reserve_range_l']
    if applied_l is None:delivered_lo,delivered_hi=0,C
    else:
        require(valid(applied_l) and applied_l>=0,'invalid_applied_amount')
        a,b=(0,1) if retention_range is None else retention_range
        require(valid(a) and valid(b) and 0<=a<=b<=1,'invalid_retention_bounds')
        delivered_lo,delivered_hi=applied_l*a,applied_l*b
    s['reserve_range_l']=[min(C,lo+delivered_lo),min(C,hi+delivered_hi)]
    s['last_update_basis']='bounded_logged_water_not_full_refill'
    return s

def transition_bank(state,*,new_capacity,new_action,new_root_zone_key,effective_at,kind,compatible=False):
    require(valid(new_capacity) and new_capacity>0 and valid(new_action) and 0<=new_action<=new_capacity,'invalid_new_profile')
    require(kind in ('demand_only','threshold_only','physical'),'unknown_transition_kind')
    if effective_at!=state['state_time_utc']:return dict(status='replay_to_transition_boundary_required',state=None)
    if kind!='physical' and compatible and new_capacity==state['capacity_l'] and new_root_zone_key==state['root_zone_key']:
        s=deepcopy(state);s['action_l']=new_action;s['release_approved']=False
        return dict(status='carry_reserve_apply_new_demand_forward',state=s)
    s=initialize_bank(new_capacity,new_action,state_time=effective_at,root_zone_key=new_root_zone_key)
    return dict(status='reinitialized_unknown_no_water_created',state=s)

def display_plan(*,flag_id,state,plant_id,reason_category='general',production_care_approved=False,
                 trusted_source=False,source_severe=False,source_adapter_approved=False,push_consent=False,push_policy=False):
    """Default delivery eligibility only. Existing episode/cooldown layer follows.
    Returns a plan; does not send anything or infer biological severity.
    """
    require(flag_id in {f'W{i:02}' for i in range(1,15)},'unknown_flag')
    require(state in ('triggered','not_triggered','unknown','not_applicable','disabled','context_only','review_requested'),'unknown_flag_state')
    push=False;card=None
    if state=='unknown':card='care_estimate_unavailable' if flag_id=='W06' else None
    elif state=='review_requested':card='requested_problem_review'
    elif state=='context_only':card='weather_preparation_context'
    elif state=='triggered':
        if flag_id=='W06':card='estimated_watering_due' if production_care_approved else None
        elif flag_id=='W05':card='weather_preparation' if trusted_source and source_adapter_approved else None
        elif flag_id not in ('W07','W10','W11','W12','W13','W14'):card='weather_preparation'
    if card and state=='triggered' and push_consent and push_policy:
        push=(flag_id=='W06' and production_care_approved) or (flag_id in ('W01','W02','W03','W04','W05') and trusted_source and source_severe and source_adapter_approved)
    return dict(card=card,push_eligible=push,dedupe_key=f'{plant_id}:{card}:{reason_category}' if card else None,
                asks_for_daily_measurement=False,notifications_sent=0)
