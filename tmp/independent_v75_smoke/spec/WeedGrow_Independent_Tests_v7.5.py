"""Independent known-answer, exhaustive-oracle and mutation checks.

Run: python WeedGrow_Independent_Tests_v7.5.py [--engine /path/to/engine.py]
Expected answers are fixed in the catalogue, never generated from the engine.
Standard library only. Synthetic conditional truth is not agronomic truth.
"""
import argparse
from copy import deepcopy
from decimal import Decimal, localcontext
from fractions import Fraction
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
CAT=json.loads((HERE/'WeedGrow_Independent_Test_Cases_v7.5.json').read_text(encoding='utf-8'))
E=None


def payload(case):
    p=E.demo_payload();now=p['now'];p['profile']['anchor_utc']=now-3600
    s=p['profile']['scenarios'][0]
    s.update(initial_l=case['initial'],capacity_l=2,action_l=.8,plant_loss_m2=.15,surface_loss_m2=.05,rain_catchment_m2=.08,irrigation_retention=.8)
    p['plant']['soil_rain']=case['soil_rain']
    for r in p['weather']:
        if r['kind']=='occurred_estimate' and r['end']==now:
            r.update(et0_mm=case['et0'],rain_mm=case['rain'],temp_c=case.get('temperature',25),rh=case.get('humidity',60))
        if r['kind']=='forecast':r['rain_mm']=case.get('forecast_rain_per_hour',0)
    if 'watering_now' in case:
        p['logs']=[dict(event_id='independent-event',revision=1,kind='watering',earliest=now,latest=now,recorded_at=now,amount_l=case['watering_now'])]
    if 'unknown_amounts' in case:
        p['profile']['scenarios']=[dict(s,id='refill'+str(i),unknown_log_applied_l=v) for i,v in enumerate(case['unknown_amounts'])]
    return p


def check_case(test,case):
    r=E.evaluate(payload(case));water=r['water']
    test.assertEqual(water['candidate'],case['expected_candidate'],case['id'])
    actual=sorted(set(round(b['reserve_l'],8) for b in water['branches']))
    test.assertEqual(actual,case['expected_reserves'],case['id']+': '+case['derivation'])
    # Unreleased profiles must remain blocked, even when a candidate is exact.
    test.assertIsNone(r['needs_water']);test.assertEqual(water['decision'],'uncertain')
    return r


class IndependentCases(unittest.TestCase):
    def test_decimal_air_vpd_oracle(self):
        # Independently evaluates the specified physical relation using decimal
        # exp at50digit precision, without the engine's floating exp/function.
        with localcontext() as ctx:
            ctx.prec=50
            for t,rh in [('0','0'),('20','50'),('30','40'),('30','80'),('-5','65')]:
                T=Decimal(t);R=Decimal(rh)
                expected=Decimal('.6108')*(Decimal('17.27')*T/(T+Decimal('237.3'))).exp()*(1-R/100)
                self.assertAlmostEqual(E.vpd(float(T),float(R)),float(expected),places=12)
    def test_exhaustive_discrete_event_oracle(self):
        # Independent event-level machine: each W adds one quantum up to cap;
        # each D removes one quantum down to zero. Enumerate EVERY within-bin
        # ordering; no bank_step calls are used to create expected results.
        checked=0
        for capacity,start,inputs,losses in itertools.product((2,3),(0,1,2),(0,1,2,3),(0,1,2,3)):
            if start>capacity:continue
            terminals=[]
            n=inputs+losses
            for water_positions in itertools.combinations(range(n),inputs):
                positions=set(water_positions);state=Fraction(start)
                for i in range(n):
                    state=min(Fraction(capacity),state+1) if i in positions else max(Fraction(0),state-1)
                terminals.append(float(state))
            a=E.Bank(float(start));b=E.Bank(float(start))
            E.bank_step(a,capacity,inputs,losses,'inputs_first');E.bank_step(b,capacity,inputs,losses,'loss_first')
            self.assertEqual(a.reserve_l,min(terminals));self.assertEqual(b.reserve_l,max(terminals));checked+=1
        self.assertEqual(checked,96)
    def test_independent_exposure_arithmetic(self):
        rows=[dict(start=0,end=1800,temp_c=34),dict(start=1800,end=9000,temp_c=36)]
        m=E.exposure_metrics(rows,'temp_c',32,'ge')
        self.assertEqual(m['exposure_hours'],2.5);self.assertEqual(m['longest_episode_hours'],2.5)
        self.assertEqual(m['exceedance_units_hours'],9) # 2*0.5 +4*2
    def test_missing_middle_bin_is_not_continuous(self):
        rows=[dict(start=0,end=3600,temp_c=34),dict(start=3600,end=7200,temp_c=None),dict(start=7200,end=10800,temp_c=34)]
        m=E.exposure_metrics(rows,'temp_c',32,'ge');self.assertEqual(m['longest_episode_hours'],1);self.assertEqual(m['exposure_hours'],2)
    def test_event_input_permutation_does_not_change_result(self):
        p=payload(CAT['cases'][6]);p['logs'].append(dict(p['logs'][0],event_id='second',amount_l=.1))
        original=E.evaluate(p);p['weather'].reverse();p['logs'].reverse();self.assertEqual(original,E.evaluate(p))
    def test_duplicate_retry_not_an_extra_retained_refill(self):
        c=CAT['cases'][6];p=payload(c);p['logs']*=3
        r=E.evaluate(p);self.assertEqual({round(b['reserve_l'],8) for b in r['water']['branches']},{.9})
    def test_no_disease_probability_from_weather_extremes(self):
        p=payload(CAT['cases'][0])
        for r in p['weather']:r.update(temp_c=25,rh=99,rain_mm=10)
        flags=E.evaluate(p)['flags'];pm=next(x for x in flags if x['id']=='W10')
        self.assertEqual(pm['state'],'disabled');self.assertTrue(all(x['probability'] is None for x in flags))


