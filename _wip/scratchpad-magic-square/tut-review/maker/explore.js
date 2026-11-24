const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('http://127.0.0.1:5342/puzzles/magic-square');
  await page.waitForTimeout(3000);
  const dir = '/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/tut-review/maker/shots';
  await page.screenshot({ path: dir + '/x-home.png' });
  const buttons = await page.locator('button, a').evaluateAll(els => els.map(e => (e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent.trim())).slice(0, 80)));
  console.log(buttons.join('\n'));
  console.log(page.url());
  console.log(errors.join('\n'));
  await browser.close();
})();
