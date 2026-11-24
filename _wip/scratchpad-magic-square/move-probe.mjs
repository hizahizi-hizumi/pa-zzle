// 縦に積んだ面で1つの例を変えた後、別の例の上から指で送る・弾かれる手・Tab で、元に戻すボタンが動かないかを確かめる。
// 使い方: node move-probe.mjs <URL> <出力先>
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
const log = [];
async function open(page, game) {
  await page.goto(`${url}/puzzles/${game}`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1500);
}
async function buttonInfo(panel) {
  return panel.evaluate((el) => {
    const button = el.querySelector('button[aria-label="例を元に戻す"]');
    const figures = [...el.querySelectorAll("figure")].map((f) => f.getBoundingClientRect());
    const b = button.getBoundingClientRect();
    const nearest = figures.findIndex((f) => b.top < f.bottom + 40 && b.bottom > f.top - 40);
    return { enabled: !button.disabled, top: Math.round(b.top), besideFigure: nearest };
  });
}
// スマートフォン: スライドパズルのルールの縦の対
{
  const context = await browser.newContext(iphone13);
  const page = await context.newPage();
  await open(page, "slide-puzzle");
  const panel = page.locator('[role="tabpanel"][data-state="active"] [data-reset-button-placement]').nth(1);
  const figures = panel.locator("figure");
  await figures.nth(0).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const hint = figures.nth(0).locator("[data-how-to-play-press-hint]").first();
  const box = await hint.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(800);
  log.push(`slide phone after change f0: ${JSON.stringify(await buttonInfo(panel))}`);
  const f1 = await figures.nth(1).boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = f1.x + f1.width / 2;
  const y = Math.min(f1.y + 60, 600);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(600);
  log.push(`slide phone after scroll on f1: ${JSON.stringify(await buttonInfo(panel))}`);
  await page.screenshot({ path: path.join(out, "slide-phone-after-scroll.png") });
  const hint1 = figures.nth(1).locator("[data-how-to-play-press-hint]").first();
  if (await hint1.count()) {
    await hint1.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const b1 = await hint1.boundingBox();
    await page.touchscreen.tap(b1.x + b1.width / 2, b1.y + b1.height / 2);
    await page.waitForTimeout(800);
    log.push(`slide phone after change f1: ${JSON.stringify(await buttonInfo(panel))}`);
  }
  await context.close();
}
// PC: バイナリパズルのルールの縦の対で Tab を送る
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await open(page, "takuzu");
  const panel = page.locator('[role="tabpanel"][data-state="active"] [data-reset-button-placement]').nth(1);
  const figures = panel.locator("figure");
  const hint = figures.nth(0).locator("[data-how-to-play-press-hint]").first();
  await hint.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const box = await hint.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  log.push(`takuzu pc after change f0: ${JSON.stringify(await buttonInfo(panel))} placement=${await panel.getAttribute("data-reset-button-placement")}`);
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(50);
    const inF1 = await figures.nth(1).evaluate((el) => el.contains(document.activeElement));
    if (inF1) { log.push(`takuzu pc tab reached f1 after ${i + 1}`); break; }
  }
  await page.waitForTimeout(300);
  log.push(`takuzu pc after tab into f1: ${JSON.stringify(await buttonInfo(panel))}`);
  await page.screenshot({ path: path.join(out, "takuzu-pc-after-tab.png") });
  await context.close();
}
// PC: ウォーターソートの横の対で、右の例の弾かれる手
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await open(page, "water-sort");
  const panel = page.locator('[role="tabpanel"][data-state="active"] [data-reset-button-placement]').nth(3);
  const figures = panel.locator("figure");
  const hint = figures.nth(0).locator("[data-how-to-play-press-hint]").first();
  await hint.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const box = await hint.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const before = await buttonInfo(panel);
  const bottles = figures.nth(1).locator("button");
  const count = await bottles.count();
  await bottles.nth(count - 1).click();
  await page.waitForTimeout(600);
  log.push(`water-sort pc pair: placement=${await panel.getAttribute("data-reset-button-placement")} before=${JSON.stringify(before)} afterRightTap=${JSON.stringify(await buttonInfo(panel))}`);
  await page.screenshot({ path: path.join(out, "water-sort-pc-pair.png") });
  await context.close();
}
console.log(log.join("\n"));
await browser.close();
