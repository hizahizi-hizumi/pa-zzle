const { chromium, devices } = require('playwright');
const G = __dirname;
(async () => {
  const browser = await chromium.launch();
  const mode = process.argv[2] || 'phone';
  const ctx = mode === 'phone'
    ? await browser.newContext({ ...devices['iPhone 13'] })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5342/puzzles/magic-square');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${G}/${mode}-00-home.png` });
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${G}/${mode}-01-menu.png` });
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  // capture opening animation frames
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${G}/${mode}-02-open-${i}.png` });
  }
  console.log(errors.join('\n'));
  const html = await page.evaluate(() => document.body.innerText);
  require('fs').writeFileSync(`${G}/${mode}-text.txt`, html);
  await browser.close();
})();
