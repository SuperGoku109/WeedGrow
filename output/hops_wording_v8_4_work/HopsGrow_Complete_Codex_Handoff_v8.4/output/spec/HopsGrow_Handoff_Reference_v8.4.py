"""Audited offline boundary helpers. No network, production profiles or pushes.

Canonical samples are NOT input-compatible with the frozen v7.4 emulator.
Port the declared contract; do not relabel point samples as hourly intervals.
"""
from copy import deepcopy
from datetime import datetime, time, timedelta
from hashlib import sha256
from math import isfinite
import json
from zoneinfo import ZoneInfo

KINDS = ('occurred_estimate', 'forecast', 'current_point')
SUPPORTS = ('point', 'interval_mean', 'interval_maximum', 'interval_sum', 'rate')
VARIABLES = {
    'air_temperature_c': ('°C', -60, 60),
    'air_rh_pct': ('%', 0, 100),
    'air_dewpoint_c': ('°C', -60, 60),
    'wind_speed_ms': ('m/s', 0, None),
    'wind_gust_ms': ('m/s', 0, None),
    'shortwave_w_m2': ('W/m²', 0, None),
    'et0_mm': ('mm', 0, None),
    'liquid_rain_mm': ('mm', 0, None),
    'rain_rate_mm_h': ('mm/h', 0, None),
}


def number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and isfinite(x)


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def text(x):
    return isinstance(x, str) and bool(x.strip())


def metadata(payload, *, provider, product, retrieved_at, location_revision,
             first_available_at=None, model_selection='provider_best_match_unpinned'):
    require(isinstance(payload, dict), 'payload_not_object')
    require(number(retrieved_at), 'invalid_retrieval_time')
    require(text(location_revision) or isinstance(location_revision, int)
            and not isinstance(location_revision, bool) and location_revision >= 0,
            'invalid_location_revision')
    available = retrieved_at if first_available_at is None else first_available_at
    require(number(available) and available <= retrieved_at, 'invalid_first_availability')
    require(text(model_selection), 'model_selection_required')
    grid_lat = payload.get('latitude', payload.get('lat'))
    grid_lon = payload.get('longitude', payload.get('lon'))
    elevation = payload.get('elevation')
    return dict(schema_version='8.4', provider=provider, product=product,
                model_selection=model_selection, location_revision=location_revision,
                model_selection_basis='request_configuration_not_resolved_model_identity',
                grid_latitude=grid_lat if number(grid_lat) and -90 <= grid_lat <= 90 else None,
                grid_longitude=grid_lon if number(grid_lon) and -180 <= grid_lon <= 180 else None,
                grid_elevation_m=elevation if number(elevation) else None,
                source_revision=sha256(json.dumps(payload, sort_keys=True, allow_nan=True,
                                                 separators=(',', ':')).encode()).hexdigest(),
                retrieved_at_utc=retrieved_at, available_at_utc=available, issued_at_utc=None)


def sample(meta, variable, value, start, end, support, kind, reasons=(), height=None):
    unit, lo, hi = VARIABLES[variable]
    reasons = list(reasons)
    if value is not None and (not number(value) or value < lo or hi is not None and value > hi):
        value = None
        reasons.append('invalid_value')
    quality = 'invalid' if any(r.startswith(('invalid', 'unexpected', 'misaligned')) for r in reasons) else 'missing' if value is None else 'ok'
    return dict(meta, variable=variable, value=value, unit=unit,
                valid_start_utc=start, valid_end_utc=end, time_support=support,
                kind=kind, quality=quality, reason_codes=reasons,
                measurement_height_m=height)


