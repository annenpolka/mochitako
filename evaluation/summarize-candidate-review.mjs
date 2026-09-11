import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createPairwiseEngine } from '../src/pairwise.ts';

if (!process.argv[2]) throw Error('Usage: node evaluation/summarize-candidate-review.mjs <evidence-directory>');
const root = resolve(process.argv[2]);
const bundle = JSON.parse(readFileSync(join(root, 'review-bundle.json'), 'utf8'));
const comparisons = JSON.parse(readFileSync(join(root, 'comparisons.json'), 'utf8'));
const hash = createHash('sha256').update(JSON.stringify(bundle.words)).digest('hex');
const key = createHash('sha256').update(`${hash}:${bundle.seed}`).digest('hex');
const file = resolve('evaluation/results', `${key}.json`);
const saved = JSON.parse(readFileSync(file, 'utf8'));
const state = createPairwiseEngine(bundle.words, hash, bundle.seed).validate(saved.state);
if (comparisons.length !== state.questions.length) throw Error('Comparison count differs');
const rows = new Map();
for (let i = 0; i < comparisons.length; i++) {
  const c = comparisons[i], q = state.questions[i];
  if (c.question.a !== q.a || c.question.b !== q.b || !['a', 'b'].includes(c.candidateSide) || q[c.candidateSide] !== `${c.prefix}-${c.candidate}`) throw Error(`Comparison ${i} differs`);
  if (!rows.has(c.candidate)) rows.set(c.candidate, { candidate: c.candidate, control: c.control, wins: 0, losses: 0, ties: 0, skips: 0, unanswered: 0, contexts: [] });
  const row = rows.get(c.candidate);
  const result = q.answer === null ? 'unanswered' : q.answer === 'tie' ? 'ties' : q.answer === 'skip' ? 'skips' : q.answer === c.candidateSide ? 'wins' : 'losses';
  row[result]++;
  row.contexts.push({ prefix: c.prefix, result });
}
console.log(JSON.stringify({ source: file, revision: saved.revision, cursor: state.cursor, total: comparisons.length, candidates: [...rows.values()], note: 'Two controlled comparisons per candidate; no automatic adoption or corpus-wide yield estimate.' }, null, 2));
