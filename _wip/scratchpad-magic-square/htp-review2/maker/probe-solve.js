// 置き方の例で残りの空きも埋めて解き終えたとき、その後に押したときの反応を確かめる。
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // 効果音の呼び出しを数える
  await page.addInitScript(() => {
    window.__sounds = [];
    const orig = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype.start;
    if (orig) window.AudioBufferSourceNode.prototype.start = function (...a) { window.__sounds.push(performance.now()); return orig.apply(this, a); };
  });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  const dlg = page.getByRole('dialog', { name: /遊び方/ });
  await dlg.waitFor();
  await page.waitForTimeout(500);
  await dlg.getByRole('tab', { name: '操作' }).click();
  await page.waitForTimeout(300);
  const op1 = dlg.locator('[role=tabpanel][data-state=active]').getByRole('listitem').nth(0);
  const cell = (r, c) => op1.getByRole('group', { name: '魔方陣の盤面' }).getByRole('button', { name: new RegExp(`^${r}行${c}列`) });
  const val = (v) => op1.getByRole('group', { name: '盤面の下に並んだ数' }).getByRole('button', { name: String(v), exact: true });
  await op1.scrollIntoViewIfNeeded();
  await cell(2, 2).click(); await page.waitForTimeout(150);
  await val(2).click(); await page.waitForTimeout(300);
  await cell(3, 3).click(); await page.waitForTimeout(150);
  await val(12).click(); await page.waitForTimeout(600);
  await op1.screenshot({ path: 'probe-solve-1-solved.png' });
  const before = await page.evaluate(() => window.__sounds.length);
  console.log('cell 3,3 pressed after solve:', await cell(3, 3).getAttribute('aria-pressed'));
  await cell(1, 2).click(); await page.waitForTimeout(150);
  console.log('cell 1,2 pressed after solve select:', await cell(1, 2).getAttribute('aria-pressed'));
  await val(4).click(); await page.waitForTimeout(60);
  await op1.screenshot({ path: 'probe-solve-2-press-after-solved-mid.png' });
  await page.waitForTimeout(400);
  console.log('cell 1,2 label after pressing 4:', await cell(1, 2).getAttribute('aria-label'));
  const disabled = await op1.getByRole('group', { name: '盤面の下に並んだ数' }).locator('button:not([disabled])').allInnerTexts();
  console.log('enabled tablets after solve:', disabled);
  console.log('sound starts (approx):', before, '->', await page.evaluate(() => window.__sounds.length));
  await op1.screenshot({ path: 'probe-solve-3-after.png' });
  await browser.close();
})();
