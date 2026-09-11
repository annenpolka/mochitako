import { describe, expect, it } from "vitest";
import schema from "../schema/words.schema.json" with { type: "json" };
import {
  isVibe,
  KINDS,
  prefixes,
  suffixes,
  VIBES,
  words,
} from "../src/index.ts";

const wordSchema = schema.$defs.word;

describe("vocabulary corpus", () => {
  it("has unique values across the whole corpus", () => {
    expect(new Set(words.map((w) => w.value)).size).toBe(words.length);
  });

  it("uses lowercase ascii slug-safe values", () => {
    for (const w of words) {
      expect(w.value, w.value).toMatch(/^[a-z]+$/);
    }
  });

  it("gives every word a Japanese reading", () => {
    for (const w of words) {
      expect(w.reading.length, w.value).toBeGreaterThan(0);
      expect(w.reading, w.value).toMatch(
        /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー・]+$/u,
      );
    }
  });

  it("maps each reading to a single value (no duplicate romanizations)", () => {
    const byReading = new Map<string, string>();
    for (const w of words) {
      const normalized = w.reading
        .normalize("NFKC")
        .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 96));
      const existing = byReading.get(normalized);
      expect(
        existing === undefined || existing === w.value,
        `reading "${w.reading}" is shared by "${existing}" and "${w.value}"`,
      ).toBe(true);
      byReading.set(normalized, w.value);
    }
  });

  it("assigns a known kind to every word", () => {
    for (const w of words) {
      expect(KINDS, w.value).toContain(w.kind);
    }
  });

  it("assigns at least one known vibe to every word", () => {
    for (const w of words) {
      expect(w.vibes.length, w.value).toBeGreaterThan(0);
      for (const vibe of w.vibes) {
        expect(isVibe(vibe), `${w.value}: unknown vibe "${vibe}"`).toBe(true);
      }
    }
  });

  it("keeps weirdness within [0, 1] when present", () => {
    for (const w of words) {
      if (w.weirdness !== undefined) {
        expect(w.weirdness, w.value).toBeGreaterThanOrEqual(0);
        expect(w.weirdness, w.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("gives every word at least one valid role", () => {
    for (const w of words) {
      expect(w.roles.length, w.value).toBeGreaterThan(0);
      for (const role of w.roles) {
        expect(["prefix", "suffix"], `${w.value}: ${role}`).toContain(role);
      }
    }
  });

  it("derives prefix and suffix pools from roles", () => {
    expect(prefixes.every((w) => w.roles.includes("prefix"))).toBe(true);
    expect(suffixes.every((w) => w.roles.includes("suffix"))).toBe(true);
    expect(prefixes.length + suffixes.length).toBeGreaterThan(words.length);
  });

  it("covers every vibe on both sides", () => {
    for (const vibe of VIBES) {
      expect(
        prefixes.some((w) => w.vibes.includes(vibe)),
        `no prefix carries vibe "${vibe}"`,
      ).toBe(true);
      expect(
        suffixes.some((w) => w.vibes.includes(vibe)),
        `no suffix carries vibe "${vibe}"`,
      ).toBe(true);
    }
  });

  it("covers every kind on at least one side", () => {
    for (const kind of KINDS) {
      expect(
        words.some((w) => w.kind === kind),
        `no word has kind "${kind}"`,
      ).toBe(true);
    }
  });
});

describe("schema", () => {
  it("stays in sync with the Kind and Vibe enums", () => {
    expect([...wordSchema.properties.kind.enum].sort()).toEqual(
      [...KINDS].sort(),
    );
    expect([...wordSchema.properties.vibes.items.enum].sort()).toEqual(
      [...VIBES].sort(),
    );
    expect([...wordSchema.properties.roles.items.enum].sort()).toEqual(
      ["prefix", "suffix"].sort(),
    );
  });
});
