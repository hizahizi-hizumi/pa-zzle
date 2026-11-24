// 採点の行とメニューの図の文の、行ごとの幅を測る。text-wrap を替えて比べる。
// 使い方: node wrap-probe.mjs <URL> <wrap: none|pretty|balance> <ゲームID...>
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
const [url, wrap, ...games] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone13 } = devices[process.env.DEVICE ?? "iPhone 13"];
for (const game of games) {
  const context = await browser.newContext(iphone13);
  const page = await context.newPage();
  await page.goto(`${url}/puzzles/${game}`);
  if (wrap !== "none") {
    await page.addStyleTag({ content: `[role="tabpanel"] p { text-wrap: ${wrap} !important; }` });
  }
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1500);
  for (const tab of ["操作", "採点"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(300);
    const lines = await page.evaluate(() => {
      const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
      const result = [];
      for (const p of panel.querySelectorAll("p, li > p, span.block")) {
        const phrases = [...p.querySelectorAll(":scope > span.inline-block, :scope > span > span.inline-block")];
        if (phrases.length < 3) continue;
        const rows = new Map();
        for (const phrase of phrases) {
          const r = phrase.getBoundingClientRect();
          const key = Math.round(r.top);
          const row = rows.get(key) ?? { left: r.left, right: r.right, text: "" };
          row.left = Math.min(row.left, r.left); row.right = Math.max(row.right, r.right); row.text += phrase.textContent;
          rows.set(key, row);
        }
        const box = p.getBoundingClientRect();
        result.push([...rows.values()].map((row) => `${Math.round(row.right - row.left)}/${Math.round(box.width)} ${row.text}`).join(" | "));
      }
      return result;
    });
    console.log(`== ${game} ${tab} (${wrap})`);
    for (const line of lines) if (line.split(" | ").length >= 2) console.log("  " + line);
  }
  await context.close();
}
await browser.close();
