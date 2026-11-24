const { chromium, devices } = require('playwright');
const OUT = __dirname + '/shots';
(async () => {
  const [base, game, dev] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(base + '/puzzles/' + game, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/explore-${game}-${dev}-0.png` });
  const btns = await page.locator('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(Boolean));
  console.log('buttons', btns);
  await browser.close();
})();
