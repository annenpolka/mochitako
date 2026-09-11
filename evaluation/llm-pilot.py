"""Prepare a frozen preference pilot; evaluator workspaces never contain holdout labels."""
import hashlib
import json
import pathlib
import sys
import tempfile
from datetime import datetime, timezone


def digest(value):
    return hashlib.sha256(value).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def prepare(source):
    source = pathlib.Path(source).resolve()
    raw = source.read_bytes()
    saved = json.loads(raw)
    questions = saved['state']['questions']
    assert len(questions) == 100 and all(q['answer'] in ('a', 'b') for q in questions)
    assert len({tuple(sorted((q['a'], q['b']))) for q in questions}) == 100
    corpus = json.loads(pathlib.Path('data/words.json').read_text())['words']
    readings = {w['value']: w['reading'] for w in corpus}
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out = pathlib.Path('evaluation/results') / ('pilot-' + stamp)
    out.mkdir(mode=0o700)
    (out / 'source.json').write_bytes(raw)
    # Stable hash shuffle, chosen before seeing validation predictions; not tuned to labels.
    indexes = sorted(range(100), key=lambda i: digest(('mochitako-pilot-v1:' + '/'.join(sorted((questions[i]['a'], questions[i]['b'])))).encode()))
    train, test = indexes[:60], indexes[60:]
    def display(q, label=False):
        d = {k:q[k] for k in ('a', 'b')}
        for side in ('a','b'):
            d[side + '_reading'] = '・'.join(readings[w] for w in q[side].split('-'))
        if label: d['winner'] = q['answer']
        return d
    tasks, answers = [], {}
    for n,i in enumerate(test):
        ident = f'q{n+1:03d}'
        tasks.append({'id':ident, **display(questions[i])})
        answers[ident] = {'winner':questions[i]['answer'], 'sourceIndex':i, 'mode':questions[i]['mode']}
    reverse = {}
    for n,i in enumerate(test[:8]):
        q=questions[i]
        ident=f's{n+1:03d}'
        tasks.append({'id':ident, **display({'a':q['b'],'b':q['a']})})
        reverse[ident]=f'q{n+1:03d}'
    tasks.sort(key=lambda q:digest(('presentation-v1:'+q['id']).encode()))
    examples=[display(questions[i],True) for i in train]
    common='''This is a closed-book preference prediction task, not a coding task. Do not use tools, read files, inspect the environment, edit anything, browse, or ask questions. All necessary information is below. Return only the requested JSON as your final response.\nPredict which Japanese-inspired two-word name a particular human would personally prefer. The project is mochitako: cute, concrete or evocative, sometimes slightly strange names. Strange is not automatically bad, and conventional cuteness is not automatically best. The human chooses intuitively between A and B. Predict this person's choice, not objective safety or a numeric quality score. Even if uncertain, choose a or b. The two names may differ in only one slot or in both.\nOutput exactly {"predictions":[{"id":"...","winner":"a"}]} with every task ID exactly once. No prose, reasoning, scores, or code fences.\n'''
    manifest={'schema':'mochitako-pilot.v1','sourceSha256':digest(raw),'sourceRevision':saved['revision'],'corpusHash':saved['state']['corpusHash'],'trainIndexes':train,'testIndexes':test,'answers':answers,'reverse':reverse,'runs':{},'protocol':{'primary':'correct / 40 on canonical holdout; invalid/missing counts as incorrect','secondary':'role counts, paired gains/losses, swapped-order consistency within same prompt (not independent runs)','budget':'four independent sessions only; no all-corpus expansion','success':'exploratory: compare example condition to same-model baseline; no automatic adoption threshold','limits':['single human','adaptive source sampling','word overlap across splits allowed','same-prompt swap probes are weak diagnostics','no repeated model trials','agent harnesses differ between models']}}
    for model in ('deepseek','devin'):
        for condition in ('zero','few'):
            name=f'{model}-{condition}'
            workspace=pathlib.Path(tempfile.mkdtemp(prefix=f'mochitako-{name}-'))
            prompt=common
            if condition=='few':prompt+='\nHuman preference examples (not test answers):\n'+json.dumps(examples,ensure_ascii=False)+'\n'
            else:prompt+='\nNo human preference examples are supplied. Use your best prior judgment.\n'
            prompt+='\nTasks:\n'+json.dumps(tasks,ensure_ascii=False)+'\n'
            brief=workspace/'brief.txt';brief.write_text(prompt)
            manifest['runs'][name]={'workspace':str(workspace),'brief':str(brief),'briefSha256':digest(prompt.encode())}
            (out/f'{name}-brief.txt').write_text(prompt)
    dump(out/'manifest.json',manifest)
    print(out.resolve())


if __name__=='__main__':
    prepare(sys.argv[1])
