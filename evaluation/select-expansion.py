"""Apply explicit editorial decisions to frozen proposals; emit a reviewable corpus."""
import collections
import copy
import json
import pathlib
import re
import unicodedata

root = pathlib.Path('evaluation/results/expansion-500-v1')
base = json.loads((root / 'before.json').read_text())
normalize = lambda s: ''.join(chr(ord(c)-96) if 'ァ' <= c <= 'ヶ' else c for c in unicodedata.normalize('NFKC', s))
fix_values = {'sekiro':'sekirei', 'shichimencho':'shichimenchou', 'kikyo':'kikyou', 'fukinoto':'fukinotou', 'kare':'karee', 'suteki':'suteeki', 'soseji':'sooseeji', 'bekon':'beekon', 'shuukurimu':'shuukuriimu', 'kohi':'koohii', 'kyuri':'kyuuri', 'zokin':'zoukin', 'hamonika':'haamonika', 'rikooda':'rikoodaa', 'korogi':'koorogi', 'nyaanya':'nyaanyaa', 'kyusu':'kyuusu', 'gyoza':'gyouza', 'shumai':'shuumai', 'shoyu':'shouyu', 'natto':'nattou', 'omurice':'omuraisu', 'kangaroo':'kangaruu'}
exclude_prefix = set('zudon bishibishi mechakucha guchagucha sutonsuton koronkoron gorongoron boroboro girigiri gakuri hetoheto chiin katai atsui kayui usui fukai hosoi nagai mijikai omoi nigai karai oishii tanoshii ureshii kawaii yasashii yowai tsuyoi hayai osoi chikai tooi hiroi semai kurai omoshiroi surudoi nibui shikkari kichinto dokkiri kogitsune kousagi koneko korisu koropokkuru chiri hokori hinagata okane koro ima kyou minna kodomo akachan aji botan nagareboshi enishi kimochi tezawari'.split())
exclude_suffix = set('houchou hari tab i ranpu himatsubushi noroma nukegara ikimono kotowaza yumemiru yasashii tanoshii ureshii shiawase nadenade gashan dosadosa batabata'.split())
exclude_suffix.discard('tab');exclude_suffix.discard('i');exclude_suffix.add('tabi')
# Avoid treating adverbs, textures and adjectives as trailing nouns; retain
# common event nouns such as kakurenbo and akubi instead.
exclude_suffix.update('chirinchirin gatangoton karankoron kerokero kokekokko moomoo nyaanyaa wanwan chunchun peropero mogumogu pakupaku gokugoku waiwai zawazawa harahara sowasowa pukupuku mukumuku nurunuru betabeta kochikochi paripari sakusaku fukafuka gasagasa zarazara nebaneba'.split())
repair_vibes = {
'mogumogu':['motion','happy'], 'gokugoku':['motion'], 'zuruzuru':['motion','weird'], 'sakusaku':['happy'], 'karikari':['motion'], 'paripari':['motion'], 'hokuhoku':['happy','fluffy'], 'torotoro':['sleepy','fluffy'], 'jimejime':['weather'], 'gangan':['motion'], 'zawazawa':['nature','motion'], 'shinshin':['weather','sleepy'], 'gatsugatsu':['motion'], 'perori':['motion','happy'], 'buubuu':['motion'],
'koorogi':['nature','tiny'], 'kirigirisu':['nature','tiny'], 'matsumushi':['nature','tiny'], 'taiko':['motion','happy'], 'fue':['motion','tiny'], 'koto':['mysterious'], 'shamisen':['motion'], 'suzu':['tiny'], 'haamonika':['motion','tiny'], 'piano':['happy'], 'gitaa':['motion'], 'baiorin':['mysterious'], 'rikoodaa':['motion'], 'tanbarin':['motion','happy'], 'geta':['motion']}
exclude_prefix.update(['shikushiku', 'ohashi'])
exclude_suffix.update(['kyandoru', 'aburaage', 'oshiruko', 'hama', 'ukkari', 'tezukuri'])
rejected=[]; corrections=[]; pools={}
allowed = json.loads(pathlib.Path('schema/words.schema.json').read_text())['$defs']['word']['properties']
for role in ['prefix','suffix']:
    run=json.loads((root / role / 'result.json').read_text()); text=run['finalMessage'].strip()
    text=re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    raw=json.loads(text)['words']; pools[role]=[]
    for proposal in raw:
        w={k:proposal[k] for k in ['value','reading','kind','vibes']};old=copy.deepcopy(w)
        w['value']=fix_values.get(w['value'],w['value'])
        if w['value'] in (exclude_prefix if role=='prefix' else exclude_suffix):
            rejected.append({'role':role,'word':old,'reason':'Editorial hold: harsh/general/redundant expression, homograph conflict, or poor slot fit'})
            continue
        if w['value'] in repair_vibes:w['vibes']=repair_vibes[w['value']]
        w['vibes']=list(dict.fromkeys(w['vibes']))
        if any(v not in allowed['vibes']['items']['enum'] for v in w['vibes']):raise ValueError(w)
        if w['value']=='biidama':w['reading']='びーだま'
        if w['value']=='keshigomu':w['reading']='けしゴム'
        w['roles']=[role]
        if w!=dict(old,roles=[role]):corrections.append({'role':role,'before':old,'after':w})
        pools[role].append(w)
