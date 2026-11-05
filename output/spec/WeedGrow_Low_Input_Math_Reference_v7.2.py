"""WeedGrow v7.2: offline mathematical reference, not a released care model.

All storage, loss, refill and action parameters come from explicitly supplied
scenarios. No published hemp parameter is silently made a production default.
Unanimity over scenarios is a robustness check, NOT a probability or validated
confidence interval. An upstream validation/coverage certificate is required.
"""
from dataclasses import dataclass
from math import exp, isfinite
from typing import Iterable, Literal


def finite(value: float, name: str) -> float:
    if not isfinite(value):
        raise ValueError(name + ' must be finite')
    return value


def nonnegative(value: float, name: str) -> float:
    finite(value, name)
    if value < 0:
        raise ValueError(name + ' must be nonnegative')
    return value


def air_vpd_kpa(air_c: float, rh_pct: float) -> float:
    """Paired ambient air values only; FAO saturation-vapour-pressure relation."""
    finite(air_c, 'air_c'); finite(rh_pct, 'rh_pct')
    if not -60 <= air_c <= 60 or not 0 <= rh_pct <= 100:
        raise ValueError('outside this reference implementation domain')
    return 0.6108 * exp(17.27 * air_c / (air_c + 237.3)) * (1 - rh_pct / 100)


def available_capacity_l(filled_root_accessible_l: float, theta_fc: float,
                         theta_wp: float) -> float:
    """Dimensional derivation, not a way to infer rooting or substrate properties."""
    nonnegative(filled_root_accessible_l, 'filled_root_accessible_l')
    if not (isfinite(theta_fc) and isfinite(theta_wp) and 0 <= theta_wp < theta_fc <= 1):
        raise ValueError('invalid volumetric water contents')
    return filled_root_accessible_l * (theta_fc - theta_wp)


def rain_capture_l(rain_mm: float, effective_catchment_m2: float,
                   delivery_fraction: float) -> float:
    """Gross delivery before the storage cap; 1 mm * 1 m2 = 1 litre.

    Catchment may differ from pot opening because of canopy redistribution.
    Unknown reception is represented by multiple scenarios, not a default 0.5.
    """
    nonnegative(rain_mm, 'rain_mm'); nonnegative(effective_catchment_m2, 'catchment')
    if not isfinite(delivery_fraction) or not 0 <= delivery_fraction <= 1:
        raise ValueError('invalid fraction')
    return rain_mm * effective_catchment_m2 * delivery_fraction


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    capacity_l: float
    reserve_l: float
    action_reserve_l: float

    def __post_init__(self):
        if not self.scenario_id:
            raise ValueError('scenario id missing')
        if not isfinite(self.capacity_l) or self.capacity_l <= 0:
            raise ValueError('capacity must be positive')
        for name, value in [('reserve', self.reserve_l), ('action', self.action_reserve_l)]:
            if not isfinite(value) or not 0 <= value <= self.capacity_l:
                raise ValueError(name + ' outside storage domain')


@dataclass(frozen=True)
class Step:
    state: Scenario
    excess_l: float
    extracted_l: float
    unmet_demand_l: float
    balance_error_l: float


def advance(s: Scenario, delivered_l: float, potential_loss_l: float) -> Step:
    """One ordered timestep in a simplified available-water bank.

    Replay events at their occurrence times. Delivered water has already passed
    interception/runoff treatment, but has NOT already been capped to storage.
    Overflow is an accounting term, not a prediction of saturation or root rot.
    Subdivide if intra-step order is unknown. This is not a surface-drying model.
    """
    nonnegative(delivered_l, 'delivered_l'); nonnegative(potential_loss_l, 'potential_loss_l')
    total = s.reserve_l + delivered_l
    excess = max(0.0, total - s.capacity_l)
    stored = min(s.capacity_l, total)
    extracted = min(stored, potential_loss_l)
    final = stored - extracted
    unmet = potential_loss_l - extracted
    nxt = Scenario(s.scenario_id, s.capacity_l, final, s.action_reserve_l)
    error = s.reserve_l + delivered_l - excess - extracted - final
    return Step(nxt, excess, extracted, unmet, error)


