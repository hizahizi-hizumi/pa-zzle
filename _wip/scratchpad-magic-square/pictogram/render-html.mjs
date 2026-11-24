// HTML を Chromium で開いてページ全体を撮る。使い方: node render-html.mjs <html> <png> [幅]
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const dirs = [...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
  ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : []).filter((e) => e.isDirectory() && e.name.startsWith("node")).map((e) => path.join("/opt", e.name, "lib", "node_modules"))];
let playwright;
for (const base of [import.meta.url, ...dirs.map((d) => path.join(d, "_"))]) { try { playwright = createRequire(base)("playwright"); break; } catch {} }
const [html, png, width = "1200"] = process.argv.slice(2);
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 600 }, deviceScaleFactor: 2 });
await page.goto(`file://${path.resolve(html)}`);
await page.screenshot({ path: png, fullPage: true });
await browser.close();