# Restore editorial draft variety and clear word identity before considering
# further model proposals. These drafts were informed by local human examples.
drafts=json.loads(pathlib.Path('evaluation/results/editorial-v1/candidates.json').read_text())['candidates']
draft_vibes={
'food':['weird'], 'object':['tiny'], 'nature':['nature'], 'creature':['nature']}
draft_specific={'hankachi':['tiny'], 'tebukuro':['fluffy'], 'nagagutsu':['weather'], 'ohagi':['sweet'], 'kintsuba':['sweet'], 'tamago':['tiny'], 'makura':['sleepy','fluffy'], 'zabuton':['fluffy','sleepy'], 'boushi':['happy'], 'erimaki':['fluffy'], 'tsumiki':['tiny','happy'], 'tegami':['mysterious'], 'kitte':['tiny'], 'takarabako':['mysterious'], 'yakiimo':['sweet'], 'koumori':['mysterious'], 'shirasu':['tiny','nature']}
draft_words=[]
for c in drafts:
    w={k:c[k] for k in ['value','reading','kind','roles']};w['value']={'tofu':'toufu'}.get(w['value'],w['value']);w['vibes']=draft_specific.get(w['value'],draft_vibes[w['kind']]);draft_words.append(w)
pools['suffix']=draft_words+pools['suffix']
# Concrete adverbs from the suffix proposals belong in the prefix pool.
for value,reading,kind,vibes in [
('chirinchirin','ちりんちりん','sound',['tiny','motion']),('gatangoton','がたんごとん','sound',['motion']),('karankoron','からんころん','sound',['motion']),('moomoo','モーモー','sound',['happy']),('peropero','ぺろぺろ','motion',['motion','happy']),('waiwai','わいわい','mood',['happy']),('pukupuku','ぷくぷく','texture',['fluffy']),('kochikochi','こちこち','texture',['weird']),('fukafuka','ふかふか','texture',['fluffy','sleepy']),('nadenade','なでなで','motion',['happy']),('yumemiru','ゆめみる','mood',['sleepy','mysterious']),('oshaberi','おしゃべり','mood',['happy']),('tezukuri','てづくり','trait',['happy']),('yorimichi','よりみち','concept',['motion','nature']),('sukkiri','すっきり','mood',['happy']),('sappari','さっぱり','texture',['happy']),('hinyari','ひんやり','texture',['weather']),('poyopoyo','ぽよぽよ','texture',['fluffy']),('meromero','めろめろ','mood',['happy']),('ukauka','うかうか','mood',['weird'])]:
    pools['prefix'].insert(0,dict(value=value,reading=reading,kind=kind,vibes=vibes,roles=['prefix']))
