import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { words } from "../src/dictionary.ts";
import { corpusHash } from "../src/evaluation.ts";
import { evaluationServer } from "../src/evaluation-server.ts";
import type { PairWord } from "../src/pairwise.ts";
import { createPairwiseEngine } from "../src/pairwise.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function launch(directory: string, vocabulary: PairWord[] = words) {
  const app = evaluationServer(directory, "test", vocabulary);
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  cleanups.push(
    () =>
      new Promise<void>((resolve, reject) => {
        app.server.closeAllConnections();
        app.server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = app.server.address();
  if (!address || typeof address === "string") throw Error("Missing address");
  const url = `http://127.0.0.1:${address.port}`;
  const html = await (await fetch(url)).text();
  const token = html.match(/"token":"([^"]+)"/)?.[1];
  if (!token) throw Error("Missing token");
  const headers = {
    "Content-Type": "application/json",
    "X-Mochitako-Token": token,
  };
  return { ...app, url, headers, html };
}
function directory() {
  const path = mkdtempSync(join(tmpdir(), "mochitako-server-test-"));
  cleanups.push(async () => rmSync(path, { recursive: true, force: true }));
  return path;
}
describe("local answer persistence", () => {
  it("serves and saves candidate vocabulary separately from the live dictionary", async () => {
    const dir = directory();
    const vocabulary = [
      ...words,
      { value: "testpaper", reading: "てすとぺーぱー", roles: ["suffix"] },
    ];
    const hash = createHash("sha256")
      .update(JSON.stringify(vocabulary))
      .digest("hex");
    const app = await launch(dir, vocabulary);
    const original = await launch(dir);
    expect(app.file).not.toBe(original.file);
    expect(app.html).toContain(`"corpusHash":"${hash}"`);
    expect(original.html).toContain(`"corpusHash":"${corpusHash}"`);
    const engine = createPairwiseEngine(vocabulary, hash, "test");
    const state = engine.answer(
      engine.validate({
        ...engine.empty(),
        review: { title: "候補" },
        questions: [
          {
            a: "kurukuru-testpaper",
            b: "kurukuru-otedama",
            mode: "suffix",
            answer: null,
          },
        ],
      }),
      "tie",
    );
    const response = await fetch(`${app.url}/api/state`, {
      method: "POST",
      headers: app.headers,
      body: JSON.stringify({ revision: 0, state }),
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(readFileSync(app.file, "utf8")).state).toEqual(state);
    expect(
      await (
        await fetch(`${original.url}/api/state`, {
          headers: original.headers,
        })
      ).json(),
    ).toEqual({ revision: 0, state: null });
  });
  it("saves ten imported answers, restores from disk, and preserves corrections", async () => {
    const dir = directory();
    const app = await launch(dir);
    const engine = createPairwiseEngine(words, corpusHash, "test");
    let state = engine.addRound(engine.empty());
    for (let i = 0; i < 10; i++)
      state = engine.answer(state, i % 2 ? "a" : "b");
    const save = await fetch(`${app.url}/api/state`, {
      method: "POST",
      headers: app.headers,
      body: JSON.stringify({ revision: 0, state }),
    });
    expect(save.status).toBe(200);
    const disk = JSON.parse(readFileSync(app.file, "utf8"));
    expect(disk.summary.answered).toBe(10);
    expect(disk.state).toEqual(state);
    const restarted = await launch(dir);
    const restored = await (
      await fetch(`${restarted.url}/api/state`, { headers: restarted.headers })
    ).json();
    expect(restored).toEqual({ revision: 1, state });
    state = engine.answer(engine.back(state), "skip");
    expect(
      (
        await fetch(`${app.url}/api/state`, {
          method: "POST",
          headers: app.headers,
          body: JSON.stringify({ revision: 1, state }),
        })
      ).status,
    ).toBe(200);
    expect(JSON.parse(readFileSync(app.file, "utf8")).summary.answered).toBe(9);
    expect(readdirSync(join(dir, "history"))).toHaveLength(2);
  });
  it("rejects stale writes, wrong dictionaries, and foreign origins without losing answers", async () => {
    const app = await launch(directory());
    const state = createPairwiseEngine(words, corpusHash, "test").addRound(
      createPairwiseEngine(words, corpusHash, "test").empty(),
    );
    const send = (revision: number, payload = state, extra = {}) =>
      fetch(`${app.url}/api/state`, {
        method: "POST",
        headers: { ...app.headers, ...extra },
        body: JSON.stringify({ revision, state: payload }),
      });
    expect((await send(0)).status).toBe(200);
    const original = readFileSync(app.file, "utf8");
    expect((await send(0)).status).toBe(409);
    expect((await send(1, { ...state, corpusHash: "stale" })).status).toBe(400);
    expect(
      (await send(1, state, { Origin: "https://example.com" })).status,
    ).toBe(403);
    expect((await fetch(`${app.url}/api/state`)).status).toBe(403);
    expect(readFileSync(app.file, "utf8")).toBe(original);
  });
});
