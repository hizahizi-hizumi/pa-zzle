// 追加の確かめ: 印のマスを選んだ後の印以外の操作、決め手を見せる間の操作、レベル3を選んだときの完成、
// 本番のレベル1の盤面、プレイ中のメニューから開いたときの完成。
const { chromium } = require('playwright');
const fs = require('fs');

const dir = '/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/tut-review/maker/shots/extra2';
fs.mkdirSync(dir, { recursive: true });
const log = [];
function note(s) { log.push(s); console.log(s); }

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.type() + ': ' + m.text()); });
  let n = 0;
  async function shot(label) { n += 1; await page.screenshot({ path: `${dir}/${String(n).padStart(3, '0')}-${label}.png` }); }
  const dialog = () => page.getByRole('dialog', { name: '魔方陣' });
  const cell = (r, c) => dialog().locator(`button[aria-label^="${r}行${c}列 "]`);
  const num = (v) => dialog().getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true });
  async function message() { return (await dialog().locator('[aria-live=polite] p').innerText()).replace(/\n/g, ' / '); }
  async function cues() {
    return dialog().evaluate((root) => ({
      marks: root.querySelectorAll('[data-tutorial-cue="mark"]').length,
      recall: root.querySelectorAll('[data-tutorial-cue="recall"]').length,
      pointer: root.querySelectorAll('[data-tutorial-cue="pointer"]').length,
      spots: root.querySelectorAll('[data-tutorial-spotlight]').length,
    }));
  }
  async function state(label) { note(`[${label}] msg="${await message()}" cues=${JSON.stringify(await cues())}`); await shot(label); }

  async function openTutorialFromHome() {
    await page.getByRole('button', { name: 'メニュー' }).tap();
    await page.waitForTimeout(400);
    await page.getByText('遊び方').first().tap();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /チュートリアル/ }).first().tap();
    await page.waitForTimeout(800);
  }
  async function enter(r, c, v) { await cell(r, c).tap(); await page.waitForTimeout(120); await num(v).tap(); }

  await page.goto('http://127.0.0.1:5342/puzzles/magic-square');
  await page.waitForTimeout(1500);
  await shot('C-home');
  const lv = await page.locator('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || '') + '|' + e.textContent.trim()));
  note(JSON.stringify(lv));
  // C: レベル3を選んでからチュートリアルを開き、完成の一言と遊び始める操作を見る
  await page.locator('button', { hasText: 'レベル 3' }).first().tap();
  await page.waitForTimeout(600);
  await openTutorialFromHome();
  await dialog().getByRole('button', { name: 'はじめる' }).tap();
  await page.waitForTimeout(2000);
  for (const [r, c, v] of [[1, 1, 14], [1, 4, 11], [3, 1, 8], [2, 2, 2], [2, 3, 7], [3, 4, 1], [4, 2, 15], [4, 3, 10]]) {
    await enter(r, c, v);
    await page.waitForTimeout(1100);
  }
  await page.waitForTimeout(3500);
  const buttons = await dialog().locator('button').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  note(`[C-level3-completed] msg="${await message()}" buttons=${JSON.stringify(buttons.slice(-3))}`);
  await shot('C-level3-completed');
  await dialog().getByRole('button', { name: '閉じる' }).tap();
  await page.waitForTimeout(800);

  // D: 本番のレベル1の盤面
  await page.locator('button', { hasText: 'レベル 1' }).first().tap();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'ランダムに遊ぶ' }).tap();
  await page.waitForTimeout(2500);
  await shot('D-level1-start');
  const l1 = await page.locator('button[aria-label*="行"][aria-label*="列 "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  note(`[D-level1] ${JSON.stringify(l1)}`);

  // F: プレイ中のメニューからチュートリアルを開く
  await page.getByRole('button', { name: 'メニュー' }).tap();
  await page.waitForTimeout(500);
  await shot('F-play-menu');
  const menuItems = await page.locator('[role=menuitem]').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  note(`[F-menu] ${JSON.stringify(menuItems)}`);
  const tut = page.getByRole('menuitem', { name: /チュートリアル/ });
  if (await tut.count()) {
    await tut.first().tap();
    await page.waitForTimeout(800);
    await dialog().getByRole('button', { name: 'はじめる' }).tap();
    await page.waitForTimeout(2000);
    for (const [r, c, v] of [[1, 1, 14], [1, 4, 11], [3, 1, 8], [2, 2, 2], [2, 3, 7], [3, 4, 1], [4, 2, 15], [4, 3, 10]]) {
      await enter(r, c, v);
      await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(3500);
    const b2 = await dialog().locator('button').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter(Boolean));
    note(`[F-play-completed] msg="${await message()}" buttons=${JSON.stringify(b2.slice(-3))}`);
    await shot('F-play-completed');
  }
  note('ERRORS: ' + JSON.stringify(errors));
  fs.writeFileSync(`${dir}/log.txt`, log.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
