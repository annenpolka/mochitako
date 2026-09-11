import { describe, expect, it } from "vitest";
import { prefixes, suffixes } from "../src/dictionary.ts";
import {
  createReview,
  pairs,
  sample,
  summarize,
  validateReview,
} from "../src/evaluation.ts";

describe("dictionary evaluation", () => {
  it("enumerates the Cartesian product including identical words", () => {
    expect(pairs).toHaveLength(prefixes.length * suffixes.length);
    expect(new Set(pairs.map((p) => p.id)).size).toBe(pairs.length);
    expect(pairs.some((p) => p.id === "purin-purin" && p.sameWord)).toBe(true);
  });
  it("draws reproducible distinct samples", () => {
    expect(sample("a")).toEqual(sample("a"));
    expect(sample("a")).not.toEqual(sample("b"));
    expect(new Set(sample("a").map((p) => p.id)).size).toBe(100);
    expect(() => sample("a", pairs.length + 1)).toThrow();
  });
  it("preserves unknowns and keeps partial yields bounded to reviewed pairs", () => {
    const r = createReview("test");
    r.reviewer = "test:synthetic";
    const first = r.ratings[0];
    if (!first) throw new Error("Missing sample");
    first.grade = "excellent";
    first.liked = false;
    first.axes.strange = 0;
    const result = summarize(validateReview(r)).subjective;
    expect(result.reviewed).toBe(1);
    expect(result.likedAnswered).toBe(1);
    expect(result.likedRate).toBe(0);
    expect(result.sampleComplete).toBe(false);
    expect(result.effectiveCombinationCount).toBeNull();
    expect(result.wordYield.filter((w) => w.reviewed === 1)).toHaveLength(2);
    expect(
      result.wordYield
        .filter((w) => w.reviewed === 0)
        .every((w) => w.acceptableYield === null),
    ).toBe(true);
    expect(summarize().subjective.likedRate).toBeNull();
  });
  it("rejects stale, duplicate, changed-sample and invalid judgments", () => {
    const valid = () => ({
      ...createReview("test"),
      reviewer: "test:synthetic",
    });
    const stale = valid();
    stale.corpusHash = "old";
    expect(() => validateReview(stale)).toThrow(/hash/);
    const duplicate = valid();
    duplicate.ratings[1] = duplicate
      .ratings[0] as (typeof duplicate.ratings)[number];
    expect(() => validateReview(duplicate)).toThrow(/sample/);
    const invalid = valid();
    const rating = invalid.ratings[0];
    if (!rating) throw new Error("Missing rating");
    rating.axes.cute = 6;
    expect(() => validateReview(invalid)).toThrow(/cute/);
    const repeated = valid();
    const comparison = repeated.comparisons[0];
    if (!comparison) throw new Error("Missing comparison");
    repeated.comparisons.push({
      a: comparison.b,
      b: comparison.a,
      winner: "tie",
    });
    expect(() => validateReview(repeated)).toThrow(/Duplicate/);
  });
  it("credits a tie equally without counting unanswered comparisons", () => {
    const r = createReview("test");
    r.reviewer = "test:synthetic";
    const comparison = r.comparisons[0];
    if (!comparison) throw new Error("Missing comparison");
    comparison.winner = "tie";
    expect(
      summarize(validateReview(r)).subjective.pairwise.map((p) => p.winRate),
    ).toEqual([0.5, 0.5]);
  });
});
