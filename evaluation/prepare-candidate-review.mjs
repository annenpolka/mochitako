import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { words } from '../src/dictionary.ts';
import { createPairwiseEngine } from '../src/pairwise.ts';

// Selection is explicit and reviewable; this script does not score words.
const root = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw Error('Usage: node evaluation/prepare-candidate-review.mjs <evidence-directory>');
const selection = JSON.parse(readFileSync(join(root, 'selection.json'), 'utf8'));
const selected = selection.selected;
const normalize = s => s.normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 96));
const seenValues = new Set(words.map(w => w.value));
const seenReadings = new Set(words.map(w => normalize(w.reading)));
if (selected.length !== 50) throw Error('Expected 50 selected candidates');
for (const c of selected) {
  if (!/^[a-z]+$/.test(c.value) || !c.reading || seenValues.has(c.value) || seenReadings.has(normalize(c.reading))) throw Error(`Duplicate or invalid candidate: ${c.value}`);
  if (!words.some(w => w.value === c.control && w.roles.includes('suffix'))) throw Error(`Invalid control: ${c.control}`);
  seenValues.add(c.value); seenReadings.add(normalize(c.reading));
}
const vocabulary = [...words, ...selected.map(c => ({ value: c.value, reading: c.reading, roles: ['suffix'] }))];
const hash = createHash('sha256').update(JSON.stringify(vocabulary)).digest('hex');
const seed = 'mochitako-candidates-v2-50';
const engine = createPairwiseEngine(vocabulary, hash, seed);
const sound = ['mochimochi','kosokoso','yurayura','nukunuku','korokoro','nemunemu','kurukuru','pukapuka','tokotoko','fuwafuwa'];
const scene = ['hidamari','komorebi','amefuri','hoshizora','soyokaze','minamo','tsukiyo','haru','yuuyake','konayuki'];
const comparisons = [];
// Interleave candidate domains in selection.json. Separate each candidate's two
// contexts by 50 questions, and reverse its side for the second context.
for (let context = 0; context < 2; context++) {
  for (let i = 0; i < selected.length; i++) {
    const candidate = selected[i];
    const prefix = (context ? scene : sound)[i % 10];
    if (!words.some(w => w.value === prefix && w.roles.includes('prefix'))) throw Error(`Invalid prefix: ${prefix}`);
    const candidateSide = (i + context) % 2 ? 'b' : 'a';
    const a = `${prefix}-${candidateSide === 'a' ? candidate.value : candidate.control}`;
    const b = `${prefix}-${candidateSide === 'b' ? candidate.value : candidate.control}`;
    comparisons.push({ candidate: candidate.value, control: candidate.control, prefix, candidateSide, question: { a, b, mode: 'suffix', answer: null } });
  }
}
const state = engine.validate({ ...engine.empty(), review: { title: '新候補50語・100問' }, questions: comparisons.map(c => c.question) });
for (const [name, value] of [['review-bundle.json', { words: vocabulary, seed, state }], ['comparisons.json', comparisons]]) {
  writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
console.log(`Prepared ${selected.length} candidates / ${state.questions.length} comparisons`);
