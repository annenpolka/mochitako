import { resolve } from "node:path";
import { evaluationServer } from "./evaluation-server.ts";

const port = Number(process.env.MOCHITAKO_EVAL_PORT ?? 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid port");
const { server, file } = evaluationServer(
  resolve("evaluation/results"),
  process.argv[2],
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Open http://127.0.0.1:${port}/\nAnswers: ${file}`);
});
