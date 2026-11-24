// 遊び方の触れる例を押して、途中の姿を撮る。
// 使い方: node htp-touch.mjs <アプリの URL> <画像の出力先> <iphone|pc|narrow>
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
const log = [];

let shot = 0;
async function capture(name, target) {
  shot += 1;
  const file = path.join(out, `${String(shot).padStart(3, "0")}-${name}.png`);
  if (target) {
    await target.screenshot({ path: file, scale: "css" });
  } else {
    await page.screenshot({ path: file, scale: "css" });
  }
  console.log(file);
}

async function tap(locator) {
  if (mode === "pc") {
    await locator.click();
  } else {
    await locator.tap();
  }
}

await page.goto(`${url}/puzzles/magic-square`);
await page.locator("[aria-haspopup]").first().click();
await page.getByRole("menuitem", { name: "遊び方" }).click();
await page.waitForTimeout(800);

function ruleSection(text) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: text }) }).last();
}
function board(section, index = 0) {
  return section.getByRole("group", { name: "魔方陣の盤面" }).nth(index);
}
function cell(section, boardIndex, label) {
  return board(section, boardIndex).getByRole("button", { name: new RegExp(`^${label}`) });
}
function pad(section, index = 0) {
  return section.getByRole("group", { name: "盤面の下に並んだ数" }).nth(index);
}
function value(section, padIndex, number) {
  return pad(section, padIndex).getByRole("button", { name: String(number), exact: true });
}
async function hintedLabels(section) {
  return section.evaluate((element) =>
    [...element.querySelectorAll("[data-how-to-play-press-hint]")].map((hint) => {
      const owner = hint.closest("button");
      return owner?.getAttribute("aria-label") ?? owner?.textContent ?? "?";
    }),
  );
}
async function panelOf(section) {
  return section.locator("div.bg-muted").first();
}

// ルール1: 盤面ごとの数の並び。
const rule1 = ruleSection(/縦・横・斜めのどの列も/);
await rule1.scrollIntoViewIfNeeded();
await capture("rule1-initial", await panelOf(rule1));
log.push(`rule1 initial hint: ${JSON.stringify(await hintedLabels(rule1))}`);
await tap(cell(rule1, 0, "1行4列"));
await page.waitForTimeout(200);
log.push(`rule1 after select hint: ${JSON.stringify(await hintedLabels(rule1))}`);
await capture("rule1-selected", await panelOf(rule1));
await tap(value(rule1, 1, 12));
await page.waitForTimeout(60);
await capture("rule1-other-pad-60ms", await panelOf(rule1));
await page.waitForTimeout(400);
log.push(`rule1 after other pad: ${await board(rule1, 0).innerText()} / ${await board(rule1, 1).innerText()}`);
await tap(value(rule1, 0, 12));
await page.waitForTimeout(300);
await capture("rule1-replaced", await panelOf(rule1));
log.push(`rule1 after 12: ${await rule1.locator("figcaption").first().innerText()}`);

// ルール2: 置いた数がくぼみに変わるまで。
const rule2 = ruleSection(/まだ無い数/);
await rule2.scrollIntoViewIfNeeded();
await tap(cell(rule2, 0, "1行4列"));
await tap(value(rule2, 0, 11));
await page.waitForTimeout(200);
await capture("rule2-placed", await panelOf(rule2));
log.push(`rule2 after 11 hint: ${JSON.stringify(await hintedLabels(rule2))}`);
await tap(cell(rule2, 0, "1行2列"));
await page.waitForTimeout(200);
await capture("rule2-hints-done", await panelOf(rule2));
log.push(`rule2 after hints: ${JSON.stringify(await hintedLabels(rule2))}`);
await tap(value(rule2, 0, 6));
await page.waitForTimeout(400);
await capture("rule2-after-check-card", await panelOf(rule2));
log.push(`rule2 after 6: ${await board(rule2, 0).innerText()} / ${await rule2.locator("figcaption").first().innerText()}`);
await tap(cell(rule2, 0, "1行1列"));
await tap(value(rule2, 0, 7));
await page.waitForTimeout(400);
await capture("rule2-given-rejected", await panelOf(rule2));
log.push(`rule2 given rejected: ${await rule2.locator("figcaption").first().innerText()}`);

