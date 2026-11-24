const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'probe-home.png' });
  const buttons = await page.locator('button, a').evaluateAll(els => els.map(e => (e.getAttribute('aria-label')||'') + ' | ' + e.textContent.trim().slice(0,40)));
  console.log(buttons.join('\n'));
  console.log('errors', errors);
  await browser.close();
})();
