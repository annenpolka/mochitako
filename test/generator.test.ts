import { describe, expect, it } from "vitest";
import type { Word } from "../src/index.ts";
import {
  createGenerator,
  generate,
  generateMany,
  prefixes,
  suffixes,
  VIBES,
} from "../src/index.ts";

const prefixMap = new Map(prefixes.map((w) => [w.value, w]));
const suffixMap = new Map(suffixes.map((w) => [w.value, w]));

function parse(slug: string): { prefix: Word; suffix: Word } {
  const [p, s] = slug.split("-");
  const prefix = p === undefined ? undefined : prefixMap.get(p);
  const suffix = s === undefined ? undefined : suffixMap.get(s);
  if (!prefix || !suffix) {
    throw new Error(`slug "${slug}" contains words outside the dictionary`);
  }
  return { prefix, suffix };
}

describe("generate", () => {
  it("produces <prefix>-<suffix> built from the dictionaries", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generate();
      expect(slug).toMatch(/^[a-z]+-[a-z]+$/);
      parse(slug);
    }
  });

  it("honors the vibe filter when chaos is 0", () => {
    for (const vibe of VIBES) {
      for (let i = 0; i < 100; i++) {
        const { prefix, suffix } = parse(generate({ vibe }));
        expect(prefix.vibes, `prefix of ${vibe} slug`).toContain(vibe);
        expect(suffix.vibes, `suffix of ${vibe} slug`).toContain(vibe);
      }
    }
  });

  it("lets words escape the vibe filter when chaos is 1", () => {
    const results = generateMany(200, {
      vibe: "sleepy",
      chaos: 1,
      seed: "chaos",
    });
    const escaped = results.some((slug) => {
      const { prefix, suffix } = parse(slug);
      return (
        !prefix.vibes.includes("sleepy") || !suffix.vibes.includes("sleepy")
      );
    });
    expect(escaped).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    expect(generate({ seed: "tako" })).toBe(generate({ seed: "tako" }));
    expect(generateMany(5, { seed: "tako" })).toEqual(
      generateMany(5, { seed: "tako" }),
    );
  });

  it("differs across seeds", () => {
    expect(generateMany(10, { seed: "tako" })).not.toEqual(
      generateMany(10, { seed: "mochi" }),
    );
  });

  it("rejects out-of-range chaos", () => {
    expect(() => generate({ chaos: -0.1 })).toThrow(RangeError);
    expect(() => generate({ chaos: 1.1 })).toThrow(RangeError);
    expect(() => generate({ chaos: Number.NaN })).toThrow(RangeError);
  });
});

describe("generateMany", () => {
  it("returns exactly count slugs", () => {
    expect(generateMany(7)).toHaveLength(7);
  });

  it("rejects non-positive or fractional counts", () => {
    expect(() => generateMany(0)).toThrow(RangeError);
    expect(() => generateMany(-3)).toThrow(RangeError);
    expect(() => generateMany(1.5)).toThrow(RangeError);
  });
});

describe("createGenerator", () => {
  it("produces an identical stream for identical seeds", () => {
    const a = createGenerator({ seed: "octopus" });
    const b = createGenerator({ seed: "octopus" });
    const streamA = [a(), a(), a()];
    const streamB = [b(), b(), b()];
    expect(streamA).toEqual(streamB);
  });

  it("advances the stream on each call rather than repeating", () => {
    const gen = createGenerator({ seed: "octopus" });
    const stream = [gen(), gen(), gen(), gen(), gen()];
    expect(new Set(stream).size).toBeGreaterThan(1);
  });
});