def decide(states: Iterable[Scenario], *, certified_domain: bool,
           history_supported: bool) -> dict:
    states = list(states)
    if not states or not certified_domain or not history_supported:
        return {'decision': 'uncertain', 'reason': 'unsupported_domain_or_history'}
    if len({s.scenario_id for s in states}) != len(states):
        raise ValueError('duplicate scenario identifiers')
    due = [s.reserve_l <= s.action_reserve_l for s in states]
    decision = 'water' if all(due) else 'not_due' if not any(due) else 'uncertain'
    return {'decision': decision, 'reason': 'scenario_agreement' if decision != 'uncertain'
            else 'scenario_disagreement', 'scenario_count': len(states),
            'probability': None, 'measured_moisture': None}


@dataclass(frozen=True)
class Hour:
    # Intervals are already normalized to non-overlapping UTC bins by adapter.
    start_utc: int
    hours: float
    air_c: float
    rh_pct: float
    nature: Literal['occurred_estimate', 'forecast']


def joint_air_hours(hours: Iterable[Hour], *, nature: str, t_low: float,
                    t_high: float, rh_low: float, rh_high: float,
                    expected_hours: float, window_start_utc: int = 0) -> dict:
    """Feature extraction for an explicitly requested window, NOT disease risk.

    Temperature/humidity bands are supplied analysis choices. Their boundaries
    are not assumed to be cannabis infection limits. Missing hours stay unknown.
    """
    if nature not in ('occurred_estimate', 'forecast') or not t_low < t_high:
        raise ValueError('invalid feature specification')
    if not 0 <= rh_low <= rh_high <= 100:
        raise ValueError('invalid humidity band')
    nonnegative(expected_hours, 'expected_hours')
    finite(window_start_utc, 'window_start_utc')
    window_end_utc = window_start_utc + expected_hours * 3600
    selected = [h for h in hours if h.nature == nature]
    selected.sort(key=lambda h: h.start_utc)
    end = None; covered = joint = 0.0
    for h in selected:
        if h.hours <= 0 or not isfinite(h.hours):
            raise ValueError('invalid duration')
        air_vpd_kpa(h.air_c, h.rh_pct)
        finite(h.start_utc, 'start_utc')
        if h.start_utc < window_start_utc or h.start_utc + h.hours * 3600 > window_end_utc:
            raise ValueError('interval outside requested window; slice in adapter first')
        if end is not None and h.start_utc < end:
            raise ValueError('overlap or duplicate interval')
        end = h.start_utc + h.hours * 3600
        covered += h.hours
        if t_low <= h.air_c < t_high and rh_low <= h.rh_pct <= rh_high:
            joint += h.hours
    if covered > expected_hours + 1e-9:
        raise ValueError('coverage exceeds window')
    missing = max(0.0, expected_hours - covered)
    return {'joint_hours': joint, 'covered_hours': covered, 'missing_hours': missing,
            'possible_joint_hours': [joint, joint + missing], 'nature': nature,
            'disease_probability': None, 'leaf_wet_hours': None}


