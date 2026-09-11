import { createHash } from "node:crypto";
import { prefixes, suffixes, words } from "./dictionary.ts";
import { rngFromSeed } from "./random.ts";

export const corpusHash = createHash("sha256")
  .update(JSON.stringify(words))
  .digest("hex");
export const pairs = prefixes.flatMap((prefix) =>
  suffixes.map((suffix) => ({
    id: `${prefix.value}-${suffix.value}`,
    prefix: prefix.value,
    suffix: suffix.value,
    reading: `${prefix.reading}・${suffix.reading}`,
    length: prefix.value.length + suffix.value.length + 1,
    sameWord: prefix.value === suffix.value,
  })),
);
export const grades = ["bad", "meh", "good", "excellent"] as const;
export const axes = [
  "pronounceable",
  "imageable",
  "cute",
  "strange",
  "memorable",
] as const;
export type Grade = (typeof grades)[number];
export interface Rating {
  id: string;
  grade: Grade | null;
  liked: boolean | null;
  axes: Record<(typeof axes)[number], number | null>;
  note: string;
}
export interface Review {
  corpusHash: string;
  seed: string;
  reviewer: string;
  ratings: Rating[];
  comparisons: { a: string; b: string; winner: "a" | "b" | "tie" | null }[];
}
export function sample(seed: string, count = 100) {
  if (!Number.isInteger(count) || count < 1 || count > pairs.length)
    throw new Error("Invalid sample size");
  const pool = [...pairs];
  const random = rngFromSeed(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const left = pool[i];
    const right = pool[j];
    if (left && right) [pool[i], pool[j]] = [right, left];
  }
  return pool.slice(0, count);
}
export function createReview(seed: string): Review {
  const selected = sample(seed);
  return {
    corpusHash,
    seed,
    reviewer: "",
    ratings: selected.map((pair) => ({
      id: pair.id,
      grade: null,
      liked: null,
      axes: {
        pronounceable: null,
        imageable: null,
        cute: null,
        strange: null,
        memorable: null,
      },
      note: "",
    })),
    comparisons: selected.flatMap((pair, i) => {
      const next = selected[i + 1];
      return i % 2 === 0 && next
        ? [{ a: pair.id, b: next.id, winner: null }]
        : [];
    }),
  };
}
export function validateReview(input: unknown): Review {
  if (!input || typeof input !== "object")
    throw new Error("Review must be an object");
  const r = input as Review;
  if (r.corpusHash !== corpusHash)
    throw new Error(
      "Corpus hash mismatch: regenerate the review for this dictionary",
    );
  if (
    typeof r.seed !== "string" ||
    typeof r.reviewer !== "string" ||
    !r.reviewer.trim()
  )
    throw new Error("seed and reviewer are required");
  if (!Array.isArray(r.ratings) || !Array.isArray(r.comparisons))
    throw new Error("Missing ratings/comparisons");
  const expected = sample(r.seed).map((p) => p.id);
  if (
    r.ratings.length !== expected.length ||
    r.ratings.some((v, i) => !v || v.id !== expected[i])
  )
    throw new Error("Ratings must match the seeded sample, in order");
  for (const rating of r.ratings) {
    if (rating.grade !== null && !grades.includes(rating.grade))
      throw new Error(`Invalid grade: ${rating.id}`);
    if (rating.liked !== null && typeof rating.liked !== "boolean")
      throw new Error(`Invalid liked: ${rating.id}`);
    if (typeof rating.note !== "string" || !rating.axes)
      throw new Error(`Invalid rating: ${rating.id}`);
    for (const axis of axes) {
      const value = rating.axes[axis];
      if (
        value !== null &&
        (!Number.isInteger(value) || value < 0 || value > 5)
      )
        throw new Error(`Invalid ${axis}: ${rating.id}`);
    }
  }
  const known = new Set(pairs.map((p) => p.id));
  const seen = new Set<string>();
  for (const c of r.comparisons) {
    if (
      !c ||
      !known.has(c.a) ||
      !known.has(c.b) ||
      c.a === c.b ||
      ![null, "a", "b", "tie"].includes(c.winner)
    )
      throw new Error("Invalid comparison");
    const key = [c.a, c.b].sort().join("/");
    if (seen.has(key)) throw new Error("Duplicate comparison");
    seen.add(key);
  }
  return r;
}
function counts(values: string[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}
export function summarize(review?: Review) {
  const ratings = review?.ratings ?? [];
  const graded = ratings.filter((r) => r.grade !== null);
  const liked = ratings.filter((r) => r.liked !== null);
  const rate = (n: number, d: number) => (d ? n / d : null);
  const yieldFor = (role: "prefix" | "suffix", value: string) => {
    const subset = graded.filter(
      (r) => r.id.split("-")[role === "prefix" ? 0 : 1] === value,
    );
    return {
      role,
      value,
      possible: role === "prefix" ? suffixes.length : prefixes.length,
      reviewed: subset.length,
      grades: counts(
        subset.flatMap((r) => (r.grade === null ? [] : [r.grade])),
      ),
      acceptableYield: rate(
        subset.filter((r) => r.grade === "good" || r.grade === "excellent")
          .length,
        subset.length,
      ),
    };
  };
  const buckets = new Map<string, string[]>();
  for (const word of words) {
    const key = `${word.kind}:${[...word.vibes].sort().join("+")}`;
    buckets.set(key, [...(buckets.get(key) ?? []), word.value]);
  }
  const comparisons =
    review?.comparisons.filter((c) => c.winner !== null) ?? [];
  const wins = new Map<string, { appearances: number; points: number }>();
  for (const c of comparisons) {
    for (const side of ["a", "b"] as const) {
      const stat = wins.get(c[side]) ?? { appearances: 0, points: 0 };
      stat.appearances++;
      stat.points += c.winner === "tie" ? 0.5 : c.winner === side ? 1 : 0;
      wins.set(c[side], stat);
    }
  }
  return {
    corpusHash,
    words: words.length,
    prefixes: prefixes.length,
    suffixes: suffixes.length,
    totalPairs: pairs.length,
    sameWordPairs: pairs.filter((p) => p.sameWord).map((p) => p.id),
    missingWeirdness: words.filter((w) => w.weirdness === undefined).length,
    vibeCoverage: {
      prefix: counts(prefixes.flatMap((w) => w.vibes)),
      suffix: counts(suffixes.flatMap((w) => w.vibes)),
    },
    kindCoverage: counts(words.map((w) => w.kind)),
    pairLengthDistribution: counts(pairs.map((p) => String(p.length))),
    metadataClusters: [...buckets]
      .filter(([, values]) => values.length > 1)
      .map(([key, values]) => ({ key, values }))
      .sort((a, b) => b.values.length - a.values.length),
    caveat:
      "Metadata clusters are review candidates, not measured semantic redundancy. Pair length is not pronunciation quality. Missing weirdness is unknown.",
    subjective: {
      reviewer: review?.reviewer ?? null,
      seed: review?.seed ?? null,
      liked: liked.filter((r) => r.liked).length,
      likedAnswered: liked.length,
      likedRate: rate(liked.filter((r) => r.liked).length, liked.length),
      axes: Object.fromEntries(
        axes.map((axis) => {
          const values = ratings.flatMap((r) =>
            r.axes[axis] === null ? [] : [r.axes[axis]],
          );
          return [
            axis,
            {
              reviewed: values.length,
              mean: values.length
                ? values.reduce((a, b) => a + b, 0) / values.length
                : null,
            },
          ];
        }),
      ),
      sampleComplete: liked.length === 100,
      reviewed: graded.length,
      grades: counts(
        graded.flatMap((r) => (r.grade === null ? [] : [r.grade])),
      ),
      confirmedAcceptable: graded.filter(
        (r) => r.grade === "good" || r.grade === "excellent",
      ).length,
      effectiveCombinationCount: null,
      caveat:
        "Unreviewed pairs remain unknown. Yields describe reviewed pairs only; no corpus-wide success count is inferred. Pairwise win rates depend on opponents and are not a global ranking.",
      wordYield: [
        ...prefixes.map((w) => yieldFor("prefix", w.value)),
        ...suffixes.map((w) => yieldFor("suffix", w.value)),
      ],
      pairwise: [...wins].map(([id, stat]) => ({
        id,
        ...stat,
        winRate: stat.points / stat.appearances,
      })),
    },
  };
}
