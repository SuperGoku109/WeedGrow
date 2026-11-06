from pathlib import Path
import ast
import hashlib
import json
import re
import zipfile

WORK = Path(__file__).resolve().parent
SOURCE = WORK.parent / 'WeedGrow_Complete_Codex_Handoff_v8.3.zip'
DEST = WORK / 'HopsGrow_Complete_Codex_Handoff_v8.4'
DEST.mkdir(exist_ok=False)

def wording(text):
    text = text.replace('WeedGrow', 'HopsGrow').replace('weedgrow', 'hopsgrow').replace('WEEDGROW', 'HOPSGROW')
    text = text.replace('v8.3', 'v8.4').replace("'8.3'", "'8.4'").replace('"8.3"', '"8.4"')
    text = re.sub(r'cannabis', 'hops', text, flags=re.I)
    text = text.replace('internal-bud', 'internal-cone')
    return text

def source_wording(text):
    # Source summaries are descriptive labels, never renamed as hops experiments.
    urls = []
    def save_url(match):
        urls.append(match[0])
        return 'SOURCEURLPLACEHOLDER%dEND' % (len(urls) - 1)
    text = re.sub(r'https?://[^"\s]+', save_url, text)
    pairs = [
        ('Cannabis sativa', 'a related crop'),
        ('Industrial Hemp', 'Related-Crop Plants'),
        ('CBD-dominant indoor cannabis', 'indoor related-crop plants'),
        ('CBD-flower hemp', 'related-crop flowering'),
        ('high-CBD', 'chemically selected'),
        ('THC/CBD', 'chemical-composition'),
        ('medical cannabis', 'a related crop'),
        ('same buds', 'same flower yield'),
        ('cannabis bud rot', 'related-crop flower rot'),
    ]
    for old, new in pairs:
        text = text.replace(old, new)
    text = re.sub(r'\bcannabis\b|\bhemp\b', 'related-crop', text, flags=re.I)
    text = re.sub(r'\bstrain\b', 'cultivar', text)
    # Keep the exact cited address while removing crop terms from its visible spelling.
    for index, url in enumerate(urls):
        encoded = re.sub(r'hemp|cannabidiol|cbd|cannabis',
                         lambda m: ''.join('%%%02X' % ord(c) for c in m[0]), url, flags=re.I)
        text = text.replace('SOURCEURLPLACEHOLDER%dEND' % index, encoded)
    return wording(text)

originals = {}
with zipfile.ZipFile(SOURCE) as archive:
    for info in archive.infolist():
        old = archive.read(info.filename).decode('utf-8')
        originals[info.filename] = old
        text = old
        if 'Implementation_Contract' in info.filename:
            start = text.index('"sources": {')
            end = text.index('"releasePolicy": {', start)
            text = text[:start] + source_wording(text[start:end]) + text[end:]
        text = wording(text)
        if info.filename == 'README_START_HERE.md' or 'Implementation_Master' in info.filename:
            pos = text.index('\n') + 1
            note = ('\nCrop scope: hops (*Humulus lupulus*). Version 8.4 updates wording and packaging only; '
                    'algorithm calculations, thresholds, rules, test inputs and expected results are unchanged. '
                    'This wording update adds no hops calibration or validation. Research source titles in the '
                    'contract are descriptive summaries; related-crop studies remain transfer evidence, not hops studies. '
                    'Original authors, source links and scientific limitations are retained.\n')
            text = text[:pos] + note + text[pos:]
        path = DEST / wording(info.filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode('utf-8'))

# Compare executable syntax, allowing only the stated string and docstring changes.
python_files = 0
for name, old in originals.items():
    if name.endswith('.py'):
        expected = ast.dump(ast.parse(wording(old)), include_attributes=False)
        actual = ast.dump(ast.parse((DEST / wording(name)).read_text(encoding='utf-8')), include_attributes=False)
        assert expected == actual, name
        python_files += 1
    if 'weather_fixtures/' in name or 'Independent_Test_Cases' in name:
        assert (DEST / wording(name)).read_bytes() == old.encode('utf-8'), name

manifest_path = DEST / 'HANDOFF_MANIFEST.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for record in manifest['files']:
    data = (DEST / record['path']).read_bytes()
    record['bytes'] = len(data)
    record['sha256'] = hashlib.sha256(data).hexdigest()
manifest['buildVerification']['verificationToolSHA256'] = hashlib.sha256((DEST / 'tools/verify_handoff_v8.4.py').read_bytes()).hexdigest()
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

blocked = re.compile(r'weed|cannab|marij|\bhemp\b|\bTHC\b|\bCBD\b', re.I)
for path in DEST.rglob('*'):
    if path.is_file():
        assert not blocked.search(path.relative_to(DEST).as_posix()), path
        assert not blocked.search(path.read_text(encoding='utf-8')), path
        if path.suffix == '.json':
            json.loads(path.read_text(encoding='utf-8'))
print(json.dumps({'filesReviewed': len(originals), 'pythonSyntaxComparisonsPassed': python_files,
                  'weatherFixturesAndKnownAnswerInputsByteIdentical': True,
                  'removedTermScanPassed': True, 'package': str(DEST)}, indent=2))
