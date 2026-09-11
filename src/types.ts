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

export interface Word {
  value: string;
  vibes: Vibe[];
  /** 0.0–1.0; how out-of-place the word feels. Boosted by chaos. */
  weirdness?: number;
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