def run_checks():
    checks = []
    def check(name, condition):
        assert condition, name
        checks.append(name)
    def rejects(name, fn):
        try: fn()
        except ValueError: checks.append(name); return
        raise AssertionError(name)
    check('vpd30_rh40', abs(air_vpd_kpa(30,40)-2.5458) < .003)
    check('vpd30_rh80', abs(air_vpd_kpa(30,80)-.8486) < .003)
    check('vpd_saturated', air_vpd_kpa(20,100) == 0)
    rejects('bad_rh', lambda: air_vpd_kpa(20,101))
    rejects('nan_vpd', lambda: air_vpd_kpa(float('nan'),50))
    check('native_cl_capacity', abs(available_capacity_l(10,.32,.12)-2) < 1e-10)
    check('native_scl_capacity', abs(available_capacity_l(10,.26,.10)-1.6) < 1e-10)
    check('native_cl_raw_derived', abs(available_capacity_l(10,.32,.12)*.6-1.2) < 1e-10)
    check('native_scl_raw_derived', abs(available_capacity_l(10,.26,.10)*.6-.96) < 1e-10)
    check('native_cl_remaining_action', abs(available_capacity_l(10,.32,.12)*(1-.6)-.8) < 1e-10)
    check('native_scl_remaining_action', abs(available_capacity_l(10,.26,.10)*(1-.6)-.64) < 1e-10)
    rejects('bad_storage_parameters', lambda: available_capacity_l(10,.1,.2))
    check('rain_units', abs(rain_capture_l(10,.07,1)-.7)<1e-10)
    check('sheltered_soil_zero', rain_capture_l(25,.07,0)==0)
    rejects('negative_rain', lambda: rain_capture_l(-1,.07,1))
    rejects('invalid_delivery', lambda: rain_capture_l(1,.07,2))
    base = Scenario('a',2,1,.8)
    st=advance(base,.4,.2)
    check('water_bank_step',abs(st.state.reserve_l-1.2)<1e-10)
    st=advance(base,3,.5)
    check('overflow',abs(st.excess_l-2)<1e-10 and abs(st.state.reserve_l-1.5)<1e-10)
    st=advance(base,0,3)
    check('no_negative_bank',st.state.reserve_l==0 and st.unmet_demand_l==2)
    for i,(r,add,loss) in enumerate([(r,a,l) for r in (0,.7,2) for a in (0,.4,3) for l in (0,.6,4)]):
        out=advance(Scenario('x',2,r,.8),add,loss)
        check('balance_and_bounds_'+str(i),abs(out.balance_error_l)<1e-10 and 0<=out.state.reserve_l<=2)
    rejects('negative_refill', lambda: advance(base,-1,0))
    rejects('negative_loss', lambda: advance(base,0,-1))
    rejects('invalid_action', lambda: Scenario('a',2,1,3))
    rejects('nonfinite_reserve', lambda: Scenario('a',2,float('nan'),.8))
    kw=dict(certified_domain=True,history_supported=True)
    check('water_unanimous',decide([Scenario('a',2,.7,.8),Scenario('b',2,.8,.8)],**kw)['decision']=='water')
    check('not_due_unanimous',decide([base,Scenario('b',2,1.1,.9)],**kw)['decision']=='not_due')
    check('uncertain_mixed',decide([base,Scenario('b',2,.5,.8)],**kw)['decision']=='uncertain')
    check('no_probability',decide([base],**kw)['probability'] is None)
    check('unvalidated_not_released',decide([base],certified_domain=False,history_supported=True)['decision']=='uncertain')
    check('missing_history_not_safe',decide([base],certified_domain=True,history_supported=False)['decision']=='uncertain')
    check('empty_not_safe',decide([],**kw)['decision']=='uncertain')
    rejects('duplicate_scenario',lambda:decide([base,base],**kw))
    hours=[Hour(0,1,30,40,'occurred_estimate'),Hour(3600,1,15,95,'occurred_estimate'),Hour(7200,1,22,95,'forecast')]
    fkw=dict(nature='occurred_estimate',t_low=20,t_high=35,rh_low=90,rh_high=100,expected_hours=3)
    f=joint_air_hours(hours,**fkw)
    check('nonconcurrent_no_false_joint',f['joint_hours']==0)
    check('forecast_not_history',f['covered_hours']==2)
    check('gap_not_zero',f['possible_joint_hours']==[0,1])
    check('feature_not_diagnosis',f['disease_probability'] is None and f['leaf_wet_hours'] is None)
    f=joint_air_hours(hours,nature='forecast',t_low=20,t_high=35,rh_low=90,rh_high=100,expected_hours=1,window_start_utc=7200)
    check('future_separate',f['joint_hours']==1)
    rejects('hour_overlap',lambda:joint_air_hours([hours[0],hours[0]],**fkw))
    rejects('window_overcoverage',lambda:joint_air_hours(hours,**dict(fkw,expected_hours=1)))
    rejects('outside_window',lambda:joint_air_hours([Hour(10800,1,22,95,'occurred_estimate')],**fkw))
    rejects('bad_hour_duration',lambda:joint_air_hours([Hour(0,0,22,95,'occurred_estimate')],**fkw))
    return checks


if __name__ == '__main__':
    import json
    print(json.dumps({'mathematical_checks':len(run_checks()),'biological_accuracy_validated':False}))
