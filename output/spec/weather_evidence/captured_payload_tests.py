"""Offline contract checks on real responses captured30October2026.
No keys or network required; this verifies payload support, not care accuracy.
"""
from pathlib import Path
import json,math,unittest
P=Path(__file__).resolve().parent
def read(n):
    folder=P.parent/'weather_fixtures' if n.endswith('_payload.json') else P
    return json.loads((folder/n).read_text(encoding='utf-8'))
class PayloadTests(unittest.TestCase):
    def test_all_four_live_requests_succeeded(self):
        r=read('live_probe_report.json');self.assertEqual(len(r['probes']),4);self.assertTrue(all(x['status']==200 for x in r['probes']))
    def test_openweather_current_hourly_daily_shape(self):
        d=read('openweather_current_payload.json');self.assertEqual(len(d['hourly']),48);self.assertEqual(len(d['daily']),8)
        self.assertTrue(all(k in d['current'] for k in ('dt','temp','humidity','dew_point','wind_speed')))
    def test_history_has_separate_data_envelope(self):
        d=read('openweather_history_payload.json');self.assertEqual(len(d['data']),1)
        self.assertEqual(d['data'][0]['dt'],1792497600)
    def test_openweather_payload_has_no_et0_or_shortwave(self):
        d=read('openweather_current_payload.json')
        for r in [d['current']]+d['hourly']:self.assertNotIn('et0_fao_evapotranspiration',r);self.assertNotIn('shortwave_radiation',r)
    def check_meteo(self,name,n):
        d=read(name);h=d['hourly'];u=d['hourly_units'];self.assertEqual(len(h['time']),n)
        self.assertTrue(all(b-a==3600 for a,b in zip(h['time'],h['time'][1:])))
        for k,v in h.items():
            self.assertEqual(len(v),n,k);self.assertTrue(all(isinstance(x,(int,float)) and math.isfinite(x) for x in v),k)
        for k,unit in [('rain','mm'),('et0_fao_evapotranspiration','mm'),('wind_speed_10m','m/s'),('shortwave_radiation','W/m²')]:self.assertEqual(u[k],unit)
        self.assertTrue(all(x>=0 for x in h['et0_fao_evapotranspiration']))
    def test_meteo_forecast_variables_and_units(self):self.check_meteo('openmeteo_forecast_payload.json',96)
    def test_meteo_archive_variables_and_units(self):self.check_meteo('openmeteo_archive_payload.json',72)
    def test_forecast_showers_are_material_in_this_fixture(self):
        h=read('openmeteo_forecast_payload.json')['hourly']
        self.assertEqual(sum(h['rain']),0);self.assertAlmostEqual(sum(h['showers']),.6)
        self.assertAlmostEqual(sum(h['rain'])+sum(h['showers']),sum(h['precipitation']))
    def test_parser_findings_are_recorded_as_failures_not_compatibility_success(self):
        a=read('actual_parser_audit.json');self.assertEqual(a['realPayloadChecks']['historicalParsedDates'],[])
        self.assertEqual(a['realPayloadChecks']['sunriseShiftSeconds'],7200)
        self.assertFalse(a['controlledSchemaChecks']['alertsSurviveDecoder'])

if __name__=='__main__':
    r=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(PayloadTests))
    (P/'captured_payload_verification.json').write_text(json.dumps(dict(checksRun=r.testsRun,allPassed=r.wasSuccessful(),parserReadyForAlgorithm=False,scope='Frozen real payload contracts and explicit parser-defect reproductions; not live availability guarantees'),indent=2))
    raise SystemExit(0 if r.wasSuccessful() else 1)