def case_method(c):
    def test(self):check_case(self,c)
    return test
for c in CAT['cases']:setattr(IndependentCases,'test_'+c['id'],case_method(c))


def mutation_checks():
    """Inject faults in memory; require fixed-answer tests to catch them."""
    result=[];original_replay=E.replay_water;original_bank=E.bank_step
    def check(label,target,replacement,case_id):
        case=next(c for c in CAT['cases'] if c['id']==case_id)
        try:
            with patch.object(E,target,replacement):check_case(unittest.TestCase(),case)
        except AssertionError:result.append(dict(mutation=label,detected=True));return
        result.append(dict(mutation=label,detected=False))
    def no_loss(b,c,w,d,o):return original_bank(b,c,w,0,o)
    check('omit_weather_loss','bank_step',no_loss,'B01_dry')
    def no_water(b,c,w,d,o):return original_bank(b,c,0,d,o)
    check('ignore_delivered_water','bank_step',no_water,'B05_exposed_rain')
    def thousandfold(b,c,w,d,o):return original_bank(b,c,w*1000,d,o)
    check('millimetre_litre_unit_error','bank_step',thousandfold,'B05_exposed_rain')
    def shifted_threshold(plant,profile,*args):
        profile=deepcopy(profile)
        for s in profile['scenarios']:s['action_l']=s['capacity_l']-s['action_l']
        return original_replay(plant,profile,*args)
    check('compare_reserve_to_depletion','replay_water',shifted_threshold,'B02_still_available')
    def assume_full(plant,profile,*args):
        profile=deepcopy(profile)
        for s in profile['scenarios']:s['unknown_log_applied_l']=s['capacity_l']/s['irrigation_retention']
        return original_replay(plant,profile,*args)
    check('unknown_refill_assumed_full','replay_water',assume_full,'B09_unknown_refill')
    def credit_forecast(plant,profile,weather,*args):
        weather=deepcopy(weather);amount=sum(r.get('rain_mm',0) or 0 for r in weather if r['kind']=='forecast')
        past=[r for r in weather if r['kind']=='occurred_estimate'];past[-1]['rain_mm']+=amount
        return original_replay(plant,profile,weather,*args)
    check('forecast_rain_credited_now','replay_water',credit_forecast,'B13_forecast_not_current')
    with patch.object(E,'vpd',lambda t,rh:0):
        try:IndependentCases('test_decimal_air_vpd_oracle').test_decimal_air_vpd_oracle()
        except AssertionError:result.append(dict(mutation='broken_air_vpd',detected=True))
        else:result.append(dict(mutation='broken_air_vpd',detected=False))
    return result


def main():
    global E
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--engine',type=Path,default=HERE/'WeedGrow_Algorithm_Emulator_v7.4.py')
    parser.add_argument('--include-existing',action='store_true',help='Also run the95 v7.4 scenarios without overwriting their delivered report')
    args=parser.parse_args()
    engine=args.engine.resolve();spec=importlib.util.spec_from_file_location('independent_target',engine);E=importlib.util.module_from_spec(spec);sys.modules[spec.name]=E;spec.loader.exec_module(E)
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(IndependentCases)
    independent_count=suite.countTestCases();existing_count=0
    if args.include_existing:
        legacy_spec=importlib.util.spec_from_file_location('existing_scenarios',HERE/'WeedGrow_Algorithm_Scenarios_v7.4.py')
        legacy=importlib.util.module_from_spec(legacy_spec);legacy_spec.loader.exec_module(legacy);legacy.E=E
        prior_suite=unittest.defaultTestLoader.loadTestsFromTestCase(legacy.Scenarios);existing_count=prior_suite.countTestCases();suite.addTests(prior_suite)
    r=unittest.TextTestRunner(verbosity=2).run(suite);mutations=mutation_checks()
    passed=r.wasSuccessful() and all(x['detected'] for x in mutations)
    report=dict(version='7.5',engine=str(engine),engineSHA256=hashlib.sha256(engine.read_bytes()).hexdigest(),testsRun=r.testsRun,independentTests=independent_count,existingTests=existing_count,seededBankTrials=1000 if existing_count else 0,failures=[str(t) for t,_ in r.failures],errors=[str(t) for t,_ in r.errors],knownAnswerCases=len(CAT['cases']),exhaustiveParameterSets=96,mutationChecks=mutations,allPassed=passed,biologicalAccuracyValidated=False)
    (HERE/'WeedGrow_Independent_Test_Report_v7.5.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if passed else 1


if __name__=='__main__':sys.exit(main())
