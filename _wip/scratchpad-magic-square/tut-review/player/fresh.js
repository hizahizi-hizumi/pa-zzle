const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: 'fresh-01-home.png' });
  await p.touchscreen.tap(40, 221);
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'fresh-02-detail.png' });
  await p.touchscreen.tap(276, 559);
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'fresh-03-play.png' });
  await b.close();
})();
