const { chromium, devices } = require('playwright');
const G = __dirname;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5342/puzzles/magic-square');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /ランダムに遊ぶ/ }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${G}/play-00.png` });
  const btns = await page.getByRole('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.innerText).slice(0, 30)));
  console.log(btns.join(' | '));
  await browser.close();
})();
