// 魔方陣の遊び方を3つの組み合わせで開き、タブを最後まで撮り、例とゴールを押して撮る。
const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = __dirname;
const URL = "http://localhost:5342/puzzles/magic-square";
const configName = process.argv[2] ?? "pc";
const configs = {
  pc: { context: { viewport: { width: 1280, height: 800 } }, reduced: false, touch: false },
  iphone: { context: { ...devices["iPhone 13"] }, reduced: false, touch: true },
  "iphone-reduced": { context: { ...devices["iPhone 13"] }, reduced: true, touch: true },
  w320: { context: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, reduced: false, touch: true },
};
const config = configs[configName];
const dir = path.join(OUT, configName);
fs.mkdirSync(dir, { recursive: true });
const log = [];
function note(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  log.push(line);
  console.log(line);
}

let shot = 0;
async function snap(page, name, target) {
  shot += 1;
  const file = path.join(dir, `${String(shot).padStart(3, "0")}-${name}.png`);
  if (target) {
    await target.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file });
  }
  return file;
}

async function press(locator) {
  if (config.touch) {
    await locator.tap();
  } else {
    await locator.click();
  }
}

function dialog(page) {
  return page.getByRole("dialog", { name: /遊び方/ });
}

async function scroller(page) {
  // 送る領域: 狭い画面は格子全体、広い画面は表示中のタブの中身。
  return page.evaluateHandle(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const all = [...dlg.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1 && el.offsetParent !== null && s.visibility !== "hidden";
    });
    return all[all.length - 1] ?? null;
  });
}

async function scrollShots(page, label) {
  const handle = await scroller(page);
  const info = await handle.evaluate((el) => el && { h: el.scrollHeight, c: el.clientHeight });
  if (!info) {
    await snap(page, `${label}-only`);
    return;
  }
  const step = Math.floor(info.c * 0.8);
  let y = 0;
  let index = 0;
  for (;;) {
    await handle.evaluate((el, top) => (el.scrollTop = top), y);
    await page.waitForTimeout(250);
    await snap(page, `${label}-scroll${index}`);
    index += 1;
    if (y + info.c >= info.h) break;
    y += step;
  }
  await handle.evaluate((el) => (el.scrollTop = 0));
}

async function readCaptions(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
    return [...panel.querySelectorAll("figure")].map((figure) => {
      const caption = figure.querySelector("figcaption");
      if (!caption) return "(no caption)";
      const shown = [...caption.querySelectorAll('[aria-hidden="false"]')].map((l) => l.textContent);
      return (shown.join(" / ") || caption.innerText).replace(/\s+/g, " ");
    });
  });
}

async function hinted(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="tabpanel"][data-state="active"] [data-how-to-play-press-hint]')].map((h) => {
      const b = h.closest("button");
      return b ? b.getAttribute("aria-label") || b.textContent.trim() : "?";
    }),
  );
}

async function openTab(page, name) {
  await press(dialog(page).getByRole("tab", { name }));
  await page.waitForTimeout(300);
}

function ruleItems(page) {
  return dialog(page).locator('[role="tabpanel"][data-state="active"] > div > *');
}

async function cellOf(scope, boardIndex, row, col) {
  return scope.getByRole("group", { name: "魔方陣の盤面" }).nth(boardIndex).getByRole("button", { name: new RegExp(`^${row}行${col}列`) });
}

