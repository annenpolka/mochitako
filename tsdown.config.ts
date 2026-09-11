import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/index.ts",
    format: "esm",
    dts: true,
    outExtensions: () => ({ js: ".mjs", dts: ".d.mts" }),
  },
  {
    entry: "src/cli.ts",
    format: "esm",
    dts: false,
    outExtensions: () => ({ js: ".mjs" }),
    outputOptions: {
      banner: "#!/usr/bin/env node",
    },
  },
]);
