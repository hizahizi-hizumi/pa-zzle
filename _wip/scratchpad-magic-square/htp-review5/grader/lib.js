const { chromium, devices } = require('playwright');
const G = __dirname;
async function open(mode) {
  const browser = await chromium.launch();
  const ctx = mode === 'phone'
    ? await browser.newContext({ ...devices['iPhone 13'] })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5342/puzzles/magic-square');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(4500);
  return { browser, page, errors };
}
async function scroller(page) {
  return page.locator('[role=dialog] .scroll-pt-11').first();
}
async function setScroll(page, y) {
  await page.evaluate((y) => { const s = document.querySelector('[role=dialog] .scroll-pt-11'); s.scrollTop = y; }, y);
  await page.waitForTimeout(250);
  return page.evaluate(() => { const s = document.querySelector('[role=dialog] .scroll-pt-11'); return { top: s.scrollTop, h: s.scrollHeight, ch: s.clientHeight }; });
}
async function tab(page, name) {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(400);
}
module.exports = { open, scroller, setScroll, tab, G };
