import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const watch = process.argv.includes("--watch");

const entries = {
  background: "src/background/index.ts",
  content: "src/card/index.ts",
  popup: "src/popup/index.ts",
  offscreen: "src/offscreen/index.ts",
  picker: "src/picker/index.ts",
};

const entryPoints = Object.fromEntries(Object.entries(entries).filter(([, file]) => existsSync(file)));
const statics = ["manifest.json", "popup.html", "offscreen.html"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of statics) {
  if (existsSync(file)) await cp(file, `dist/${file}`);
}
if (existsSync("icons")) await cp("icons", "dist/icons", { recursive: true });

const options = {
  entryPoints,
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
  sourcemap: false,
  logLevel: "info",
};

if (Object.keys(entryPoints).length > 0) {
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    console.log("watching...");
  } else {
    await build(options);
  }
}