def validate_sample(row):
    """Executable semantic checks; the companion JSON Schema checks shape."""
    require(isinstance(row, dict), 'sample_not_object')
    require(row.get('schema_version') == '8.4', 'schema_version')
    require(row.get('variable') in VARIABLES, 'variable')
    require(row.get('unit') == VARIABLES[row['variable']][0], 'unit')
    require(row.get('kind') in KINDS and row.get('time_support') in SUPPORTS, 'kind_or_support')
    for key in ('valid_start_utc', 'valid_end_utc', 'retrieved_at_utc', 'available_at_utc'):
        require(number(row.get(key)), key)
    a, b = row['valid_start_utc'], row['valid_end_utc']
    require(a <= b, 'reversed_interval')
    require((a == b) == (row['time_support'] in ('point', 'rate')), 'support_bounds')
    require(row['available_at_utc'] <= row['retrieved_at_utc'], 'availability_after_retrieval')
    require(row.get('issued_at_utc') is None or number(row['issued_at_utc'])
            and row['issued_at_utc'] <= row['available_at_utc'], 'issue_after_availability')
    require(row['kind'] == 'forecast' or b <= row['retrieved_at_utc'], 'future_nonforecast')
    require(all(text(row.get(k)) for k in ('provider', 'product', 'model_selection', 'source_revision')), 'source_identity')
    revision = row.get('location_revision')
    require(text(revision) or isinstance(revision, int) and not isinstance(revision, bool) and revision >= 0, 'location_revision')
    require(row.get('quality') in ('ok', 'missing', 'invalid'), 'quality')
    require(isinstance(row.get('reason_codes'), list) and all(text(x) for x in row['reason_codes']), 'reason_codes')
    value = row.get('value')
    require((row['quality'] == 'ok') == (value is not None), 'quality_value')
    if value is not None:
        _, lo, hi = VARIABLES[row['variable']]
        require(number(value) and value >= lo and (hi is None or value <= hi), 'value')
    return True


def normalize_meteo(payload, *, product, retrieved_at, location_revision,
                    first_available_at=None, model_selection='provider_best_match_unpinned'):
    require(product in ('forecast', 'archive'), 'unsupported_product')
    meta = metadata(payload, provider='Open-Meteo', product=product,
                    retrieved_at=retrieved_at, location_revision=location_revision,
                    first_available_at=first_available_at, model_selection=model_selection)
    require(payload.get('utc_offset_seconds') == 0, 'request_UTC_for_this_adapter')
    h, units = payload.get('hourly'), payload.get('hourly_units')
    require(isinstance(h, dict) and isinstance(units, dict), 'missing_hourly_envelope')
    times = h.get('time')
    require(isinstance(times, list) and units.get('time') == 'unixtime', 'unix_time_axis_required')
    require(all(number(t) for t in times) and all(b-a == 3600 for a, b in zip(times, times[1:])), 'nonhourly_or_duplicate_times')
    issues, samples = [], []

    def read(field, i, unit, lo, hi=None):
        values = h.get(field)
        if field not in h:
            return None, ['missing_field']
        if not isinstance(values, list) or len(values) != len(times):
            return None, ['misaligned_array']
        if units.get(field) != unit:
            return None, ['unexpected_units']
        value = values[i]
        if value is None:
            return None, ['missing_value']
        if not number(value) or value < lo or hi is not None and value > hi:
            return None, ['invalid_value']
        return value, []

    fields = [('temperature_2m', 'air_temperature_c', 'point', 2),
              ('relative_humidity_2m', 'air_rh_pct', 'point', 2),
              ('dew_point_2m', 'air_dewpoint_c', 'point', 2),
              ('wind_speed_10m', 'wind_speed_ms', 'point', 10),
              ('wind_gusts_10m', 'wind_gust_ms', 'interval_maximum' if product == 'forecast' or model_selection == 'cerra' else 'point', 10),
              ('shortwave_radiation', 'shortwave_w_m2', 'interval_mean', None),
              ('et0_fao_evapotranspiration', 'et0_mm', 'interval_sum', None)]
    for i, t in enumerate(times):
        if product == 'archive' and t > retrieved_at:
            issues.append(dict(row=i, reason='future_archive_row_rejected'))
            continue
        kind = 'forecast' if product == 'forecast' else 'occurred_estimate'
        for field, variable, support, height in fields:
            unit, lo, hi = VARIABLES[variable]
            value, reasons = read(field, i, unit, lo, hi)
            samples.append(sample(meta, variable, value, t if support == 'point' else t-3600, t, support, kind, reasons, height))
        rain, reasons = read('rain', i, 'mm', 0)
        if product == 'forecast':
            showers, r2 = read('showers', i, 'mm', 0)
            reasons = ['rain:'+r for r in reasons]+['showers:'+r for r in r2]
            # Prefix-free quality marker, while preserving which input failed.
            if any('invalid' in r or 'unexpected' in r or 'misaligned' in r for r in reasons):
                reasons.append('invalid_rain_component')
            rain = rain + showers if rain is not None and showers is not None else None
        samples.append(sample(meta, 'liquid_rain_mm', rain, t-3600, t, 'interval_sum', kind, reasons))
    for row in samples:
        validate_sample(row)
    return dict(samples=samples, issues=issues, raw_source_events=[], source_event_coverage='unknown')


