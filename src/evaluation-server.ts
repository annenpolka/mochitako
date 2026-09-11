import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { words } from "./dictionary.ts";
import { evaluationPage } from "./evaluation-page.ts";
import type { PairState, PairWord } from "./pairwise.ts";
import { createPairwiseEngine } from "./pairwise.ts";

export function evaluationServer(
  directory: string,
  seed = "mochitako-v1",
  vocabulary: PairWord[] = words,
) {
  const corpusHash = createHash("sha256")
    .update(JSON.stringify(vocabulary))
    .digest("hex");
  mkdirSync(directory, { recursive: true });
  const key = createHash("sha256")
    .update(`${corpusHash}:${seed}`)
    .digest("hex");
  const file = join(directory, `${key}.json`);
  const engine = createPairwiseEngine(vocabulary, corpusHash, seed);
  const token = randomUUID();
  const html = evaluationPage(seed, token, vocabulary);
  function load(): { revision: number; state: PairState | null } {
    if (!existsSync(file)) return { revision: 0, state: null };
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (!Number.isInteger(saved.revision) || saved.revision < 1)
      throw Error("Invalid saved revision");
    return { revision: saved.revision, state: engine.validate(saved.state) };
  }
  load(); // Fail at startup rather than overwrite corrupt existing answers.
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    };
    const address = server.address();
    const host =
      typeof address === "object" && address ? `127.0.0.1:${address.port}` : "";
    if (
      req.headers.host !== host ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      respond(403, { error: "アクセス元が一致しません。" });
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (req.url !== "/api/state") {
      respond(404, { error: "Not found" });
      return;
    }
    if (req.headers["x-mochitako-token"] !== token) {
      respond(403, { error: "画面を再読み込みしてください。" });
      return;
    }
    try {
      if (req.method === "GET") {
        respond(200, load());
        return;
      }
      if (req.method !== "POST") {
        respond(405, { error: "Method not allowed" });
        return;
      }
      if (req.headers["content-type"] !== "application/json") {
        respond(415, { error: "JSON required" });
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5_000_000) {
          respond(413, { error: "回答データが大きすぎます。" });
          return;
        }
        chunks.push(chunk);
      }
      let next: PairState;
      let revision: number;
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        next = engine.validate(input.state);
        revision = input.revision;
        if (!Number.isInteger(revision) || revision < 0)
          throw Error("Invalid revision");
      } catch {
        respond(400, {
          error: "回答データの形式・辞書・シードが一致しません。",
        });
        return;
      }
      // No await between reading the revision and atomic replacement.
      const current = load();
      if (revision !== current.revision) {
        respond(409, {
          error:
            "別の画面で回答が更新されました。再読み込みしてから続けてください。",
        });
        return;
      }
      const saved = {
        revision: revision + 1,
        state: next,
        updatedAt: new Date().toISOString(),
        summary: engine.stats(next),
      };
      const json = `${JSON.stringify(saved, null, 2)}\n`;
      const history = join(directory, "history");
      mkdirSync(history, { recursive: true });
      writeFileSync(
        join(history, `${key}-${saved.revision}-${randomUUID()}.json`),
        json,
        { flag: "wx" },
      );
      const temporary = `${file}.${randomUUID()}.tmp`;
      writeFileSync(temporary, json, { flag: "wx" });
      renameSync(temporary, file);
      respond(200, { revision: saved.revision, state: next });
    } catch {
      respond(500, {
        error:
          "ファイルに保存できませんでした。回答を進めず、再試行してください。",
      });
    }
  });
  return { server, file };
}
