import { prefixes, suffixes } from "./dictionary/index.ts";
import { rngFromSeed } from "./random.ts";
import type { GenerateOptions, Vibe, Word } from "./types.ts";

function resolveRng(options: GenerateOptions): () => number {
  if (options.random) return options.random;
  if (options.seed !== undefined) return rngFromSeed(options.seed);
  return Math.random;
}

function validateChaos(chaos: number): void {
  if (!Number.isFinite(chaos) || chaos < 0 || chaos > 1) {
    throw new RangeError(`chaos must be between 0 and 1, got ${chaos}`);
  }
}

function weightOf(word: Word, chaos: number): number {
  return 1 + (word.weirdness ?? 0) * chaos * 3;
}

function pickWord(
  words: readonly Word[],
  vibe: Vibe | undefined,
  chaos: number,
  rng: () => number,
): Word {
  const filtered =
    vibe === undefined ? words : words.filter((w) => w.vibes.includes(vibe));
  const obeyVibe = vibe !== undefined && filtered.length > 0 && rng() >= chaos;
  const pool = obeyVibe ? filtered : words;

  let total = 0;
  for (const w of pool) total += weightOf(w, chaos);
  let roll = rng() * total;
  for (const w of pool) {
    roll -= weightOf(w, chaos);
    if (roll <= 0) return w;
  }
  const last = pool[pool.length - 1];
  if (!last) throw new Error("word pool is empty");
  return last;
}

function draw(
  vibe: Vibe | undefined,
  chaos: number,
  rng: () => number,
): string {
  const prefix = pickWord(prefixes, vibe, chaos, rng);
  let suffix = pickWord(suffixes, vibe, chaos, rng);
  if (suffix.value === prefix.value) {
    suffix = pickWord(suffixes, vibe, chaos, rng);
  }
  return `${prefix.value}-${suffix.value}`;
}

export function generate(options: GenerateOptions = {}): string {
  const chaos = options.chaos ?? 0;
  validateChaos(chaos);
  return draw(options.vibe, chaos, resolveRng(options));
}

export function generateMany(
  count: number,
  options: GenerateOptions = {},
): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${count}`);
  }
  const chaos = options.chaos ?? 0;
  validateChaos(chaos);
  const rng = resolveRng(options);
  return Array.from({ length: count }, () => draw(options.vibe, chaos, rng));
}

/**
 * A generator with shared options. A bound `seed`/`random` produces a
 * deterministic stream: successive calls advance the same RNG sequence.
 */
export function createGenerator(defaults: GenerateOptions = {}) {
  const rng = resolveRng(defaults);
  return (options: GenerateOptions = {}): string => {
    const merged = { ...defaults, ...options };
    const chaos = merged.chaos ?? 0;
    validateChaos(chaos);
    return draw(merged.vibe, chaos, rng);
  };
}