function valueOf(scope, v) {
  return scope.getByRole("group", { name: "盤面の下に並んだ数" }).getByRole("button", { name: String(v), exact: true });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext(config.context);
  const page = await context.newPage();
  if (config.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // ゲームのホームのメニューから遊び方を開く
  await press(page.getByRole("button", { name: "メニュー" }));
  await page.waitForTimeout(400);
  await snap(page, "home-menu");
  await press(page.getByRole("menuitem", { name: "遊び方" }));
  const t0 = Date.now();
  await dialog(page).waitFor();
  for (const at of config.reduced ? [150, 500, 900, 1500] : [150, 900, 1500, 2300, 3200, 4200, 6500]) {
    const wait = at - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await snap(page, `open-goal-${at}ms`);
  }
  const goal = dialog(page).getByRole("img", { name: "ゴールの盤面" });
  // 見せ直して、途中で盤面を押して飛ばす
  const replay = dialog(page).getByRole("button", { name: "始まりの盤面から見せ直す" });
  note("replay enabled after settle:", await replay.isEnabled());
  await press(replay);
  await page.waitForTimeout(1200);
  await snap(page, "goal-replay-mid");
  const skip = dialog(page).getByLabel("埋め終えた姿まで飛ばす");
  note("skip target count during replay:", await skip.count());
  if (await skip.count()) {
    await press(skip);
    await page.waitForTimeout(200);
    await snap(page, "goal-after-skip");
    note("skip target after skip:", await skip.count());
  }
  await page.waitForTimeout(800);
  await snap(page, "goal-settled-after-skip");

  // ルールのタブを最後まで
  await scrollShots(page, "rules");
  note("rules captions initial:", await readCaptions(page));
  note("rules hints initial:", await hinted(page));

  const rules = ruleItems(page);
  note("rule items:", await rules.count());
  // ルール1: 列の合計
  const rule1 = rules.nth(0);
  await rule1.scrollIntoViewIfNeeded();
  await snap(page, "rule1-initial", rule1);
  await press(await cellOf(rule1, 0, 1, 4));
  await page.waitForTimeout(250);
  await snap(page, "rule1-selected", rule1);
  note("rule1 hints after select:", await hinted(page));
  await press(valueOf(rule1, 13));
  await page.waitForTimeout(60);
  await snap(page, "rule1-pressed13-mid", rule1);
  await page.waitForTimeout(500);
  await snap(page, "rule1-pressed13", rule1);
  note("rule1 captions after 13:", await readCaptions(page));
  note("rule1 hints after 13:", await hinted(page));
  // 2つ目の盤面の空きを埋める
  await press(await cellOf(rule1, 1, 1, 3));
  await page.waitForTimeout(200);
  await snap(page, "rule1-board2-selected", rule1);
  await press(valueOf(rule1, 1));
  await page.waitForTimeout(400);
  await snap(page, "rule1-board2-filled", rule1);
  note("rule1 captions after board2 fill:", await readCaptions(page));
  // 元に戻す
  await press(rule1.getByRole("button", { name: "例を元に戻す" }));
  await page.waitForTimeout(400);
  await snap(page, "rule1-reset", rule1);
  note("rule1 captions after reset:", await readCaptions(page));
  // 選ばずに数を押す
  await press(valueOf(rule1, 13));
  await page.waitForTimeout(80);
  await snap(page, "rule1-no-select-press-mid", rule1);
  await page.waitForTimeout(400);

  // ルール2: 1回ずつ
  const rule2 = rules.nth(1);
  await rule2.scrollIntoViewIfNeeded();
  await snap(page, "rule2-initial", rule2);
  await press(await cellOf(rule2, 0, 1, 4));
  await page.waitForTimeout(200);
  await snap(page, "rule2-selected", rule2);
  await press(valueOf(rule2, 11));
  await page.waitForTimeout(400);
  await snap(page, "rule2-placed11", rule2);
  note("rule2 captions after 11:", await readCaptions(page));
  await press(await cellOf(rule2, 0, 1, 1));
  await page.waitForTimeout(300);
  await snap(page, "rule2-select-other", rule2);
  // くぼみの札を押す（押せない）
  note("rule2 value 4 disabled:", await valueOf(rule2, 4).isDisabled());

  // ルール3: 最初から置いてある数
  const rule3 = rules.nth(2);
  await rule3.scrollIntoViewIfNeeded();
  await snap(page, "rule3-initial", rule3);
  await press(await cellOf(rule3, 0, 1, 1));
  await page.waitForTimeout(250);
  await snap(page, "rule3-selected14", rule3);
  note("rule3 hints after select:", await hinted(page));
  await press(valueOf(rule3, 6));
  await page.waitForTimeout(60);
  await snap(page, "rule3-pressed6-mid", rule3);
  await page.waitForTimeout(500);
  await snap(page, "rule3-pressed6", rule3);
  note("rule3 hints after 6 rejected:", await hinted(page));
  await press(valueOf(rule3, 7));
  await page.waitForTimeout(500);
  await snap(page, "rule3-pressed7-after-rejected", rule3);
  note("rule3 hints after another rejected 7:", await hinted(page));
  await press(await cellOf(rule3, 0, 1, 3));
  await page.waitForTimeout(200);
  await press(valueOf(rule3, 6));
  await page.waitForTimeout(400);
  await snap(page, "rule3-replace-placed", rule3);
  note("rule3 captions after replace:", await readCaptions(page));

  // 操作のタブ
  await openTab(page, "操作");
  await scrollShots(page, "ops");
  const ops = dialog(page).locator('[role="tabpanel"][data-state="active"] li');
  note("ops li count:", await ops.count());
  // 置き方
  const op1 = dialog(page).locator('[role="tabpanel"][data-state="active"]').getByRole("listitem").nth(0);
  await op1.scrollIntoViewIfNeeded();
  await snap(page, "op1-initial", op1);
  await press(await cellOf(op1, 0, 2, 2));
  await page.waitForTimeout(250);
  await snap(page, "op1-selected", op1);
  note("op1 hints after select:", await hinted(page));
  await press(valueOf(op1, 2));
  await page.waitForTimeout(400);
  await snap(page, "op1-placed2", op1);
  // 置き換え
  const op2 = dialog(page).locator('[role="tabpanel"][data-state="active"]').getByRole("listitem").nth(1);
  await op2.scrollIntoViewIfNeeded();
  await snap(page, "op2-initial", op2);
  await press(await cellOf(op2, 0, 1, 4));
  await page.waitForTimeout(200);
  await snap(page, "op2-selected", op2);
  await press(valueOf(op2, 11));
  await page.waitForTimeout(300);
  await snap(page, "op2-replaced", op2);
  note("op2 hints after replace:", await hinted(page));
  await press(valueOf(op2, 11));
  await page.waitForTimeout(300);
  await snap(page, "op2-removed", op2);
  note("op2 hints after remove:", await hinted(page));
  // メモ
  const op3 = dialog(page).locator('[role="tabpanel"][data-state="active"]').getByRole("listitem").nth(2);
  await op3.scrollIntoViewIfNeeded();
  await snap(page, "op3-initial", op3);
  await press(await cellOf(op3, 0, 1, 3));
  await page.waitForTimeout(200);
  await snap(page, "op3-selected", op3);
  await press(op3.getByRole("button", { name: "メモ" }));
  await page.waitForTimeout(200);
  await snap(page, "op3-memo-on", op3);
  await press(valueOf(op3, 5));
  await page.waitForTimeout(200);
  await snap(page, "op3-memo5", op3);
  for (const v of [6, 7, 8, 9]) {
    await press(valueOf(op3, v));
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(60);
  await snap(page, "op3-memo-5th-rejected", op3);
  note("op3 cell after 5 memos:", await (await cellOf(op3, 0, 1, 3)).getAttribute("aria-label"));
  await press(op3.getByRole("button", { name: "例を元に戻す" }));
  await page.waitForTimeout(300);
  await snap(page, "op3-reset", op3);
  // メモが消える
  const op4 = dialog(page).locator('[role="tabpanel"][data-state="active"]').getByRole("listitem").nth(3);
  await op4.scrollIntoViewIfNeeded();
  await snap(page, "op4-initial", op4);
  await press(await cellOf(op4, 0, 1, 3));
  await page.waitForTimeout(200);
  await press(valueOf(op4, 5));
  await page.waitForTimeout(300);
  await snap(page, "op4-placed5", op4);

  // 採点のタブ
  await openTab(page, "採点");
  await scrollShots(page, "score");
  // ルールのタブに戻す
  await openTab(page, "ルール");
  await page.waitForTimeout(300);
  await snap(page, "back-to-rules");
  note("rules captions after tab back:", await readCaptions(page));
  // 閉じて開き直す
  await press(dialog(page).getByRole("button", { name: "閉じる" }));
  await page.waitForTimeout(500);
  await press(page.getByRole("button", { name: "メニュー" }));
  await page.waitForTimeout(300);
  await press(page.getByRole("menuitem", { name: "遊び方" }));
  await dialog(page).waitFor();
  await page.waitForTimeout(200);
  await snap(page, "reopen-200ms");
  note("rules captions after reopen:", await readCaptions(page));
  await page.waitForTimeout(config.reduced ? 1200 : 6500);
  await press(dialog(page).getByRole("button", { name: "閉じる" }));
  await page.waitForTimeout(500);

  // プレイ中のメニューから
  await press(page.getByRole("button", { name: /ランダムに遊ぶ/ }));
  await page.waitForTimeout(1500);
  await snap(page, "play-start");
  // 盤面の空きを1つ選んで、置ける数を1つ置く
  const board = page.getByRole("group", { name: "魔方陣の盤面" });
  const empties = board.getByRole("button", { name: /空き/ });
  note("play empties:", await empties.count());
  await press(empties.first());
  await page.waitForTimeout(200);
  const pad = page.getByRole("group", { name: "盤面の下に並んだ数" });
  const avail = pad.locator("button:not([disabled])");
  await press(avail.first());
  await page.waitForTimeout(300);
  await press(avail.nth(1));
  await page.waitForTimeout(300);
  await snap(page, "play-midway");
  await press(page.getByRole("button", { name: "その他の操作" }));
  await page.waitForTimeout(400);
  await snap(page, "play-menu");
  await press(page.getByRole("menuitem", { name: "遊び方" }));
  await dialog(page).waitFor();
  await page.waitForTimeout(config.reduced ? 1500 : 6500);
  await snap(page, "play-howto-open");
  await openTab(page, "操作");
  await snap(page, "play-howto-ops");
  await openTab(page, "採点");
  await snap(page, "play-howto-score");
  await press(dialog(page).getByRole("button", { name: "閉じる" }));
  await page.waitForTimeout(500);
  await snap(page, "play-after-close");

  note("errors:", errors);
  fs.writeFileSync(path.join(dir, "log.txt"), log.join("\n"));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(dir, "log.txt"), log.join("\n") + "\nERROR " + e.stack);
  process.exit(1);
});
