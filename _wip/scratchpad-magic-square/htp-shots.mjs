// 遊び方を狭い画面と動きを減らす設定で開き、各タブを最後まで撮る。
// 使い方: node htp-shots.mjs <アプリの URL> <画像の出力先> <narrow|reduced|iphone|pc>
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function loadPlaywright() {
  const directories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [import.meta.url, ...directories.map((d) => path.join(d, "_"))]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  throw new Error("playwright not found");
}

const [url, out, mode] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _webkitOnly, ...iphone13 } = devices["iPhone 13"];
const contextOptions = {
  narrow: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  reduced: { ...iphone13, reducedMotion: "reduce" },
  iphone: { ...iphone13 },
  pc: { viewport: { width: 1280, height: 800 } },
}[mode];
const context = await browser.newContext(contextOptions);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
});

let shot = 0;
async function capture(name) {
  shot += 1;
  const file = path.join(out, `${String(shot).padStart(3, "0")}-${name}.png`);
  await page.screenshot({ path: file, scale: "css" });
  console.log(file);
}

await page.goto(`${url}/puzzles/magic-square`);
await page.locator("[aria-haspopup]").first().click();
await page.getByRole("menuitem", { name: "遊び方" }).click();
const openedAt = Date.now();

if (mode === "reduced") {
  for (const at of [150, 500, 900, 1600, 3000]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - openedAt)));
    await capture(`goal-${at}ms`);
  }
} else {
  await page.waitForTimeout(500);
  await capture("goal-start");
  await page.waitForTimeout(4500);
  await capture("goal-end");
}

for (const tab of ["ルール", "操作", "採点"]) {
  await page.getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(300);
  const handle = await page.evaluateHandle(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    let element = panel;
    while (element) {
      const { overflowY } = getComputedStyle(element);
      if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) {
        return element;
      }
      element = element.parentElement;
    }
    return document.scrollingElement;
  });
  await handle.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  for (let index = 0; index < 30; index += 1) {
    await capture(`${tab}-${index}`);
    const moved = await handle.evaluate((element) => {
      const before = element.scrollTop;
      element.scrollTop = before + element.clientHeight - 80;
      return element.scrollTop !== before;
    });
    if (!moved) break;
    await page.waitForTimeout(250);
  }
}

writeFileSync(path.join(out, "browser-errors.log"), errors.join("\n"));
console.log(`errors=${errors.length}`);
await browser.close();
