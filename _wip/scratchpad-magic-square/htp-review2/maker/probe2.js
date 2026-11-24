const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  const items = await page.locator('[role=menuitem]').evaluateAll(els => els.map(e => e.outerHTML.slice(0,200)));
  console.log(items);
  await page.locator('[role=menuitem]', { hasText: '遊び方' }).click();
  await page.waitForTimeout(1500);
  console.log(page.url());
  const dialogs = await page.locator('[role=dialog]').evaluateAll(els => els.map(e => [e.getAttribute('aria-labelledby'), e.innerText.slice(0,80)]));
  console.log(dialogs);
  await page.screenshot({ path: 'probe2.png' });
  await browser.close();
})();
