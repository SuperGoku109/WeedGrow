"""Scores independent watering outcomes; never deploys a model.

Standard library, Python3.10+. Input: criterion_id, criterion_definition,
criterion_defined_before_predictions and cases[]. See v8.3 master and Field_Dataset_Contract. Supersedes v8.0 scoring helper.
"""
import argparse
import json
from math import isfinite
from pathlib import Path


def ratio(a,b):return a/b if b else None
def number(x):return isinstance(x,(int,float)) and not isinstance(x,bool) and isfinite(x)
def text(x):return isinstance(x,str) and bool(x.strip())


def evaluate(data, split='test'):
    errors=[];excluded=[];eligible=[];seen=set();groups={}
    if not isinstance(data,dict):
        data={};errors.append('dataset_not_object')
    if split not in ('train','tune','test'):
        errors.append('invalid_requested_split')
    rows=data.get('cases',[])
    if not isinstance(rows,list):
        rows=[];errors.append('cases_not_array')
    selected_case_count=0
    unadjudicated_case_count=0
    criterion=data.get('criterion_id')
    if not text(criterion) or not text(data.get('criterion_definition')) or data.get('criterion_defined_before_predictions') is not True:
        errors.append('predefined_outcome_criterion_missing')
    for row in rows:
        if not isinstance(row,dict):
            errors.append('case_not_object');continue
        cid=row.get('case_id')
        if not isinstance(cid,str) or not cid or cid in seen:
            errors.append('invalid_or_duplicate_case_id');continue
        seen.add(cid)
        partition=row.get('split')
        if partition not in ('train','tune','test'):
            errors.append('invalid_split:'+cid);continue
        for field in ('plant_group','grower_group'):
            group=row.get(field)
            if not isinstance(group,str) or not group:
                errors.append('missing_'+field+':'+cid);continue
            key=(field,group)
            if key in groups and groups[key]!=partition:errors.append('split_leakage:'+field+':'+group)
            groups[key]=partition
        if partition!=split:continue
        selected_case_count+=1
        if row.get('adjudication_status') not in ('pending','adjudicated'):
            errors.append('invalid_adjudication_status:'+cid);continue
        if row.get('adjudication_status')!='adjudicated':
            unadjudicated_case_count+=1
            excluded.append(dict(case_id=cid,reason='outcome_not_adjudicated'));continue
        if row.get('criterion_id')!=criterion:
            errors.append('criterion_mismatch:'+cid);continue
        if not isinstance(row.get('observed_watering_needed'),bool):
            errors.append('invalid_outcome_label:'+cid);continue
        if row.get('decision') not in ('water','not_due','uncertain'):
            errors.append('invalid_decision:'+cid);continue
        times=[row.get(k) for k in ('evaluation_utc','latest_input_available_at_utc','prediction_frozen_utc','label_revealed_utc')]
        if not all(number(x) for x in times):
            errors.append('missing_or_invalid_prediction_time:'+cid);continue
        evaluation,available,frozen,revealed=times
        if available>evaluation or frozen<evaluation or frozen>=revealed:
            errors.append('temporal_leakage:'+cid);continue
        if not text(row.get('reference_method')) or not text(row.get('adjudicator_id')):
            errors.append('reference_provenance_missing:'+cid);continue
        eligible.append(row)
    counts=dict(total=len(eligible),due=0,not_due=0,true_positive=0,false_positive=0,true_negative=0,false_negative=0,uncertain_due=0,uncertain_not_due=0)
    for row in eligible:
        positive=row['observed_watering_needed'];decision=row['decision']
        counts['due' if positive else 'not_due']+=1
        if decision=='uncertain':counts['uncertain_due' if positive else 'uncertain_not_due']+=1
        elif decision=='water':counts['true_positive' if positive else 'false_positive']+=1
        else:counts['false_negative' if positive else 'true_negative']+=1
    c=counts;decided=c['total']-c['uncertain_due']-c['uncertain_not_due']
    metrics=dict(adjudication_coverage=ratio(c['total'],selected_case_count),
                 decision_coverage=ratio(decided,c['total']),
                 precision_of_water_recommendations=ratio(c['true_positive'],c['true_positive']+c['false_positive']),
                 false_water_per_recommendation=ratio(c['false_positive'],c['true_positive']+c['false_positive']),
                 accuracy_on_decided=ratio(c['true_positive']+c['true_negative'],decided),
                 sensitivity_on_decided=ratio(c['true_positive'],c['true_positive']+c['false_negative']),
                 due_cases_captured=ratio(c['true_positive'],c['due']),
                 due_cases_without_water_recommendation=ratio(c['false_negative']+c['uncertain_due'],c['due']),
                 false_water_recommendations_per_negative=ratio(c['false_positive'],c['not_due']),
                 explicit_misses_per_positive=ratio(c['false_negative'],c['due']))
    if errors:
        status='invalid_evaluation';metrics={k:None for k in metrics}
    else:status='evaluated' if eligible else 'not_evaluated'
    return dict(status=status,split=split,selected_case_count=selected_case_count,
                unadjudicated_case_count=unadjudicated_case_count,counts=counts,metrics=metrics,excluded=excluded,
                integrity_errors=sorted(set(errors)),release_authorized=False,
                explanation='Descriptive metrics only; require independent uncertainty/statistical review and preregistered release gates.')


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('input',type=Path);p.add_argument('--output',type=Path);args=p.parse_args()
    result=evaluate(json.loads(args.input.read_text(encoding='utf-8')))
    text=json.dumps(result,indent=2,allow_nan=False)
    if args.output:args.output.write_text(text,encoding='utf-8')
    else:print(text)
    return 1 if result['status']=='invalid_evaluation' else 0

if __name__=='__main__':raise SystemExit(main())