def local_day_bounds(timestamp, zone):
    require(number(timestamp) and text(zone), 'invalid_local_day_input')
    z = ZoneInfo(zone)
    day = datetime.fromtimestamp(timestamp, z).date()
    return (datetime.combine(day, time(), z).timestamp(),
            datetime.combine(day+timedelta(days=1), time(), z).timestamp())


def normalize_openweather(payload, *, product, retrieved_at, location_revision,
                          first_available_at=None):
    require(product in ('onecall_metric', 'timemachine_metric'), 'unsupported_product')
    meta = metadata(payload, provider='OpenWeather', product=product,
                    retrieved_at=retrieved_at, location_revision=location_revision,
                    first_available_at=first_available_at, model_selection='provider_unspecified')
    sources, samples, issues, daily = [], [], [], []
    if product == 'timemachine_metric':
        data = payload.get('data')
        require(isinstance(data, list), 'history_data_envelope_required')
        sources = [(r, 'occurred_estimate') for r in data]
    else:
        if 'current' in payload:
            sources.append((payload['current'], 'current_point'))
        hourly = payload.get('hourly', [])
        if not isinstance(hourly, list):
            issues.append(dict(reason='invalid_hourly_envelope'))
            hourly = []
        sources += [(r, 'forecast') for r in hourly]
    fields = [('temp', 'air_temperature_c'), ('humidity', 'air_rh_pct'),
              ('dew_point', 'air_dewpoint_c'), ('wind_speed', 'wind_speed_ms'),
              ('wind_gust', 'wind_gust_ms')]
    for i, raw in enumerate(sources):
        row, kind = raw
        if not isinstance(row, dict) or not number(row.get('dt')):
            issues.append(dict(row=i, reason='invalid_point_row'))
            continue
        t = row['dt']
        if kind != 'forecast' and t > retrieved_at:
            issues.append(dict(row=i, reason='future_nonforecast_row_rejected'))
            continue
        for field, variable in fields:
            samples.append(sample(meta, variable, row.get(field), t, t, 'point', kind,
                                  ['missing_value'] if row.get(field) is None else []))
        rain, reasons = None, []
        complete = all(number(row.get(k)) for k in ('dt', 'temp', 'humidity', 'wind_speed')) and 0 <= row['humidity'] <= 100 and -60 <= row['temp'] <= 60 and row['wind_speed'] >= 0
        if 'rain' not in row:
            rain, reasons = (0, ['documented_no_phenomenon_omission']) if complete else (None, ['incomplete_sample_no_zero_inference'])
        elif not isinstance(row['rain'], dict):
            reasons = ['invalid_rain_structure']
        else:
            rain = row['rain'].get('1h')
            reasons = ['missing_rain_rate'] if rain is None else []
        samples.append(sample(meta, 'rain_rate_mm_h', rain, t, t, 'rate', kind, reasons))
    daily_rows = payload.get('daily', []) if product == 'onecall_metric' else []
    if not isinstance(daily_rows, list):
        issues.append(dict(reason='invalid_daily_envelope'))
        daily_rows = []
    for i, row in enumerate(daily_rows):
        if not isinstance(row, dict) or not number(row.get('dt')):
            issues.append(dict(daily_row=i, reason='invalid_daily_row'))
            continue
        try:
            a, b = local_day_bounds(row['dt'], payload.get('timezone'))
        except (ValueError, KeyError):
            issues.append(dict(daily_row=i, reason='invalid_daily_timezone'))
            continue
        # Daily forecasts are retained separately and cannot fill hourly gaps.
        daily.append(sample(meta, 'liquid_rain_mm', row.get('rain'), a, b,
                            'interval_sum', 'forecast', ['missing_value'] if row.get('rain') is None else []))
    for row in samples+daily:
        validate_sample(row)
    events = payload.get('alerts', [])
    if not isinstance(events, list):
        issues.append(dict(reason='invalid_source_event_envelope'))
        events = []
    return dict(samples=samples, daily_forecasts=daily, issues=issues,
                raw_source_events=deepcopy(events), source_event_coverage='unknown',
                solar_utc=[dict(dt=r.get('dt'), sunrise=r.get('sunrise'), sunset=r.get('sunset'))
                           for r, _ in sources if isinstance(r, dict)])


