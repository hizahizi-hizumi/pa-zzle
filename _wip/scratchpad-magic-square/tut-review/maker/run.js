// 使い方: node run.js <name> <width> <height> <reduced:0|1> <touch:0|1>
const { chromium } = require('playwright');
const fs = require('fs');

const [name, w, h, reduced, touch] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);
const useTouch = touch === '1';
const dir = `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/tut-review/maker/shots/${name}`;
fs.mkdirSync(dir, { recursive: true });
const log = [];
function note(s) { log.push(s); console.log(s); }

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: useTouch,
    isMobile: useTouch,
    deviceScaleFactor: useTouch ? 2 : 1,
  });
  const page = await context.newPage();
  if (reduced === '1') {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });

  let shotNo = 0;
  async function shot(label) {
    shotNo += 1;
    const file = `${dir}/${String(shotNo).padStart(3, '0')}-${label}.png`;
    await page.screenshot({ path: file });
    return file;
  }
  async function burst(label, count = 12, interval = 150) {
    for (let i = 0; i < count; i += 1) {
      await shot(`${label}-b${String(i).padStart(2, '0')}`);
      await page.waitForTimeout(interval);
    }
  }
  async function press(locator) {
    if (useTouch) {
      await locator.tap();
    } else {
      await locator.click();
    }
  }
  const dialog = () => page.getByRole('dialog', { name: '魔方陣' });
  async function message() {
    const p = dialog().locator('[aria-live=polite] p');
    return (await p.innerText()).replace(/\n/g, ' / ');
  }
  function cell(r, c) { return dialog().locator(`button[aria-label^="${r}行${c}列 "]`); }
  function num(v) { return dialog().getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true }); }
  async function cues() {
    return dialog().evaluate((root) => {
      const marks = [...root.querySelectorAll('[data-tutorial-cue="mark"]')].map((m) => m.closest('button')?.getAttribute('aria-label'));
      const pointers = [...root.querySelectorAll('[data-tutorial-cue="pointer"]')].map((m) => m.closest('button')?.getAttribute('aria-label'));
      const spots = root.querySelectorAll('[data-tutorial-spotlight]').length;
      const recall = root.querySelectorAll('[data-tutorial-cue="recall"]').length;
      return { marks, pointers, spots, recall };
    });
  }
  async function state(label) {
    const m = await message();
    const c = await cues();
    const hint = await dialog().getByRole('button', { name: 'ヒント' }).count();
    note(`[${label}] msg="${m}" marks=${JSON.stringify(c.marks)} pointers=${JSON.stringify(c.pointers)} spotlights=${c.spots} recall=${c.recall} hint=${hint}`);
    await shot(label);
  }
  async function overflowCheck(label) {
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const msgBox = await dialog().locator('[aria-live=polite] p').boundingBox();
    const board = await dialog().getByRole('group', { name: '魔方陣の盤面' }).boundingBox();
    const pad = await dialog().getByRole('group', { name: '数の欄' }).boundingBox();
    note(`[${label}] scrollWidth=${r.sw} clientWidth=${r.cw} msg=${JSON.stringify(msgBox)} board=${JSON.stringify(board)} pad=${JSON.stringify(pad)}`);
  }

  await page.goto('http://127.0.0.1:5342/puzzles/magic-square');
  await page.waitForTimeout(1500);
  await press(page.getByRole('button', { name: 'メニュー' }));
  await page.waitForTimeout(500);
  await press(page.getByText('遊び方').first());
  await page.waitForTimeout(1200);
  await shot('howto');
  await press(page.getByRole('button', { name: /チュートリアル/ }).first());
  await page.waitForTimeout(400);
  await burst('open', 8, 150);
  await state('intro');
  await overflowCheck('intro');

  // 入口から最初の手順
  await press(dialog().getByRole('button', { name: 'はじめる' }));
  await burst('start', 14, 150);
  await state('step1');
  await overflowCheck('step1');

  // 手順に無い手: 数を先に押す・印の無いマス・印のマスで違う数
  await press(num(14));
  await page.waitForTimeout(250);
  await state('step1-num-before-select');
  await press(cell(1, 4));
  await page.waitForTimeout(250);
  await state('step1-other-cell');
  await press(cell(1, 1));
  await page.waitForTimeout(300);
  await state('step1-selected');
  await press(num(1));
  await page.waitForTimeout(250);
  await state('step1-wrong-num');
  await press(num(14));
  await burst('step1-placed', 10, 150);
  await state('step2');

  // 横の列: 考えずに印を押す → 何か押す
  await press(cell(1, 4));
  await page.waitForTimeout(300);
  await state('step2-selected');
  await press(num(15));
  await page.waitForTimeout(400);
  await state('step2-wrong15');
  // 同じ数を押して外す
  await press(num(15));
  await page.waitForTimeout(400);
  await state('step2-removed');
  await press(num(1));
  await page.waitForTimeout(400);
  await state('step2-wrong1');
  // 違反中にほかのマスを押す
  await press(cell(4, 2));
  await page.waitForTimeout(300);
  await state('step2-violation-other-cell');
  await press(num(11));
  await burst('step2-placed', 10, 150);
  await state('step3');

  // 縦の列: 10 を入れて 横の列の超過と縦の列の不一致を同時に出す
  await press(cell(3, 1));
  await page.waitForTimeout(300);
  await state('step3-selected');
  await press(num(10));
  await page.waitForTimeout(400);
  await state('step3-wrong10');
  await press(num(8));
  await burst('step3-placed', 10, 150);
  await state('step4');

  // 斜めの列
  await press(cell(2, 2));
  await page.waitForTimeout(300);
  await state('step4-selected');
  await press(num(15));
  await page.waitForTimeout(400);
  await state('step4-wrong15');
  await press(num(2));
  await burst('step4-placed', 10, 150);
  await state('step5');

  // 探す手順: 決まらないマス → 数 → 決まるマス
  await press(cell(4, 3));
  await page.waitForTimeout(300);
  await state('step5-undecided');
  await press(num(10));
  await page.waitForTimeout(300);
  await state('step5-undecided-num');
  await press(cell(3, 4));
  await page.waitForTimeout(300);
  await state('step5-decided-34');
  await press(cell(2, 3));
  await page.waitForTimeout(300);
  await state('step5-decided-23');
  await press(cell(4, 2));
  await page.waitForTimeout(300);
  await state('step5-decided-42');
  await press(num(10));
  await page.waitForTimeout(400);
  await state('step5-wrong10');
  await press(num(15));
  await burst('step5-placed', 10, 150);
  await state('free');

  // 手を離した後: 待っても手がかりを出さないこと
  await page.waitForTimeout(6000);
  await state('free-after-wait');
  await press(dialog().getByRole('button', { name: 'ヒント' }));
  await page.waitForTimeout(400);
  await state('free-hint');
  // 違う数で違反
  await press(cell(2, 3));
  await page.waitForTimeout(300);
  await state('free-selected-23');
  await press(num(10));
  await page.waitForTimeout(400);
  await state('free-wrong10');
  await press(cell(3, 4));
  await page.waitForTimeout(300);
  await state('free-select-34-while-violation');
  await press(num(1));
  await page.waitForTimeout(400);
  await state('free-correct-while-violation');
  await press(cell(2, 3));
  await page.waitForTimeout(300);
  await state('free-reselect-23');
  await press(num(7));
  await page.waitForTimeout(500);
  await state('free-fixed');
  // 完成
  await press(cell(4, 3));
  await page.waitForTimeout(200);
  await press(num(10));
  await burst('solve', 16, 150);
  await page.waitForTimeout(3000);
  await state('completed');
  await overflowCheck('completed');
  const finishButtons = await dialog().locator('footer button').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  note(`finish buttons: ${JSON.stringify(finishButtons)}`);

  note('ERRORS: ' + JSON.stringify(errors));
  fs.writeFileSync(`${dir}/log.txt`, log.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
