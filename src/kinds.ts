import type { Kind } from "./types.ts";

export const KINDS = [
  "texture",
  "mood",
  "motion",
  "sound",
  "nature",
  "food",
  "creature",
  "object",
  "concept",
  "trait",
] as const satisfies readonly Kind[];

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}
