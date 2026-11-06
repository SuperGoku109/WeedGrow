import importlib.util,json
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('air_fallback',HERE/'WeedGrow_API_Air_Fallback_v8.1.py');E=importlib.util.module_from_spec(s);s.loader.exec_module(E)

class AirTests(unittest.TestCase):
    def test_fao_table_values(self):
        # FAO56 chapter3 example3 es(24.5)=3.075kPa, es(15)=1.705.
        x=E.resolve_air(24.5,dew_point_c=15,same_air_sample=True)
        self.assertAlmostEqual(x['rh'],100*1.705/3.075,delta=.05)
        self.assertAlmostEqual(x['air_vpd_kpa'],3.075-1.705,delta=.002)
    def test_saturation(self):
        x=E.resolve_air(20,dew_point_c=20,same_air_sample=True);self.assertEqual(x['rh'],100);self.assertEqual(x['air_vpd_kpa'],0)
    def test_provider_rh_has_priority(self):
        x=E.resolve_air(20,rh=40,dew_point_c=20,same_air_sample=True);self.assertEqual(x['rh'],40);self.assertEqual(x['method'],'provider_rh')
    def test_zero_rh_is_valid_not_missing(self):self.assertEqual(E.resolve_air(20,rh=0)['rh'],0)
    def test_no_silent_clamp_when_dew_exceeds_air(self):self.assertIsNone(E.resolve_air(20,dew_point_c=21,same_air_sample=True)['rh'])
    def test_unpaired_values_not_joined(self):self.assertIsNone(E.resolve_air(20,dew_point_c=10)['rh'])
    def test_daily_aggregate_not_used(self):self.assertIsNone(E.resolve_air(20,dew_point_c=10,same_air_sample=True,time_support='daily_mean')['rh'])
    def test_interval_max_not_used(self):self.assertIsNone(E.resolve_air(20,dew_point_c=10,same_air_sample=True,time_support='interval_maximum')['rh'])
    def test_no_guess_from_minimum_temperature(self):self.assertIsNone(E.resolve_air(20,same_air_sample=True)['rh'])
    def test_invalid_rh_is_not_silently_replaced(self):self.assertIsNone(E.resolve_air(20,rh=120,dew_point_c=10,same_air_sample=True)['rh'])
    def test_invalid_boolean_not_temperature(self):self.assertIsNone(E.resolve_air(True,dew_point_c=0,same_air_sample=True)['rh'])
    def test_nan_rejected(self):self.assertIsNone(E.resolve_air(float('nan'),dew_point_c=10,same_air_sample=True)['rh'])
    def test_freezing_fallback_is_explicitly_unsupported(self):self.assertIsNone(E.resolve_air(0,dew_point_c=-2,same_air_sample=True)['rh'])
    def test_no_wetness_claim(self):self.assertIsNone(E.resolve_air(20,dew_point_c=20,same_air_sample=True)['leaf_wet_hours'])
    def test_direct_rh_without_paired_temperature_has_no_vpd(self):self.assertIsNone(E.resolve_air(20,rh=40)['air_vpd_kpa'])

if __name__=='__main__':
    r=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(AirTests))
    (HERE/'WeedGrow_Practical_Refinement_Verification_v8.1.json').write_text(json.dumps(dict(testsRun=r.testsRun,allPassed=r.wasSuccessful(),failures=len(r.failures),errors=len(r.errors),appIntegrationChanged=False),indent=2))
    raise SystemExit(0 if r.wasSuccessful() else 1)
