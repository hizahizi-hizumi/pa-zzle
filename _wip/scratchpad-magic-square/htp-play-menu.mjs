// プレイ中の「その他の操作」から遊び方を開いて撮る。
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
function loadPlaywright() {
  const directories = (existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
    .map((entry) => path.join("/opt", entry.name, "lib", "node_modules"));
  for (const base of [import.meta.url, ...directories.map((d) => path.join(d, "_"))]) {
    try { return createRequire(base)("playwright"); } catch {}
  }
  throw new Error("playwright not found");
}
const [url, out] = process.argv.slice(2);
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
await page.screenshot({ path: path.join(out, "play-start.png") });
await page.getByRole("button", { name: "その他の操作" }).tap();
await page.getByRole("menuitem", { name: "遊び方" }).tap();
await page.waitForTimeout(5500);
await page.screenshot({ path: path.join(out, "play-menu-howtoplay.png") });
await page.getByRole("tab", { name: "採点" }).tap();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, "play-menu-score.png") });
await page.getByRole("button", { name: "閉じる" }).tap();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, "play-after-close.png") });
console.log(`errors=${errors.length}`, errors.join(" | "));
await browser.close();
