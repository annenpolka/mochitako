import corpus from "../data/words.json" with { type: "json" };
import type { Word } from "./types.ts";

/** The full curated vocabulary. */
export const words: Word[] = corpus.words as Word[];

/** Words that can occupy the leading slot of a slug. */
export const prefixes: Word[] = words.filter((w) => w.roles.includes("prefix"));

/** Words that can occupy the trailing slot of a slug. */
export const suffixes: Word[] = words.filter((w) => w.roles.includes("suffix"));
