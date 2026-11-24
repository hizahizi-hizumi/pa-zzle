const { chromium, devices } = require('playwright');
const G = __dirname;
(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 360]) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5342/puzzles/magic-square');
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'メニュー' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: '遊び方' }).click();
    await page.waitForTimeout(1500);
    const p = page.locator('[role=tabpanel][data-state=active] div.rounded-lg.bg-muted').nth(1);
    await p.scrollIntoViewIfNeeded();
    await p.getByRole('button', { name: /^1行4列/ }).tap();
    await page.waitForTimeout(400);
    await p.screenshot({ path: `${G}/used-reset-w${width}.png` });
    const info = await p.evaluate((el) => {
      const reset = el.querySelector('button[aria-label="例を元に戻す"]').getBoundingClientRect();
      const cap = [...el.querySelectorAll('figcaption span')].filter(s => getComputedStyle(s).visibility !== 'hidden' && s.innerText.trim()).map(s => { const r = s.getBoundingClientRect(); return [s.innerText.replace(/\n/g, ' '), Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)]; });
      return { reset: [Math.round(reset.left), Math.round(reset.right), Math.round(reset.top), Math.round(reset.bottom)], cap };
    });
    console.log(width, JSON.stringify(info));
    await ctx.close();
  }
  await browser.close();
})();
