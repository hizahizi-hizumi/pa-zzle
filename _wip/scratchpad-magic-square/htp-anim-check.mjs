// ルール3で弾かれたときに走るアニメーションを調べる。
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
await page.goto(`${url}/puzzles/magic-square`);
await page.locator("[aria-haspopup]").first().click();
await page.getByRole("menuitem", { name: "遊び方" }).click();
await page.waitForTimeout(800);
const rule3 = page.locator("section").filter({ has: page.getByRole("heading", { name: /最初から/ }) }).last();
await rule3.scrollIntoViewIfNeeded();
await rule3.getByRole("group", { name: "魔方陣の盤面" }).getByRole("button", { name: /^1行1列/ }).tap();
await page.waitForTimeout(200);
await page.evaluate(() => {
  window.__anims = [];
  const original = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    window.__anims.push({ cls: this.className?.baseVal ?? this.className, keyframes: JSON.stringify(keyframes), duration: options?.duration });
    return original.call(this, keyframes, options);
  };
});
await rule3.getByRole("group", { name: "盤面の下に並んだ数" }).getByRole("button", { name: "6", exact: true }).tap();
await page.waitForTimeout(40);
const panel = rule3.locator("div.bg-muted").first();
for (const at of [0, 1, 2]) {
  await panel.screenshot({ path: path.join(out, `pulse-${at}.png`), scale: "css", animations: "allow" });
}
console.log(JSON.stringify(await page.evaluate(() => window.__anims), null, 1));
await browser.close();
