"""Score only captured final predictions, never synthesize missing model output."""
import collections
import json
import math
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
answers = manifest['answers']
expected = set(answers) | set(manifest['reverse'])
results = {}
run_names = list(manifest['runs'])
if (root / 'v41-runs.json').exists():
    run_names += ['v41-zero', 'v41-few']
for name in run_names:
    paths = sorted((root / name).glob('**/result.json'))
    if not paths:
        results[name] = {'status':'missing'}
        continue
    result = json.loads(paths[0].read_text())
    row = {k:result.get(k) for k in ('status','sessionId','cost','usage','reportedModel','cleanupErrors','model','requestedModel')}
    row['resultPath'] = str(paths[0].relative_to(root))
    row['toolCalls'] = 0
    events = paths[0].parent / 'events.jsonl'
    for line in events.read_text().splitlines():
        try: event = json.loads(line)
        except json.JSONDecodeError: continue
        if event.get('type') == 'tool_use': row['toolCalls'] += 1
        update = event.get('message',{}).get('params',{}).get('update',{})
        if update.get('sessionUpdate') == 'tool_call': row['toolCalls'] += 1
        if event.get('type') == 'step_finish': row['usage'] = event.get('part',{}).get('tokens')
    if row['status'] not in ('completed','turn_completed'):
        row['error'] = result.get('errors') or result.get('error')
        results[name] = row
        continue
    try:
        predictions = json.loads(result['finalMessage'])['predictions']
        assert isinstance(predictions,list)
        counts = collections.Counter(p.get('id') for p in predictions if isinstance(p,dict))
        pred = {p['id']:p['winner'] for p in predictions if isinstance(p,dict) and p.get('id') in expected and counts[p['id']] == 1 and p.get('winner') in ('a','b')}
        extra = [p for p in predictions if not isinstance(p,dict) or p.get('id') not in expected]
        row['invalidOrMissing'] = len(expected - pred.keys())
        row['extraCount'] = len(extra)
        row['formatValid'] = set(pred) == expected and not extra and len(predictions) == len(expected)
    except (ValueError,KeyError,AssertionError,TypeError):
        pred = {}; row['formatValid'] = False; row['invalidOrMissing'] = len(expected)
    correct = {ident:pred.get(ident) == truth['winner'] for ident,truth in answers.items()}
    n=len(answers); k=sum(correct.values()); rate=k/n; z=1.96
    center=(rate+z*z/(2*n))/(1+z*z/n)
    radius=z*math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/(1+z*z/n)
    row.update(correct=k,total=n,accuracy=rate,wilson95=[center-radius,center+radius],predictions=pred,
        correctById=correct, leftChoices=sum(pred.get(i)=='a' for i in answers),
        swapConsistent=sum(pred.get(a) in ('a','b') and pred.get(b) in ('a','b') and pred[a]!=pred[b] for a,b in manifest['reverse'].items()),swapTotal=len(manifest['reverse']))
    row['byMode']={mode:{'correct':sum(correct[i] for i,t in answers.items() if t['mode']==mode),'total':sum(t['mode']==mode for t in answers.values())} for mode in ('prefix','suffix','whole')}
    results[name]=row
paired={}
for model in ('deepseek','devin','v41'):
    if model+'-zero' not in results or model+'-few' not in results: continue
    zero,few=(results[model+'-'+c] for c in ('zero','few'))
    if 'correctById' not in zero or 'correctById' not in few: continue
    improved=[i for i in answers if not zero['correctById'][i] and few['correctById'][i]]
    regressed=[i for i in answers if zero['correctById'][i] and not few['correctById'][i]]
    changed=len(improved)+len(regressed)
    p=min(1,2*sum(math.comb(changed,k) for k in range(min(len(improved),len(regressed))+1))/2**changed) if changed else 1
    paired[model]={'improved':improved,'regressed':regressed,'net':len(improved)-len(regressed),'mcnemarExactP':p}
summary={'sourceRevision':manifest['sourceRevision'],'sourceSha256':manifest['sourceSha256'],'trainingCount':manifest.get('trainingCount',60),'holdoutCount':len(answers),'humanLeftChoices':sum(a['winner']=='a' for a in answers.values()),'results':results,'paired':paired,'actualBilling':None,'limits':manifest['protocol']['limits']}
if 'development' in manifest.get('schema', ''):
    summary['evaluationKind'] = 'development'
    summary['holdoutCount'] = 0
    summary['historicalComparisonCount'] = len(answers)
    summary['metricMeaning'] = 'Agreement with historical binary labels, not fresh validation accuracy; re-reviewed ties remain separately identified.'
    summary['calibrationIds'] = manifest.get('calibrationIds', [])
    summary['revisedIds'] = manifest.get('revisedIds', [])
retry_path = root / 'deepseek-few-retry/result.json'
if retry_path.exists():
    retry = json.loads(retry_path.read_text())
    summary['retry'] = {k:retry.get(k) for k in ('status','sessionId','cost','errors','resumed')}
audit_path = root / 'process-audit.json'
if audit_path.exists():
    summary['processAudit'] = json.loads(audit_path.read_text())
(root/'scores.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:{key:v.get(key) for key in ('status','correct','total','accuracy','swapConsistent','toolCalls','cost','usage','formatValid')} for k,v in results.items()},ensure_ascii=False,indent=2))
print('paired',json.dumps(paired))
