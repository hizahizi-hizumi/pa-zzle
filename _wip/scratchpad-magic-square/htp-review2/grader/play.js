const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /レベル 1/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: /^遊ぶ$/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'play-01.png' });
  const btns = await page.locator('button').evaluateAll(es => es.map(e => (e.getAttribute('aria-label') || '') + ':' + e.innerText.trim().slice(0, 20)));
  console.log(btns.join(' | '));
  const more = page.getByRole('button', { name: /メニュー|その他|…/ }).first();
  if (await more.count()) { await more.click(); await page.waitForTimeout(500); await page.screenshot({ path: 'play-02-menu.png' }); }
  await browser.close();
})();
