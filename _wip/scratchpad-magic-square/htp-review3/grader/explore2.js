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
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + 'sp-01-menu.png' });
  const items = await page.$$eval('[role=menuitem], [role=menu] button, [role=dialog] button', els => els.map(e => e.textContent.trim()));
  console.log('menu items', items);
  await page.getByText('遊び方', { exact: true }).click();
  for (const t of [100, 300, 600, 1000, 1500, 2000, 3000, 4500, 6000, 8000]) {
    await page.waitForTimeout(t === 100 ? 100 : 0);
  }
  // capture timeline
  const start = Date.now();
  const times = [50, 250, 500, 900, 1400, 2000, 3000, 4500, 6500, 9000];
  for (const t of times) {
    const w = t - (Date.now() - start);
    if (w > 0) await page.waitForTimeout(w);
    await page.screenshot({ path: OUT + `sp-02-open-${String(t).padStart(5,'0')}.png` });
  }
  const html = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]') || document.body;
    return d.outerHTML.length;
  });
  console.log('dialog html len', html);
  const outline = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    if (!d) return 'no dialog';
    const res = [];
    d.querySelectorAll('h1,h2,h3,h4,[role=tab],button,p,li').forEach(e => {
      const r = e.getBoundingClientRect();
      res.push(`${e.tagName}${e.getAttribute('role')?'['+e.getAttribute('role')+']':''} ${e.getAttribute('aria-label')||''} | ${e.textContent.trim().slice(0,60)} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return res.join('\n');
  });
  console.log(outline);
  console.log(errs.join('\n'));
  await browser.close();
})();