def resolve_air_samples(temperature, humidity, dewpoint):
    """Preserve invalid/missing distinction before invoking the tested fallback."""
    import importlib.util
    from pathlib import Path
    expected = ('air_temperature_c', 'air_rh_pct', 'air_dewpoint_c')
    for row, variable in zip((temperature, humidity, dewpoint), expected):
        validate_sample(row)
        require(row['variable'] == variable, 'wrong_air_variable')
    if humidity['quality'] == 'invalid':
        return dict(rh=None, air_vpd_kpa=None, method='unavailable',
                    reasons=['invalid_provider_rh'], leaf_wet_hours=None)
    keys = ('provider', 'product', 'source_revision', 'location_revision',
            'valid_start_utc', 'valid_end_utc', 'time_support')
    needed = (temperature, humidity) if humidity['value'] is not None else (temperature, dewpoint)
    paired = all(r['time_support'] == 'point' for r in needed) and all(
        tuple(r[k] for k in keys) == tuple(needed[0][k] for k in keys) for r in needed)
    path = Path(__file__).resolve().parent/'HopsGrow_API_Air_Fallback_v8.1.py'
    spec = importlib.util.spec_from_file_location('audited_air_fallback', path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    return helper.resolve_air(temperature['value'], humidity['value'], dewpoint['value'],
                              same_air_sample=paired, time_support='point')


def flower_context(*, stage, canopy_rain, rain_positive, rain_complete,
                   humid_positive, humid_complete):
    """Factual W11 OR/AND logic, not disease prediction or wetness duration.

    Positives/completeness describe the declared window policy. None means
    unknown, never a dry/no-disease claim. Partial reception stays unresolved.
    """
    require(all(x is None or isinstance(x, bool) for x in
                (rain_positive, rain_complete, humid_positive, humid_complete)), 'invalid_context_evidence')
    if stage == 'unknown' or stage is None:
        return 'unknown'
    if stage != 'flowering':
        return 'not_applicable'
    if humid_positive is True or rain_positive is True and canopy_rain == 'yes':
        return 'context_only'
    rain_ruled_out = canopy_rain == 'no' or rain_complete is True and rain_positive is False
    humid_ruled_out = humid_complete is True and humid_positive is False
    return 'not_triggered' if rain_ruled_out and humid_ruled_out else 'unknown'


def display_plan(*, flag_id, state, plant_id, production_care_approved=False,
                 trusted_source=False, source_severe=False, source_adapter_approved=False,
                 push_consent=False, push_policy=False):
    require(flag_id in {f'W{i:02}' for i in range(1, 15)}, 'unknown_flag')
    require(state in ('triggered', 'not_triggered', 'unknown', 'not_applicable', 'disabled', 'context_only', 'review_requested'), 'unknown_state')
    require(text(plant_id), 'plant_identity')
    gates = (production_care_approved, trusted_source, source_severe,
             source_adapter_approved, push_consent, push_policy)
    require(all(isinstance(x, bool) for x in gates), 'nonboolean_delivery_gate')
    card = None
    if flag_id == 'W06':
        if state == 'unknown':
            card = 'care_estimate_unavailable'
        elif state == 'triggered' and production_care_approved:
            card = 'estimated_watering_due'
    elif flag_id in ('W07', 'W13', 'W14'):
        if state == 'review_requested':
            card = 'requested_problem_review'
    elif flag_id in ('W08', 'W09', 'W11', 'W12'):
        if state == 'context_only':
            card = 'weather_preparation_context'
    elif flag_id in ('W01', 'W02', 'W03', 'W04', 'W05') and state == 'triggered':
        if flag_id != 'W05' or trusted_source and source_adapter_approved:
            card = 'weather_preparation'
    # W10 cannot emit a predictive or context card through this route.
    push = bool(card and state == 'triggered' and push_consent and push_policy and
                (flag_id == 'W06' and production_care_approved or
                 flag_id in ('W01', 'W02', 'W03', 'W04', 'W05') and
                 trusted_source and source_severe and source_adapter_approved))
    return dict(card=card, push_eligible=push, notifications_sent=0,
                asks_for_daily_measurement=False)
