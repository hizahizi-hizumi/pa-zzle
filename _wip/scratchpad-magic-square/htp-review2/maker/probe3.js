const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /ランダムに遊ぶ/ }).click();
  await page.waitForTimeout(1500);
  console.log(page.url());
  const b = await page.locator('button').evaluateAll(els => els.slice(0,6).map(e => [e.getAttribute('aria-label'), e.textContent.trim().slice(0,20), e.getAttribute('aria-haspopup')]));
  console.log(b);
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(300);
  console.log(await page.locator('[role=menuitem]').allInnerTexts());
  await page.screenshot({ path: 'probe3.png' });
  await browser.close();
})();
