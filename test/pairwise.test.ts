import { describe, expect, it } from "vitest";
import { words } from "../src/dictionary.ts";
import { corpusHash } from "../src/evaluation.ts";
import { createPairwiseEngine } from "../src/pairwise.ts";

const engine = createPairwiseEngine(words, corpusHash, "test");
describe("ten-question pairwise review", () => {
  it("starts with ten distinct controlled comparisons and both roles", () => {
    const state = engine.addRound(engine.empty());
    expect(engine.validate(state)).toEqual(state);
    expect(state.questions).toHaveLength(10);
    expect(state.questions.filter((q) => q.mode === "prefix")).toHaveLength(5);
    expect(state.questions.filter((q) => q.mode === "suffix")).toHaveLength(5);
    expect(engine.addRound(engine.empty())).toEqual(state);
    expect(() => engine.addRound(state)).toThrow();
  });
  it("resumes and corrects an answer without double-counting it", () => {
    let state = engine.addRound(engine.empty());
    state = engine.answer(state, "a");
    const loaded = engine.validate(JSON.parse(JSON.stringify(state)));
    expect(loaded.cursor).toBe(1);
    const before = engine.stats(loaded);
    expect(before.answered).toBe(1);
    expect(before.wordStats.reduce((n, w) => n + w.wins, 0)).toBe(1);
    state = engine.answer(engine.back(loaded), "b");
    expect(engine.stats(state).answered).toBe(1);
    expect(engine.stats(state).wordStats).not.toEqual(before.wordStats);
    state = engine.answer(engine.back(state), "skip");
    expect(engine.stats(state).answered).toBe(0);
    expect(engine.stats(state).skipped).toBe(1);
    expect(engine.stats(state).names).toBe(0);
  });
  it("stops after ten and adds later rounds with occasional whole-name comparisons", () => {
    let state = engine.addRound(engine.empty());
    for (let i = 0; i < 10; i++)
      state = engine.answer(state, i % 2 ? "a" : "skip");
    expect(state.cursor).toBe(10);
    expect(state.questions[state.cursor]).toBeUndefined();
    expect(() => engine.answer(state, "a")).toThrow();
    state = engine.addRound(state);
    expect(state.cursor).toBe(10);
    expect(state.questions).toHaveLength(20);
    expect(state.questions.filter((q) => q.mode === "whole")).toHaveLength(1);
    expect(engine.validate(state)).toEqual(state);
  });
  it("rejects stale hashes, changed controls, and invalid cursors without modifying input", () => {
    const state = engine.addRound(engine.empty());
    const original = JSON.stringify(state);
    expect(() => engine.validate({ ...state, corpusHash: "old" })).toThrow();
    expect(() => engine.validate({ ...state, cursor: 1 })).toThrow();
    expect(() => engine.validate({ ...state, cursor: -1 })).toThrow();
    const wrong = structuredClone(state);
    const first = wrong.questions[0];
    if (!first) throw Error("missing question");
    first.mode = "whole";
    expect(() => engine.validate(wrong)).toThrow();
    expect(JSON.stringify(state)).toBe(original);
  });
  it("maintains valid, non-duplicate questions across 50 rounds", () => {
    let state = engine.empty();
    for (let r = 0; r < 50; r++) {
      state = engine.addRound(state);
      for (let i = 0; i < 10; i++)
        state = engine.answer(state, i % 3 === 0 ? "skip" : i % 2 ? "a" : "b");
    }
    expect(engine.validate(state).questions).toHaveLength(500);
    expect(engine.stats(state).answered).toBe(300);
  });
});

it("counts ties separately from decisive choices and skips, including after correction", () => {
  let state = engine.addRound(engine.empty());
  state = engine.answer(state, "tie");
  state = engine.answer(state, "skip");
  const stats = engine.stats(
    engine.validate(JSON.parse(JSON.stringify(state))),
  );
  expect(stats.answered).toBe(0);
  expect(stats.ties).toBe(1);
  expect(stats.skipped).toBe(1);
  expect(stats.names).toBe(2);
  expect(stats.wordStats).toEqual([]);
  state = engine.answer(engine.back(engine.back(state)), "a");
  expect(engine.stats(state).answered).toBe(1);
  expect(engine.stats(state).ties).toBe(0);
  expect(
    engine.stats(state).wordStats.reduce((sum, w) => sum + w.wins, 0),
  ).toBe(1);
});

it("supports a bounded review without changing original answers", () => {
  const original = engine.addRound(engine.empty());
  const before = JSON.stringify(original);
  let state = {
    ...structuredClone(original),
    review: { title: "5問の見直し" },
    questions: original.questions.slice(0, 5),
  };
  expect(engine.validate(state).questions).toHaveLength(5);
  for (let i = 0; i < 5; i++)
    state = {
      ...engine.answer(state, "tie"),
      review: { title: "5問の見直し" },
    };
  expect(state.cursor).toBe(5);
  expect(engine.stats(state).ties).toBe(5);
  expect(() => engine.addRound(state)).toThrow(/終了/);
  expect(() => engine.validate({ ...state, review: undefined })).toThrow();
  expect(JSON.stringify(original)).toBe(before);
});

it("restores a hundred-question review across round boundaries and stops at its end", () => {
  let prepared = engine.empty();
  for (let round = 0; round < 10; round++) {
    prepared = engine.addRound(prepared);
    for (let i = 0; i < 10; i++) prepared = engine.answer(prepared, "tie");
  }
  let state = engine.validate({
    ...prepared,
    cursor: 0,
    questions: prepared.questions.map((q) => ({ ...q, answer: null })),
    review: { title: "候補100問" },
  });
  for (let i = 0; i < 100; i++) {
    state = engine.answer(state, i % 2 ? "a" : "tie");
    if (i % 10 === 9)
      state = engine.validate(JSON.parse(JSON.stringify(state)));
  }
  expect(state.cursor).toBe(100);
  expect(engine.stats(state).ties).toBe(50);
  expect(engine.stats(state).answered).toBe(50);
  expect(() => engine.addRound(state)).toThrow(/終了/);
  expect(engine.back(state).cursor).toBe(99);
});
