const { chromium, devices } = require('playwright');
const OUT = __dirname + '/shots';
const BASES = { after: 'http://localhost:5342', before: 'http://localhost:5343' };
async function openHelp(version, dev, game, browser) {
  const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.goto(BASES[version] + '/puzzles/' + game, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'メニュー' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}
// scroll container for the active tab
async function scrollerHandle(page) {
  return page.evaluateHandle(() => {
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    let el = panel;
    while (el) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) return el;
      el = el.parentElement;
    }
    return panel;
  });
}
async function shootScroll(page, prefix) {
  const h = await scrollerHandle(page);
  const info = await h.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  const files = [];
  let y = 0, i = 0;
  while (true) {
    await h.evaluate((el, y) => { el.scrollTop = y; }, y);
    await page.waitForTimeout(350);
    const f = `${prefix}-s${i}.png`;
    await page.screenshot({ path: f });
    files.push(f);
    if (y + info.ch >= info.sh - 2) break;
    y += Math.max(200, info.ch - 120);
    i++;
    if (i > 25) break;
  }
  await h.evaluate(el => { el.scrollTop = 0; });
  return { info, files };
}
module.exports = { chromium, devices, OUT, BASES, openHelp, scrollerHandle, shootScroll };
