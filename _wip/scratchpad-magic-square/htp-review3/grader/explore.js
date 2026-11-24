const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const OUT = __dirname + '/shots/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+': '+m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUT + 'sp-00-home.png' });
  const btns = await page.$$eval('button, a', els => els.map(e => (e.tagName + ' ' + (e.getAttribute('aria-label')||'') + ' | ' + e.textContent.trim()).slice(0,80)));
  console.log(btns.join('\n'));
  console.log(errs.join('\n'));
  await browser.close();
})();
