import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { words } from "./dictionary.ts";
import type { PairWord } from "./pairwise.ts";

export function evaluationPage(
  seed = "mochitako-v1",
  token: string | null = null,
  vocabulary: PairWord[] = words,
) {
  const engine = stripTypeScriptTypes(
    readFileSync(new URL("./pairwise.ts", import.meta.url), "utf8"),
  ).replace(/^export /gm, "");
  const corpusHash = createHash("sha256")
    .update(JSON.stringify(vocabulary))
    .digest("hex");
  const payload = JSON.stringify({
    words: vocabulary,
    corpusHash,
    seed,
    token,
  }).replaceAll("<", "\\u003c");
  return readFileSync(
    new URL("../evaluation/pairwise.html", import.meta.url),
    "utf8",
  )
    .replace("/* ENGINE */", () => engine)
    .replace("/* PAYLOAD */", () => `const data = ${payload};`);
}
