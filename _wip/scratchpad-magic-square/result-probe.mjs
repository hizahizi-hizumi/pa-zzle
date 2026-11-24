// プレイ画面の盤面と数の札の読み上げ名を並べる。
import { createRequire } from "node:module";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
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
const [url] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone13 } = devices["iPhone 13"];
const context = await browser.newContext(iphone13);
const page = await context.newPage();
await page.goto(`${url}/puzzles/magic-square`);
const homeButtons = await page.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent));
console.log("home:", JSON.stringify(homeButtons));
await page.getByRole("button", { name: /ランダムに遊ぶ/ }).tap();
await page.waitForTimeout(1500);
const all = await page.locator("button, [role=gridcell], [role=button]").evaluateAll((els) => els.map((e) => `${e.tagName}|${e.getAttribute("role")}|${e.getAttribute("aria-label")}|${e.textContent}`));
console.log(all.join("\n"));
console.log(page.url());
await browser.close();
