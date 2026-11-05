import math, json
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
checks = []
def check(key, value, expected, tolerance=1e-9):
    passed = abs(value-expected) <= tolerance
    checks.append(dict(id=key, actual=value, expected=expected, tolerance=tolerance, passed=passed))
    assert passed, checks[-1]

def es(t): return 0.6108 * math.exp(17.27*t/(t+237.3))
def vpd(t,rh): return es(t)*(1-rh/100)
def radiation(lat,j):
    phi=math.radians(lat)
    dr=1+0.033*math.cos(2*math.pi*j/365)
    dec=0.409*math.sin(2*math.pi*j/365-1.39)
    x=-math.tan(phi)*math.tan(dec)
    ws=0 if x>=1 else math.pi if x<=-1 else math.acos(x)
    ra=24*60/math.pi*0.0820*dr*(ws*math.sin(phi)*math.sin(dec)+math.cos(phi)*math.cos(dec)*math.sin(ws))
    return max(0,ra),24/math.pi*ws
def hargreaves(lo,hi,ra): return 0.0023*((lo+hi)/2+17.8)*math.sqrt(hi-lo)*(0.408*ra)
def pressure(z): return 101.3*((293-0.0065*z)/293)**5.26
def pm(t,rn,g,delta,gamma,u2,deficit):
    return (0.408*delta*(rn-g)+gamma*900/(t+273)*u2*deficit)/(delta+gamma*(1+0.34*u2))

check('NUM-01', vpd(30,40),2.545839,0.00001)
check('NUM-02', vpd(22,75),0.66098,0.0001)
check('NUM-03', vpd(30,100),0)
check('NUM-04', vpd(22,0),es(22))
ra,daylight=radiation(-34,15)
check('NUM-05',ra,43.34,0.01)
check('NUM-06',hargreaves(18,30,ra),5.89,0.01)
check('NUM-07',2*3.6,7.2)
check('NUM-08',5*3.6,18)
check('NUM-09',500*3600/1000000,1.8)
check('NUM-10',1013/10,101.3)
check('NUM-11',pressure(1700),82.75,0.2)
check('NUM-12',5*4.87/math.log(67.8*10-5.42),3.7398,0.001)
check('NUM-13',1000*(0.30-0.15)*0.4,60)
check('NUM-14',1000*(0.30-0.225)*0.4,30)
check('NUM-15',1000*10*(math.pi*0.1**2),314.159265,0.000001)
check('NUM-16',6200-5850,350)
check('NUM-17',6200-6000+500-100+20,620)
check('NUM-18',30-8-10+5+0,17)
check('NUM-19',3+5+0,8)
check('NUM-20',radiation(69,172)[1],24)
check('NUM-21',radiation(69,355)[1],0)
check('NUM-22',pm(30.2,14.33,0.14,0.246,0.0674,2,1.57),5.72,0.02)
check('NUM-23',2.55*4,10.2)
check('NUM-24',(datetime.fromisoformat('2026-10-29T07:00:00+02:00')-datetime.fromisoformat('2026-10-28T00:00:00+02:00')).total_seconds()/3600,31)
HERE.joinpath('numerical_validation.json').write_text(json.dumps({'description':'Independent specification math checks; not crop-model accuracy or app acceptance tests','checks':checks},indent=2),encoding='utf-8')
print(json.dumps({'passed':sum(x['passed'] for x in checks),'total':len(checks),'Ra_MJ':ra,'Hargreaves_mm_day':hargreaves(18,30,ra),'daylight_h':daylight,'P_1700_kPa':pressure(1700),'PM_FAO_example17':pm(30.2,14.33,0.14,0.246,0.0674,2,1.57)},indent=2))
