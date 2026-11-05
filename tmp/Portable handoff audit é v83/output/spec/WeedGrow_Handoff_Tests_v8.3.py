"""Independent boundary and failure-isolation regressions for the handoff."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
s = importlib.util.spec_from_file_location('handoff83', HERE/'WeedGrow_Handoff_Reference_v8.3.py')
E = importlib.util.module_from_spec(s)
s.loader.exec_module(E)
NOW = 1793365000


def read(name):
    return json.loads((HERE/'weather_fixtures'/name).read_text(encoding='utf-8'))


def meteo(d=None, **kw):
    return E.normalize_meteo(d if d is not None else read('openmeteo_forecast_payload.json'),
                             product=kw.pop('product', 'forecast'), retrieved_at=kw.pop('retrieved_at', NOW),
                             location_revision=1, **kw)


def ow(d=None, **kw):
    return E.normalize_openweather(d if d is not None else read('openweather_current_payload.json'),
                                  product=kw.pop('product', 'onecall_metric'), retrieved_at=kw.pop('retrieved_at', NOW),
                                  location_revision=1, **kw)


def rows(x, name):
    return [r for r in x['samples'] if r['variable'] == name]


class HandoffTests(unittest.TestCase):
    def test_all_four_payloads_have_contract_valid_samples(self):
        results = [meteo(), meteo(read('openmeteo_archive_payload.json'), product='archive'),
                   ow(), ow(read('openweather_history_payload.json'), product='timemachine_metric')]
        self.assertEqual([len(r['samples']) for r in results], [96*8, 72*8, 49*6, 6])
        for result in results:
            self.assertTrue(all(E.validate_sample(r) for r in result['samples']))

    def test_bad_rh_does_not_erase_valid_wind_or_et0(self):
        d = read('openmeteo_forecast_payload.json')
        d['hourly']['relative_humidity_2m'][0] = 120
        result = meteo(d)
        self.assertIsNone(rows(result, 'air_rh_pct')[0]['value'])
        self.assertEqual(rows(result, 'air_rh_pct')[0]['quality'], 'invalid')
        self.assertEqual(rows(result, 'wind_speed_ms')[0]['value'], d['hourly']['wind_speed_10m'][0])
        self.assertEqual(rows(result, 'et0_mm')[0]['value'], d['hourly']['et0_fao_evapotranspiration'][0])

    def test_negative_rain_component_cannot_hide_in_positive_sum(self):
        d = read('openmeteo_forecast_payload.json')
        d['hourly']['rain'][0], d['hourly']['showers'][0] = -1, 2
        r = rows(meteo(d), 'liquid_rain_mm')[0]
        self.assertIsNone(r['value'])
        self.assertEqual(r['quality'], 'invalid')

    def test_boolean_component_is_not_one_mm(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['rain'][0] = True
        self.assertIsNone(rows(meteo(d), 'liquid_rain_mm')[0]['value'])

    def test_missing_showers_blocks_only_rain(self):
        d = read('openmeteo_forecast_payload.json');del d['hourly']['showers']
        r = meteo(d)
        self.assertTrue(all(x['value'] is None for x in rows(r, 'liquid_rain_mm')))
        self.assertTrue(all(x['value'] is not None for x in rows(r, 'et0_mm')))

    def test_missing_dewpoint_does_not_block_provider_rh(self):
        d = read('openmeteo_forecast_payload.json');del d['hourly']['dew_point_2m']
        r = meteo(d)
        self.assertTrue(all(x['value'] is None for x in rows(r, 'air_dewpoint_c')))
        self.assertTrue(all(x['value'] is not None for x in rows(r, 'air_rh_pct')))

    def test_wrong_wind_units_do_not_block_other_variables(self):
        d = read('openmeteo_forecast_payload.json');d['hourly_units']['wind_speed_10m'] = 'km/h'
        r = meteo(d)
        self.assertTrue(all(x['quality'] == 'invalid' for x in rows(r, 'wind_speed_ms')))
        self.assertIsNotNone(rows(r, 'et0_mm')[0]['value'])

    def test_misaligned_array_does_not_shift_values_or_destroy_rain(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['relative_humidity_2m'].pop()
        r = meteo(d)
        self.assertTrue(all(x['value'] is None for x in rows(r, 'air_rh_pct')))
        self.assertEqual(len(rows(r, 'liquid_rain_mm')), 96)

    def test_duplicate_axis_rejected_before_interpretation(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['time'][1] = d['hourly']['time'][0]
        with self.assertRaises(ValueError):meteo(d)

    def test_non_utc_axis_rejected(self):
        d = read('openmeteo_forecast_payload.json');d['utc_offset_seconds'] = 7200
        with self.assertRaises(ValueError):meteo(d)

    def test_forecast_gust_has_previous_hour_max_support(self):
        r = rows(meteo(), 'wind_gust_ms')[0]
        self.assertEqual(r['time_support'], 'interval_maximum')
        self.assertEqual(r['valid_end_utc']-r['valid_start_utc'], 3600)

    def test_archive_gust_support_depends_on_product_model(self):
        d = read('openmeteo_archive_payload.json')
        self.assertEqual(rows(meteo(d, product='archive'), 'wind_gust_ms')[0]['time_support'], 'point')
        self.assertEqual(rows(meteo(d, product='archive', model_selection='cerra'), 'wind_gust_ms')[0]['time_support'], 'interval_maximum')

    def test_wind_speed_is_point_not_sustained_mean(self):
        r = rows(meteo(), 'wind_speed_ms')[0]
        self.assertEqual(r['time_support'], 'point')
        self.assertEqual(r['valid_start_utc'], r['valid_end_utc'])

    def test_forecast_past_days_do_not_turn_into_history(self):
        self.assertEqual({r['kind'] for r in meteo()['samples']}, {'forecast'})

    def test_archive_kind_matches_main_contract_and_retains_product(self):
        r = meteo(read('openmeteo_archive_payload.json'), product='archive')
        self.assertEqual({x['kind'] for x in r['samples']}, {'occurred_estimate'})
        self.assertTrue(all(x['product'] == 'archive' for x in r['samples']))

    def test_future_archive_rows_quarantined(self):
        d = read('openmeteo_archive_payload.json');first = d['hourly']['time'][0]
        r = meteo(d, product='archive', retrieved_at=first)
        self.assertEqual(len(r['samples']), 8)
        self.assertEqual(len(r['issues']), 71)

    def test_first_availability_can_be_preserved_on_refetch(self):
        r = meteo(first_available_at=NOW-30)
        self.assertTrue(all(x['available_at_utc'] == NOW-30 and x['retrieved_at_utc'] == NOW for x in r['samples']))

    def test_invented_future_availability_rejected(self):
        with self.assertRaises(ValueError):meteo(first_available_at=NOW+1)

    def test_no_invented_issue_time(self):
        self.assertTrue(all(x['issued_at_utc'] is None for x in meteo()['samples']))

    def test_explicit_null_openweather_rain_stays_unknown(self):
        d = read('openweather_current_payload.json');d['current']['rain'] = None
        r = rows(ow(d), 'rain_rate_mm_h')[0]
        self.assertIsNone(r['value']);self.assertEqual(r['quality'], 'invalid')

    def test_absent_openweather_rain_uses_only_complete_sample_contract(self):
        d = read('openweather_current_payload.json');d['current'].pop('rain', None)
        self.assertEqual(rows(ow(d), 'rain_rate_mm_h')[0]['value'], 0)
        del d['current']['humidity']
        self.assertIsNone(rows(ow(d), 'rain_rate_mm_h')[0]['value'])

    def test_bad_openweather_rh_retains_wind(self):
        d = read('openweather_current_payload.json');d['current']['humidity'] = 200
        r = ow(d)
        self.assertIsNone(rows(r, 'air_rh_pct')[0]['value'])
        self.assertIsNotNone(rows(r, 'wind_speed_ms')[0]['value'])

    def test_current_future_point_quarantined_forecast_kept(self):
        d = read('openweather_current_payload.json');d['current']['dt'] = NOW+1
        r = ow(d)
        self.assertTrue(all(x['kind'] == 'forecast' for x in r['samples']))
        self.assertIn('future_nonforecast_row_rejected', [x['reason'] for x in r['issues']])

    def test_malformed_daily_envelope_retains_current(self):
        d = read('openweather_current_payload.json');d['daily'] = None
        r = ow(d)
        self.assertTrue(r['samples']);self.assertEqual(r['daily_forecasts'], [])

    def test_malformed_hourly_envelope_retains_current(self):
        d = read('openweather_current_payload.json');d['hourly'] = None
        r = ow(d)
        self.assertEqual(len(r['samples']), 6)
        self.assertEqual(r['samples'][0]['kind'], 'current_point')

    def test_invalid_normalized_rh_cannot_trigger_dewpoint_fallback(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['relative_humidity_2m'][0] = 120
        r = meteo(d)
        out = E.resolve_air_samples(*(rows(r, k)[0] for k in ('air_temperature_c', 'air_rh_pct', 'air_dewpoint_c')))
        self.assertIsNone(out['rh']);self.assertIn('invalid_provider_rh', out['reasons'])

    def test_missing_normalized_rh_can_use_paired_dewpoint(self):
        d = read('openmeteo_forecast_payload.json')
        d['hourly']['relative_humidity_2m'][0] = None
        d['hourly']['temperature_2m'][0], d['hourly']['dew_point_2m'][0] = 20, 20
        r = meteo(d)
        out = E.resolve_air_samples(*(rows(r, k)[0] for k in ('air_temperature_c', 'air_rh_pct', 'air_dewpoint_c')))
        self.assertEqual(out['rh'], 100);self.assertIsNone(out['leaf_wet_hours'])

    def test_dewpoint_different_source_cannot_fill_humidity(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['relative_humidity_2m'][0] = None
        r = meteo(d)
        t, h, dew = [rows(r, k)[0] for k in ('air_temperature_c', 'air_rh_pct', 'air_dewpoint_c')]
        dew['source_revision'] = 'other-source-revision'
        self.assertIsNone(E.resolve_air_samples(t, h, dew)['rh'])

    def test_provider_rh_does_not_require_dewpoint(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['dew_point_2m'][0] = None
        r = meteo(d)
        out = E.resolve_air_samples(*(rows(r, k)[0] for k in ('air_temperature_c', 'air_rh_pct', 'air_dewpoint_c')))
        self.assertEqual(out['method'], 'provider_rh');self.assertIsNotNone(out['air_vpd_kpa'])

    def test_bad_daily_timezone_retains_current(self):
        d = read('openweather_current_payload.json');d['timezone'] = 'not/a/zone'
        r = ow(d)
        self.assertTrue(r['samples']);self.assertEqual(r['daily_forecasts'], [])

    def test_explicit_rain_rate_cannot_become_amount(self):
        d = read('openweather_current_payload.json');d['current']['rain'] = {'1h': 2}
        r = rows(ow(d), 'rain_rate_mm_h')[0]
        self.assertEqual((r['value'], r['unit'], r['time_support']), (2, 'mm/h', 'rate'))
        self.assertEqual(r['valid_start_utc'], r['valid_end_utc'])

    def test_source_events_are_raw_and_not_verified(self):
        d = read('openweather_current_payload.json');d['alerts'] = [{'event': 'hail'}]
        r = ow(d)
        self.assertEqual(r['raw_source_events'], d['alerts']);self.assertEqual(r['source_event_coverage'], 'unknown')

    def test_model_selection_preserved_not_invented(self):
        self.assertEqual(meteo(model_selection='configured-model')['samples'][0]['model_selection'], 'configured-model')

    def test_canonical_unit_validator_rejects_renamed_key(self):
        r = meteo()['samples'][0];r['units'] = r.pop('unit')
        with self.assertRaises(ValueError):E.validate_sample(r)

    def test_no_input_mutation(self):
        d = read('openmeteo_forecast_payload.json');before = deepcopy(d);meteo(d)
        self.assertEqual(d, before)

    def test_nan_does_not_become_valid_rain(self):
        d = read('openmeteo_forecast_payload.json');d['hourly']['showers'][0] = float('nan')
        self.assertIsNone(rows(meteo(d), 'liquid_rain_mm')[0]['value'])

    def test_unexpected_humidity_does_not_invalidate_gust(self):
        d = read('openmeteo_forecast_payload.json');d['hourly_units']['relative_humidity_2m'] = 'fraction'
        r = meteo(d)
        self.assertIsNone(rows(r, 'air_rh_pct')[0]['value']);self.assertIsNotNone(rows(r, 'wind_gust_ms')[0]['value'])

    def test_flowering_missing_weather_is_unknown_not_disabled(self):
        self.assertEqual(E.flower_context(stage='flowering', canopy_rain='yes', rain_positive=None,
                                         rain_complete=False, humid_positive=None, humid_complete=False), 'unknown')

    def test_flower_context_truth_table(self):
        cases = [('flowering', 'yes', True, False, None, False, 'context_only'),
                 ('flowering', 'no', True, True, True, False, 'context_only'),
                 ('flowering', 'unknown', True, True, False, True, 'unknown'),
                 ('flowering', 'partial', True, True, False, True, 'unknown'),
                 ('flowering', 'no', None, False, False, True, 'not_triggered'),
                 ('flowering', 'unknown', False, True, False, True, 'not_triggered'),
                 ('flowering', 'yes', False, True, False, False, 'unknown'),
                 ('vegetative', 'yes', True, True, True, True, 'not_applicable'),
                 ('unknown', 'yes', True, True, True, True, 'unknown')]
        for stage, canopy, rain, rain_cov, humid, humid_cov, expected in cases:
            self.assertEqual(E.flower_context(stage=stage, canopy_rain=canopy, rain_positive=rain,
                                             rain_complete=rain_cov, humid_positive=humid, humid_complete=humid_cov), expected)

    def test_water_context_state_cannot_bypass_approval(self):
        self.assertIsNone(E.display_plan(flag_id='W06', state='context_only', plant_id='p')['card'])

    def test_predictive_pm_cannot_emit_any_card_from_bad_state(self):
        for state in ('triggered', 'context_only', 'review_requested'):
            self.assertIsNone(E.display_plan(flag_id='W10', state=state, plant_id='p')['card'])

    def test_context_never_pushes_even_with_all_gates(self):
        for wid in ('W08', 'W09', 'W11', 'W12'):
            r = E.display_plan(flag_id=wid, state='context_only', plant_id='p', production_care_approved=True,
                               trusted_source=True, source_severe=True, source_adapter_approved=True,
                               push_consent=True, push_policy=True)
            self.assertIsNotNone(r['card']);self.assertFalse(r['push_eligible'])

    def test_string_false_cannot_enable_permission(self):
        with self.assertRaises(ValueError):E.display_plan(flag_id='W05', state='triggered', plant_id='p', push_consent='false')

    def test_unknown_water_has_nonpushing_card(self):
        r = E.display_plan(flag_id='W06', state='unknown', plant_id='p')
        self.assertEqual(r['card'], 'care_estimate_unavailable');self.assertFalse(r['push_eligible'])

    def test_no_source_push_without_approved_mapping(self):
        r = E.display_plan(flag_id='W05', state='triggered', plant_id='p', trusted_source=True,
                           source_severe=True, push_consent=True, push_policy=True)
        self.assertIsNone(r['card']);self.assertFalse(r['push_eligible'])


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(HandoffTests))
    (HERE/'WeedGrow_Handoff_Verification_v8.3.json').write_text(json.dumps(dict(
        testsRun=result.testsRun, allPassed=result.wasSuccessful(), failures=len(result.failures),
        errors=len(result.errors), realPlantOutcomes=0, applicationChanged=False), indent=2), encoding='utf-8')
    raise SystemExit(0 if result.wasSuccessful() else 1)
