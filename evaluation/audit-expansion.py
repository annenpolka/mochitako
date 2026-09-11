"""Audit model proposals without writing the production dictionary."""
import collections
import json
import pathlib
import re
import unicodedata

root = pathlib.Path('evaluation/results/expansion-500-v1')
base = json.loads((root / 'before.json').read_text())
schema = json.loads(pathlib.Path('schema/words.schema.json').read_text())['$defs']['word']['properties']
def norm(s):
    return ''.join(chr(ord(c)-96) if 'ァ' <= c <= 'ヶ' else c for c in unicodedata.normalize('NFKC', s))
for role in ['prefix', 'suffix']:
    result = root / role / 'result.json'
    if not result.exists():
        continue
    run = json.loads(result.read_text())
    assert run['status'] == 'completed', run['status']
    text = run['finalMessage'].strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    data = json.loads(text)['words']
    kept, rejected, values, readings = [], [], {w['value'] for w in base}, {norm(w['reading']) for w in base}
    for index, w in enumerate(data):
        reason = None
        if not isinstance(w, dict) or not isinstance(w.get('value'), str) or not re.fullmatch('[a-z]+', w['value']) or not isinstance(w.get('reading'), str) or not w['reading']:
            reason = 'invalid identity'
        elif w['value'] in values or norm(w['reading']) in readings:
            reason = 'duplicate value or normalized reading'
        elif w.get('kind') not in schema['kind']['enum'] or not isinstance(w.get('vibes'), list) or not w['vibes'] or any(v not in schema['vibes']['items']['enum'] for v in w['vibes']):
            reason = 'invalid metadata'
        if reason:
            rejected.append({'index': index, 'word': w, 'reason': reason})
            continue
        clean = {k: w[k] for k in ['value', 'reading', 'kind', 'vibes']}
        clean['vibes'] = list(dict.fromkeys(clean['vibes']))
        clean['roles'] = [role]
        kept.append(clean); values.add(clean['value']); readings.add(norm(clean['reading']))
    audit = {'role': role, 'received': len(data), 'validUnique': len(kept), 'rejected': rejected, 'candidates': kept, 'model': run['model'], 'sessionId': run['sessionId'], 'cost': run.get('cost')}
    (root / (role + '-audit.json')).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(role, len(data), 'received', len(kept), 'valid/unique', dict(collections.Counter(w['kind'] for w in kept)))
