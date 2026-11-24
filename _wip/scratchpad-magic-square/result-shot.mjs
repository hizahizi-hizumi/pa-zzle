// ランダムの問題を盤面の読み上げ名から解き、結果画面の採点基準を撮る。
// 使い方: node result-shot.mjs <アプリの URL> <画像の出力先>
import { createRequire } from "node:module";
import path from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
function loadPlaywright() {
  const directories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [import.meta.url, ...directories.map((d) => path.join(d, "_"))]) {
    try { return createRequire(base)("playwright"); } catch {}
  }
  throw new Error("playwright not found");
}
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone13 } = devices["iPhone 13"];
const context = await browser.newContext(iphone13);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(`${url}/puzzles/magic-square`);
await page.getByRole("button", { name: /ランダムに遊ぶ/ }).tap();
await page.waitForTimeout(1500);
const labels = await page.locator("button[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const cells = labels.filter((l) => /^\d+行\d+列 /.test(l)).map((l) => {
  const [, r, c, v] = l.match(/^(\d+)行(\d+)列 (.+)$/);
  return { r: Number(r) - 1, c: Number(c) - 1, v: v === "空き" ? 0 : Number(v) };
});
const n = Math.round(Math.sqrt(cells.length));
const sum = (n * (n * n + 1)) / 2;
const grid = cells.map((cell) => cell.v);
const used = new Set(grid.filter(Boolean));
const empties = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
const lines = [];
for (let i = 0; i < n; i++) {
  lines.push([...Array(n)].map((_, j) => i * n + j));
  lines.push([...Array(n)].map((_, j) => j * n + i));
}
lines.push([...Array(n)].map((_, j) => j * n + j));
lines.push([...Array(n)].map((_, j) => j * n + (n - 1 - j)));
const ok = () => lines.every((line) => {
  const values = line.map((i) => grid[i]);
  const s = values.reduce((a, b) => a + b, 0);
  return values.includes(0) ? s < sum : s === sum;
});
function solve(k) {
  if (k === empties.length) return true;
  for (let v = 1; v <= n * n; v++) {
    if (used.has(v)) continue;
    grid[empties[k]] = v; used.add(v);
    if (ok() && solve(k + 1)) return true;
    grid[empties[k]] = 0; used.delete(v);
  }
  return false;
}
if (!solve(0)) throw new Error("unsolved");
console.log(`size=${n} empties=${empties.length}`);
for (const i of empties) {
  const cell = cells[i];
  await page.getByRole("button", { name: new RegExp(`^${cell.r + 1}行${cell.c + 1}列 `) }).tap();
  await page.getByRole("button", { name: String(grid[i]), exact: true }).tap();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(out, "result-0.png") });
await page.getByRole("button", { name: "採点内訳" }).tap();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, "result-breakdown.png") });
const criteria = page.getByText("列の端の色を変えなかった数は", { exact: false });
console.log("criteria count:", await criteria.count());
if (await criteria.count()) {
  await criteria.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "result-criteria.png") });
} else {
  const texts = await page.locator("button, summary").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent));
  console.log("buttons:", JSON.stringify(texts));
}
console.log(`errors=${errors.length}`, errors.join(" | "));
await browser.close();
