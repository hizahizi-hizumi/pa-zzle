const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errors.push(m.type()+': ' + m.text()); });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'sp-01-menu.png' });
  const items = await page.locator('[role=menuitem], [role=menu] button').evaluateAll(els => els.map(e => e.innerText.trim()));
  console.log(items);
  await page.getByText('遊び方', { exact: true }).click();
  for (const t of [100, 300, 600, 1000, 1500, 2500, 4000, 6000]) {
    await page.waitForTimeout(t === 100 ? 100 : 0);
  }
  const shots = [100, 400, 800, 1500, 2500, 4000, 6000, 9000];
  let last = 0;
  for (const t of shots) { await page.waitForTimeout(t - last); last = t; await page.screenshot({ path: `sp-02-open-${t}.png` }); }
  const html = await page.evaluate(() => document.querySelector('[role=dialog]')?.outerHTML.length);
  console.log('dialog html len', html);
  const texts = await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText);
  console.log(texts);
  console.log(errors.join('\n'));
  await browser.close();
})();
