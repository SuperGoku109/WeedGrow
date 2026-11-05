from pathlib import Path
from copy import deepcopy
from datetime import datetime,timezone
import importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('functional',HERE/'WeedGrow_Functional_Reference_v8.2.py');E=importlib.util.module_from_spec(s);s.loader.exec_module(E)
PAYLOAD=HERE.parent/'weather_fixtures'
RETRIEVED=datetime(2026,10,30,12,44,36,tzinfo=timezone.utc).timestamp()
def read(name):return json.loads((PAYLOAD/name).read_text(encoding='utf-8'))
def bank(**kwargs):return E.initialize_bank(2,.8,state_time=100,root_zone_key='same-medium/root-profile',**kwargs)

class FunctionalTests(unittest.TestCase):
    def test_forecast_liquid_includes_convective_showers(self):
        x=E.normalize_meteo(read('openmeteo_forecast_payload.json'),product='forecast',retrieved_at=RETRIEVED,location_revision=1)
        self.assertAlmostEqual(sum(r['value'] for r in x if r['variable']=='liquid_rain_mm'),.6)
    def test_archive_rain_is_already_total_liquid(self):
        x=E.normalize_meteo(read('openmeteo_archive_payload.json'),product='archive',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(len([r for r in x if r['variable']=='liquid_rain_mm']),72)
    def test_point_and_previous_hour_amount_have_different_bounds(self):
        x=E.normalize_meteo(read('openmeteo_forecast_payload.json'),product='forecast',retrieved_at=RETRIEVED,location_revision=1)
        t=next(r for r in x if r['variable']=='air_temperature_c');e=next(r for r in x if r['variable']=='et0_mm')
        self.assertEqual(t['valid_start_utc'],t['valid_end_utc']);self.assertEqual(e['valid_end_utc']-e['valid_start_utc'],3600)
    def test_past_forecast_not_relabelled_observed(self):
        x=E.normalize_meteo(read('openmeteo_forecast_payload.json'),product='forecast',retrieved_at=9999999999,location_revision=1)
        self.assertTrue(all(r['kind']=='forecast' for r in x))
    def test_no_fabricated_provider_issue_time(self):
        x=E.normalize_meteo(read('openmeteo_archive_payload.json'),product='archive',retrieved_at=RETRIEVED,location_revision=1)
        self.assertTrue(all(r['issued_at_utc'] is None and r['available_at_utc']==RETRIEVED for r in x))
    def test_future_archive_row_cannot_be_historical(self):
        with self.assertRaises(ValueError):E.normalize_meteo(read('openmeteo_archive_payload.json'),product='archive',retrieved_at=0,location_revision=1)
    def test_future_timestamp_record_cannot_be_historical(self):
        with self.assertRaises(ValueError):E.normalize_openweather(read('openweather_history_payload.json'),product='timemachine_metric',retrieved_at=0,location_revision=1)
    def test_forecast_missing_showers_is_not_silently_zero(self):
        d=read('openmeteo_forecast_payload.json');del d['hourly']['showers']
        with self.assertRaises(ValueError):E.normalize_meteo(d,product='forecast',retrieved_at=RETRIEVED,location_revision=1)
    def test_wrong_wind_units_rejected(self):
        d=read('openmeteo_forecast_payload.json');d['hourly_units']['wind_speed_10m']='km/h'
        with self.assertRaises(ValueError):E.normalize_meteo(d,product='forecast',retrieved_at=RETRIEVED,location_revision=1)
    def test_array_mismatch_rejected(self):
        d=read('openmeteo_archive_payload.json');d['hourly']['rain'].pop()
        with self.assertRaises(ValueError):E.normalize_meteo(d,product='archive',retrieved_at=RETRIEVED,location_revision=1)
    def test_hourly_missing_value_stays_unknown(self):
        d=read('openmeteo_forecast_payload.json');d['hourly']['showers'][0]=None
        x=E.normalize_meteo(d,product='forecast',retrieved_at=RETRIEVED,location_revision=1)
        self.assertIsNone(next(r for r in x if r['variable']=='liquid_rain_mm')['value'])
    def test_history_data_envelope_is_ingested(self):
        x=E.normalize_openweather(read('openweather_history_payload.json'),product='timemachine_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(len(x['points']),1);self.assertEqual(x['points'][0]['kind'],'historical_weather_estimate')
    def test_solar_epochs_remain_true_utc(self):
        d=read('openweather_current_payload.json');x=E.normalize_openweather(d,product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(x['points'][0]['sunrise_utc'],d['current']['sunrise'])
    def test_today_daily_record_remains_forecast(self):
        x=E.normalize_openweather(read('openweather_current_payload.json'),product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(x['daily_forecasts'][0]['kind'],'forecast')
    def test_absent_rain_zero_only_for_valid_product_sample(self):
        d=read('openweather_current_payload.json');x=E.normalize_openweather(d,product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(x['points'][0]['values']['rain_rate_mm_h']['value'],0)
        del d['current']['humidity'];x=E.normalize_openweather(d,product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertIsNone(x['points'][0]['values']['rain_rate_mm_h']['value'])
    def test_rain_rate_not_accumulated_amount(self):
        d=read('openweather_current_payload.json');d['current']['rain']={'1h':2}
        x=E.normalize_openweather(d,product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(x['points'][0]['values']['rain_rate_mm_h']['value'],2);self.assertNotIn('rain_total_mm',x['points'][0]['values'])
    def test_raw_alert_not_automatically_a_mapped_hail_warning(self):
        d=read('openweather_current_payload.json');d['alerts']=[dict(event='synthetic hail')]
        x=E.normalize_openweather(d,product='onecall_metric',retrieved_at=RETRIEVED,location_revision=1)
        self.assertEqual(len(x['raw_source_events']),1);self.assertEqual(x['source_event_coverage'],'unknown')
    def test_dst_short_day(self):
        t=datetime(2026,3,8,12,tzinfo=timezone.utc).timestamp();a,b=E.local_day_bounds(t,'America/New_York');self.assertEqual(b-a,23*3600)
    def test_dst_long_day(self):
        t=datetime(2026,11,1,12,tzinfo=timezone.utc).timestamp();a,b=E.local_day_bounds(t,'America/New_York');self.assertEqual(b-a,25*3600)
    def test_unanchored_initial_state_is_full_range_not_full_water(self):
        x=bank();self.assertEqual(x['reserve_range_l'],[0,2]);self.assertFalse(x['release_approved'])
    def test_narrow_initial_range_needs_a_basis(self):
        with self.assertRaises(ValueError):bank(initial_range=[1,1])
    def test_unknown_watering_widens_upper_only(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic');y=E.logged_water_update(x)
        self.assertEqual(y['reserve_range_l'],[.3,2]);self.assertEqual(x['reserve_range_l'],[.3,.5])
    def test_known_water_unknown_retention_is_a_range(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic');y=E.logged_water_update(x,applied_l=.2)
        self.assertEqual(y['reserve_range_l'],[.3,.7])
    def test_known_validated_retention_arithmetic(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic');y=E.logged_water_update(x,applied_l=.2,retention_range=[.5,1])
        self.assertEqual(y['reserve_range_l'],[.4,.7])
    def test_zero_log_has_no_refill(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic');self.assertEqual(E.logged_water_update(x,applied_l=0)['reserve_range_l'],[.3,.5])
    def test_compatible_demand_change_preserves_water(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic')
        y=E.transition_bank(x,new_capacity=2,new_action=.9,new_root_zone_key=x['root_zone_key'],effective_at=100,kind='demand_only',compatible=True)
        self.assertEqual(y['state']['reserve_range_l'],[.3,.5]);self.assertEqual(y['state']['action_l'],.9)
    def test_new_pot_does_not_create_a_full_pot(self):
        x=bank(initial_range=[.3,.5],anchor_basis='synthetic')
        y=E.transition_bank(x,new_capacity=4,new_action=1,new_root_zone_key='new',effective_at=100,kind='physical')
        self.assertEqual(y['state']['reserve_range_l'],[0,4]);self.assertFalse(y['state']['release_approved'])
    def test_preserving_water_does_not_preserve_new_profile_approval(self):
        x=bank();x['release_approved']=True
        y=E.transition_bank(x,new_capacity=2,new_action=.8,new_root_zone_key=x['root_zone_key'],effective_at=100,kind='demand_only',compatible=True)
        self.assertFalse(y['state']['release_approved'])
    def test_transition_needs_replay_to_change_time(self):
        x=bank();y=E.transition_bank(x,new_capacity=2,new_action=.8,new_root_zone_key=x['root_zone_key'],effective_at=200,kind='demand_only',compatible=True)
        self.assertIsNone(y['state']);self.assertEqual(y['status'],'replay_to_transition_boundary_required')
    def test_uncertainty_is_one_nonpushing_card(self):
        a=E.display_plan(flag_id='W06',state='unknown',plant_id='p',reason_category='weather')
        b=E.display_plan(flag_id='W06',state='unknown',plant_id='p',reason_category='weather')
        self.assertEqual(a['dedupe_key'],b['dedupe_key']);self.assertFalse(a['push_eligible']);self.assertFalse(a['asks_for_daily_measurement'])
    def test_disease_context_never_pushes_as_disease(self):
        x=E.display_plan(flag_id='W11',state='context_only',plant_id='p',push_consent=True,push_policy=True)
        self.assertFalse(x['push_eligible']);self.assertEqual(x['card'],'weather_preparation_context')
    def test_unapproved_water_cannot_create_due_card_or_push(self):
        x=E.display_plan(flag_id='W06',state='triggered',plant_id='p',push_consent=True,push_policy=True)
        self.assertIsNone(x['card']);self.assertFalse(x['push_eligible'])
    def test_verified_severe_source_still_requires_delivery_permission(self):
        args=dict(flag_id='W05',state='triggered',plant_id='p',trusted_source=True,source_severe=True,source_adapter_approved=True,push_policy=True)
        self.assertFalse(E.display_plan(**args)['push_eligible']);self.assertTrue(E.display_plan(**args,push_consent=True)['push_eligible'])
    def test_unmapped_source_does_not_create_card(self):self.assertIsNone(E.display_plan(flag_id='W05',state='triggered',plant_id='p')['card'])

if __name__=='__main__':
    r=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(FunctionalTests))
    (HERE/'WeedGrow_Functional_Verification_v8.2.json').write_text(json.dumps(dict(testsRun=r.testsRun,allPassed=r.wasSuccessful(),failures=len(r.failures),errors=len(r.errors),realPlantOutcomesUsed=0,applicationChanged=False),indent=2))
    raise SystemExit(0 if r.wasSuccessful() else 1)
