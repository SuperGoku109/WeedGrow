"""Executable scenario/invariant checks; synthetic conditions, not field validation."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import random
import sys
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hopsgrow_v73',HERE/'HopsGrow_Algorithm_Emulator_v7.4.py')
E=importlib.util.module_from_spec(spec);sys.modules[spec.name]=E;spec.loader.exec_module(E)

def base():return E.demo_payload()
def evaluate(p):return E.evaluate(p)
def f(result, wid):return next(x for x in result['flags'] if x['id']==wid)
def hist(p):return [r for r in p['weather'] if r['kind']=='occurred_estimate']
def future(p):return [r for r in p['weather'] if r['kind']=='forecast']
def log(p, amount=.1, event_id='event', at=None, **extra):
    t=p['now'] if at is None else at
    return dict(event_id=event_id,revision=1,kind='watering',earliest=t,latest=t,recorded_at=p['now'],amount_l=amount,**extra)
def alert(p, hazard='hail', alert_id='source-event'):
    return dict(alert_id=alert_id,adapter_verified=True,location_revision=1,start=p['now'],end=p['now']+E.HOUR,
                issued_at=p['now']-100,hazard=hazard,issuer='SYNTHETIC_TEST_SOURCE')


class Scenarios(unittest.TestCase):
    def test_dry_candidate_is_water_but_production_is_uncertain(self):
        r=evaluate(base());self.assertEqual(r['water']['candidate'],'water');self.assertEqual(r['water']['decision'],'uncertain')
    def test_large_water_at_now_changes_candidate(self):
        p=base();p['logs']=[log(p,2)];self.assertEqual(evaluate(p)['water']['candidate'],'not_due')
    def test_unknown_amount_is_not_full_refill(self):
        p=base();p['logs']=[log(p,None)];self.assertEqual(evaluate(p)['water']['candidate'],'water')
    def test_unknown_amount_unbounded_abstains(self):
        p=base();p['logs']=[log(p,None)];p['profile']['scenarios'][0]['unknown_log_applied_l']=None
        self.assertEqual(evaluate(p)['water']['reason'],'unknown_refill_unbounded')
    def test_refill_scenario_disagreement_abstains(self):
        p=base();p['logs']=[log(p,None)];s=p['profile']['scenarios'][0];s['unknown_log_applied_l']=0
        t=dict(s,id='large',unknown_log_applied_l=2);p['profile']['scenarios'].append(t)
        self.assertEqual(evaluate(p)['water']['candidate'],'uncertain')
    def test_forecast_rain_is_not_current_water(self):
        p=base();before=evaluate(p)['water']
        for r in future(p):r['rain_mm']=3
        after=evaluate(p);self.assertEqual(before,after['water']);self.assertEqual(f(after,'W04')['state'],'triggered')
    def test_soil_shelter_prevents_rain_credit(self):
        p=base();p['plant']['soil_rain']='no';before=evaluate(p)['water']
        for r in hist(p):r['rain_mm']=10
        self.assertEqual(before,evaluate(p)['water'])
    def test_unknown_reception_retains_zero_and_full_branches(self):
        p=base();p['plant']['soil_rain']='unknown';hist(p)[-1]['rain_mm']=10
        s=p['profile']['scenarios'][0];p['profile']['scenarios'].append(dict(s,id='rain-reaches',uncertain_soil_delivery=1))
        self.assertEqual(evaluate(p)['water']['candidate'],'uncertain')
    def test_unknown_reception_cannot_default_to_fifty_percent(self):
        p=base();p['plant']['soil_rain']='unknown';p['profile']['scenarios'][0]['uncertain_soil_delivery']=.5
        self.assertEqual(evaluate(p)['water']['reason'],'unknown_rain_reception_not_bracketed')
    def test_partial_reception_needs_supported_bounds(self):
        p=base();p['plant']['soil_rain']='partial'
        self.assertEqual(evaluate(p)['water']['reason'],'partial_rain_reception_bounds_missing')
    def test_duplicate_log_is_idempotent(self):
        p=base();p['logs']=[log(p)];before=evaluate(p);p['logs']*=2;self.assertEqual(before,evaluate(p))
    def test_separate_equal_logs_both_count(self):
        p=base();p['logs']=[log(p),log(p,event_id='other')]
        self.assertAlmostEqual(evaluate(p)['water']['branches'][0]['delivered_l'],.16)
    def test_new_log_revision_replaces_old(self):
        p=base();a=log(p,.1);p['logs']=[a,dict(a,revision=2,amount_l=2)]
        self.assertEqual(evaluate(p)['water']['candidate'],'not_due')
    def test_deleted_log_does_not_add_water(self):
        p=base();a=log(p,2);p['logs']=[a,dict(a,revision=2,deleted=True)]
        self.assertEqual(evaluate(p)['water']['candidate'],'water')
    def test_conflicting_log_revision_blocks_water_only(self):
        p=base();a=log(p);p['logs']=[a,dict(a,amount_l=2)];future(p)[0]['temp_c']=36
        r=evaluate(p);self.assertEqual(r['water']['reason'],'log_ledger_requires_repair');self.assertEqual(f(r,'W01')['state'],'triggered')
    def test_date_only_time_is_bounded_by_recorded_time(self):
        p=base();p['logs']=[dict(log(p,.5),earliest=p['now']-E.DAY,latest=p['now']+E.DAY)]
        rows,issues=E.canonical_logs(p['logs'],p['now']);self.assertFalse(issues);self.assertEqual(rows[0]['latest'],p['now'])
    def test_future_log_is_quarantined(self):
        p=base();p['logs']=[log(p,at=p['now']+10)]
        self.assertIn('invalid_log_time',evaluate(p)['data_issues'])
    def test_negative_amount_is_invalid(self):
        p=base();p['logs']=[log(p,-1)];self.assertEqual(evaluate(p)['water']['reason'],'log_ledger_requires_repair')
    def test_zero_amount_not_replaced_with_default(self):
        p=base();p['logs']=[log(p,0)];self.assertEqual(evaluate(p)['water']['branches'][0]['delivered_l'],0)
    def test_profile_change_cannot_create_water(self):
        p=base();p['logs']=[dict(log(p),kind='repot')]
        self.assertEqual(evaluate(p)['water']['reason'],'profile_transition_requires_reinitialization')
    def test_log_crossing_anchor_needs_reconciliation(self):
        p=base();p['logs']=[dict(log(p),earliest=p['profile']['anchor_utc']-10)]
        self.assertEqual(evaluate(p)['water']['reason'],'log_straddles_anchor')
    def test_missing_et0_does_not_hide_heat(self):
        p=base();hist(p)[-1]['et0_mm']=None;future(p)[0]['temp_c']=35
        r=evaluate(p);self.assertEqual(r['water']['candidate'],'uncertain');self.assertEqual(f(r,'W01')['state'],'triggered')
    def test_missing_rh_does_not_block_et0_water_path(self):
        p=base();hist(p)[-1]['rh']=None;self.assertEqual(evaluate(p)['water']['candidate'],'water')
    def test_missing_rain_matters_only_when_soil_can_receive_it(self):
        p=base();hist(p)[-1]['rain_mm']=None;self.assertEqual(evaluate(p)['water']['candidate'],'uncertain')
        p['plant']['soil_rain']='no';self.assertEqual(evaluate(p)['water']['candidate'],'water')
    def test_future_values_cannot_be_marked_history(self):
        p=base();future(p)[0]['kind']='occurred_estimate'
        self.assertIn('future_values_marked_occurred',evaluate(p)['data_issues'])
    def test_duplicate_weather_not_double_counted(self):
        p=base();before=evaluate(p);p['weather']*=2;self.assertEqual(before,evaluate(p))
    def test_new_weather_issue_replaces_original(self):
        p=base();old=hist(p)[-1];p['weather'].append(dict(old,issued_at=p['now'],rain_mm=10))
        r=evaluate(p);self.assertTrue(any(b['delivered_l']>.69 for b in r['water']['branches']))
    def test_overlapping_weather_blocks_replay(self):
        p=base();p['weather'].append(dict(hist(p)[-1],start=p['now']-E.HOUR/2))
        self.assertEqual(evaluate(p)['water']['candidate'],'uncertain')
    def test_conflicting_weather_is_not_summed(self):
        p=base();p['weather'].append(dict(hist(p)[-1],rain_mm=9))
        r=evaluate(p);self.assertIn('conflicting_weather_revision',r['data_issues']);self.assertEqual(r['water']['candidate'],'uncertain')
    def test_bad_humidity_does_not_remove_valid_wind(self):
        p=base();r=future(p)[0];r['rh']=120;r['gust_ms']=20
        out=evaluate(p);self.assertIn('invalid_rh',out['data_issues']);self.assertEqual(f(out,'W03')['state'],'triggered')
    def test_point_crossing_can_trigger_heat_but_not_duration(self):
        p=base();p['weather'].append(dict(hist(p)[-1],kind='current_point',start=p['now'],end=p['now'],temp_c=35))
        self.assertEqual(f(evaluate(p),'W01')['state'],'triggered')
    def test_old_hot_point_is_not_current_warning(self):
        p=base();p['weather'].append(dict(hist(p)[-1],kind='current_point',start=p['now']-2*E.HOUR,end=p['now']-2*E.HOUR,temp_c=35))
        self.assertEqual(f(evaluate(p),'W01')['state'],'not_triggered')
    def test_absent_source_coverage_is_unknown(self):self.assertEqual(f(evaluate(base()),'W05')['state'],'unknown')
    def test_hail_requires_explicit_source(self):
        p=base();p['alerts']=[alert(p)];self.assertEqual(f(evaluate(p),'W05')['state'],'triggered')
    def test_unverified_source_ignored(self):
        p=base();p['alerts']=[dict(alert(p),adapter_verified=False)];self.assertEqual(f(evaluate(p),'W05')['state'],'unknown')
    def test_cancelled_source_replaces_old_active(self):
        p=base();a=alert(p);p['alerts']=[a,dict(a,cancelled=True,issued_at=p['now'])]
        self.assertEqual(f(evaluate(p),'W05')['state'],'unknown')
    def test_expired_source_ignored(self):
        p=base();p['alerts']=[dict(alert(p),start=0,end=1)];self.assertEqual(f(evaluate(p),'W05')['state'],'unknown')
    def test_source_alert_survives_missing_water_history(self):
        p=base();p['weather']=[];p['alerts']=[alert(p)];r=evaluate(p)
        self.assertEqual(r['water']['candidate'],'uncertain');self.assertEqual(f(r,'W05')['state'],'triggered')
    def test_forecast_accumulation_triggers_below_rate_threshold(self):
        p=base()
        for r in future(p):r['rain_mm']=1.5
        self.assertEqual(f(evaluate(p),'W04')['state'],'triggered')
    def test_missing_forecast_does_not_block_current_decision(self):
        p=base();future(p)[0]['et0_mm']=None;r=evaluate(p)
        self.assertEqual(r['water']['candidate'],'water');self.assertEqual(r['debug_threshold_projection']['state'],'unavailable')
    def test_projection_never_overrides_water_due_now(self):
        p=base()
        for r in future(p):r['rain_mm']=4
        out=evaluate(p);self.assertEqual(out['water']['candidate'],'water')
        self.assertEqual(out['debug_threshold_projection']['first_crossing_interval_utc'],[p['now'],p['now']])
    def test_projection_is_interval_or_horizon_censored_not_exact_ETA(self):
        p=base();p['logs']=[log(p,.7)];r=evaluate(p)
        self.assertEqual(r['water']['candidate'],'not_due');self.assertEqual(r['debug_threshold_projection']['state'],'synthetic_candidate_only')
        lo,hi=r['debug_threshold_projection']['first_crossing_interval_utc'];self.assertLess(lo,hi)
    def test_rain_mean_rate_uses_interval_duration(self):
        p=base();r=future(p)[0];r['end']=r['start']+E.HOUR/2;r['rain_mm']=6
        self.assertEqual(f(evaluate(p),'W04')['state'],'triggered')
    def test_partial_window_below_screen_is_unknown(self):
        p=base();p['weather'].remove(future(p)[0]);self.assertEqual(f(evaluate(p),'W04')['state'],'unknown')
    def test_air_freezing_and_frost_context_are_distinct(self):
        p=base();future(p)[0]['temp_c']=1;r=f(evaluate(p),'W02')
        self.assertEqual(r['evidence']['possible_frost_context']['state'],'triggered')
        self.assertEqual(r['evidence']['air_freezing_context']['state'],'not_triggered')
    def test_stage_not_age_controls_flowers(self):
        p=base();p['plant'].update(stage='vegetative',age_days=900)
        self.assertEqual(f(evaluate(p),'W11')['state'],'not_applicable')
    def test_unknown_stage_not_assumed_flowering(self):
        p=base();p['plant']['stage']='unknown';self.assertEqual(f(evaluate(p),'W11')['state'],'unknown')
    def test_unknown_stage_does_not_rule_out_establishment(self):
        p=base();p['plant']['stage']='unknown';self.assertEqual(f(evaluate(p),'W13')['state'],'unknown')
    def test_unknown_container_type_not_assumed_ground(self):
        p=base();p['plant']['planted_in']='unknown';self.assertEqual(f(evaluate(p),'W08')['state'],'unknown')
    def test_unknown_canopy_reception_not_assumed_dry(self):
        p=base();p['plant']['canopy_rain']='unknown';future(p)[0]['rain_mm']=1
        self.assertEqual(f(evaluate(p),'W11')['state'],'unknown')
    def test_canopy_shelter_blocks_direct_rain_not_humidity(self):
        p=base();p['plant']['canopy_rain']='no';future(p)[0].update(rain_mm=1,rh=95)
        r=f(evaluate(p),'W11');self.assertFalse(r['evidence']['direct_rain_forecast']);self.assertEqual(r['state'],'context_only')
    def test_pm_prediction_disabled_at_both_moderate_and_high_rh(self):
        p=base()
        for rh in (48,95):
            for r in p['weather']:r['rh']=rh
            self.assertEqual(f(evaluate(p),'W10')['state'],'disabled')
    def test_root_diagnosis_never_from_rain_and_logs(self):
        p=base();p['logs']=[log(p,20)]
        for r in hist(p):r['rain_mm']=20
        out=evaluate(p)
        for wid in ('W07','W14'):self.assertEqual(f(out,wid)['state'],'disabled')
    def test_optional_review_is_topic_specific(self):
        p=base();p['problem_report']={'topics':['root_wilt']};r=evaluate(p)
        self.assertEqual(f(r,'W14')['state'],'review_requested');self.assertEqual(f(r,'W07')['state'],'disabled')
    def test_greenhouse_weather_does_not_become_internal_air(self):
        p=base();p['plant']['environment']='greenhouse';r=evaluate(p)
        self.assertEqual(r['water']['reason'],'environment_out_of_scope');self.assertEqual(f(r,'W11')['state'],'not_applicable')
    def test_scope_mismatch_not_guessed(self):
        p=base();p['plant']['medium']='coco';self.assertEqual(evaluate(p)['water']['reason'],'profile_scope_medium')
    def test_ground_never_reuses_a_container_profile(self):
        p=base();p['plant']['planted_in']='ground';self.assertEqual(evaluate(p)['water']['reason'],'profile_scope_planted_in')
    def test_missing_profile_does_not_crash_weather_warnings(self):
        p=base();p['profile']=None;future(p)[0]['temp_c']=35;r=evaluate(p)
        self.assertEqual(r['water']['reason'],'profile_unavailable');self.assertEqual(f(r,'W01')['state'],'triggered')
    def test_scenario_identity_is_not_parsed_from_display_label(self):
        p=base();p['profile']['scenarios'][0]['id']='profile/subprofile';r=evaluate(p)
        self.assertEqual(r['debug_threshold_projection']['state'],'synthetic_candidate_only')
    def test_dated_age_can_select_supported_profile(self):
        p=base();p['plant'].update(age_known=True,age_days=20,age_asof=p['now']-E.DAY,age_origin='seed')
        p['profile']['scope'].update(age_days_range=[20,22],age_origin=['seed'])
        self.assertEqual(evaluate(p)['water']['selection']['optional_features_used']['effective_age_days'],21)
    def test_clone_age_not_silently_seed_age(self):
        p=base();p['plant'].update(age_known=True,age_days=20,age_asof=p['now'],age_origin='clone')
        p['profile']['scope'].update(age_days_range=[10,30],age_origin=['seed'])
        self.assertEqual(evaluate(p)['water']['reason'],'optional_age_origin_mismatch')
    def test_missing_age_uses_explicit_aggregate_fallback(self):
        p=base();fallback=deepcopy(p['profile']);fallback['id']='aggregate-synthetic'
        p['profile']['scope'].update(age_days_range=[10,30],age_origin=['seed']);p['profile']['fallback']=fallback
        self.assertEqual(evaluate(p)['water']['profile_id'],'aggregate-synthetic')
    def test_old_height_uses_explicit_fallback(self):
        p=base();fallback=deepcopy(p['profile']);fallback['id']='height-aggregate'
        p['plant'].update(height_cm=50,height_asof=p['now']-20*E.DAY)
        p['profile']['scope'].update(height_cm_range=[40,60],height_max_age_days=7);p['profile']['fallback']=fallback
        self.assertEqual(evaluate(p)['water']['profile_id'],'height-aggregate')
    def test_fresh_height_is_proxy_not_leaf_area_measurement(self):
        p=base();p['plant'].update(height_cm=50,height_asof=p['now'])
        p['profile']['scope'].update(height_cm_range=[40,60],height_max_age_days=7)
        self.assertEqual(evaluate(p)['water']['selection']['optional_features_used']['height_cm'],50)
    def test_inactive_plant_has_no_care_cards(self):
        p=base();p['plant']['status']='harvested';p['alerts']=[alert(p)]
        r=evaluate(p);self.assertEqual(r['cards'],[]);self.assertTrue(all(x['state']=='not_applicable' for x in r['flags']))
    def test_equal_time_conflicting_alert_versions_not_asserted_active(self):
        p=base();a=alert(p);p['alerts']=[a,dict(a,cancelled=True)]
        self.assertEqual(f(evaluate(p),'W05')['state'],'unknown')
    def test_same_wind_source_deduplicates_W05(self):
        p=base();p['alerts']=[alert(p,'wind')]
        self.assertFalse(any(c['card']=='W05' for c in evaluate(p)['cards']))
    def test_location_change_invalidates_old_history(self):
        p=base();p['plant']['location_revision']=2;r=evaluate(p)
        self.assertIn('weather_location_mismatch',r['data_issues']);self.assertEqual(r['water']['reason'],'profile_location_changed')
    def test_excluded_measurements_do_not_change_algorithm(self):
        p=base();before=evaluate(p);p['plant'].update(leaf_temperature=99,root_temperature=90,soilMoisture=.9,waterLevel=1,strain='resistant')
        self.assertEqual(before,evaluate(p))
    def test_forged_approval_field_cannot_release_synthetic_profile(self):
        p=base();p['profile']['approved']=True;self.assertEqual(evaluate(p)['water']['decision'],'uncertain')
    def test_all_warning_ids_dispatched_exactly_once(self):self.assertEqual(tuple(x['id'] for x in evaluate(base())['flags']),E.WARNING_IDS)
    def test_deterministic_and_no_input_mutation(self):
        p=base();original=deepcopy(p);self.assertEqual(evaluate(p),evaluate(p));self.assertEqual(p,original)
    def test_no_probability_or_notification_claims(self):
        r=evaluate(base());self.assertTrue(all(x['probability'] is None for x in r['flags']));self.assertEqual(r['notifications_sent'],0);self.assertIsNone(r['needs_water'])
    def test_heat_and_container_cards_merge(self):
        p=base();future(p)[0]['temp_c']=35;r=evaluate(p);cards=[c for c in r['cards'] if c['card']=='heat']
        self.assertEqual(len(cards),1);self.assertEqual(set(cards[0]['warning_ids']),{'W01','W08'})
    def test_same_heat_source_deduplicates_W05(self):
        p=base();p['alerts']=[alert(p,'heat')];cards=evaluate(p)['cards'];self.assertFalse(any(c['card']=='W05' for c in cards))
    def test_notification_cooldown_does_not_hide_escalation(self):
        prev=dict(episode_key='wind1',tier=1,sent_at=100);new=dict(episode_key='wind1',tier=2,state='triggered',eligible=True)
        self.assertEqual(E.notification_plan(prev,new,now=101,cooldown_seconds=1000,policy_enabled=True),'escalation')
        new['tier']=1;self.assertEqual(E.notification_plan(prev,new,now=101,cooldown_seconds=1000,policy_enabled=True),'suppress')
    def test_disabled_delivery_policy_sends_nothing(self):
        self.assertEqual(E.notification_plan(None,dict(state='triggered',eligible=True),now=1,cooldown_seconds=100,policy_enabled=False),'suppress')
    def test_vpd_is_air_only_and_combines_temperature_humidity(self):
        self.assertAlmostEqual(E.vpd(30,40)/E.vpd(30,80),3)
    def test_1000_bank_trials_conservation_monotonicity_and_order_bounds(self):
        rng=random.Random(20261030)
        for _ in range(1000):
            c=rng.uniform(.2,20);r=rng.uniform(0,c);w=rng.uniform(0,10);d=rng.uniform(0,10)
            a=E.Bank(r);b=E.Bank(r);more=E.Bank(r);dry=E.Bank(r)
            E.bank_step(a,c,w,d,'inputs_first');E.bank_step(b,c,w,d,'loss_first')
            E.bank_step(more,c,w+1,d,'inputs_first');E.bank_step(dry,c,w,d+1,'inputs_first')
            self.assertTrue(0<=a.reserve_l<=c and 0<=b.reserve_l<=c)
            self.assertLessEqual(a.reserve_l,b.reserve_l+1e-9)
            self.assertLessEqual(a.reserve_l,more.reserve_l+1e-9);self.assertGreaterEqual(a.reserve_l+1e-9,dry.reserve_l)
            self.assertAlmostEqual(r+a.delivered_l,a.reserve_l+a.extracted_l+a.excess_l)


    def test_missing_rain_does_not_clear_canopy_context(self):
        p=base()
        for r in p['weather']:r['rain_mm']=None
        self.assertEqual(f(evaluate(p),'W12')['state'],'unknown')
    def test_recent_rain_supplies_flower_context_after_forecast_turns_dry(self):
        p=base();hist(p)[-2]['rain_mm']=2;r=f(evaluate(p),'W11')
        self.assertEqual(r['state'],'context_only');self.assertTrue(r['evidence']['direct_rain_recent'])
        self.assertFalse(r['evidence']['direct_rain_forecast'])
    def test_corrected_authoritative_log_resolves_old_conflict(self):
        p=base();a=log(p);p['logs']=[a,dict(a,amount_l=2),dict(a,revision=2,amount_l=1)]
        self.assertNotIn('conflicting_log_revision',evaluate(p)['data_issues'])
        self.assertNotEqual(evaluate(p)['water']['reason'],'log_ledger_requires_repair')
    def test_censored_projection_has_no_finite_upper_wait(self):
        p=base();p['logs']=[log(p,.7)]
        for r in future(p):r['rain_mm']=1.5
        x=evaluate(p)['debug_threshold_projection'];self.assertGreater(x['trajectories_not_crossing_within_horizon'],0)
        self.assertIsNone(x['first_crossing_interval_utc'][1])
    def test_degree_hours_and_continuous_duration(self):
        rows=[dict(start=0,end=E.HOUR,temp_c=34),dict(start=E.HOUR,end=3*E.HOUR,temp_c=36)]
        m=E.exposure_metrics(rows,'temp_c',32,'ge');self.assertEqual(m['exposure_hours'],3)
        self.assertEqual(m['longest_episode_hours'],3);self.assertEqual(m['exceedance_units_hours'],10)
    def test_gap_breaks_continuous_episode(self):
        rows=[dict(start=0,end=E.HOUR,temp_c=34),dict(start=2*E.HOUR,end=3*E.HOUR,temp_c=34)]
        m=E.exposure_metrics(rows,'temp_c',32,'ge');self.assertEqual(m['exposure_hours'],2);self.assertEqual(m['longest_episode_hours'],1)
    def test_overlap_does_not_double_exposure_dose(self):
        r=dict(start=0,end=E.HOUR,temp_c=34);m=E.exposure_metrics([r,r],'temp_c',32,'ge')
        self.assertIsNone(m['exceedance_units_hours'])
    def test_point_can_trigger_without_inventing_exposure_hours(self):
        p=base();p['weather'].append(dict(hist(p)[-1],kind='current_point',start=p['now'],end=p['now'],temp_c=35))
        r=f(evaluate(p),'W01');recent=r['evidence']['phases'][0]
        self.assertEqual(recent['state'],'triggered');self.assertEqual(recent['exposure_hours'],0)
    def test_forecast_and_recent_trigger_states_remain_separate(self):
        p=base();future(p)[0]['temp_c']=35;r=f(evaluate(p),'W01')['evidence']['phases']
        self.assertEqual(r[0]['state'],'not_triggered');self.assertEqual(r[1]['state'],'triggered')
    def test_invalid_bank_order_rejected(self):
        with self.assertRaises(E.Unsupported):E.bank_step(E.Bank(1),2,0,0,'typo')
    def test_invalid_bank_initial_state_rejected(self):
        with self.assertRaises(E.Unsupported):E.bank_step(E.Bank(3),2,0,0,'inputs_first')
    def test_declared_forecast_ttl_rejects_stale_values(self):
        p=base();future(p)[0].update(temp_c=40,issued_at=p['now']-E.DAY);p['forecast_max_age_seconds']={'synthetic':6*E.HOUR}
        r=evaluate(p);self.assertIn('forecast_stale_or_invalid_freshness_policy',r['data_issues'])
        self.assertEqual(f(r,'W01')['state'],'unknown')
    def test_hourly_maximum_gust_does_not_become_hour_of_strong_wind(self):
        p=base();future(p)[0]['gust_ms']=20
        gust=f(evaluate(p),'W03')['evidence']['gust']['evidence']['phases'][1]
        self.assertEqual(gust['state'],'triggered');self.assertIsNone(gust['exposure_hours'])
    def test_interval_maximum_temperature_has_no_sustained_dose(self):
        m=E.exposure_metrics([dict(start=0,end=E.HOUR,temp_c=35,temp_c_support='maximum')],'temp_c',32,'ge')
        self.assertFalse(m['integral_supported'])
    def test_historical_heat_exposure_is_not_a_current_heat_trigger(self):
        p=base()
        for r in hist(p)[-8:-1]:r['temp_c']=35
        out=f(evaluate(p),'W01');self.assertEqual(out['state'],'not_triggered')
        self.assertEqual(out['evidence']['history_24h_exposure']['exposure_hours'],7)
    def test_point_rain_rate_triggers_weather_without_creating_water_volume(self):
        p=base();before=evaluate(p)['water']
        p['weather'].append(dict(hist(p)[-1],kind='current_point',start=p['now'],end=p['now'],rain_rate_mm_h=20,rain_mm=None))
        r=evaluate(p);self.assertEqual(f(r,'W04')['state'],'triggered');self.assertEqual(r['water'],before)
        self.assertEqual(f(r,'W11')['state'],'context_only')
        p['plant']['canopy_rain']='unknown';self.assertEqual(f(evaluate(p),'W11')['state'],'unknown')


class Recorder(unittest.TextTestResult):
    def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.passed=[]
    def addSuccess(self,test):super().addSuccess(test);self.passed.append(test.id().split('.')[-1])


def main():
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Scenarios)
    result=unittest.TextTestRunner(verbosity=1,resultclass=Recorder).run(suite)
    report=dict(version='7.4',scenarioTestsRun=result.testsRun,scenarioTestsPassed=len(result.passed),
                bankTrials=1000,randomSeed=20261030,passed=result.passed,
                failures=[str(t) for t,_ in result.failures],errors=[str(t) for t,_ in result.errors],
                biologicalAccuracyValidated=False,liveDataUsed=False,productionProfilesBundled=0)
    (HERE/'HopsGrow_Algorithm_Verification_v7.4.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    p=base();(HERE/'HopsGrow_Synthetic_Input_v7.4.json').write_text(json.dumps(p,indent=2),encoding='utf-8')
    (HERE/'HopsGrow_Synthetic_Output_v7.4.json').write_text(json.dumps(evaluate(p),indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='passed'},indent=2))
    return 0 if result.wasSuccessful() else 1


if __name__=='__main__':sys.exit(main())
