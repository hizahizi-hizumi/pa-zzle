const { chromium, ctxOptions, BASES } = require('./lib');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOptions('phone'));
  const page = await ctx.newPage();
  await page.goto(BASES.after + '/puzzles/takuzu', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const names = await page.evaluate(() => [...document.querySelectorAll('button, a')].map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30) + ' <' + b.tagName + '>'));
  console.log(names.join('\n'));
  await browser.close();
})();
