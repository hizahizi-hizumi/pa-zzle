// メニューの図の文の、文節ごとの幅と列の幅を測る。
// 使い方: node menu-probe.mjs <URL> <width> <ゲームID...>
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
const [url, width, ...games] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone } = devices[width === "320" ? "iPhone SE" : "iPhone 13"];
for (const game of games) {
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await page.goto(`${url}/puzzles/${game}`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "操作" }).click();
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    const surface = panel.querySelector('[data-slot="dropdown-menu-static-surface"]');
    const out = [];
    const lead = surface.parentElement.querySelector("p");
    for (const block of [lead, ...surface.querySelectorAll("span.block")]) {
      const box = block.getBoundingClientRect();
      const phrases = [...block.querySelectorAll(":scope > span.inline-block")];
      const lines = new Map();
      for (const p of phrases) {
        const r = p.getBoundingClientRect();
        const key = Math.round(r.top);
        const line = lines.get(key) ?? { w: 0, text: "" };
        line.w = Math.max(line.w, r.right - box.left); line.text += p.textContent;
        lines.set(key, line);
      }
      const widths = phrases.map((p) => `${p.textContent}:${Math.round(p.getBoundingClientRect().width)}`);
      out.push(`${Math.round(box.width)} | ${[...lines.values()].map((l) => `${Math.round(l.w)} ${l.text}`).join(" / ")}  [${widths.join(" ")}]`);
    }
    return out;
  });
  console.log(`== ${game} ${width}`);
  for (const row of rows) console.log("  " + row);
  await context.close();
}
await browser.close();
