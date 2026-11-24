const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const OUT = __dirname + '/shots/';
async function openHelp(kind, opts = {}) {
  const browser = await chromium.launch();
  const ctxOpts = kind === 'sp' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  if (opts.reducedMotion) ctxOpts.reducedMotion = 'reduce';
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByText('遊び方', { exact: true }).click();
  await page.waitForTimeout(opts.wait ?? 9000);
  return { browser, page, errs };
}
async function scroller(page) {
  return await page.evaluateHandle(() => {
    const d = document.querySelector('[role=dialog]');
    const all = [d, ...d.querySelectorAll('*')];
    const cands = all.filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2; });
    return cands[0] || document.scrollingElement;
  });
}
async function scrollInfo(page) {
  return await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const all = [d, ...d.querySelectorAll('*')];
    const cands = all.filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2; });
    const s = cands[0];
    if (!s) return null;
    return { tag: s.tagName, cls: s.className, sh: s.scrollHeight, ch: s.clientHeight, top: s.scrollTop };
  });
}
async function setScroll(page, y) {
  await page.evaluate((y) => {
    const d = document.querySelector('[role=dialog]');
    const all = [d, ...d.querySelectorAll('*')];
    const cands = all.filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2; });
    cands[0].scrollTop = y;
  }, y);
}
module.exports = { openHelp, scrollInfo, setScroll, OUT, devices, chromium };
