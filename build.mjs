// Builds the static site: dist/index.html + dist/app.js, and copies both to the repo root
// so the root folder is deployable as-is with no build step.
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  target: ["es2020"],
  alias: { "grok/canvas": "./src/grok-canvas-shim.ts" },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "dist/app.js",
  logLevel: "info",
});
copyFileSync("src/index.html", "dist/index.html");
copyFileSync("dist/app.js", "app.js");
copyFileSync("src/index.html", "index.html");
