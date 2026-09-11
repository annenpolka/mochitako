export type Vibe =
  | "sleepy"
  | "fluffy"
  | "happy"
  | "nature"
  | "weather"
  | "motion"
  | "sweet"
  | "mysterious"
  | "tiny"
  | "weird";

export type Kind =
  | "texture"
  | "mood"
  | "motion"
  | "sound"
  | "nature"
  | "food"
  | "creature"
  | "object"
  | "concept"
  | "trait";

/** Which slug slot a word can occupy. */
export type WordRole = "prefix" | "suffix";

export interface Word {
  /** Lowercase ASCII romaji form, safe for slugs and identifiers. */
  value: string;
  /** Japanese orthography (hiragana for native words, katakana for loanwords). */
  reading: string;
  /** Lexical category — what the word denotes. */
  kind: Kind;
  /** Mood tags used by `vibe` filtering. */
  vibes: Vibe[];
  /** 0.0–1.0; how out-of-place the word feels. Boosted by chaos. */
  weirdness?: number;
  /** Slots this word may occupy when composing a slug. */
  roles: WordRole[];
}

export interface GenerateOptions {
  /** Restrict picks to words carrying this vibe (subject to `chaos`). */
  vibe?: Vibe;
  /** 0.0–1.0. Probability that each pick ignores the vibe filter. Default 0. */
  chaos?: number;
  /** Deterministic output when set. */
  seed?: string;
  /** Injectable RNG. Takes precedence over `seed`. */
  random?: () => number;
}
