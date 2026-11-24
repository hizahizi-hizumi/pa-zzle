const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const OUT = __dirname + '/shots/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /No\.1/ }).click();
  await page.waitForTimeout(1500);
  const start = page.locator('aside[aria-label="選んだ問題"] button');
  console.log(await start.allTextContents());
  if (await start.count()) { await start.first().click(); await page.waitForTimeout(1500); }
  await page.screenshot({ path: OUT + 'sp-play.png' });
  const btns = await page.$$eval('button', (els) => els.map((e) => (e.getAttribute('aria-label') || '') + '|' + e.textContent.trim().slice(0, 20)));
  console.log(btns.slice(0, 40).join('\n'));
  await browser.close();
})();
