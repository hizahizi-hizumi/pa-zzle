const { chromium } = require('playwright');
const dir = '/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/tut-review/maker/shots/extra3';
require('fs').mkdirSync(dir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5342/puzzles/magic-square');
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: 'レベル 1' }).first().tap();
  await page.getByRole('button', { name: 'ランダムに遊ぶ' }).tap();
  await page.waitForTimeout(2000);
  const b = await page.locator('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || '') + '|' + e.textContent.trim()).slice(0, 6));
  console.log(JSON.stringify(b));
  await page.locator('button[aria-label]').filter({ hasText: '' }).nth(1).tap().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: dir + '/menu.png' });
  const items = await page.locator('[role=menuitem], [role=dialog] button').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  console.log(JSON.stringify(items));
  await page.getByText('遊び方').first().tap(); await page.waitForTimeout(1200); const tut = page.getByRole('button', { name: /チュートリアル/ });
  console.log('tut count', await tut.count());
  if (await tut.count()) {
    await tut.first().tap();
    await page.waitForTimeout(1000);
    const dialog = page.getByRole('dialog', { name: '魔方陣' });
    await dialog.getByRole('button', { name: 'はじめる' }).tap();
    await page.waitForTimeout(2000);
    const cell = (r, c) => dialog.locator(`button[aria-label^="${r}行${c}列 "]`);
    const num = (v) => dialog.getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true });
    for (const [r, c, v] of [[1, 1, 14], [1, 4, 11], [3, 1, 8], [2, 2, 2], [2, 3, 7], [3, 4, 1], [4, 2, 15], [4, 3, 10]]) {
      await cell(r, c).tap(); await page.waitForTimeout(120); await num(v).tap(); await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(3500);
    console.log('msg', (await dialog.locator('[aria-live=polite] p').innerText()).replace(/\n/g, ' / '));
    const b2 = await dialog.locator('button').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter(Boolean));
    console.log(JSON.stringify(b2.slice(-3)));
    await page.screenshot({ path: dir + '/play-completed.png' });
    await dialog.getByRole('button', { name: b2[b2.length - 2] }).tap();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: dir + '/back-to-play.png' });
  }
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