// ルール3: 弾かれたときの印のふくらみと、手がかりを出さないままにすること。
const rule3 = ruleSection(/最初から/);
await rule3.scrollIntoViewIfNeeded();
await capture("rule3-initial", await panelOf(rule3));
await tap(cell(rule3, 0, "1行1列"));
await page.waitForTimeout(200);
await capture("rule3-selected", await panelOf(rule3));
await tap(value(rule3, 0, 6));
await page.waitForTimeout(90);
await capture("rule3-rejected-90ms", await panelOf(rule3));
await page.waitForTimeout(400);
await capture("rule3-rejected-settled", await panelOf(rule3));
await tap(value(rule3, 0, 7));
await page.waitForTimeout(400);
log.push(`rule3 after 7 hint: ${JSON.stringify(await hintedLabels(rule3))}`);

// 操作: 置き方の例を解き終える。
await page.getByRole("tab", { name: "操作" }).click();
await page.waitForTimeout(300);
const place = ruleSection(/そのマスに/);
await place.scrollIntoViewIfNeeded();
await tap(cell(place, 0, "2行2列"));
await tap(value(place, 0, 2));
await tap(cell(place, 0, "3行3列"));
await tap(value(place, 0, 12));
await page.waitForTimeout(250);
await capture("place-clearing-250ms", await panelOf(place));
await page.waitForTimeout(2500);
await capture("place-cleared", await panelOf(place));
await tap(cell(place, 0, "1行2列"));
await page.waitForTimeout(200);
log.push(`place after clear pressed: ${await cell(place, 0, "1行2列").getAttribute("aria-pressed")}`);

// 操作: メモの例で待ったを押す。
const memo = ruleSection(/鉛筆のボタンを/);
await memo.scrollIntoViewIfNeeded();
await tap(cell(memo, 0, "1行3列"));
await tap(memo.getByRole("button", { name: "メモ" }));
await tap(value(memo, 0, 5));
await page.waitForTimeout(200);
await capture("memo-written", await panelOf(memo));
await tap(memo.getByRole("button", { name: "待った" }));
await page.waitForTimeout(200);
await capture("memo-undone", await panelOf(memo));
log.push(`memo after undo: ${await cell(memo, 0, "1行3列").getAttribute("aria-label")}`);
for (const number of [1, 2, 3, 5, 6]) {
  await tap(value(memo, 0, number));
}
await page.waitForTimeout(300);
await capture("memo-limit", await panelOf(memo));
log.push(`memo limit caption: ${await memo.locator("figcaption").first().innerText()}`);
await tap(cell(memo, 0, "1行1列"));
await tap(value(memo, 0, 9));
await page.waitForTimeout(400);
await capture("memo-on-placed", await panelOf(memo));
log.push(`memo on placed caption: ${await memo.locator("figcaption").first().innerText()}`);
const memoCleared = ruleSection(/同じ数のメモは/);
await memoCleared.scrollIntoViewIfNeeded();
await tap(cell(memoCleared, 0, "1行3列"));
await page.waitForTimeout(200);
log.push(`memo first example selection after second: ${await cell(memo, 0, "1行1列").getAttribute("aria-pressed")} / second: ${await cell(memoCleared, 0, "1行3列").getAttribute("aria-pressed")}`);
await capture("memo-cleared-selected", await panelOf(memoCleared));

// ルール1: 盤面ごとに選ぶ。
await page.getByRole("tab", { name: "ルール" }).click();
await page.waitForTimeout(300);
await rule1.scrollIntoViewIfNeeded();
await tap(cell(rule1, 1, "1行3列"));
await page.waitForTimeout(200);
await capture("rule1-both-selected", await panelOf(rule1));

writeFileSync(path.join(out, "log.txt"), log.join("\n"));
writeFileSync(path.join(out, "browser-errors.log"), errors.join("\n"));
console.log(log.join("\n"));
console.log(`errors=${errors.length}`);
await browser.close();
