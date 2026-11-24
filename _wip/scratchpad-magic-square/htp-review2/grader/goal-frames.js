const { openHelp } = require('./lib');
(async () => {
  const { browser, page } = await openHelp('sp');
  const t0 = Date.now() - 500;
  const top = page.locator('[role=dialog] .isolate').first();
  const b = await top.boundingBox();
  for (let t = 600; t <= 4200; t += 200) {
    while (Date.now() - t0 < t) await page.waitForTimeout(5);
    await page.screenshot({ path: `goalframes/f-${String(t).padStart(5,'0')}.png`, clip: { x: 0, y: 150, width: 390, height: 330 } });
  }
  await browser.close();
})();
