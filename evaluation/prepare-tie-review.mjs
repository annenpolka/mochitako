import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { words } from '../src/dictionary.ts';
import { corpusHash } from '../src/evaluation.ts';
import { createPairwiseEngine } from '../src/pairwise.ts';

const root = 'evaluation/results/validation-v2/20260911T044255Z';
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`));
const scores = JSON.parse(readFileSync(`${root}/scores.json`));
const source = JSON.parse(readFileSync(`${root}/source.json`));
const seed = 'mochitako-tie-review-v1';
const e = createPairwiseEngine(words, corpusHash, seed);
const chosen = Object.keys(manifest.answers).filter(id => {
  const a = scores.results['deepseek-few'].predictions[id];
  const b = scores.results['devin-few'].predictions[id];
  return a === b && a !== manifest.answers[id].winner;
}).slice(0, 5);
if (chosen.length !== 5) throw Error('Need five disagreements');
const mappings = chosen.map(id => ({ id, sourceIndex: manifest.answers[id].sourceIndex, original: source.state.questions[manifest.answers[id].sourceIndex] }));
const state = e.validate({ ...e.empty(), review: { title: '5問だけ見直し' }, questions: mappings.map(m => ({ ...m.original, answer: null })) });
const key = createHash('sha256').update(`${corpusHash}:${seed}`).digest('hex');
mkdirSync('evaluation/results/tie-review', { recursive: true });
writeFileSync(`evaluation/results/${key}.json`, `${JSON.stringify({revision:1,state,updatedAt:new Date().toISOString(),summary:e.stats(state)},null,2)}\n`, {flag:'wx'});
writeFileSync('evaluation/results/tie-review/manifest.json', JSON.stringify({seed,corpusHash,source:root,mappings,selection:'First five comparisons where both few-shot models disagreed with the original human choice. Targeted diagnostic, not an unbiased accuracy estimate.',rule:'Keep previous answers and scores unchanged. Ties are separate from skips. Do not retrospectively replace benchmark labels or claim increased accuracy.'},null,2)+'\n', {flag:'wx'});
console.log(`Seed: ${seed}\nFile: evaluation/results/${key}.json`);