selected={}; counts={};seen_base_values={w['value']for w in base};seen_base_readings={normalize(w['reading'])for w in base}
for role,target in [('prefix',350),('suffix',330)]:
    selected[role]=[];seen_values=set(seen_base_values);seen_readings=set(seen_base_readings)
    for w in pools[role]:
        if w['value']in seen_values or normalize(w['reading'])in seen_readings:
            rejected.append({'role':role,'word':w,'reason':'Existing or repeated value/normalized reading'});continue
        seen_values.add(w['value']);seen_readings.add(normalize(w['reading']))
        selected[role].append(w)
    counts[role]=len(selected[role])
    if len(selected[role])<target:raise ValueError((role,len(selected[role]),target))
    all_valid = selected[role][:]
    if role == 'suffix':
        # Keep the local editorial draft, then spread the remaining slots across
        # lexical categories so model output order does not bury instruments,
        # objects and event nouns at the end of the list.
        draft_values = {w['value'] for w in draft_words}
        head = [w for w in selected[role] if w['value'] in draft_values]
        buckets = collections.defaultdict(list)
        for w in selected[role]:
            if w['value'] not in draft_values: buckets[w['kind']].append(w)
        tail = []
        while any(buckets.values()):
            for kind in ['creature','nature','food','object','concept','sound','motion','mood','texture','trait']:
                if buckets[kind]: tail.append(buckets[kind].pop(0))
        selected[role] = (head + tail)[:target]
    else:
        selected[role]=selected[role][:target]
    chosen_values = {w['value'] for w in selected[role]}
    for w in all_valid:
        if w['value'] not in chosen_values: rejected.append({'role':role,'word':w,'reason':'Beyond current target; hold, not quality rejection'})
# Same lexical item may occupy both roles; choose one spelling, but flag kind
# disagreements for caller review instead of silently merging homographs.
corpus=copy.deepcopy(base);by_read={normalize(w['reading']):w for w in corpus};by_val={w['value']:w for w in corpus};conflicts=[]
for role in ['prefix','suffix']:
    for w in selected[role]:
        old=by_read.get(normalize(w['reading'])) or by_val.get(w['value'])
        if old:
            if old['kind']!=w['kind']:conflicts.append({'kept':copy.deepcopy(old),'other':w})
            old['roles']=list(dict.fromkeys(old['roles']+[role]));old['vibes']=list(dict.fromkeys(old['vibes']+w['vibes']))
        else:
            w=copy.deepcopy(w);corpus.append(w);by_read[normalize(w['reading'])]=w;by_val[w['value']]=w
# Explicit lexical choices after inspecting both role proposals.
kind_fixes = {'hanabi':'object','oshaberi':'concept','nabe':'object','konbu':'food','nori':'food','donburi':'object','hokora':'object','torii':'object','amai':'trait','suppai':'trait','suzushii':'trait','samui':'trait','mabushii':'trait','akarui':'trait','hitahita':'motion','bukubuku':'motion','nodoka':'mood','wazuka':'trait'}
vibe_fixes = {'chimaki':['nature'], 'engawa':['nature','sleepy'], 'roji':['nature','mysterious'], 'oage':['happy'], 'hanpen':['fluffy'], 'chikuwa':['weird'], 'kamaboko':['happy'], 'oden':['happy'], 'soboro':['tiny'], 'shittori':['sleepy']}
for w in corpus[len(base):]:
    if w['value'] in kind_fixes: w['kind'] = kind_fixes[w['value']]
    if w['value'] in vibe_fixes: w['vibes'] = vibe_fixes[w['value']]
assert corpus[:len(base)]==base
out={'countsBeforeSelection':counts,'selected':selected,'corpus':corpus,'conflicts':conflicts,'conflictResolutions':kind_fixes,'vibeEdits':vibe_fixes,'corrections':corrections,'rejected':rejected}
(root/'selection.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('Available',counts,'corpus',len(corpus),'roles',{r:sum(r in w['roles']for w in corpus)for r in ['prefix','suffix']})
print('Kind conflicts:',[(x['kept']['value'],x['kept']['kind'],x['other']['kind'])for x in conflicts])
