// ルール3の、マスの ✓ / ✕ の印と、数の字・手がかりの枠・隣のマスの重なりを測って撮る。
// 使い方: node cell-mark-probe.mjs <URL> <出力先>
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
const modes = [
  ["pc", { viewport: { width: 1280, height: 800 } }],
  ["iphone", iphone13],
  ["w320", { ...iphone13, viewport: { width: 320, height: 568 } }],
];
for (const [name, options] of modes) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(`${url}/puzzles/magic-square`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1500);
  const board = page.locator('[role="tabpanel"][data-state="active"] [role="group"][aria-label="魔方陣の盤面"]').nth(3);
  await board.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const rows = await board.evaluate((el) => {
    const result = [];
    const cells = [...el.querySelectorAll("button[aria-label]")];
    const hint = el.querySelector("[data-how-to-play-press-hint]");
    const hintRect = hint?.getBoundingClientRect();
    for (const cell of cells) {
      const mark = cell.querySelector("[data-how-to-play-verdict-mark]");
      if (!mark) continue;
      const m = mark.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const digit = [...cell.querySelectorAll("span")].find((s) => /^\d+$/.test(s.textContent ?? "") && s.childElementCount === 0);
      const range = document.createRange();
      range.selectNodeContents(digit);
      const t = range.getBoundingClientRect();
      const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      const others = cells.filter((o) => o !== cell).map((o) => o.getBoundingClientRect());
      result.push(`${cell.getAttribute("aria-label")}: mark ${m.width.toFixed(1)} gapToCellTop ${(c.top - m.bottom).toFixed(1)} digit ${overlap(m, t) ? "OVERLAP" : "clear"} otherCells ${others.some((o) => overlap(m, o)) ? "OVERLAP" : "clear"} hintFrame ${hintRect && overlap(m, hintRect) ? "OVERLAP" : "clear"} markTopFromBoardTop ${(m.top - el.getBoundingClientRect().top).toFixed(1)}`);
    }
    return result;
  });
  console.log(name); for (const r of rows) console.log("  " + r);
  const box = await board.boundingBox();
  await page.screenshot({ path: path.join(out, `rule3-marks-${name}.png`), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 40), width: box.width + 40, height: box.height + 60 } });
  await context.close();
}
await browser.close();
