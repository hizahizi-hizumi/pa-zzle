const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errors.push(m.type()+': ' + m.text()); });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'sp-00-home.png' });
  const btns = await page.locator('button, a').evaluateAll(els => els.map(e => (e.tagName + ' ' + (e.getAttribute('aria-label')||'') + ' | ' + e.innerText.trim().slice(0,40))));
  console.log(btns.join('\n'));
  console.log(errors.join('\n'));
  await browser.close();
})();
