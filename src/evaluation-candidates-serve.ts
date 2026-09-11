import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluationServer } from "./evaluation-server.ts";
import type { PairWord } from "./pairwise.ts";
import { createPairwiseEngine } from "./pairwise.ts";

const path = process.argv[2];
if (!path) throw Error("Usage: pnpm eval:candidates <review-bundle.json>");
const bundle = JSON.parse(readFileSync(resolve(path), "utf8"));
const vocabulary: PairWord[] = bundle.words;
if (
  typeof bundle.seed !== "string" ||
  !bundle.seed ||
  !Array.isArray(vocabulary) ||
  !vocabulary.length ||
  vocabulary.some(
    (w) =>
      !w ||
      typeof w.value !== "string" ||
      !/^[a-z]+$/.test(w.value) ||
      typeof w.reading !== "string" ||
      !w.reading ||
      !Array.isArray(w.roles) ||
      !w.roles.length ||
      w.roles.some((role) => !["prefix", "suffix"].includes(role)),
  ) ||
  new Set(vocabulary.map((w) => w.value)).size !== vocabulary.length
)
  throw Error("Invalid review vocabulary");
const hash = createHash("sha256")
  .update(JSON.stringify(vocabulary))
  .digest("hex");
const engine = createPairwiseEngine(vocabulary, hash, bundle.seed);
const state = engine.validate(bundle.state);
if (
  !state.review ||
  state.cursor !== 0 ||
  state.questions.some((q) => q.answer)
)
  throw Error("Expected an unanswered review queue");
const port = Number(process.env.MOCHITAKO_EVAL_PORT ?? 4322);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid port");
const { server, file } = evaluationServer(
  resolve("evaluation/results"),
  bundle.seed,
  vocabulary,
);
if (!existsSync(file))
  writeFileSync(
    file,
    `${JSON.stringify({ revision: 1, state, summary: engine.stats(state) }, null, 2)}\n`,
    { flag: "wx" },
  );
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Open http://127.0.0.1:${port}/\nAnswers: ${file}`);
});
