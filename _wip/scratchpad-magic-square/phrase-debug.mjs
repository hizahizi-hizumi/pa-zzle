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
const [url, game, needle] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone } = devices["iPhone 13"];
const context = await browser.newContext(iphone);
const page = await context.newPage();
await page.goto(`${url}/puzzles/${game}`);
await page.locator("[aria-haspopup]").first().click();
await page.getByRole("menuitem", { name: "遊び方" }).click();
await page.waitForTimeout(1200);
await page.getByRole("tab", { name: "採点" }).click();
await page.waitForTimeout(500);
const info = await page.evaluate((needle) => {
  const p = [...document.querySelectorAll('[role="tabpanel"] p')].find((el) => el.textContent.includes(needle));
  const spans = [...p.querySelectorAll(":scope > span.inline-block")];
  return { width: p.clientWidth, spans: spans.map((s) => `${s.textContent}@${s.offsetTop}:${Math.round(s.getBoundingClientRect().right - p.getBoundingClientRect().left)}`) };
}, needle);
console.log(JSON.stringify(info, null, 1));
await browser.close();
