// ルール2の数の札で、✓ / ✕ の印と数字の字の矩形が重なるかを測る。
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
for (const [name, options] of [["iphone", iphone13], ["w360", { ...iphone13, viewport: { width: 360, height: 640 } }], ["w320", { ...iphone13, viewport: { width: 320, height: 568 } }]]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(`${url}/puzzles/magic-square`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1500);
  const pad = page.locator('[role="tabpanel"][data-state="active"] [role="group"][aria-label="盤面の下に並んだ数"]').nth(2);
  await pad.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const result = await pad.evaluate((el) => {
    const rows = [];
    for (const button of el.querySelectorAll("button")) {
      const mark = button.querySelector("[data-how-to-play-verdict-mark]");
      if (!mark) { continue; }
      const range = document.createRange();
      const textNode = [button, ...button.querySelectorAll("*")].flatMap((n) => [...n.childNodes]).find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
      if (!textNode) continue;
      range.selectNodeContents(textNode);
      const t = range.getBoundingClientRect();
      const m = mark.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      const ox = Math.min(t.right, m.right) - Math.max(t.left, m.left);
      const oy = Math.min(t.bottom, m.bottom) - Math.max(t.top, m.top);
      rows.push(`${textNode.textContent}: card ${Math.round(b.width)}x${Math.round(b.height)} mark ${m.width.toFixed(1)} overlap ${ox > 0 && oy > 0 ? `${ox.toFixed(1)}x${oy.toFixed(1)}` : "none"} glyph top ${(t.top - b.top).toFixed(1)} right ${(b.right - t.right).toFixed(1)} markBottom ${(m.bottom - b.top).toFixed(1)} markLeft ${(b.right - m.left).toFixed(1)}`);
    }
    return rows;
  });
  console.log(name); for (const r of result) console.log("  " + r);
  const box = await pad.boundingBox();
  await page.screenshot({ path: path.join(out, `pad-marks-${name}.png`), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 110) } });
  await context.close();
}
await browser.close();
