import type { Vibe } from "./types.ts";

export const VIBES = [
  "sleepy",
  "fluffy",
  "happy",
  "nature",
  "weather",
  "motion",
  "sweet",
  "mysterious",
  "tiny",
  "weird",
] as const satisfies readonly Vibe[];

export function isVibe(value: string): value is Vibe {
  return (VIBES as readonly string[]).includes(value);
}
