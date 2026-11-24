// 手を離した後の受け付けない操作（最初から置いてある数のマスに数を押す・マスを選ばずに数を押す）への反応を、本番と比べる。
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  async function animCount() {
    return page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.tagName === 'BUTTON').map((a) => (a.effect.target.getAttribute('aria-label') || a.effect.target.textContent.trim())));
  }
  // 本番
  await page.goto('http://127.0.0.1:5342/puzzles/magic-square');
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: 'レベル 1' }).first().tap();
  await page.getByRole('button', { name: 'ランダムに遊ぶ' }).tap();
  await page.waitForTimeout(2000);
  const pnum = (v) => page.getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true });
  await pnum(7).tap();
  await page.waitForTimeout(40);
  console.log('play: number without cell ->', JSON.stringify(await animCount()));
  await page.locator('button[aria-label^="1行2列 "]').tap();
  await page.waitForTimeout(100);
  await pnum(7).tap();
  await page.waitForTimeout(40);
  console.log('play: given cell + number ->', JSON.stringify(await animCount()));
  // チュートリアルの手を離した後
  await page.goto('http://127.0.0.1:5342/puzzles/magic-square/tutorial');
  await page.waitForTimeout(1500);
  const dialog = page.getByRole('dialog', { name: '魔方陣' });
  await dialog.getByRole('button', { name: 'はじめる' }).tap();
  await page.waitForTimeout(2000);
  const cell = (r, c) => dialog.locator(`button[aria-label^="${r}行${c}列 "]`);
  const num = (v) => dialog.getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true });
  for (const [r, c, v] of [[1, 1, 14], [1, 4, 11], [3, 1, 8], [2, 2, 2], [2, 3, 7]]) {
    await cell(r, c).tap(); await page.waitForTimeout(120); await num(v).tap(); await page.waitForTimeout(1100);
  }
  await num(1).tap();
  await page.waitForTimeout(40);
  console.log('tutorial free: number without cell ->', JSON.stringify(await animCount()));
  await page.screenshot({ path: 'shots/extra3/free-num-without-cell.png' });
  await cell(1, 2).tap();
  await page.waitForTimeout(100);
  await num(1).tap();
  await page.waitForTimeout(40);
  console.log('tutorial free: given cell + number ->', JSON.stringify(await animCount()));
  console.log('msg', (await dialog.locator('[aria-live=polite] p').innerText()).replace(/\n/g, ' / '));
  await page.screenshot({ path: 'shots/extra3/free-given-cell-num.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
