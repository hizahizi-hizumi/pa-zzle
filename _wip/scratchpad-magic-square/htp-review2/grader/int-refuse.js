const { openHelp } = require('./lib');
const out = 'sp-int';
(async () => {
  const { browser, page, errors } = await openHelp('sp');
  await page.waitForTimeout(5000);
  const panel = page.locator('[role=tabpanel][data-state=active]');
  const s2 = panel.locator(':scope > div > section').nth(2);
  await s2.locator('.rounded-lg').first().evaluate(e => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await s2.locator('button[aria-label*="行"]').nth(0).tap();
  await page.waitForTimeout(500);
  const box = await s2.locator('.rounded-lg').first().boundingBox();
  const clip = { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 664 - box.y) };
  // record transforms
  const key7 = s2.locator('button:not([aria-label])').filter({ hasText: /^7$/ });
  const t0 = Date.now();
  key7.tap();
  for (const t of [20, 50, 90, 140, 200, 280, 400]) {
    while (Date.now() - t0 < t) await page.waitForTimeout(5);
    await page.screenshot({ path: `${out}/refuse-${t}.png`, clip });
    const tr = await s2.evaluate(s => Array.from(s.querySelectorAll('*')).map(e => getComputedStyle(e).transform).filter(x => x && x !== 'none' && !x.startsWith('matrix(1, 0, 0, 1, 0, 0)')).slice(0,5));
    console.log(t, JSON.stringify(tr));
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
