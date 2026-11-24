// ほかのゲームの遊び方をゲームのホームから開き、各タブを最後まで撮る（共通の部品を直した後の崩れの確かめ）。
// 使い方: node htp-others.mjs <アプリの URL> <画像の出力先> <iphone|pc> <ゲームID...>
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
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
const [url, out, mode, ...games] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone13 } = devices["iPhone 13"];
const { defaultBrowserType: _s, ...iphoneSE } = devices["iPhone SE"];
const options = mode === "pc" ? { viewport: { width: 1280, height: 800 } } : mode === "narrow" ? iphoneSE : iphone13;
const summary = [];
for (const game of games) {
  const dir = path.join(out, game);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try {
    await page.goto(`${url}/puzzles/${game}`);
    await page.locator("[aria-haspopup]").first().click();
    await page.getByRole("menuitem", { name: "遊び方" }).click();
    await page.waitForTimeout(6000);
    let shot = 0;
    for (const tab of ["ルール", "操作", "採点"]) {
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForTimeout(400);
      const handle = await page.evaluateHandle(() => {
        let element = document.querySelector('[role="tabpanel"][data-state="active"]');
        while (element) {
          const { overflowY } = getComputedStyle(element);
          if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) return element;
          element = element.parentElement;
        }
        return document.scrollingElement;
      });
      await handle.evaluate((element) => { element.scrollTop = 0; });
      await page.waitForTimeout(200);
      for (let index = 0; index < 20; index += 1) {
        shot += 1;
        await page.screenshot({ path: path.join(dir, `${String(shot).padStart(2, "0")}-${tab}-${index}.png`) });
        const moved = await handle.evaluate((element) => {
          const before = element.scrollTop;
          element.scrollTop = before + element.clientHeight - 80;
          return element.scrollTop !== before;
        });
        if (!moved) break;
        await page.waitForTimeout(250);
      }
    }
    summary.push(`${game}: shots=${shot} errors=${errors.length} ${errors.join(" | ")}`);
  } catch (error) {
    summary.push(`${game}: failed ${error.message.split("\n")[0]}`);
  }
  await context.close();
}
writeFileSync(path.join(out, `summary-${mode}.txt`), summary.join("\n"));
console.log(summary.join("\n"));
await browser.close();
