// 採点のタブの流れの図を、指定の幅で撮り、図の下の流れの行の数を測る。
// 使い方: node flow-shot.mjs <URL> <出力先> <幅> <ゲームID...>
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
const [url, out, width, ...games] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone } = devices["iPhone 13"];
for (const game of games) {
  const context = await browser.newContext({ ...iphone, viewport: { width: Number(width), height: 700 } });
  const page = await context.newPage();
  await page.goto(`${url}/puzzles/${game}`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "採点" }).click();
  await page.waitForTimeout(400);
  const panels = page.locator('[role="tabpanel"][data-state="active"] div.rounded-lg.border-\\(length\\:--border-width-normal\\)');
  const count = await panels.count();
  for (let i = 0; i < count; i += 1) {
    const panel = panels.nth(i);
    await panel.scrollIntoViewIfNeeded();
    const info = await panel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const captions = [...el.querySelectorAll("figcaption > span:first-child")].map((s) => {
        const tops = new Set([...s.querySelectorAll("span.inline-block")].map((p) => Math.round(p.getBoundingClientRect().top)));
        return `${s.textContent}(${tops.size}行)`;
      });
      return `${Math.round(r.width)}x${Math.round(r.height)} ${captions.join(" / ")}`;
    });
    console.log(`${game} flow${i}: ${info}`);
    await panel.screenshot({ path: path.join(out, `${game}-w${width}-flow${i}.png`) });
  }
  await context.close();
}
await browser.close();
