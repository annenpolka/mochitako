"""Freeze new human answers and reuse the prior prompts without holdout leakage."""
import hashlib
import json
import pathlib
import tempfile
from datetime import datetime, timezone

base = pathlib.Path('evaluation/results')
protocol = json.loads((base / 'validation-v2/protocol.json').read_text())
old = base / 'pilot-20260911T040042Z'
old_manifest = json.loads((old / 'manifest.json').read_text())
old_questions = json.loads((old / 'source.json').read_text())['state']['questions']
old_keys = {tuple(sorted((q['a'],q['b']))) for q in old_questions}
sources = [p for p in base.glob('*.json') if json.loads(p.read_text())['state']['seed'] == protocol['seed']]
assert len(sources) == 1
raw = sources[0].read_bytes()
saved = json.loads(raw)
assert saved['state']['corpusHash'] == protocol['corpusHash']
selected = []
seen = set()
for i,q in enumerate(saved['state']['questions']):
    key = tuple(sorted((q['a'],q['b'])))
    if q['answer'] in ('a','b') and key not in old_keys and key not in seen:
        selected.append((i,q))
        seen.add(key)
assert len(selected) >= 40, f'Need 40 new answered comparisons, have {len(selected)}'
selected = selected[:40]
out = base / 'validation-v2' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
out.mkdir(mode=0o700)
(out/'source.json').write_bytes(raw)
words = json.loads(pathlib.Path('data/words.json').read_text())['words']
readings = {w['value']:w['reading'] for w in words}
def display(q):
    d = {k:q[k] for k in ('a','b')}
    for side in ('a','b'): d[side+'_reading'] = '・'.join(readings[w] for w in q[side].split('-'))
    return d
answers, tasks, reverse = {}, [], {}
for n,(i,q) in enumerate(selected):
    ident=f'q{n+1:03d}'
    answers[ident]={'sourceIndex':i,'winner':q['answer'],'mode':q['mode']}
    tasks.append({'id':ident,**display(q)})
for n,(_,q) in enumerate(selected[:8]):
    ident=f's{n+1:03d}'
    reverse[ident]=f'q{n+1:03d}'
    tasks.append({'id':ident,**display({'a':q['b'],'b':q['a']})})
tasks.sort(key=lambda q:hashlib.sha256(('presentation-v1:'+q['id']).encode()).hexdigest())
manifest={'schema':'mochitako-validation.v2','sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceRevision':saved['revision'],'corpusHash':protocol['corpusHash'],'answers':answers,'reverse':reverse,'runs':{},'protocol':{'limits':['single human','40 new comparisons, one trial per condition','adaptive source sampling','word overlap allowed','same-batch swap probes only','different agent harnesses']},'originalTrainingManifest':str(old/'manifest.json'),'trainingCount':60,'selectedIndexes':[i for i,_ in selected]}
for model in ('deepseek','devin'):
    for condition in ('zero','few'):
        name=f'{model}-{condition}'
        original=(old/f'deepseek-{condition}-brief.txt').read_text()
        prefix=original.split('\nTasks:\n')[0]
        prompt=prefix+'\nTasks:\n'+json.dumps(tasks,ensure_ascii=False)+'\n'
        workspace=pathlib.Path(tempfile.mkdtemp(prefix='mochitako-validation-'+name+'-'))
        brief=workspace/'brief.txt';brief.write_text(prompt)
        manifest['runs'][name]={'workspace':str(workspace),'brief':str(brief),'briefSha256':hashlib.sha256(prompt.encode()).hexdigest(),'promptPrefixSha256':hashlib.sha256(prefix.encode()).hexdigest(),'model':'opencode-go/deepseek-v4.1-flash' if model=='deepseek' else 'swe-2-max'}
        (out/f'{name}-brief.txt').write_text(prompt)
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'root':str(out.resolve()),'runs':manifest['runs']}))
