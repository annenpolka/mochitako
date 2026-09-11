"""Freeze explicit human sessions for editing, not evaluator validation or generation."""
import collections
import hashlib
import json
import pathlib

root = pathlib.Path('evaluation/results')
out = root / 'editorial-v1'
out.mkdir(exist_ok=True)
# The last source is the explicitly requested re-review of five older questions.
seeds = ['mochitako-v1', 'mochitako-validation-v2-1', 'mochitako-candidates-v1', 'mochitako-candidates-v2-50', 'mochitako-tie-review-v1']
sources = {}
for p in root.glob('*.json'):
    d = json.loads(p.read_text())
    seed = d.get('state', {}).get('seed')
    if seed in seeds:
        if seed in sources:
            raise ValueError(f'Duplicate session {seed}')
        sources[seed] = (p, d)
assert set(sources) == set(seeds)
records = {}
provenance = []
for seed in seeds:
    path, saved = sources[seed]
    provenance.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'revision': saved['revision'], 'seed': seed})
    for index, q in enumerate(saved['state']['questions']):
        if q['answer'] is None:
            continue
        names = tuple(sorted([q['a'], q['b']]))
        key = '/'.join(names)
        label = q[q['answer']] if q['answer'] in ('a', 'b') else q['answer']
        row = records.setdefault(key, {'names': list(names), 'observations': []})
        row['observations'].append({'seed': seed, 'index': index, 'label': label})
        row['currentLabel'] = label
result = {'purpose': 'Human editorial references only; previously used evaluation items are now development material.', 'sources': provenance, 'uniqueComparisons': len(records), 'counts': dict(collections.Counter('tie' if r['currentLabel'] == 'tie' else 'skip' if r['currentLabel'] == 'skip' else 'directional' for r in records.values())), 'records': list(records.values()), 'humanExplanations': json.loads((root / 'human-anchors/scene-sound-v1.json').read_text())}
path = out / 'human-evidence.json'
if path.exists():
    assert json.loads(path.read_text()) == result, 'Evidence changed; use a new editorial version'
else:
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ['uniqueComparisons', 'counts']}, ensure_ascii=False))
