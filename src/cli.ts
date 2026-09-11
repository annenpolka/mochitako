import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };
import { generateMany } from "./generator.ts";
import type { Vibe } from "./types.ts";
import { isVibe, VIBES } from "./vibes.ts";

function fail(message: string): never {
  console.error(`mochitako: ${message}`);
  process.exit(1);
}

function parseVibe(raw: string | undefined): Vibe | undefined {
  if (raw === undefined) return undefined;
  if (isVibe(raw)) return raw;
  fail(`unknown vibe "${raw}" (choose from: ${VIBES.join(", ")})`);
}

function parseChaos(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const chaos = Number(raw);
  if (!Number.isFinite(chaos) || chaos < 0 || chaos > 1) {
    fail(`chaos must be between 0 and 1, got "${raw}"`);
  }
  return chaos;
}

function parseCount(raw: string): number {
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1) {
    fail(`count must be a positive integer, got "${raw}"`);
  }
  return count;
}

const main = defineCommand({
  meta: {
    name: "mochitako",
    version: pkg.version,
    description: "Cute random slug generator — Docker-style names, but mochi.",
  },
  args: {
    vibe: {
      type: "string",
      description: `Word mood filter (${VIBES.join(" | ")})`,
    },
    chaos: {
      type: "string",
      description: "How often each word may ignore the vibe filter (0.0–1.0)",
    },
    seed: {
      type: "string",
      description: "Seed for deterministic output",
    },
    count: {
      type: "string",
      alias: "n",
      default: "1",
      description: "Number of slugs to generate",
    },
  },
  run({ args }) {
    const vibe = parseVibe(args.vibe);
    const chaos = parseChaos(args.chaos);
    const count = parseCount(args.count);
    const slugs = generateMany(count, { vibe, chaos, seed: args.seed });
    for (const slug of slugs) console.log(slug);
  },
});

runMain(main);
