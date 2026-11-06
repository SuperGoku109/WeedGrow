"""Offline verification of the complete handoff. No app or network changes.

Run from any directory: python path/to/package/tools/verify_handoff_v8.4.py
Python 3.10+ with IANA timezone data; tests run only in a temporary copy.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT/'output/spec'


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def check(condition, reason):
    if not condition:
        raise ValueError(reason)


def main():
    try:
        ZoneInfo('America/New_York')
    except ZoneInfoNotFoundError:
        raise ValueError('IANA timezone data unavailable. On Windows, install tzdata in this test Python environment; ordinary app users need no extra input.')
    manifest = load(ROOT/'HANDOFF_MANIFEST.json')
    entries = manifest['files']
    check(len({x['path'] for x in entries}) == len(entries), 'duplicate_manifest_entry')
    for record in entries:
        relative = Path(record['path'])
        check(not relative.is_absolute() and '..' not in relative.parts, 'unsafe_manifest_path')
        path = ROOT/relative
        check(path.is_file(), 'missing_file:'+str(relative))
        b = path.read_bytes()
        check(len(b) == record['bytes'] and hashlib.sha256(b).hexdigest() == record['sha256'], 'digest_mismatch:'+str(relative))
        if path.suffix == '.json':
            load(path)
        elif path.suffix == '.py':
            compile(b.decode('utf-8'), str(relative), 'exec')
        elif path.suffix == '.md':
            body = b.decode('utf-8')
            check(not re.search(r'\]\((?:[A-Za-z]:[/\\]|/Users/|/home/)', body), 'nonportable_link:'+str(relative))
            for target in re.findall(r'\]\(([^)]+)\)', body):
                if '://' in target or target.startswith(('mailto:', '#')):
                    continue
                target = unquote(target.split('#', 1)[0]).strip('<>')
                check((path.parent/target).exists(), 'broken_local_link:'+str(relative)+':'+target)
    contract = load(SPEC/'HopsGrow_Implementation_Contract_v8.4.json')
    check(contract['version'] == '8.4', 'contract_version')
    check(len(contract['factors']) == 42 and len(contract['flags']) == 14, 'factor_flag_scope_changed')
    check({x['id'] for x in contract['flags']} == {f'W{i:02}' for i in range(1,15)}, 'warning_ids')
    check(not contract['dailyMeasurementRequirements'], 'added_daily_measurements')
    release = load(SPEC/'HopsGrow_Release_Policy_v8.0.json')
    check(release == contract['releasePolicy'], 'release_policy_disagrees')
    check(not release['approvedProfileIds'] and not release['diseasePredictivePushEnabled'], 'unapproved_activation')
    check(all(x is None for x in release['numericTargets'].values()), 'invented_release_targets')
    plan = load(ROOT/'docs/algorithm-implementation-tasks-v8.4.json')
    tasks = {x['id']: x for x in plan['tasks']}
    check(plan['specVersion'] == '8.4' and len(tasks) == len(plan['tasks']) == 28, 'task_scope')
    done = set()
    while len(done) < len(tasks):
        ready = {k for k, x in tasks.items() if k not in done and set(x['dependsOn']) <= done}
        check(ready, 'task_dependency_cycle_or_unknown')
        done |= ready
    check({a for t in tasks.values() for a in t['specAcceptanceIds']} == {a['id'] for a in contract['acceptanceCases']}, 'acceptance_coverage')
    def ancestors(tid):
        result = set(tasks[tid]['dependsOn'])
        for dep in tasks[tid]['dependsOn']:
            result |= ancestors(dep)
        return result
    check('WG-026' not in ancestors('WG-027') and 'WG-026' in ancestors('WG-028'), 'weather_care_release_coupling')
    spec = importlib.util.spec_from_file_location('audited_boundary', SPEC/'HopsGrow_Handoff_Reference_v8.4.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    wire = load(SPEC/'HopsGrow_Weather_Sample_Contract_v8.4.json')
    check(wire['kinds'] == list(helper.KINDS) and wire['timeSupports'] == list(helper.SUPPORTS), 'wire_enum_drift')
    check(wire['variables'] == {k:v[0] for k,v in helper.VARIABLES.items()}, 'wire_units_drift')
    fixture_records = 0
    for file, product in [('openmeteo_forecast_payload.json', 'forecast'), ('openmeteo_archive_payload.json', 'archive'),
                          ('openweather_current_payload.json', 'onecall_metric'), ('openweather_history_payload.json', 'timemachine_metric')]:
        normalizer = helper.normalize_meteo if product in ('forecast', 'archive') else helper.normalize_openweather
        result = normalizer(load(SPEC/'weather_fixtures'/file), product=product, retrieved_at=1793365000, location_revision=1)
        for row in result['samples']+result.get('daily_forecasts', []):
            check(set(wire['requiredFields']) <= set(row), 'missing_wire_field')
            helper.validate_sample(row)
            fixture_records += 1
    commands = [
        ['HopsGrow_Independent_Tests_v7.5.py', '--include-existing'],
        ['legacy_v82/HopsGrow_Functional_Tests_v8.2.py'],
        ['HopsGrow_Field_Evaluator_Tests_v8.4.py'],
        ['HopsGrow_API_Air_Fallback_Tests_v8.1.py'],
        ['HopsGrow_Handoff_Tests_v8.4.py'],
        ['weather_evidence/captured_payload_tests.py'],
    ]
    runs = []
    with TemporaryDirectory(prefix='HopsGrow handoff é ') as temp:
        sandbox = Path(temp)/'spec'
        shutil.copytree(SPEC, sandbox, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        for command in commands:
            env = dict(os.environ, PYTHONIOENCODING='utf-8')
            r = subprocess.run([sys.executable, *command], cwd=sandbox, env=env, text=True, encoding='utf-8', capture_output=True, timeout=120)
            out = r.stdout+r.stderr
            match = re.search(r'Ran (\d+) tests?', out)
            runs.append(dict(command=command, exitCode=r.returncode, testsRun=int(match[1]) if match else None,
                             output=out if r.returncode else out[-150:]))
            check(r.returncode == 0 and match is not None, 'suite_failed:'+str(command)+'\n'+out)
        r = subprocess.run([sys.executable, 'HopsGrow_Field_Evaluator_v8.4.py', 'HopsGrow_Field_Dataset_v8.4.json'],
                           cwd=sandbox, text=True, encoding='utf-8', capture_output=True, timeout=30)
        empty = json.loads(r.stdout)
        check(r.returncode == 1 and empty['status'] == 'invalid_evaluation' and not empty['release_authorized'], 'empty_dataset_was_approved')
    report = dict(version='8.4', integrityPassed=True, verifiedManifestFiles=len(entries),
                  canonicalFixtureSamples=fixture_records, tasks=28, acceptanceAreas=16,
                  testMethods=sum(x['testsRun'] for x in runs), suites=runs,
                  emptyUnconfiguredDatasetRejected=True, applicationChanged=False,
                  realPlantOutcomes=0, predictiveAccuracyValidated=False, productionActivationReady=False)
    destination = ROOT/'verification/latest_run.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'suites'}, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as error:
        print('HANDOFF VERIFICATION FAILED: '+str(error), file=sys.stderr)
        raise SystemExit(1)
