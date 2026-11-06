"""Hand-calculated scoring and leakage checks; no biological data."""
import importlib.util
import json
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('field_evaluator',HERE/'HopsGrow_Field_Evaluator_v8.4.py');E=importlib.util.module_from_spec(s);s.loader.exec_module(E)

def dataset(pairs=()):
    return dict(criterion_id='SYNTHETIC_SCORING_ONLY',criterion_definition='Test label, not a care criterion',criterion_defined_before_predictions=True,
                cases=[dict(case_id=str(i),plant_group='p'+str(i),grower_group='g'+str(i),split='test',criterion_id='SYNTHETIC_SCORING_ONLY',
                            adjudication_status='adjudicated',observed_watering_needed=y,decision=d,
                            evaluation_utc=100,latest_input_available_at_utc=100,prediction_frozen_utc=101,label_revealed_utc=200,
                            reference_method='synthetic_test',adjudicator_id='synthetic') for i,(y,d) in enumerate(pairs)])

class EvaluationTests(unittest.TestCase):
    def test_six_cases_hand_counts(self):
        x=E.evaluate(dataset([(True,'water'),(True,'not_due'),(True,'uncertain'),(False,'water'),(False,'not_due'),(False,'uncertain')]))
        self.assertEqual(x['status'],'evaluated');c=x['counts'];m=x['metrics']
        for k in ('true_positive','false_positive','true_negative','false_negative','uncertain_due','uncertain_not_due'):self.assertEqual(c[k],1)
        self.assertEqual(m['decision_coverage'],4/6);self.assertEqual(m['accuracy_on_decided'],.5)
        self.assertEqual(m['due_cases_captured'],1/3);self.assertEqual(m['due_cases_without_water_recommendation'],2/3)
    def test_empty_is_not_perfect(self):
        x=E.evaluate(dataset());self.assertEqual(x['status'],'not_evaluated');self.assertTrue(all(v is None for v in x['metrics'].values()))
    def test_all_uncertain_has_zero_coverage_not_full_accuracy(self):
        x=E.evaluate(dataset([(True,'uncertain'),(False,'uncertain')]))
        self.assertEqual(x['metrics']['decision_coverage'],0);self.assertIsNone(x['metrics']['accuracy_on_decided'])
        self.assertEqual(x['counts']['false_negative'],0);self.assertEqual(x['counts']['uncertain_due'],1)
    def test_perfect_subset_does_not_hide_low_coverage(self):
        x=E.evaluate(dataset([(True,'water')]+[(True,'uncertain')]*9));self.assertEqual(x['metrics']['accuracy_on_decided'],1)
        self.assertEqual(x['metrics']['decision_coverage'],.1);self.assertEqual(x['metrics']['due_cases_captured'],.1)
    def test_future_weather_leakage_blocks_metrics(self):
        d=dataset([(True,'water')]);d['cases'][0]['latest_input_available_at_utc']=102
        x=E.evaluate(d);self.assertEqual(x['status'],'invalid_evaluation');self.assertTrue(all(v is None for v in x['metrics'].values()))
    def test_label_revealed_before_freeze_blocks_metrics(self):
        d=dataset([(True,'water')]);d['cases'][0]['label_revealed_utc']=101
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_same_plant_train_and_test_is_leakage(self):
        d=dataset([(True,'water'),(True,'water')]);d['cases'][0]['split']='train';d['cases'][1]['plant_group']='p0'
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_same_grower_train_and_test_is_leakage(self):
        d=dataset([(True,'water'),(True,'water')]);d['cases'][0]['split']='train';d['cases'][1]['grower_group']='g0'
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_duplicate_cases_not_double_counted_as_valid(self):
        d=dataset([(True,'water')]);d['cases']*=2;self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_unconfirmed_outcome_is_excluded(self):
        d=dataset([(False,'not_due')]);d['cases'][0]['adjudication_status']='pending'
        x=E.evaluate(d);self.assertEqual(x['status'],'not_evaluated');self.assertEqual(len(x['excluded']),1)
    def test_numeric_label_is_not_a_boolean_observation(self):
        d=dataset([(True,'water')]);d['cases'][0]['observed_watering_needed']=1
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_criterion_must_be_predefined(self):
        d=dataset([(True,'water')]);d['criterion_defined_before_predictions']=False
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_criterion_mismatch_blocks_evaluation(self):
        d=dataset([(True,'water')]);d['cases'][0]['criterion_id']='other';self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_no_automatic_release_even_if_perfect(self):
        self.assertFalse(E.evaluate(dataset([(True,'water'),(False,'not_due')]))['release_authorized'])

class BoundaryTests(unittest.TestCase):
    def test_nonstrings_cannot_supply_outcome_criterion(self):
        d=dataset([(True,'water')]);d['criterion_id']=1;d['cases'][0]['criterion_id']=1
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_nonstring_reference_provenance_is_invalid(self):
        d=dataset([(True,'water')]);d['cases'][0]['reference_method']=['not_a_method_id']
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_nonobject_dataset_is_invalid_not_exception(self):
        self.assertEqual(E.evaluate(None)['status'],'invalid_evaluation')
    def test_nonarray_cases_is_invalid(self):
        d=dataset();d['cases']={};self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_malformed_case_is_invalid_not_exception(self):
        d=dataset();d['cases']=[None];self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_unknown_requested_split_is_invalid(self):
        self.assertEqual(E.evaluate(dataset(),split='typo')['status'],'invalid_evaluation')
    def test_invalid_adjudication_status_is_not_silently_excluded(self):
        d=dataset([(True,'water')]);d['cases'][0]['adjudication_status']='typo'
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_pending_population_cannot_be_hidden(self):
        d=dataset([(True,'water'),(False,'uncertain')]);d['cases'][1]['adjudication_status']='pending'
        r=E.evaluate(d);self.assertEqual(r['selected_case_count'],2)
        self.assertEqual(r['unadjudicated_case_count'],1)
        self.assertEqual(r['metrics']['adjudication_coverage'],.5)
        self.assertEqual(r['metrics']['decision_coverage'],1)
    def test_precision_and_false_recommendation_denominators(self):
        r=E.evaluate(dataset([(True,'water'),(False,'water'),(False,'not_due'),(False,'not_due')]))
        self.assertEqual(r['metrics']['precision_of_water_recommendations'],.5)
        self.assertEqual(r['metrics']['false_water_per_recommendation'],.5)
        self.assertEqual(r['metrics']['false_water_recommendations_per_negative'],1/3)
    def test_no_water_recommendations_has_undefined_precision(self):
        r=E.evaluate(dataset([(True,'uncertain'),(False,'not_due')]))
        self.assertIsNone(r['metrics']['precision_of_water_recommendations'])
    def test_invalid_group_type_is_structured_error(self):
        d=dataset([(True,'water')]);d['cases'][0]['plant_group']=[]
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')
    def test_nonfinite_time_cannot_create_metrics(self):
        d=dataset([(True,'water')]);d['cases'][0]['evaluation_utc']=float('nan')
        self.assertEqual(E.evaluate(d)['status'],'invalid_evaluation')

if __name__=='__main__':
    suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(EvaluationTests),unittest.defaultTestLoader.loadTestsFromTestCase(BoundaryTests)]);r=unittest.TextTestRunner(verbosity=1).run(suite)
    (HERE/'HopsGrow_Field_Evaluator_Verification_v8.4.json').write_text(json.dumps(dict(testsRun=r.testsRun,passed=r.wasSuccessful(),failures=len(r.failures),errors=len(r.errors),realPlantCasesUsed=0),indent=2))
    raise SystemExit(0 if r.wasSuccessful() else 1)
