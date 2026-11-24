const { chromium, devices } = require('playwright');
const DIR = __dirname;
async function openHelp(kind, extra = {}) {
  const browser = await chromium.launch();
  let opts;
  if (kind === 'sp') opts = { ...devices['iPhone 13'] };
  else if (kind === 'sptall') opts = { ...devices['iPhone 13'], viewport: { width: 390, height: extra.height || 3200 } };
  else opts = { viewport: { width: 1280, height: extra.height || 800 }, deviceScaleFactor: extra.dsf || 1 };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(400);
  await page.getByText('遊び方', { exact: true }).click();
  await page.waitForTimeout(500);
  return { browser, ctx, page, errors };
}
module.exports = { openHelp, DIR };
