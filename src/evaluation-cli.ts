import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { words } from "./dictionary.ts";
import { corpusHash, pairs, summarize, validateReview } from "./evaluation.ts";
import { evaluationPage } from "./evaluation-page.ts";
import { createPairwiseEngine } from "./pairwise.ts";

const [command = "prepare", argument] = process.argv.slice(2);
const out = resolve("evaluation/output");
mkdirSync(out, { recursive: true });
if (command === "prepare") {
  writeFileSync(
    `${out}/pairs.csv`,
    `${[
      "prefix,suffix,reading,length,sameWord",
      ...pairs.map(
        (p) => `${p.prefix},${p.suffix},${p.reading},${p.length},${p.sameWord}`,
      ),
    ].join("\n")}\n`,
  );
  writeFileSync(
    `${out}/baseline.json`,
    `${JSON.stringify(summarize(), null, 2)}\n`,
  );
  writeFileSync(`${out}/review.html`, evaluationPage(argument));
  console.log(
    `Wrote ${pairs.length} pairs, baseline.json and review.html to ${out}`,
  );
} else if (command === "report" && argument) {
  const saved = JSON.parse(readFileSync(resolve(argument), "utf8"));
  const input = saved?.state ?? saved;
  let report: unknown;
  if (input?.version === 2) {
    if (typeof input.seed !== "string") throw Error("Missing seed");
    const engine = createPairwiseEngine(words, corpusHash, input.seed);
    const state = engine.validate(input);
    report = {
      corpusHash,
      seed: input.seed,
      ...engine.stats(state),
      comparisons: state.questions,
      acceptableRate: null,
      effectiveCombinationCount: null,
      caveat:
        "Relative preferences only. Word counts depend on opponents; skips are not losses. No global ranking or acceptance rate inferred.",
    };
  } else report = summarize(validateReview(input));
  writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${out}/report.json`);
} else {
  throw new Error(
    "Usage: pnpm eval:pairs [seed] | pnpm eval:report <review.json>",
  );
}
