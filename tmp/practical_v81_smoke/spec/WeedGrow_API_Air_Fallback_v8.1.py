"""Small offline adapter helper; not yet integrated into the app/emulator.

Derives AIR humidity only from a compatible simultaneous API sample. Never
fills soil water, leaf wetness or disease probabilities. No network/user input.
"""
from math import exp,isfinite

def valid(x,lo,hi):return isinstance(x,(int,float)) and not isinstance(x,bool) and isfinite(x) and lo<=x<=hi
def es(t):return .6108*exp(17.27*t/(t+237.3))

def resolve_air(temp_c=None,rh=None,dew_point_c=None,*,same_air_sample=False,time_support='point'):
    result=dict(rh=None,air_vpd_kpa=None,method='unavailable',reasons=[],leaf_wet_hours=None)
    compatible=same_air_sample is True and time_support in ('point','representative_bin')
    if rh is not None:
        if not valid(rh,0,100):
            result['reasons']=['invalid_provider_rh'];return result
        result.update(rh=rh,method='provider_rh')
        if compatible and valid(temp_c,-60,60):result['air_vpd_kpa']=es(temp_c)*(1-rh/100)
        return result
    if not compatible:
        result['reasons']=['unpaired_or_aggregate_air'];return result
    # Conservative nonfreezing fallback domain avoids dew/frost-point ambiguity.
    if not valid(temp_c,0,60) or not valid(dew_point_c,0,60):
        result['reasons']=['fallback_outside_nonfreezing_domain_or_missing'];return result
    if dew_point_c>temp_c:
        result['reasons']=['dew_above_air_temperature'];return result
    ea=es(dew_point_c);sat=es(temp_c)
    result.update(rh=100*ea/sat,air_vpd_kpa=sat-ea,method='derived_from_paired_api_dewpoint')
    result['reasons']=['air_estimate_only_not_leaf_wetness']
    return result
